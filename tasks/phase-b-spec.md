# Phase B Implementation Spec — Premium vs Featured Differentiation

## Overview

Phase B adds analytics tracking, verified badges, rich directory cards, enhanced SEO, priority in recommendations, and monthly email reports to clearly differentiate Premium ($49/$129) from Featured ($129/$199).

---

## 1. Analytics Tracking Foundation

### New tables

**`listing_views`** — tracks every profile view
```sql
CREATE TABLE listing_views (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id  uuid NOT NULL,
  listing_type text NOT NULL CHECK (listing_type IN ('practitioner', 'center')),
  viewed_at   timestamptz NOT NULL DEFAULT now(),
  referrer    text,           -- 'directory', 'homepage', 'search', 'direct', 'similar'
  session_id  text             -- anonymous session hash (no PII)
);
CREATE INDEX idx_listing_views_listing ON listing_views(listing_id, viewed_at);
CREATE INDEX idx_listing_views_date ON listing_views(viewed_at);
```

**`listing_impressions`** — tracks search/homepage appearances (Featured only meaningful)
```sql
CREATE TABLE listing_impressions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id    uuid NOT NULL,
  listing_type  text NOT NULL,
  impression_type text NOT NULL CHECK (impression_type IN ('search', 'homepage', 'similar')),
  impressed_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_listing_impressions_listing ON listing_impressions(listing_id, impressed_at);
```

**`contact_clicks`** — tracks CTA engagement
```sql
CREATE TABLE contact_clicks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id  uuid NOT NULL,
  listing_type text NOT NULL,
  click_type  text NOT NULL CHECK (click_type IN ('phone', 'email', 'website', 'booking', 'discovery_call')),
  clicked_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_contact_clicks_listing ON contact_clicks(listing_id, clicked_at);
```

### Tracking implementation

**Profile view tracking:**
- Fire on ProfileDetail.tsx and CenterDetail.tsx mount
- Edge function `track-view` — receives { listing_id, listing_type, referrer }
- Debounce: don't count same session_id + listing_id within 30 minutes
- Session ID: hash of IP + user-agent (no cookies, no PII stored)

**Impression tracking:**
- Fire when Featured listing renders on homepage, in directory search results, or in "similar practitioners"
- Batch: collect impression events and flush every 5 seconds (IntersectionObserver)
- Edge function `track-impressions` — receives array of { listing_id, listing_type, impression_type }

**Contact click tracking:**
- Wrap phone/email/website/booking links with onClick handler
- Edge function `track-click` — receives { listing_id, listing_type, click_type }

### Analytics dashboard widget

**Premium sees:**
- Total profile views (last 30 days) — single number
- Total contact clicks (last 30 days) — single number
- "Upgrade to Featured for detailed analytics with trends, search impressions, and monthly reports"

**Featured sees:**
- Profile views: 30/60/90 day trend chart (sparkline or bar chart)
- Search impressions: how many times listing appeared in results
- Homepage impressions: rotation views + click-through rate
- Contact clicks: breakdown by type (phone, email, booking, etc.)
- Competitor benchmark: "You rank #N of M [top modality] practitioners on [island]"
  - Ranking based on composite score from profile views + contact clicks

### Dashboard location
New tab in sidebar for Premium+Featured: "Analytics" (chart icon)
- Route: `/dashboard/analytics`
- Component: `DashboardAnalytics.tsx`

---

## 2. Verified Badge

### Data model
Add column to practitioners and centers:
```sql
ALTER TABLE practitioners ADD COLUMN verified_at timestamptz;
ALTER TABLE centers ADD COLUMN verified_at timestamptz;
```
When `verified_at IS NOT NULL`, the listing is verified.

### Admin panel
- Add "Verify" button in admin practitioner/center edit dialogs
- Sets `verified_at = now()` or clears it

### Frontend display
- `VerifiedBadge` component: green checkmark + "Verified" text
- Shown on: ProviderCard, CenterCard, ProfileDetail header, CenterDetail header
- Only for Featured tier listings that have been verified by admin
- Tooltip: "This practitioner has been verified by Hawaiʻi Wellness"

### Featured-only gate
- Only Featured tier listings can BE verified (admin UI prevents verifying non-Featured)
- If a listing downgrades from Featured, verified_at is NOT cleared (they keep it as goodwill) but badge stops showing (frontend checks tier + verified_at)

---

## 3. Rich Directory Card (Featured only)

### Current card
All tiers show the same compact card: photo, name, location, modalities, tier badge.

### Featured enhanced card
In Directory.tsx, when rendering a Featured listing:
- Card height increases slightly
- Shows 2-line bio excerpt below modalities
- Shows top testimonial snippet (1 line, italic, with quotes)
- Subtle gold/amber left border accent
- "Featured" badge is more prominent

### Implementation
- In ProviderCard.tsx: add `featured` variant
- Check `provider.tier === 'featured'` and render expanded layout
- Same for CenterCard.tsx

---

## 4. Enhanced SEO (Featured only)

### Current structured data
All listings get basic LocalBusiness schema (name, address, phone, geo).

### Featured enhanced schema
Add to ProfileDetail.tsx and CenterDetail.tsx when `tier === 'featured'`:

**Review/Rating schema** (already partially exists):
```json
{
  "@type": "AggregateRating",
  "ratingValue": "5",
  "reviewCount": "12"
}
```

**FAQ schema** from "What to Expect" section:
```json
{
  "@type": "FAQPage",
  "mainEntity": [{
    "@type": "Question",
    "name": "What to expect from a session with [Name]?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "[whatToExpect content]"
    }
  }]
}
```

**Service catalog schema** (enhanced):
```json
{
  "@type": "OfferCatalog",
  "itemListElement": [
    { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Massage", "description": "..." } }
  ]
}
```

---

## 5. Priority in Similar Practitioners

### Current behavior
`useSimilarPractitioners` hook fetches practitioners on the same island with overlapping modalities, ordered by name.

### Featured priority
Update the hook/query to sort Featured listings first:
```sql
ORDER BY
  CASE WHEN tier = 'featured' THEN 0 WHEN tier = 'premium' THEN 1 ELSE 2 END,
  -- then by modality overlap count, then name
```

Same for centers in any "similar centers" section.

---

## 6. Monthly Email Report (Featured only)

### Email service: Resend
- API key stored as Supabase secret: `RESEND_API_KEY`
- From address: `analytics@hawaiiwellness.net` (or `noreply@`)
- React Email templates for consistent branding

### Report content
Monthly PDF/HTML email containing:
- Total profile views (this month vs last month, % change)
- Total search impressions
- Homepage impression count + CTR
- Contact click breakdown (phone, email, booking)
- Top referral sources
- Competitor ranking ("You're #2 of 8 massage therapists on Big Island")
- Call-to-action: "Update your profile to improve your ranking"

### Scheduling
- Supabase cron job or Edge Function triggered by pg_cron
- Runs on 1st of each month at 9am HST
- Query: all listings with tier = 'featured' and owner email
- Generate report per listing, send via Resend API

### Edge function: `send-monthly-report`
```
1. Query all featured listings with owner_id
2. For each, aggregate last 30 days of views/impressions/clicks
3. Build HTML email using React Email template
4. Send via Resend API
5. Log send status
```

---

## Implementation Order

| Step | What | Files | Effort |
|------|------|-------|--------|
| B1 | Analytics tables + tracking edge functions | migrations, 3 edge functions | Medium |
| B2 | Profile/center view tracking on mount | ProfileDetail, CenterDetail | Small |
| B3 | Contact click tracking wrappers | ProfileDetail, CenterDetail | Small |
| B4 | DashboardAnalytics page (Premium: basic, Featured: full) | New page + sidebar link | Medium |
| B5 | Verified badge (admin + display) | AdminPanel, ProviderCard, CenterCard, ProfileDetail, CenterDetail | Medium |
| B6 | Rich directory card for Featured | ProviderCard, CenterCard | Small |
| B7 | Enhanced SEO schemas | ProfileDetail, CenterDetail | Small |
| B8 | Similar practitioners priority sort | useSimilarPractitioners hook | Small |
| B9 | Monthly email report edge function + Resend | New edge function + email template | Medium |
| B10 | Update pricing pages + feature lists | ListYourPractice, useStripe, DashboardBilling | Small |

Total estimate: ~3-4 focused sessions

---

## Updated Feature Lists (for pricing pages)

### Practitioner Premium ($49/mo)
- Unlimited bio & "What to Expect" section
- Social media links on your profile
- Client testimonials display
- Photo gallery (up to 5 photos)
- Working hours display
- Offerings, classes & events
- Booking calendar embed
- Profile view & contact click counts
- Priority listing placement

### Practitioner Featured ($129/mo)
- Everything in Premium, plus:
- Photo gallery (up to 10 photos)
- Full analytics dashboard with trends
- Search & homepage impression tracking
- Competitor ranking benchmark
- Monthly analytics report emailed to you
- "Verified Practitioner" badge
- Enhanced Google search visibility (SEO)
- Priority in "Similar Practitioners" recommendations
- Rich directory card with bio & testimonial preview
- Homepage spotlight rotation
- Top placement in search results
- Limited featured spots per island

### Center Premium ($79/mo)
- Unlimited description
- Photo gallery (up to 5 photos) & social links
- Events, testimonials & amenities
- Working hours per location
- Booking calendar embed
- Up to 3 locations
- Profile view & contact click counts
- Priority listing placement

### Center Featured ($199/mo)
- Everything in Premium, plus:
- Photo gallery (up to 10 photos)
- Unlimited locations
- Full analytics dashboard with trends
- Search & homepage impression tracking
- Monthly analytics report emailed to you
- "Verified Center" badge
- Enhanced Google search visibility (SEO)
- Priority in "Similar Centers" recommendations
- Rich directory card with description & testimonial preview
- Homepage spotlight rotation
- Top placement in search results
- Limited featured spots per island
