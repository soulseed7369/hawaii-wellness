/**
 * Tests for homepage tier-priority listing display.
 * Business-critical: ensures featured/premium subscribers
 * get priority placement and free listings only backfill.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';

// ── Mock adapters ────────────────────────────────────────────────────────────

vi.mock('@/lib/adapters', () => ({
  practitionerRowToProvider: (row: any) => ({ ...row, _adapted: true }),
  centerRowToCenter: (row: any) => ({ ...row, _adapted: true }),
}));

vi.mock('@/data/mockData', () => ({
  mockPractitioners: [],
  mockCenters: [],
}));

// ── Mock supabase ────────────────────────────────────────────────────────────

let mockQueryData: any[] = [];
let mockCountValue = 0;

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      const chain: any = {
        select: (...args: any[]) => {
          // Count-only query returns { count, error }
          if (args[1]?.count === 'exact' && args[1]?.head === true) {
            return {
              eq: () => ({
                eq: () => Promise.resolve({ count: mockCountValue, error: null }),
              }),
            };
          }
          return chain;
        },
        eq: () => chain,
        order: () => chain,
        limit: () => Promise.resolve({ data: mockQueryData, error: null }),
      };
      return chain;
    },
  },
  hasSupabase: true,
}));

import { useHomePractitioners, useHomeCenters } from '@/hooks/useFeaturedListings';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

// ── Helper to build fake listing rows ────────────────────────────────────────

function makeListing(id: string, tier: string, name: string) {
  return { id, tier, name, island: 'maui', status: 'published', is_featured: tier === 'featured' };
}

describe('useHomePractitioners', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryData = [];
    mockCountValue = 0;
  });

  it('returns only featured when 4+ featured exist', async () => {
    mockQueryData = [
      makeListing('f1', 'featured', 'Alice'),
      makeListing('f2', 'featured', 'Bob'),
      makeListing('f3', 'featured', 'Carol'),
      makeListing('f4', 'featured', 'Dave'),
      makeListing('f5', 'featured', 'Eve'),
      makeListing('p1', 'premium', 'Frank'),
      makeListing('x1', 'free', 'Grace'),
    ];
    mockCountValue = 50;

    const { result } = renderHook(() => useHomePractitioners('maui'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Should only return featured listings (all 5), no premium or free
    expect(result.current.data.every((p: any) => p.tier === 'featured')).toBe(true);
    expect(result.current.data.length).toBe(5);
    expect(result.current.totalCount).toBe(50);
  });

  it('mixes featured + premium when featured < 4', async () => {
    mockQueryData = [
      makeListing('f1', 'featured', 'Alice'),
      makeListing('f2', 'featured', 'Bob'),
      makeListing('p1', 'premium', 'Carol'),
      makeListing('p2', 'premium', 'Dave'),
      makeListing('p3', 'premium', 'Eve'),
      makeListing('x1', 'free', 'Frank'),
    ];
    mockCountValue = 30;

    const { result } = renderHook(() => useHomePractitioners('maui'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const tiers = result.current.data.map((p: any) => p.tier);
    // Should include featured + premium, no free (combined ≥ 4)
    expect(tiers).toContain('featured');
    expect(tiers).toContain('premium');
    expect(tiers).not.toContain('free');
    expect(result.current.data.length).toBe(5); // 2 featured + 3 premium
  });

  it('pads with free listings when paid tiers < 4', async () => {
    mockQueryData = [
      makeListing('f1', 'featured', 'Alice'),
      makeListing('p1', 'premium', 'Bob'),
      makeListing('x1', 'free', 'Carol'),
      makeListing('x2', 'free', 'Dave'),
      makeListing('x3', 'free', 'Eve'),
    ];
    mockCountValue = 20;

    const { result } = renderHook(() => useHomePractitioners('maui'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // 1 featured + 1 premium = 2 paid. Need 2 free to fill 4 slots
    expect(result.current.data.length).toBe(4);
    const tiers = result.current.data.map((p: any) => p.tier);
    expect(tiers.filter((t: string) => t === 'free').length).toBe(2);
  });

  it('returns empty array when no listings exist', async () => {
    mockQueryData = [];
    mockCountValue = 0;

    const { result } = renderHook(() => useHomePractitioners('molokai'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toEqual([]);
    expect(result.current.totalCount).toBe(0);
  });

  it('returns all free when no paid subscribers exist', async () => {
    mockQueryData = [
      makeListing('x1', 'free', 'Alice'),
      makeListing('x2', 'free', 'Bob'),
      makeListing('x3', 'free', 'Carol'),
    ];
    mockCountValue = 3;

    const { result } = renderHook(() => useHomePractitioners('kauai'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data.length).toBe(3);
    expect(result.current.data.every((p: any) => p.tier === 'free')).toBe(true);
  });
});

describe('useHomeCenters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryData = [];
    mockCountValue = 0;
  });

  it('applies same tier-priority logic as practitioners', async () => {
    mockQueryData = [
      makeListing('cf1', 'featured', 'Spa A'),
      makeListing('cf2', 'featured', 'Spa B'),
      makeListing('cf3', 'featured', 'Spa C'),
      makeListing('cf4', 'featured', 'Spa D'),
      makeListing('cp1', 'premium', 'Center E'),
    ];
    mockCountValue = 10;

    const { result } = renderHook(() => useHomeCenters('oahu'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data.every((c: any) => c.tier === 'featured')).toBe(true);
    expect(result.current.data.length).toBe(4);
  });
});
