/**
 * Tests for Stripe checkout and billing hooks.
 * Revenue-critical path: plan selection → checkout session → redirect to Stripe.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';

// ── Mock supabase ────────────────────────────────────────────────────────────

const mockRefreshSession = vi.fn();
const mockGetUser = vi.fn();
const mockFunctionsInvoke = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      refreshSession: (...args: any[]) => mockRefreshSession(...args),
      getUser: (...args: any[]) => mockGetUser(...args),
    },
    functions: {
      invoke: (...args: any[]) => mockFunctionsInvoke(...args),
    },
    from: (...args: any[]) => mockFrom(...args),
  },
  hasSupabase: true,
}));

// ── Mock stripe constants ────────────────────────────────────────────────────

vi.mock('@/lib/stripe', () => ({
  STRIPE_PRICES: {
    PREMIUM_MONTHLY: 'price_test_premium',
    FEATURED_MONTHLY: 'price_test_featured',
    CENTER_PREMIUM_MONTHLY: 'price_test_center_premium',
    CENTER_FEATURED_MONTHLY: 'price_test_center_featured',
  },
  VALID_PRICE_IDS: [
    'price_test_premium',
    'price_test_featured',
    'price_test_center_premium',
    'price_test_center_featured',
  ],
  PROMO_ACTIVE: false,
}));

// ── Import after mocks ───────────────────────────────────────────────────────

import { useCreateCheckoutSession, useMyBillingProfile } from '@/hooks/useStripe';

// ── Test wrapper ─────────────────────────────────────────────────────────────

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

// ── useCreateCheckoutSession ─────────────────────────────────────────────────

describe('useCreateCheckoutSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Prevent actual redirects
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...window.location, href: '', origin: 'http://localhost:3000' },
    });
  });

  it('refreshes token, calls edge function, and returns checkout URL', async () => {
    mockRefreshSession.mockResolvedValue({
      data: { session: { access_token: 'fresh-token', expires_at: 9999 } },
      error: null,
    });
    mockFunctionsInvoke.mockResolvedValue({
      data: { url: 'https://checkout.stripe.com/session_123' },
      error: null,
    });

    const { result } = renderHook(() => useCreateCheckoutSession(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      priceId: 'price_test_premium',
      successUrl: 'http://localhost:3000/success',
      cancelUrl: 'http://localhost:3000/cancel',
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Token was refreshed before calling edge function
    expect(mockRefreshSession).toHaveBeenCalledTimes(1);

    // Edge function was called with correct params
    expect(mockFunctionsInvoke).toHaveBeenCalledWith('create-checkout-session', {
      body: {
        priceId: 'price_test_premium',
        successUrl: 'http://localhost:3000/success',
        cancelUrl: 'http://localhost:3000/cancel',
      },
      headers: { Authorization: 'Bearer fresh-token' },
    });

    // Redirects to Stripe
    expect(window.location.href).toBe('https://checkout.stripe.com/session_123');
  });

  it('throws when session refresh fails (expired login)', async () => {
    mockRefreshSession.mockResolvedValue({
      data: { session: null },
      error: { message: 'Token expired' },
    });

    const { result } = renderHook(() => useCreateCheckoutSession(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ priceId: 'price_test_premium' });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toContain('logged in');
    expect(mockFunctionsInvoke).not.toHaveBeenCalled();
  });

  it('throws when edge function returns error', async () => {
    mockRefreshSession.mockResolvedValue({
      data: { session: { access_token: 'fresh-token', expires_at: 9999 } },
      error: null,
    });
    mockFunctionsInvoke.mockResolvedValue({
      data: null,
      error: { message: 'Invalid price ID' },
    });

    const { result } = renderHook(() => useCreateCheckoutSession(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ priceId: 'price_invalid' });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Invalid price ID');
  });

  it('throws when no checkout URL is returned', async () => {
    mockRefreshSession.mockResolvedValue({
      data: { session: { access_token: 'fresh-token', expires_at: 9999 } },
      error: null,
    });
    mockFunctionsInvoke.mockResolvedValue({
      data: { url: null },
      error: null,
    });

    const { result } = renderHook(() => useCreateCheckoutSession(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ priceId: 'price_test_premium' });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('No checkout URL returned');
  });

  it('uses default success/cancel URLs when not provided', async () => {
    mockRefreshSession.mockResolvedValue({
      data: { session: { access_token: 'tok', expires_at: 9999 } },
      error: null,
    });
    mockFunctionsInvoke.mockResolvedValue({
      data: { url: 'https://checkout.stripe.com/x' },
      error: null,
    });

    const { result } = renderHook(() => useCreateCheckoutSession(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ priceId: 'price_test_featured' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const [, opts] = mockFunctionsInvoke.mock.calls[0];
    expect(opts.body.successUrl).toContain('/dashboard/billing?success=1');
    expect(opts.body.cancelUrl).toContain('/dashboard/billing');
  });
});

// ── useMyBillingProfile ──────────────────────────────────────────────────────

describe('useMyBillingProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches billing profile for logged-in user', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
    });

    const mockSelect = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockSingle = vi.fn().mockResolvedValue({
      data: {
        tier: 'premium',
        subscription_status: 'active',
        subscription_period_end: '2026-04-22',
        stripe_customer_id: 'cus_abc',
      },
      error: null,
    });

    mockFrom.mockReturnValue({
      select: mockSelect,
      eq: (...args: any[]) => { mockEq(...args); return { eq: mockEq, single: mockSingle }; },
    });

    // Override the first .eq to return an object with second .eq
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          single: mockSingle,
        }),
      }),
    });

    const { result } = renderHook(() => useMyBillingProfile(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({
      tier: 'premium',
      subscription_status: 'active',
      subscription_period_end: '2026-04-22',
      stripe_customer_id: 'cus_abc',
    });
  });

  it('returns null when no user is logged in', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
    });

    const { result } = renderHook(() => useMyBillingProfile(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });

  it('returns free defaults when profile does not exist (PGRST116)', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-new' } },
    });

    const mockInsert = vi.fn().mockReturnValue({
      then: (cb: any) => cb({ error: null }),
    });

    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          single: () =>
            Promise.resolve({
              data: null,
              error: { code: 'PGRST116', message: 'not found' },
            }),
        }),
      }),
      insert: mockInsert,
    });

    const { result } = renderHook(() => useMyBillingProfile(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({
      tier: 'free',
      subscription_status: null,
      subscription_period_end: null,
      stripe_customer_id: null,
    });
  });
});
