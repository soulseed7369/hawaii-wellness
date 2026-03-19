/**
 * Billing validation helpers.
 * Checks subscription_status and period_end in addition to tier
 * to catch cases where the tier column is stale (e.g. missed webhook).
 */

export interface BillingProfile {
  tier: 'free' | 'premium' | 'featured';
  subscription_status: string | null;
  subscription_period_end: string | null;
  stripe_customer_id: string | null;
}

/**
 * Returns true if the subscription is genuinely active.
 * Free tier is always valid. Paid tiers require an active/trialing
 * status and a non-expired period_end.
 */
export function isSubscriptionValid(billing: BillingProfile | null | undefined): boolean {
  if (!billing) return false;
  if (billing.tier === 'free') return true;

  const { subscription_status, subscription_period_end } = billing;

  // Must have an active or trialing status
  if (!subscription_status) return false;
  if (!['active', 'trialing'].includes(subscription_status)) return false;

  // Period end must not have passed (with a 24-hour grace buffer for clock skew)
  if (subscription_period_end) {
    const periodEnd = new Date(subscription_period_end);
    const now = new Date();
    const gracePeriodMs = 24 * 60 * 60 * 1000; // 24 hours
    if (periodEnd.getTime() + gracePeriodMs < now.getTime()) return false;
  }

  return true;
}

/**
 * Returns the effective tier, falling back to 'free' if subscription is invalid.
 * Use this instead of billing.tier directly.
 */
export function effectiveTier(billing: BillingProfile | null | undefined): 'free' | 'premium' | 'featured' {
  if (!billing) return 'free';
  if (!isSubscriptionValid(billing)) return 'free';
  return billing.tier;
}
