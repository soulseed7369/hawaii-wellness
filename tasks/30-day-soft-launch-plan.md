# Hawaii Wellness 30-Day Soft Launch Plan
## Big Island First: Claims → Upsell → Organic Growth

**Created:** 2026-03-25
**Owner:** Marcus
**Goal:** Launch outreach to Big Island published listings, convert claims, upsell Premium + Website Packages, and deploy OpenClaw for scalable organic growth.

---

## 1. Audit Summary: What's Already Built

### Ready to Execute (No Build Needed)
| Asset | Status | Location |
|-------|--------|----------|
| Campaign DB schema | Migration written | `20260318000003_campaign_tables.sql` |
| Campaign init script | Complete | `pipeline/scripts/40_campaign_init.py` |
| Segmentation + batching | Complete | `pipeline/scripts/41_campaign_segment.py` |
| Email send via Resend | Complete | `pipeline/scripts/42_campaign_send.py` |
| Event sync (opens/clicks/claims) | Complete | `pipeline/scripts/43_campaign_sync.py` |
| Dashboard data export | Complete | `pipeline/scripts/44_campaign_export.py` |
| Email templates (4 segments) | Complete | `pipeline/src/email_templates.py` |
| Website Packages page | Live | `hawaiiwellness.net/website-packages` |
| List Your Practice page | Live | `hawaiiwellness.net/list-your-practice` |
| Discovery Call booking | Live | Google Calendar link |
| Claim flow (magic link auth) | Live | `?claimId={id}` param |
| Admin Campaign tab | Built | AdminPanel.tsx |
| Admin Marketing Leads tab | Built | AdminPanel.tsx |
| SEO meta tags + structured data | Done | Sprint 2 SEO work |
| Taxonomy search + autocomplete | Built | Sprint 1-4 search rebuild |
| Soft launch plan (7-day) | Written | `soft-launch-plan.md` |
| Website sales campaign plan | Written | `marketing-website-sales-campaign.md` |
| Pricing strategy | Written | `tasks/pricing-and-positioning-strategy.md` |
| Monetization analysis | Written | `monetization-analysis.md` |
| Outreach contacts (70+ sites) | Written | `outreach-contacts.md` |
| Outreach link-building templates | Written | `outreach-template.md` |

### Needs Setup Before Launch
| Item | Effort | Blocker? |
|------|--------|----------|
| Apply campaign DB migration to Supabase | 5 min (paste SQL in dashboard) | **Yes** |
| Apply taxonomy migrations (Sprint 5) | 15 min (7 migration files) | No (search works without) |
| Run `40_campaign_init.py --island big_island` | 2 min | Yes (needs migration first) |
| Verify Resend API key + domain auth | 10 min | **Yes** (email deliverability) |
| Replace Stripe `prod_xxx` IDs with `price_xxx` | 5 min | **Yes** (checkout broken without) |
| Test claim flow end-to-end | 15 min | Yes (must work before outreach) |
| Run taxonomy backfill pipeline | 30 min | No (nice-to-have for search quality) |

### Not Built Yet (Build During Sprint)
| Item | Effort | When |
|------|--------|------|
| OpenClaw agent configs for content/outreach | 2-3 hours | Week 1 |
| Blog articles (SEO content) | Ongoing via OpenClaw | Weeks 2-4 |
| Automated follow-up email (email_2) template | 30 min | Week 2 |
| Website package inquiry tracking in campaign DB | 1 hour | Week 3 |
| Simple analytics dashboard (HTML) | 2 hours | Week 1 |

---

## 2. The 30-Day Timeline

### Pre-Launch (Days -2 to 0): Infrastructure Check

**Day -2 (Today, March 25)**
- [ ] Apply `20260318000003_campaign_tables.sql` migration to Supabase
- [ ] Verify Resend API key is set (`RESEND_API_KEY` in pipeline `.env`)
- [ ] Verify Resend domain authentication for `hawaiiwellness.net`
- [ ] Fix Stripe price IDs in `src/lib/stripe.ts` (replace `prod_xxx` with `price_xxx`)

**Day -1 (March 26)**
- [ ] Run `40_campaign_init.py --island big_island` to seed campaign data
- [ ] Run `41_campaign_segment.py --stats` to see Big Island breakdown
- [ ] Test claim flow: create a test listing, send yourself the claim email, claim it
- [ ] Test the full pipeline: init → segment → send (dry-run) → verify email renders
- [ ] Send yourself a test email via `42_campaign_send.py --test --to marcuswoo@gmail.com`

**Day 0 (March 27)**
- [ ] Review email templates one final time (personalization, links, tone)
- [ ] Confirm website packages page is polished and discovery call link works
- [ ] Set up a simple tracking spreadsheet or use the campaign export dashboard
- [ ] **GO LIVE decision**

---

### Week 1 (Days 1-7): Practitioners Claim Outreach

**Theme:** "Your practice is already listed. Claim it for free."

**Daily rhythm:**
1. Morning: Run `43_campaign_sync.py` to check overnight opens/clicks/claims
2. Send batch: `41_campaign_segment.py` + `42_campaign_send.py` (25/day)
3. Evening: Check replies, respond personally within 2 hours

**Day 1-2: First Batch (50 practitioners)**
- [ ] Generate batch: `41_campaign_segment.py --island big_island --segment unclaimed --limit 25`
- [ ] Send: `42_campaign_send.py --batch output/batch_*.json`
- [ ] Repeat Day 2 with next 25
- [ ] Monitor: bounces, opens, clicks, claims
- [ ] Target: 10-15 opens, 3-5 claims

**Day 3-4: Second Batch (50 practitioners)**
- [ ] Send next 50 unclaimed Big Island practitioners
- [ ] Follow up on Day 1-2 openers who didn't claim (personal reply or SMS)
- [ ] Target cumulative: 25+ opens, 8-10 claims

**Day 5-7: Third Batch + Follow-ups**
- [ ] Send remaining unclaimed Big Island practitioners with email
- [ ] Send follow-up email (email_2) to Day 1-4 openers who haven't claimed
- [ ] Start phone outreach to high-priority contacts who opened but didn't claim
- [ ] Target cumulative: 15-20 claims

**Week 1 OpenClaw Tasks:**
- [ ] Configure OpenClaw agent for blog content generation (see Section 4)
- [ ] Generate first 3 SEO blog articles targeting Big Island wellness keywords
- [ ] Configure OpenClaw agent for social media content

**Week 1 Metrics:**
| Metric | Target |
|--------|--------|
| Emails sent | 100-150 |
| Open rate | 20-25% |
| Claims | 15-20 |
| Profile completions | 5-10 |

---

### Week 2 (Days 8-14): Centers + Profile Completion Push

**Theme:** "Complete your profile — people are searching for you."

**Day 8-9: Centers Outreach Begins**
- [ ] Run `41_campaign_segment.py --island big_island --segment unclaimed` (filter for centers)
- [ ] Send claim emails to all Big Island published centers with email
- [ ] Use center-specific messaging: emphasize photos, working hours, Google Maps visibility

**Day 10-12: Profile Completion Nudge (Claimed Practitioners)**
- [ ] For practitioners who claimed but have incomplete profiles:
  - Send "Complete your profile" nudge email (new template needed)
  - Highlight what's missing: photo, bio, modalities, contact info
  - Show them their profile vs. a "complete" example
- [ ] Personal outreach (text/call) to the most promising claimed practitioners

**Day 13-14: First Upsell Signals**
- [ ] Identify claimed practitioners with complete profiles → warm leads for Premium
- [ ] Send soft Premium tease: "Your profile is looking great. Here's what Premium adds..."
- [ ] NO hard sell yet — just plant the seed

**Week 2 OpenClaw Tasks:**
- [ ] Publish 3 more blog articles (target: 6 total by end of Week 2)
- [ ] Generate social media posts promoting new blog content
- [ ] Begin link-building outreach to sites in `outreach-contacts.md` using OpenClaw for personalized emails

**Week 2 Metrics:**
| Metric | Target (Cumulative) |
|--------|---------------------|
| Total claims | 25-35 |
| Centers claimed | 5-8 |
| Profiles >70% complete | 15-20 |
| Blog articles live | 6 |

---

### Week 3 (Days 15-21): Premium Upsell + Expand to Other Islands

**Theme:** "Hundreds of people search our directory every week. Stand out."

**Day 15-17: Premium Upsell — Segmented Outreach**
- [ ] **Segment A (claimed + has website):** Send Phase 2 Track A email
  - Positioning: "Your website converts. Hawaii Wellness finds."
  - CTA: Upgrade to Premium ($49/mo Kamaaina)
- [ ] **Segment B (claimed + no website):** Send Phase 2 Track B email
  - Positioning: "Premium IS your website — shareable, bookable, found on Google"
  - CTA: Upgrade to Premium ($49/mo Kamaaina)

**Day 18-19: Website Package Soft Intro**
- [ ] Identify Segment B practitioners who opened Premium email but didn't convert
- [ ] Send website bundle intro email (Phase 2 Track C)
  - Positioning: "Done-for-you website + directory listing, live in 2 weeks"
  - CTA: Book a 15-minute discovery call
- [ ] Goal: 2-3 discovery calls booked

**Day 20-21: Expand Campaign Init**
- [ ] Run `40_campaign_init.py --island maui` to prepare Maui data
- [ ] Run `41_campaign_segment.py --stats` to preview Maui numbers
- [ ] Queue first Maui batch for Week 4 launch

**Week 3 OpenClaw Tasks:**
- [ ] Generate island-specific landing page content (Big Island wellness guide)
- [ ] Create "practitioner spotlight" social content featuring claimed practitioners (with permission)
- [ ] Run automated outreach to 20+ link-building targets
- [ ] Publish 3 more blog articles (target: 9 total)

**Week 3 Metrics:**
| Metric | Target (Cumulative) |
|--------|---------------------|
| Total claims | 35-50 |
| Premium upgrades | 3-5 |
| Website package inquiries | 2-3 |
| Discovery calls booked | 1-2 |
| Blog articles live | 9 |
| Backlinks acquired | 3-5 |

---

### Week 4 (Days 22-30): Revenue Push + Maui Launch

**Theme:** "Limited Kamaaina spots available."

**Day 22-24: Urgency + Social Proof**
- [ ] Send Premium follow-up with urgency: "X of 25 Kamaaina spots remaining"
- [ ] Include social proof: "[Practitioner name] just upgraded and got 3 new clients this week"
- [ ] Personal calls to top 5 warm leads (opened multiple emails, complete profile)

**Day 25-27: Website Package Push**
- [ ] Send dedicated website package email to all claimed practitioners without websites
- [ ] Highlight examples on the website packages page
- [ ] Offer early-bird pricing or bonus (extra page, free SEO setup)
- [ ] Book and conduct discovery calls

**Day 28-30: Maui Launch + Month-End Review**
- [ ] Launch Maui claim outreach (replicate Week 1 playbook)
- [ ] Run `44_campaign_export.py` for full month metrics
- [ ] Review: what worked, what didn't, adjust for Month 2
- [ ] Update `tasks/lessons.md` with campaign learnings

**Week 4 OpenClaw Tasks:**
- [ ] Generate Maui-specific blog content before Maui launch
- [ ] Automate weekly social media posting schedule
- [ ] Generate competitor analysis content
- [ ] Publish final 3 articles (target: 12 total for the month)

**Week 4 Metrics:**
| Metric | Target (End of Month) |
|--------|----------------------|
| Total claims (Big Island) | 40-60 |
| Premium upgrades | 5-10 |
| Featured upgrades | 1-2 |
| Website packages sold | 1-3 |
| Monthly recurring revenue | $300-$800 |
| One-time revenue (websites) | $500-$3,000 |
| Blog articles live | 12 |
| Organic search impressions | Baseline established |
| Backlinks acquired | 5-10 |

---

## 3. Revenue Projections (Conservative)

### Month 1 Revenue Scenarios

| Scenario | Claims | Premium | Featured | Websites | MRR | One-Time |
|----------|--------|---------|----------|----------|-----|----------|
| Conservative | 30 | 3 | 0 | 0 | $147 | $0 |
| Moderate | 45 | 6 | 1 | 1 | $393 | $597 |
| Strong | 60 | 10 | 2 | 2 | $688 | $1,194 |

*MRR assumes Kamaaina rates: Premium $49/mo practitioners, Featured $99/mo*

### Month 2-3 Compounding (with Maui + Oahu added)

| Month | Est. MRR | Est. One-Time | Cumulative |
|-------|----------|---------------|------------|
| Month 1 | $300-$700 | $0-$1,200 | $300-$1,900 |
| Month 2 | $700-$1,500 | $600-$2,400 | $1,600-$5,800 |
| Month 3 | $1,200-$2,500 | $1,200-$4,200 | $4,000-$12,500 |

---

## 4. OpenClaw Agent Strategy

OpenClaw with GPT-5.4 is best used for tasks that are repetitive, content-heavy, and benefit from the 1M+ token context window. Here's how to deploy it across three workstreams:

### Workstream A: SEO Blog Content Engine (Highest Impact)

**Why:** Blog articles drive organic search traffic. GPT-5.4's native computer use can research, write, and format articles autonomously.

**Agent Configuration:**
- **Input:** Target keyword + island + modality
- **Process:** Research top-ranking content → write 1,500-2,000 word article → optimize for SEO (title, meta, headings, internal links) → output markdown
- **Output:** Article ready for `articles` table in Supabase

**Content Calendar (12 articles in 30 days):**

| Week | Articles | Keywords |
|------|----------|----------|
| 1 | 3 | "wellness practitioners big island hawaii", "hawaiian healing traditions kona", "best massage therapists hilo" |
| 2 | 3 | "yoga retreats big island", "acupuncture hawaii island", "holistic health kailua kona" |
| 3 | 3 | "lomilomi massage hawaii", "naturopathic doctors hawaii", "meditation retreats big island" |
| 4 | 3 | "wellness retreats maui" (pre-Maui launch), "hawaiian healing modalities guide", "how to find a wellness practitioner in hawaii" |

**Expected Impact:** 12 indexed pages targeting long-tail wellness keywords. At 50-200 impressions/article/month after indexing, that's 600-2,400 new monthly search impressions within 60 days.

### Workstream B: Personalized Outreach at Scale

**Why:** The campaign pipeline sends templated emails. OpenClaw can personalize each email using practitioner-specific data (modalities, website content, location).

**Agent Configuration:**
- **Input:** Practitioner row from `campaign_outreach` (name, modalities, city, website_url)
- **Process:** If website exists, crawl it (OpenClaw's native computer use) → extract key details about their practice → write a 3-sentence personalized opening → merge with email template
- **Output:** Personalized email body ready for Resend

**How to Integrate:**
1. Export batch contacts as JSON from `41_campaign_segment.py`
2. Feed each contact to OpenClaw agent for personalization
3. Merge personalized intros back into email templates
4. Send via existing `42_campaign_send.py` pipeline

**Expected Impact:** Personalized emails typically see 2-3x higher reply rates. Going from 5% to 12-15% reply rate on 150 emails = 10-15 more conversations.

### Workstream C: Link-Building + Social Content

**Why:** Backlinks from Hawaii tourism, wellness, and local sites boost domain authority. Social content keeps the brand visible between email touches.

**Agent Configuration (Link Building):**
- **Input:** Target site from `outreach-contacts.md` (70+ sites already identified)
- **Process:** Visit site → find relevant page/contact → draft personalized outreach email proposing a link/guest post/partnership
- **Output:** Outreach email ready to send

**Agent Configuration (Social Media):**
- **Input:** New blog article or practitioner spotlight
- **Process:** Generate 3 platform variants (Instagram caption, Facebook post, X thread)
- **Output:** Social posts with suggested images/hashtags

**Expected Impact:**
- 5-10 backlinks in 30 days from targeted outreach
- Consistent social presence (3-4 posts/week) building brand recognition
- Each backlink improves domain authority → better rankings for all pages

### OpenClaw Priority Ranking

| Priority | Workstream | Hours/Week | ROI |
|----------|------------|------------|-----|
| 1 | SEO Blog Content | 3-4 hrs | Highest (compounds over time) |
| 2 | Personalized Outreach | 2-3 hrs | High (direct revenue impact) |
| 3 | Link Building | 2 hrs | Medium-High (takes 2-3 months to show) |
| 4 | Social Content | 1-2 hrs | Medium (brand awareness) |

---

## 5. Website Packages Upsell Funnel

### The Journey: Free → Claimed → Premium → Website Package

```
Published listing (unclaimed)
    ↓ Phase 1 email: "Claim your free listing"
Claimed listing (free tier)
    ↓ Profile completion nudge
Complete profile (free tier)
    ↓ Phase 2 email: segment-specific Premium pitch
Premium subscriber ($49/mo)
    ↓ Website package email + discovery call CTA
Website package client ($497-$1,397 one-time)
```

### Key Upsell Moments

1. **Claim → Premium (Week 3):** After they've seen their listing and completed their profile, they understand the value. Pitch Premium as "the next level."

2. **Premium → Website (Week 4+):** Premium subscribers who don't have their own website are the warmest leads. They've already invested $49/mo, proving willingness to pay. The website is the natural next step.

3. **No-Website → Website Direct (Week 3-4):** Some practitioners will skip Premium entirely if the website package includes a Premium subscription (which it does at the Standard and Pro tiers).

### Website Package Positioning by Segment

| Segment | Package | Pitch |
|---------|---------|-------|
| Claimed, no website, low-tech | Essentials ($497) | "We build it, you just approve. Live in 2 weeks." |
| Claimed, no website, growth-minded | Standard ($897) | "Your own site + booking + SEO. Everything you need." |
| Premium, has outdated website | Pro ($1,397) | "Replace your DIY site with something that actually converts." |

---

## 6. Daily Operations Checklist

```
MORNING (15 min):
  □ Run: cd pipeline && python scripts/43_campaign_sync.py --since 24h
  □ Check: new claims, opens, replies in sync output
  □ Respond: reply to any inbound emails within 2 hours

MIDDAY (30 min):
  □ Send: next batch of outreach emails (25/day target)
  □ Review: OpenClaw-generated content (blog articles, social posts)
  □ Publish: approved content to blog/social

EVENING (15 min):
  □ Run: python scripts/44_campaign_export.py
  □ Review: daily metrics in campaign_data.json
  □ Plan: tomorrow's batch and any personal follow-ups needed
```

---

## 7. Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Low open rates (<15%) | A/B test subject lines; try "Aloha [Name]" vs. current |
| Email deliverability issues | Warm up domain gradually (25/day week 1, increase); monitor Resend reputation |
| Claims but no profile completion | Send "complete your profile" nudge at Day 3 post-claim |
| Low Premium conversion | Add testimonial/social proof to upgrade emails; offer first month at $29 |
| Website package: no discovery calls | Lower barrier — offer free "website review" instead of "discovery call" |
| Stripe checkout broken (price IDs) | **Must fix before any paid conversion is possible** — critical blocker |
| OpenClaw rate limits / costs | Start with blog content (highest ROI), scale up as budget allows |

---

## 8. Success Criteria (End of 30 Days)

### Must Hit (Minimum Viable Launch)
- [ ] 25+ Big Island practitioners claimed their listing
- [ ] Campaign pipeline running daily without manual intervention
- [ ] Stripe checkout working (price IDs fixed)
- [ ] 3+ Premium subscribers

### Should Hit (Good Launch)
- [ ] 40+ claims
- [ ] 5+ Premium subscribers
- [ ] 1+ website package inquiry
- [ ] 6+ blog articles indexed by Google
- [ ] Maui outreach queued and ready

### Stretch (Great Launch)
- [ ] 60+ claims
- [ ] 10+ Premium subscribers
- [ ] 1+ website package sold
- [ ] 12 blog articles live
- [ ] 5+ backlinks acquired
- [ ] $500+ MRR

---

## 9. Immediate Next Actions (Do Today)

1. **Apply campaign DB migration** — paste SQL into Supabase dashboard
2. **Fix Stripe price IDs** — get real `price_xxx` IDs from Stripe dashboard, update `src/lib/stripe.ts`
3. **Verify Resend setup** — confirm API key, domain auth, test send
4. **Test claim flow** — end-to-end test with a real listing
5. **Run campaign init** — `python scripts/40_campaign_init.py --island big_island`
6. **Configure OpenClaw** — set up first agent for blog content generation
7. **Write first batch of blog content** — 3 articles targeting Big Island keywords

---

*This plan synthesizes and supersedes the previous `soft-launch-plan.md` (7-day scope) and `marketing-website-sales-campaign.md` (website-only focus) into a unified 30-day execution plan.*
