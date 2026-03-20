# Tier Strategy Recommendation — Aloha Health Hub

## Current State

**Listing counts (published):**
- Big Island: 270 practitioners, 119 centers
- Other islands: 5 centers (Oahu + Kauai), no practitioners yet
- Total pipeline (draft): 730 practitioners, 880 centers waiting for review

**Current paid subscribers:** 3 premium practitioners, 0 featured, 0 center subscriptions.

**Current enforcement:** Barely enforced. The only real gates are:
- Classes/Offerings tabs hidden for free tier
- Booking URL form field hidden for free tier
- Featured badge + homepage rotation for featured
- Sort priority (featured > premium > free)

**Everything else is ungated:** social links, testimonials, working hours, unlimited bio length, photo gallery, multiple center locations — all available to free users if the data exists in the DB.

---

## Proposed Tier Matrix

### Practitioners

| Feature | Free ($0) | Premium ($49/mo) | Featured ($129/mo) |
|---------|-----------|------------------|---------------------|
| **Directory listing** | ✅ | ✅ | ✅ |
| **Name, modalities, location** | ✅ | ✅ | ✅ |
| **Contact info (phone, email)** | ✅ | ✅ | ✅ |
| **Website link** | ✅ | ✅ | ✅ |
| **Profile photo** | ✅ | ✅ | ✅ |
| **About / bio** | 250 chars | Unlimited | Unlimited |
| **Social media links** | ❌ | ✅ | ✅ |
| **Working hours** | ❌ | ✅ | ✅ |
| **Testimonials display** | ❌ | ✅ | ✅ |
| **Photo gallery** | ❌ | Up to 5 | Up to 10 |
| **Offerings & Events** | ❌ | ✅ | ✅ |
| **Classes** | ❌ | ✅ | ✅ |
| **Booking / discovery call CTAs** | ❌ | ✅ | ✅ |
| **"What to Expect" section** | ❌ | ✅ | ✅ |
| **Booking calendar embed** | ❌ | ❌ | ✅ |
| **Premium badge** | ❌ | ⭐ Star | 👑 Crown |
| **Sort priority** | Last | Middle | First |
| **Homepage spotlight** | ❌ | ❌ | ✅ |
| **"Featured" badge** | ❌ | ❌ | ✅ |
| **Verified checkmark** | ❌ | ❌ | ✅ (manual) |

### Centers & Spas

| Feature | Free ($0) | Premium ($79/mo) | Featured ($199/mo) |
|---------|-----------|------------------|---------------------|
| **Directory listing** | ✅ | ✅ | ✅ |
| **Center type, modalities, location** | ✅ | ✅ | ✅ |
| **Contact info** | ✅ | ✅ | ✅ |
| **Website link** | ✅ | ✅ | ✅ |
| **Profile photo** | ✅ | ✅ | ✅ |
| **Description** | 250 chars | Unlimited | Unlimited |
| **Multiple locations** | ❌ (1 only) | Up to 3 | Unlimited |
| **Social media links** | ❌ | ✅ | ✅ |
| **Working hours** | ❌ | ✅ (per location) | ✅ (per location) |
| **Testimonials** | ❌ | ✅ | ✅ |
| **Photo gallery** | ❌ | Up to 5 | Up to 10 |
| **Events & classes calendar** | ❌ | ✅ | ✅ |
| **Amenities list** | ❌ | ✅ | ✅ |
| **Staff roster** | ❌ | ✅ | ✅ |
| **Premium badge** | ❌ | ⭐ Star | 👑 Crown |
| **Sort priority** | Last | Middle | First |
| **Homepage spotlight** | ❌ | ❌ | ✅ |

---

## Featured Tier: Dynamic Pricing by Island

### Problem with flat 5-per-island cap
Big Island has 389 published listings. Oahu will eventually have 1,000+. A flat cap of 5 makes Featured extremely scarce on busy islands and meaningless on quiet ones.

### Recommendation: Percentage-based cap + island-tiered pricing

**Cap formula:** Featured slots per island = max(5, floor(published_listings × 3%))

| Island | Est. Listings (at scale) | Featured Slots | Price/mo (Practitioner) | Price/mo (Center) |
|--------|--------------------------|----------------|------------------------|-------------------|
| Big Island | 400 | 12 | $129 | $199 |
| Maui | 300 | 9 | $129 | $199 |
| Oahu | 800 | 24 | $149 | $229 |
| Kauai | 150 | 5 | $99 | $149 |

**Why this works:**
- **Scarcity stays real** — 3% means 97% of listings can't be Featured, so the badge has real value
- **Oahu pays more** — higher competition = higher willingness to pay; justified by larger audience
- **Kauai pays less** — smaller market, lower price point encourages early adoption
- **Scales automatically** — as directories grow, slots increase proportionally without manual adjustment
- **Minimum 5** — protects against empty islands looking weird

**Implementation:** Replace the hardcoded `>= 5` in the DB trigger with a dynamic query:
```sql
SELECT GREATEST(5, FLOOR(count(*) * 0.03))
FROM (
  SELECT id FROM practitioners WHERE island = NEW.island AND status = 'published'
  UNION ALL
  SELECT id FROM centers WHERE island = NEW.island AND status = 'published'
) listings
```

### Alternative considered: Auction model
Let Featured be unlimited but charge market rate via a monthly auction. More complex to implement and confusing for users. Not recommended at this stage — save for later when there's enough demand.

---

## Implementation Priority

### Phase A: Enforce Free tier limits (biggest impact, clearest value gap)
1. Bio/description 250-char limit for free in DashboardProfile + DashboardCenters
2. Hide social links section on public profile for free tier
3. Hide testimonials section for free tier
4. Hide working hours for free tier
5. Hide amenities for free centers
6. Limit centers to 1 location for free tier
7. Hide photo gallery for free tier
8. Show lock icons / upgrade prompts where features are gated

### Phase B: Differentiate Premium vs Featured
1. Photo gallery limit: 5 for premium, 10 for featured
2. Booking calendar embed: featured only
3. Verified checkmark: featured only (or manual admin grant)
4. Location limit for centers: 3 for premium, unlimited for featured

### Phase C: Dynamic Featured pricing
1. Update DB trigger for percentage-based cap
2. Add island-specific pricing to Stripe (4 price IDs per island)
3. Update ListYourPractice to show island-specific Featured pricing
4. Update billing dashboard

---

## What the free listing page should communicate

**For practitioners:**
> "Get discovered by wellness seekers across Hawai'i — free forever. Upgrade to Premium to showcase your full practice with testimonials, classes, and booking links."

**For centers:**
> "List your center in Hawai'i's wellness directory — free forever. Upgrade to Premium to add multiple locations, events, and a photo gallery."

The key message: free gets you listed and findable. Premium makes you look professional and bookable. Featured makes you unmissable.
