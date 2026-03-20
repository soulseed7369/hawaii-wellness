# Provider & Center Account Separation Analysis
**Aloha Health Hub** — Strategic Tier & Feature Redesign

---

## Executive Summary

Aloha Health Hub currently operates a single account type for both individual practitioners (yoga teachers, therapists, healers) and larger wellness businesses (spas, clinics, retreat centers). This analysis recommends **separating into two distinct account types at signup** with tailored feature sets and pricing tiers.

**Key Outcome:** Practitioners and centers have vastly different decision-making units, usage patterns, and willingness to pay. Separate paths increase conversion, reduce feature sprawl, and enable targeted value propositions.

---

## Background & Current State

### Current Structure
- **Single account type** covering both practitioners and wellness centers
- **Database:** Separate `practitioners` and `centers` tables (already structured for separation)
- **Signup flow:** No distinction at onboarding; all users go through `/list-your-practice` and choose tier
- **Tier system:** Three tiers (Free, Premium, Featured) apply to both account types with shared features

### Current Tier Structure
| Tier | Price | Core Features |
|------|-------|---|
| **Free** | $0 | Name, bio, location, modalities, contact info |
| **Premium** | $39/mo | Free + Retreats, social links, working hours, testimonials |
| **Featured** | $129/mo | Premium + Homepage rotation, crown badge, priority results (5/island cap) |

### Why Separate Now?
1. **Different user personas:** Solo yoga teacher vs. 20-person spa/clinic team
2. **Different value drivers:** Retreats matter to some practitioners, irrelevant to many centers; centers need staff profiles, class schedules, amenities
3. **Different pricing psychology:** A center operator viewing $39/mo as "dirt cheap" vs. a freelance healer seeing it as significant
4. **Feature bloat:** Trying to serve both with one feature set leads to either under-serving or over-complicating
5. **Database readiness:** `practitioners` and `centers` are already separate tables — signal that separation is intentional

---

## Recommended Feature Matrices

### PRACTITIONERS

#### Free Tier — $0/month
**Tagline:** "Get discovered, no cost"

| Feature | Included |
|---------|----------|
| Directory listing (name, bio, modalities, location) | ✅ |
| Photo upload (avatar) | ✅ |
| Contact information (email, phone, website) | ✅ |
| Accepts new clients flag | ✅ |
| Session type (in-person / online / both) | ✅ |
| Map display & island/city listing | ✅ |
| Booking link (external URL) | ✅ |
| Edit own profile | ✅ |

**Conversion path:** Free → Premium (when ready to grow)

---

#### Premium Tier — **$49/month** (recommended)
**Tagline:** "Grow your practice with advanced tools"
**Price rationale:** Solo practitioners have lower overhead; $49 is attractive entry point for serious professionals but accessible to part-time practitioners

| Feature | Included |
|---------|----------|
| Everything in Free | ✅ |
| **Post Retreats & Immersions** | ✅ NEW |
| **Social media links** (Instagram, Facebook, LinkedIn, X, Substack) | ✅ |
| **Working hours display** | ✅ |
| **Testimonials section** (5-10 max) | ✅ |
| **Contact form on profile** (instead of direct links) | ✅ |
| **Email capture** (newsletter opt-in on profile) | ✅ |
| **SEO-friendly profile page** | ✅ |
| **Analytics dashboard** (views, clicks) | ✅ NEW |
| Priority in directory sort (after Featured) | ✅ |

**Conversion path:** Free → Premium → Featured

---

#### Featured Tier — **$149/month** (recommended)
**Tagline:** "Become the go-to healer on your island"
**Price rationale:** 3x premium cost reflects 10x visibility; practitioners willing to pay for visibility on competitive islands (Oahu, Maui) will pay this

| Feature | Included |
|---------|----------|
| Everything in Premium | ✅ |
| **Homepage featured rotation** (cycling spotlight, 5/island cap) | ✅ |
| **"Featured Practitioner" crown badge** | ✅ |
| **Top placement** in all island/city directories | ✅ |
| **Weekly featured email** (newsletter mention) | ✅ |
| **Featured profile theme** (custom accent color) | ✅ |
| **Up to 5 gallery photos** | ✅ NEW |
| **Advanced analytics** (source tracking, conversion metrics) | ✅ NEW |
| **Priority support** (email, within 24 hours) | ✅ NEW |

**Retention:** Lock in 12-month contracts at 10% discount (→ $134.10/mo) to secure slots; attract committed practitioners

---

### WELLNESS CENTERS / SPAS / CLINICS

#### Free Tier — $0/month
**Tagline:** "List your business, attract clients"

| Feature | Included |
|---------|----------|
| Directory listing (name, address, city, center type) | ✅ |
| Center type (spa, wellness_center, clinic, retreat_center, fitness_center) | ✅ |
| Photo gallery (1 photo) | ✅ |
| Contact information (phone, email, website) | ✅ |
| Service modalities (3 main) | ✅ |
| Map display | ✅ |
| Booking link (external) | ✅ |
| Basic hours (open/close time per day) | ✅ |

**Conversion path:** Free → Premium (when adding staff or advanced features)

---

#### Premium Tier — **$79/month** (recommended)
**Tagline:** "Professional center management with advanced features"
**Price rationale:** Centers are revenue-generating businesses; $79 is standard B2B SaaS pricing and reflects real operational value

| Feature | Included |
|---------|----------|
| Everything in Free | ✅ |
| **Up to 5 staff member profiles** (name, specialty, photo, bio) | ✅ NEW |
| **Class/service schedule** (repeating availability, capacity) | ✅ NEW |
| **Amenities list** (parking, Wi-Fi, accessibility, etc.) | ✅ NEW |
| **Photo gallery** (up to 5 images) | ✅ |
| **Complete working hours** (detailed per day/time slot) | ✅ |
| **Testimonials section** (customer reviews, 10 max) | ✅ |
| **Service descriptions** (full modality details) | ✅ NEW |
| **Contact form on profile** | ✅ |
| **Email capture** (client newsletter opt-in) | ✅ |
| **Facebook/Instagram links** | ✅ |
| **Analytics dashboard** (profile views, contact clicks, inquiry source) | ✅ NEW |
| **Email notifications** (new contact form submissions) | ✅ NEW |
| **SEO-optimized profiles** | ✅ |

**Conversion path:** Free → Premium → Featured

---

#### Featured Tier — **$199/month** (recommended)
**Tagline:** "Dominate your local market with maximum visibility"
**Price rationale:** 2.5x premium for 10x+ visibility; centers with multi-therapist teams, high revenue, competitive markets (Honolulu spas, busy fitness centers) will pay this for ROI

| Feature | Included |
|---------|----------|
| Everything in Premium | ✅ |
| **Homepage featured rotation** (guaranteed weekly spotlight, 5/island cap) | ✅ |
| **"Featured Wellness Center" badge** (distinctive design) | ✅ |
| **Top placement** in all searches, filters, map (always first) | ✅ |
| **Weekly featured email** (newsletter spotlight mention) | ✅ |
| **Custom center theme** (branded accent color, customizable layout) | ✅ NEW |
| **Photo gallery** (unlimited images) | ✅ |
| **Staff directory** (unlimited member profiles) | ✅ |
| **Service marketplace** (book direct — limited to 5 services, no payment processing) | ✅ NEW |
| **Review/testimonial carousel** (homepage display) | ✅ NEW |
| **Advanced analytics** (source attribution, therapist-level performance) | ✅ NEW |
| **Priority support** (phone, within 4 hours) | ✅ NEW |
| **Quarterly business check-in** (strategy call with Aloha wellness team) | ✅ NEW |

**Retention:** Offer 12-month contract at 15% discount (→ $169.15/mo) to secure featured slots and build long-term partnerships

---

## Pricing Summary Table

| Account Type | Free | Premium | Featured |
|---|---|---|---|
| **Practitioner** | $0 | $49/mo | $149/mo |
| **Center** | $0 | $79/mo | $199/mo |
| **Premium Savings** (12-mo) | — | —5% ($46.55/mo) | —10% ($134.10/mo) |
| **Center Savings** (12-mo) | — | —5% ($75.05/mo) | —15% ($169.15/mo) |

**Monthly Recurring Revenue (MRR) Projection (assuming 500 active paying listings on Oahu):**
- 200 practitioner Premium @ $49 = $9,800
- 100 practitioner Featured @ $149 = $14,900
- 150 center Premium @ $79 = $11,850
- 50 center Featured @ $199 = $9,950
- **Total: $46,500/month**

---

## Pricing Rationale

### Why Centers Pay More

1. **Revenue-generating businesses:** Centers operate as income-producing entities; practitioners are often solo/part-time
2. **Team size & complexity:** Centers manage multiple staff, schedules, inventory; practitioners manage themselves
3. **Operational scale:** Centers book 20+ clients/week; practitioners book 5–10; time value is different
4. **Lead quality:** A center lead is worth 3–5x a solo practitioner lead (group bookings, retainers, team wellness contracts)
5. **Customer acquisition cost ceiling:** Centers can afford CAC of $200–500/month; practitioners $20–50/month
6. **Lifetime value:** Center clients = $500–$2,000+ LTV; practitioner clients = $100–$300 LTV
7. **Benchmarking:** Similar B2B SaaS for spas/fitness (Acuity Scheduling, Mindbody) charges $99–299/mo for small businesses

### Why Practitioners Get Retreat Feature

- **High-margin offering:** A single retreat can generate $2,000–$10,000+ revenue for a practitioner
- **Retreat-driven practitioners:** Yogis, tantra teachers, herbalists often rely on retreat revenue
- **Retreat pricing:** If practitioner gets one retreat booking from featured placement, it pays for 1–10 months of Premium/Featured
- **Retreat-agnostic centers:** Spas/clinics rarely post retreats (they're class-based, not event-based); retreat feature doesn't apply

---

## Implementation Considerations

### Signup Flow (Highest Priority)

**New flow: Account Type Selection**
```
/list-your-practice
  ↓
[Choose Account Type]
  ├→ "I'm an Individual Practitioner"
  │  └→ Yoga teacher, therapist, healer, energy worker, etc.
  │     [Show Practitioner pricing]
  │
  └→ "I Run a Wellness Business"
     └→ Spa, clinic, wellness center, retreat center, gym, etc.
        [Show Center pricing]
```

**Existing users:** Auto-detect based on current listing type (practitioners → practitioner path, centers → center path). Store `account_type` in `user_profiles.account_type` (enum: 'practitioner' | 'center')

---

### Database Changes Required

**New columns on `user_profiles` table:**
```sql
ALTER TABLE user_profiles ADD COLUMN account_type TEXT CHECK (account_type IN ('practitioner', 'center'));
ALTER TABLE user_profiles ADD COLUMN features_json JSONB;  -- Cache of active features for this tier
```

**No changes to `practitioners` or `centers` tables** — they're already separate and correctly structured.

**Migration script:** Set `account_type` based on which table the user's listing exists in:
```sql
UPDATE user_profiles up
SET account_type = 'practitioner'
WHERE EXISTS (SELECT 1 FROM practitioners p WHERE p.owner_id = up.id);

UPDATE user_profiles up
SET account_type = 'center'
WHERE EXISTS (SELECT 1 FROM centers c WHERE c.owner_id = up.id);
```

---

### Stripe Product/Price Setup

**New products:**
- `prod_practitioner_premium` → `price_practitioner_premium_monthly` ($49/mo)
- `prod_practitioner_featured` → `price_practitioner_featured_monthly` ($149/mo)
- `prod_center_premium` → `price_center_premium_monthly` ($79/mo)
- `prod_center_featured` → `price_center_featured_monthly` ($199/mo)

**Update `src/lib/stripe.ts`:**
```typescript
export const STRIPE_PRICES = {
  // Practitioners
  PRACTITIONER_PREMIUM_MONTHLY: 'price_practitioner_premium_monthly',
  PRACTITIONER_FEATURED_MONTHLY: 'price_practitioner_featured_monthly',

  // Centers
  CENTER_PREMIUM_MONTHLY: 'price_center_premium_monthly',
  CENTER_FEATURED_MONTHLY: 'price_center_featured_monthly',
} as const;
```

**Stripe webhook update:** `stripe-webhook/index.ts` must validate that user's `account_type` matches the product they purchased (security: prevent practitioner from purchasing center plan)

---

### UI/UX Updates

**Phase 1 (Critical):**
- [ ] Modify `/list-your-practice` to show account type selection first
- [ ] Create separate pricing pages: `/pricing-practitioners` and `/pricing-centers` (optional; can use same page with toggles)
- [ ] Update `DashboardHome.tsx` to show account-type-specific onboarding

**Phase 2 (Medium Priority):**
- [ ] Update `DashboardProfile.tsx` (practitioners) and `DashboardCenters.tsx` (centers) to only show relevant fields
  - Practitioners: hide "staff members", "amenities", "class schedule"
  - Centers: hide "retreats" (or show with note: "Not applicable for centers")
- [ ] Hide/show features based on tier in dashboard (e.g., only Premium+ see "Working Hours" section)

**Phase 3 (Nice-to-Have):**
- [ ] Create account-type-specific help articles in `/help`
- [ ] Add account-type to admin `Accounts` tab (for analytics)

---

### Migration Path for Existing Users

**Current situation:** ~100–200 existing listings (mixed practitioners & centers)

**Strategy:**
1. **No forced migration:** Existing paid users keep their current plan and price indefinitely
2. **Grandfather clause:** If a practitioner is paying $39/mo, they stay at $39/mo (even if new price is $49/mo)
3. **Offer upgrade path:** Email existing users: "Upgrade to new [Practitioner/Center] plan with [new feature]" — offer first month free to incentivize
4. **Flag in system:** Mark existing users with `migrated_at` timestamp; new users get new account_type immediately

**Implementation:**
```typescript
// In DashboardBilling, show toggle:
if (user.stripe_subscription_id && !user.migrated_at) {
  return (
    <Card>
      <p>We've redesigned plans for practitioners vs. centers!</p>
      <Button onClick={handleUpgradeToPlan}>
        Learn About Your New Plan {newFeatures.length} New Features)
      </Button>
    </Card>
  );
}
```

---

## Recommended Rollout Sequence

### Sprint 1: Setup & Foundation (1 week)
1. Create new Stripe products & prices (do in Stripe Dashboard manually)
2. Update `src/lib/stripe.ts` with all new price IDs
3. Add `account_type` and `features_json` columns to `user_profiles`
4. Run migration script to backfill existing users' `account_type`
5. Update `stripe-webhook/index.ts` to validate account_type matches subscription

**Deliverable:** Stripe integration ready; no user-facing changes yet

---

### Sprint 2: UI & Signup (1 week)
1. Redesign `/list-your-practice` with account type selection
2. Create separate or toggled pricing displays
3. Update `ListYourPractice.tsx` to route to correct Stripe price based on account_type
4. Test signup flow end-to-end (both practitioner & center paths)
5. Email existing free users about new structure (educational, no action needed)

**Deliverable:** Users can sign up as practitioner or center; separate pricing shown

---

### Sprint 3: Dashboard & Features (1 week)
1. Add account-type-aware field visibility to `DashboardProfile.tsx` and `DashboardCenters.tsx`
2. Hide/show features based on tier (working hours, social links, testimonials, etc.)
3. Add feature-status badge to dashboard (e.g., "Working Hours — Premium Feature — Upgrade to unlock")
4. Update `DashboardBilling.tsx` to show account-type-specific plan comparison

**Deliverable:** Dashboard is tier & account-type aware; users see only relevant features

---

### Sprint 4: Admin & Analytics (1 week)
1. Add `account_type` filter to Admin → Accounts tab
2. Update `useAccounts` hook to expose account_type
3. Add MRR dashboard with split: Practitioners vs. Centers
4. Create email campaign for existing free users (invite to upgrade with new plan details)

**Deliverable:** Admin has full visibility; analytics distinguish practitioner vs. center revenue

---

### Sprint 5: Optimization & Launch (ongoing)
1. A/B test pricing: $49 vs. $59 for practitioners; $79 vs. $99 for centers
2. Monitor conversion rates by account type & tier
3. Adjust featured spot allocation if centers dominate one island
4. Create social proof: "500+ practitioners + 80+ centers now listed"

**Deliverable:** Live, optimized, data-driven

---

## Benefits of This Approach

### For Practitioners
- **Lower entry cost:** $49/mo feels more accessible than $39→$79 jump; attracts serious solo operators
- **Retreat focus:** Premium tier makes retreat posting a core value prop (aligns with their revenue model)
- **Less noise:** Dashboard doesn't show staff/amenities fields they'll never use

### For Wellness Centers
- **Clear value prop:** Recognize they're running a business; staffing & scheduling features speak directly to pain points
- **Higher pricing justified:** $79–$199 is standard for center management tools; perceived value matches cost
- **Expansion potential:** Unlimited staff & photos encourages growth (more staff = more stickiness)

### For Aloha Health Hub
- **Clearer monetization:** Practitioners ($49–$149) vs. Centers ($79–$199) different segments
- **Reduced churn:** Center features (staff, schedules) create sticky engagement; practitioners (retreats) create natural content expansion
- **Upsell funnel:** Clear tier hierarchy; each tier unlocks specific use cases
- **Data clarity:** Can track practitioner vs. center LTV separately; optimize acquisition spend
- **Brand positioning:** "Purpose-built for practitioners" + "Powerful for wellness centers" beats generic "wellness directory"

---

## Key Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Existing users confused by new structure | Grandfather all current plans; send clear email explaining their account type & what it means |
| Practitioners reject $49/mo (up from $39) | Offer first month free for upgrade; emphasize new features (analytics, email capture) |
| Centers see $79 as too high | Benchmark against Mindbody ($99–299); highlight ROI (1 new booking = $150+ revenue) |
| Accidentally create "second-class" tier | Don't position center tiers lower; position as "different" not "worse" |
| Feature bloat returns (each segment wants different things) | Strict feature roadmap per account type; use "nice-to-have vs. core" framework |

---

## Success Metrics (Post-Launch)

**Track these KPIs by account type:**
- Signup conversion rate (free → premium → featured)
- Practitioner MRR target: $12,000/month (200 @ $49 + 100 @ $149)
- Center MRR target: $21,800/month (150 @ $79 + 50 @ $199)
- Churn rate by tier (target: <5% monthly churn)
- NPS by account type (target: >40)
- Featured slot utilization (5/island capped, track demand)

---

## Conclusion

Separating Practitioners and Wellness Centers into distinct account types with tailored pricing ($49–$149 vs. $79–$199) and feature sets capitalizes on Aloha Health Hub's already-separate database structure. This move increases perceived value for both segments, reduces feature bloat, and creates a clearer path to monetization while maintaining a low barrier to entry (free listing for all).

**Recommended immediate action:** Create Stripe products in live mode this week; begin Sprint 1 next sprint.
