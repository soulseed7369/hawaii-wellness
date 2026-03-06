/**
 * stripe.ts
 * Stripe client-side helper (publishable key only).
 * Server-side Stripe calls (checkout, webhooks) must use the secret key
 * inside Supabase Edge Functions — never in the browser bundle.
 */

// Price IDs — create these in your Stripe dashboard and paste them here.
// Products → Add product → set recurring price → copy price ID (price_xxx)
export const STRIPE_PRICES = {
  /** Premium plan: $39 / month */
  PREMIUM_MONTHLY: 'prod_U5xikoe835v7T6',
  /** Featured plan: $129 / month */
  FEATURED_MONTHLY: 'prod_U5xj8icg13fOcT',
} as const;

export type StripePriceId = typeof STRIPE_PRICES[keyof typeof STRIPE_PRICES];

/** Publishable key — safe to include in browser bundle */
export const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string;
