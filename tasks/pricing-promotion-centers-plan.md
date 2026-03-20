# Pricing, Promotion & Centers Feature Plan
_Aloha Health Hub — March 2026_

---

## 1. Pricing Tiers (Finalized)

### Practitioners
| Tier | Regular Price | Promo Price (12 mo) | Key Features |
|------|-------------|---------------------|-------------|
| Free | $0 | $0 | Basic listing, contact info, modalities |
| Premium | $49/mo | **$39.20/mo** | + Offerings, Classes, Testimonials, social links, booking CTA |
| Featured | $149/mo | **$119.20/mo** | + Homepage rotation, crown badge, priority sort, 5/island cap |

### Centers
| Tier | Regular Price | Promo Price (12 mo) | Key Features |
|------|-------------|---------------------|-------------|
| Free | $0 | $0 | Basic listing, hours, center type |
| Premium | $79/mo | **$63.20/mo** | + Photo gallery, events, staff profiles, testimonials |
| Featured | $199/mo | **$159.20/mo** | + Homepage rotation, verified badge, priority sort, 5/island cap |

---

## 2. Launch Promotion — Recommendation

**45-day promotion window** (not 30, not 60).

- 30 days is too tight to build word of mouth; practitioners talk to each other slowly
- 60 days devalues the urgency and cuts into 2 months of full-price revenue
- 45 days hits both early adopters (week 1-2) and the "I'll do it eventually" crowd (week 5-6)

**Mechanic:** 20% off, locked in for the first 12 billing cycles
- Month 13 onwards: full price kicks in automatically (Stripe handles this natively)
- No code required — discount applies at checkout if they sign up before the deadline
- Alternatively: single promo code `ALOHA20` for marketing flexibility

**Lock-in framing (critical for conversion):**
> _"Lock in 20% off for your first year — price guaranteed through March 2027"_

This frames it as a *guarantee* not a discount, which resonates better with small business owners who hate pricing surprises.

---

## 3. Stripe Implementation

### Step 1 — Fix price IDs first (existing bug)
The current `src/lib/stripe.ts` uses `prod_xxx` (product IDs) not `price_xxx`. Replace before promotion launches:
```ts
// src/lib/stripe.ts
export const STRIPE_PRICES = {
  // Practitioners
  PRACTITIONER_PREMIUM_MONTHLY:  'price_XXXX',  // $49/mo
  PRACTITIONER_FEATURED_MONTHLY: 'price_XXXX',  // $149/mo
  // Centers (new)
  CENTER_PREMIUM_MONTHLY:        'price_XXXX',  // $79/mo
  CENTER_FEATURED_MONTHLY:       'price_XXXX',  // $199/mo
};
```

### Step 2 — Create Stripe Coupon
In Stripe Dashboard → Products → Coupons → Create:
```
Name:       ALOHA20 Launch Promo
ID:         ALOHA20
Type:       Percentage
Amount:     20%
Duration:   repeating
Months:     12
Redemption: ☑ Limit by date → [expiry date]
            ☑ Limit total redemptions → 500 (optional cap)
```

### Step 3 — Apply in checkout session
```ts
// supabase/functions/create-checkout-session/index.ts
const session = await stripe.checkout.sessions.create({
  // ...existing params
  discounts: promoActive ? [{ coupon: 'ALOHA20' }] : [],
  // OR let customer enter it:
  allow_promotion_codes: true,
});
```

### Step 4 — Update PRICE_TIER_MAP in webhook
```ts
// supabase/functions/stripe-webhook/index.ts
const PRICE_TIER_MAP: Record<string, string> = {
  'price_practitioner_premium':  'premium',
  'price_practitioner_featured': 'featured',
  'price_center_premium':        'premium',
  'price_center_featured':       'featured',
};
```

---

## 4. Centers Feature Implementation Plan

Centers justify $79/$199 vs practitioners' $49/$149 because they serve multiple practitioners, manage higher complexity, and have larger marketing budgets.

### Sprint 1 — Core Profile Differentiation (2 weeks)
**Features that make centers distinct from practitioner profiles:**

- **Multi-photo gallery** — up to 10 photos (practitioners get 1 hero photo)
  - Carousel on public profile
  - Drag-to-reorder in dashboard
  - Already has `photos text[]` column in DB — just build the UI

- **Staff/Practitioner roster** — link existing practitioners on the platform
  - New `center_practitioners` join table: `(center_id, practitioner_id, role, sort_order)`
  - Public profile shows "Our Team" section with linked practitioner cards
  - Practitioners can opt-in to appear on a center's page

- **Working hours display** — already in DB (`working_hours jsonb`)
  - Visual weekly schedule on public profile
  - "Open now" badge using current local time
  - Dashboard hours editor (Mon–Sun toggle + time pickers)

- **Center type badge** — spa / wellness center / clinic / retreat center / fitness center
  - Already stored in `center_type` column — just display it prominently on card + profile

### Sprint 2 — Events & Classes (2 weeks)
**Centers run recurring group events; practitioners run individual sessions**

- **Events calendar** — public-facing upcoming events list (different from practitioner Offerings)
  - `center_events` table: title, description, date, time, duration, price, registration_url, max_attendees, image_url
  - iCal export link for each event
  - "Add to Google Calendar" button

- **Class schedule grid** — weekly recurring classes displayed in a visual grid
  - Mon–Sun columns, classes as blocks
  - Powered by existing `classes` table (already built for practitioners, works for centers too)
  - Filterable by modality

- **Amenities list** — checkboxes: Parking, WiFi, Changing Rooms, Showers, Wheelchair Accessible, Private Rooms, Group Space, Outdoor Area
  - New `amenities text[]` column on centers table (add in next migration)

### Sprint 3 — Trust & Social Proof (1.5 weeks)

- **Verified Center badge** — for Featured centers; admin-granted
  - `is_verified boolean` column + shield icon on cards and profile
  - "Verified wellness center" tooltip explaining what verification means

- **Testimonials with photo** — centers get richer testimonials than practitioners
  - Already built `practitioner_testimonials` — add `center_testimonials` table
  - Support avatar upload for testimonial author (social proof lift)
  - Option to link testimonial to a specific class or event

- **Google/Yelp review aggregate** — display star rating pulled from enrichment data
  - Already have `rating` and `user_ratings_total` from GM pipeline in raw data
  - Surface on profile: "4.7 ★ on Google (142 reviews)"

### Sprint 4 — Admin & Analytics (1.5 weeks)

- **Center dashboard analytics** (Premium+)
  - Profile views (last 30 days)
  - Click-throughs on booking link
  - Most-viewed classes/events
  - Simple line chart — no external service needed, log events to `listing_analytics` table

- **Multi-user center accounts** — allow centers to have a team managing the listing
  - `center_admins` table: `(center_id, user_id, role)` — owner / editor
  - Editor can update profile; only owner can manage billing

- **Bulk practitioner import** — CSV upload to pre-populate staff roster
  - Maps to existing practitioners table; creates draft records

### Sprint 5 — Booking & Lead Gen (2 weeks)

- **Inquiry form** — "Contact this center" form with name/email/message
  - Sends email to center's contact email (via Supabase Edge Function + Resend)
  - Lead stored in `center_inquiries` table for dashboard review

- **Featured center homepage placement** — differentiated from practitioner featured
  - Separate 5-slot cap per island for centers (new `featured_slots` `listing_type = 'center'`)
  - Centers appear in a dedicated "Featured Wellness Centers" section on island pages (not mixed with practitioners)

- **Package/membership display** — centers can list membership packages
  - `center_packages` table: name, description, price, frequency, what_included
  - Shown on profile as "Memberships & Packages" section

---

## 5. Rollout Sequence

### Week 1–2: Pre-launch prep
- [ ] Fix Stripe price IDs (critical bug — blocks all paid signups)
- [ ] Create Stripe coupon `ALOHA20` with 45-day expiry
- [ ] Create Center account type in Stripe (new product + prices)
- [ ] Apply Supabase migration for centers amenities, center_events, center_testimonials
- [ ] Update `ListYourPractice.tsx` to show both Practitioner and Center pricing columns
- [ ] Update `create-checkout-session` to accept center price IDs

### Week 3: Sprint 1 features live
- [ ] Multi-photo gallery (dashboard + public profile)
- [ ] Working hours display + "Open now" badge
- [ ] Staff roster (join table + UI)
- [ ] Center type badge

### Week 4: Launch promotion goes live
- [ ] Toggle on `ALOHA20` promo code
- [ ] Email blast to existing free practitioners (upgrade offer)
- [ ] Email blast to unclaimed center listings (claim + upgrade)
- [ ] Social posts: "Aloha Health Hub is now open for Wellness Centers"

### Week 5–6: Sprint 2 (Events & Classes)
### Week 7–8: Sprint 3 (Trust & Social Proof)
### Week 9–10: Sprint 4 (Analytics & Multi-user)
### Week 11–14: Sprint 5 (Booking & Lead Gen)

---

## 6. Revenue Projection (Conservative)

Assuming 4 islands × ~500 qualifying wellness centers in DB:
- 5% conversion free→premium = 25 centers × $79 = **$1,975/mo**
- 2% conversion free→featured = 10 centers × $199 = **$1,990/mo**
- Plus practitioner upgrades from promo: 50 practitioners × avg $55 = **$2,750/mo**

**Launch month MRR target (promo pricing):** ~$6,700/mo
**Month 13 MRR (full pricing kicks in):** ~$8,400/mo

At 500 total paid accounts across both types, MRR crosses $20K — the point where Vercel, Supabase, and Stripe fees become negligible (<5% of revenue).

---

## 7. Recommended Next Steps (This Week)

1. **Fix Stripe price IDs** — go to Stripe Dashboard → Products, copy the real `price_xxx` IDs and update `src/lib/stripe.ts` and the webhook PRICE_TIER_MAP
2. **Create `ALOHA20` coupon** in Stripe Dashboard
3. **Apply Sprint 1 migrations** (amenities column, center_events table)
4. **Update pricing page** to show both practitioner and center pricing side by side
5. Start Sprint 1 center dashboard build
