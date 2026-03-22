/**
 * Tests for Stripe configuration constants.
 * Validates that price IDs and plan options are consistent.
 */
import { describe, it, expect } from 'vitest';
import { STRIPE_PRICES, VALID_PRICE_IDS } from '@/lib/stripe';

describe('Stripe price configuration', () => {
  it('all price IDs start with price_ prefix', () => {
    for (const [key, priceId] of Object.entries(STRIPE_PRICES)) {
      expect(priceId, `${key} should start with price_`).toMatch(/^price_/);
    }
  });

  it('VALID_PRICE_IDS contains all defined prices', () => {
    const allPrices = Object.values(STRIPE_PRICES);
    expect(VALID_PRICE_IDS).toEqual(expect.arrayContaining(allPrices));
    expect(VALID_PRICE_IDS.length).toBe(allPrices.length);
  });

  it('has both practitioner and center price IDs', () => {
    expect(STRIPE_PRICES.PREMIUM_MONTHLY).toBeDefined();
    expect(STRIPE_PRICES.FEATURED_MONTHLY).toBeDefined();
    expect(STRIPE_PRICES.CENTER_PREMIUM_MONTHLY).toBeDefined();
    expect(STRIPE_PRICES.CENTER_FEATURED_MONTHLY).toBeDefined();
  });

  it('all price IDs are unique', () => {
    const allPrices = Object.values(STRIPE_PRICES);
    const uniquePrices = new Set(allPrices);
    expect(uniquePrices.size).toBe(allPrices.length);
  });
});
