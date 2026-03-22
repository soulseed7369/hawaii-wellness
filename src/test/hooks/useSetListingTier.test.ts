/**
 * Tests for tier sync: useSetListingTier hook.
 * Revenue-critical: ensures tier changes propagate correctly
 * and featured slots are created/removed atomically.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';

// ── Mock supabase ────────────────────────────────────────────────────────────

const mockRpc = vi.fn();
const mockUpdate = vi.fn();
const mockUpsert = vi.fn();
const mockDelete = vi.fn();
const mockEq = vi.fn();

const chainable = (terminal: vi.Mock) => ({
  eq: (...args: any[]) => { mockEq(...args); return { eq: mockEq }; },
});

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...args: any[]) => mockRpc(...args),
    from: (table: string) => ({
      update: (data: any) => {
        mockUpdate(table, data);
        return {
          eq: (...args: any[]) => {
            mockEq(...args);
            return Promise.resolve({ error: null });
          },
        };
      },
      upsert: (data: any, opts: any) => {
        mockUpsert(table, data, opts);
        return Promise.resolve({ error: null });
      },
      delete: () => {
        mockDelete(table);
        return {
          eq: (...args: any[]) => {
            mockEq(...args);
            return Promise.resolve({ error: null });
          },
        };
      },
    }),
  },
  hasSupabase: true,
}));

import { useSetListingTier } from '@/hooks/useAdmin';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('useSetListingTier', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc.mockResolvedValue({ error: null });
  });

  it('calls set_user_tier RPC when listing has an owner', async () => {
    const { result } = renderHook(() => useSetListingTier(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      listingId: 'listing-1',
      listingType: 'practitioner',
      tier: 'featured',
      island: 'maui',
      ownerId: 'user-abc',
      previousTier: 'premium',
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockRpc).toHaveBeenCalledWith('set_user_tier', {
      p_user_id: 'user-abc',
      p_new_tier: 'featured',
      p_old_tier: 'premium',
    });

    // Should NOT call direct table updates when owner exists
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('updates listing directly and creates featured slot for orphan listing', async () => {
    const { result } = renderHook(() => useSetListingTier(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      listingId: 'orphan-1',
      listingType: 'center',
      tier: 'featured',
      island: 'oahu',
      ownerId: null,
      previousTier: 'free',
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Should NOT use RPC (no owner)
    expect(mockRpc).not.toHaveBeenCalled();

    // Should update listing tier directly
    expect(mockUpdate).toHaveBeenCalledWith('centers', { tier: 'featured' });

    // Should create featured slot
    expect(mockUpsert).toHaveBeenCalledWith(
      'featured_slots',
      {
        listing_id: 'orphan-1',
        listing_type: 'center',
        island: 'oahu',
        owner_id: null,
      },
      { onConflict: 'listing_id' },
    );
  });

  it('deletes featured slot when downgrading from featured tier', async () => {
    const { result } = renderHook(() => useSetListingTier(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      listingId: 'orphan-2',
      listingType: 'practitioner',
      tier: 'premium',
      island: 'kauai',
      ownerId: null,
      previousTier: 'featured',
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Should update tier
    expect(mockUpdate).toHaveBeenCalledWith('practitioners', { tier: 'premium' });

    // Should delete featured slot (downgrade from featured)
    expect(mockDelete).toHaveBeenCalledWith('featured_slots');

    // Should NOT upsert a new slot (not upgrading TO featured)
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('does not touch featured_slots for free → premium upgrade (no featured involved)', async () => {
    const { result } = renderHook(() => useSetListingTier(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      listingId: 'orphan-3',
      listingType: 'practitioner',
      tier: 'premium',
      island: 'big_island',
      ownerId: null,
      previousTier: 'free',
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockUpdate).toHaveBeenCalledWith('practitioners', { tier: 'premium' });
    expect(mockUpsert).not.toHaveBeenCalled();
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('propagates RPC error for owned listing', async () => {
    mockRpc.mockResolvedValue({ error: { message: 'Featured slots full for this island' } });

    const { result } = renderHook(() => useSetListingTier(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      listingId: 'listing-2',
      listingType: 'practitioner',
      tier: 'featured',
      island: 'maui',
      ownerId: 'user-xyz',
      previousTier: 'free',
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toContain('Featured slots full');
  });
});
