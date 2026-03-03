# Aloha Health Hub — System Plan (Source of Truth)

> **Last updated:** 2026-02-25
> **Overseer model:** Claude Sonnet (coordinates agents, integrates changes, runs tests)
> **Agent A — DB Architect:** `qwen/qwen3-coder-30b` via LM Studio (SQL schema + RLS only)
> **Agent B — Data Ops:** `qwen/qwen3-8b` via LM Studio (normalization + JSON output only)

---

## 1. Product Vision

A **lead-generation wellness directory platform** for Hawaiʻi, starting with the Big Island. No on-site payments in v1. All booking/registration is via external links.

**Primary value loop:**
1. Visitors search & discover practitioners, centers, retreats, and articles.
2. They click external booking/registration links.
3. Providers claim unclaimed listings and upgrade to paid tiers (billing scaffold deferred to v2).

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + TypeScript + Tailwind CSS |
| UI Components | shadcn/ui (Radix primitives) |
| Map | Leaflet / react-leaflet (already installed) |
| Data fetching | TanStack Query v5 |
| Routing | react-router-dom v6 |
| Backend | Supabase (Postgres + RLS + Auth) |
| Storage | Supabase Storage (optional, Sprint 3+) |
| Ingestion scripts | Node.js ESM (service role key, never in frontend) |

---

## 3. Routes Inventory (current)

| Route | Component | Status |
|---|---|---|
| `/` | `pages/Index.tsx` | Mock data, needs Supabase wiring |
| `/directory` | `pages/Directory.tsx` | Mock data, needs Supabase wiring |
| `/retreats` | `pages/Retreats.tsx` | Mock data, needs Supabase wiring |
| `/retreats/:id` | `pages/RetreatDetail.tsx` | Mock data, needs Supabase wiring |
| `/articles` | `pages/Articles.tsx` | Mock data, needs Supabase wiring |
| `/profile/:id` | `pages/ProfileDetail.tsx` | Mock data, needs Supabase wiring |
| `/list-your-practice` | `pages/ListYourPractice.tsx` | Static/lead-gen form (keep) |
| `/concierge` | `pages/Concierge.tsx` | Standalone dark layout (keep) |
| `/dashboard` | `DashboardLayout` + sub-routes | Mock, needs Auth + CRUD Sprint 3 |
| `/dashboard/profile` | `DashboardProfile.tsx` | Mock |
| `/dashboard/centers` | `DashboardCenters.tsx` | Mock |
| `/dashboard/retreats` | `DashboardRetreats.tsx` | Mock |
| `/dashboard/billing` | `DashboardBilling.tsx` | **Deferred to v2** — keep UI skeleton, disable actions |
| `/dashboard/settings` | `DashboardSettings.tsx` | Mock |

---

## 4. Mock Data Inventory (`src/data/mockData.ts`)

All current data is mock. Sprint 2 will replace these with Supabase queries. The mock file **must not be deleted** until Supabase queries are verified working. Interfaces defined:

- `Retreat` — map card on homepage
- `Practitioner` — directory + homepage carousel
- `Article` — articles hub + homepage carousel
- `Provider` — union type for map pins
- `Center` — directory tab 2
- `RetreatEvent` — retreats page listing
- `profileData` — single profile detail (static)

---

## 5. Core Database Entities (v1)

### 5.1 `practitioners`
```
id              uuid PK default gen_random_uuid()
owner_id        uuid nullable FK → auth.users(id) ON DELETE SET NULL
name            text NOT NULL
modalities      text[] NOT NULL DEFAULT '{}'
bio             text
island          text NOT NULL DEFAULT 'big_island'
region          text
city            text
address         text
lat             numeric(9,6)
lng             numeric(9,6)
phone           text
email           text
website_url     text
external_booking_url text
accepts_new_clients boolean DEFAULT true
status          text NOT NULL DEFAULT 'draft'  -- draft | published | archived
tier            text NOT NULL DEFAULT 'free'   -- free | premium | featured
created_at      timestamptz DEFAULT now()
updated_at      timestamptz DEFAULT now()
```

### 5.2 `centers`
```
id              uuid PK default gen_random_uuid()
owner_id        uuid nullable FK → auth.users(id) ON DELETE SET NULL
name            text NOT NULL
center_type     text NOT NULL DEFAULT 'wellness_center'  -- spa | wellness_center | clinic | retreat_center
description     text
island          text NOT NULL DEFAULT 'big_island'
region          text
city            text
address         text
lat             numeric(9,6)
lng             numeric(9,6)
phone           text
email           text
website_url     text
external_website_url text
status          text NOT NULL DEFAULT 'draft'
tier            text NOT NULL DEFAULT 'free'
created_at      timestamptz DEFAULT now()
updated_at      timestamptz DEFAULT now()
```

### 5.3 `retreats`
```
id              uuid PK default gen_random_uuid()
owner_id        uuid nullable FK → auth.users(id) ON DELETE SET NULL
title           text NOT NULL
venue_name      text
island          text NOT NULL DEFAULT 'big_island'
region          text
city            text
address         text
lat             numeric(9,6)
lng             numeric(9,6)
start_date      date NOT NULL
end_date        date NOT NULL
starting_price  numeric(10,2)   -- display only, no checkout
description     text
cover_image_url text
registration_url text           -- external link
status          text NOT NULL DEFAULT 'draft'
tier            text NOT NULL DEFAULT 'free'
created_at      timestamptz DEFAULT now()
updated_at      timestamptz DEFAULT now()
```

### 5.4 `articles`
```
id              uuid PK default gen_random_uuid()
slug            text UNIQUE NOT NULL
title           text NOT NULL
excerpt         text
body            text
cover_image_url text
island          text
tags            text[]
featured        boolean DEFAULT false
published_at    timestamptz
status          text NOT NULL DEFAULT 'draft'  -- draft | published | archived
created_at      timestamptz DEFAULT now()
updated_at      timestamptz DEFAULT now()
```

---

## 6. RLS Policy Summary

| Table | Public SELECT | Auth INSERT/UPDATE/DELETE |
|---|---|---|
| practitioners | `status = 'published'` | `owner_id = auth.uid()` |
| centers | `status = 'published'` | `owner_id = auth.uid()` |
| retreats | `status = 'published'` | `owner_id = auth.uid()` |
| articles | `status = 'published'` | service role only (no user edit in v1) |

Unclaimed rows (`owner_id IS NULL`, `status = 'draft'`) are invisible to the public and editable only via service role key from ingestion scripts.

---

## 7. Phased Sprint Plan

### Sprint 0 — Repo Audit + Planning + Docs ✅
- [x] Repo structure audit
- [x] `SYSTEM_PLAN.md` created
- [x] `docs/SCRAPING_PLAYBOOK.md` created
- [x] `.env.example` created
- [x] `README.md` quickstart updated

### Sprint 1 — Database Schema + RLS ✅
**Delegated to Agent A (`qwen/qwen3-coder-30b`) — reviewed and certified by Sonnet**
- [x] SQL migration file: `supabase/migrations/20260225000000_initial_schema.sql`
- [x] `updated_at` trigger function + BEFORE UPDATE trigger on all 4 tables
- [x] RLS: enabled + policies for all tables
- [x] Indexes: `(island, status)`, `(owner_id)`, `start_date` on retreats, `(status, featured)` on articles
- [x] Sonnet reviewed: removed redundant uuid-ossp extension, removed duplicate slug index, added inline security comments

### Sprint 2 — Read-Only Frontend Wiring ✅
**Sonnet implements**
- [x] `@supabase/supabase-js` v2.97.0 installed
- [x] `src/lib/supabase.ts` client singleton (null-safe fallback when env vars absent)
- [x] `src/types/database.ts` TypeScript types for all 4 tables
- [x] `src/lib/adapters.ts` DB rows → component prop shapes
- [x] Hooks: `usePractitioners`, `useCenters`, `useCentersAsProviders`, `useRetreats`, `useRetreat`, `useArticles`, `usePractitioner`
- [x] Directory, Retreats, RetreatDetail, Articles, Index, ProfileDetail all wired
- [x] Skeleton loaders + empty state messages in all pages
- [x] Mock data fallback retained when `VITE_SUPABASE_URL` not set
- [x] Build: ✅ zero TypeScript errors. Tests: ✅ 1/1 passing

### Sprint 3 — Auth + Provider Dashboard CRUD ✅
**Sonnet implements**
- [x] Supabase Auth (email/password or magic link)
- [x] Auth context + protected routes
- [x] Dashboard: claim/edit practitioner profile (owner_id = auth.uid())
- [x] Dashboard: manage centers
- [x] Dashboard: manage retreats
- [x] DashboardBilling: show "Coming Soon" banner (no real payments)

### Sprint 4 — Ingestion Pipeline + Scraping Utilities ✅
**Delegated to Agent B (`qwen/qwen3-8b`)**
- [x] CSV template validation script (`scripts/validate-csv.mjs`)
- [x] JSON normalization rules + sample output (`scripts/normalize.mjs`)
- [x] Ingestion script: CSV → Supabase via service role key (`scripts/ingest.mjs`)
- [x] Playwright/Cheerio scraper stubs: `scripts/scrapers/retreat-guru.mjs`, `book-retreats.mjs`, `local-hubs.mjs`
- [x] Batch size: 100 rows per run (MAX_RESULTS constant in each scraper)

### Sprint 5 — Polish + SEO + Final Verification ✅
**Sonnet implements**
- [x] `<title>` + meta descriptions per route
- [x] `sitemap.xml` generation
- [x] Lazy loading images + route-level code splitting
- [x] Final accessibility pass (aria labels on map, cards)
- [x] Full manual QA checklist (all routes, auth flows, ingestion end-to-end)

---

## 8. Business Constraints (Never Violate)

1. **No on-site checkout or payment processing in v1.** All "Book" / "Register" buttons are `<a href={external_url} target="_blank">` links.
2. **`SUPABASE_SERVICE_ROLE_KEY` is NEVER exposed to the frontend.** It is only used in `scripts/` run locally.
3. **Billing UI** in `DashboardBilling.tsx` keeps its visual scaffold but all actions are disabled with a "Coming Soon" notice in v1.
4. **Unclaimed listings** are inserted with `owner_id = NULL` and `status = 'draft'` and are invisible to the public until claimed and published.

---

## 9. Agent Workflow Rules

1. **Sequential sprints only** — Sprint N+1 does not start until Sprint N is verified by Sonnet.
2. **One heavy agent task at a time** — max 1 active `qwen3-coder-30b` task, max 1 active `qwen3-8b` task simultaneously.
3. **Agent scope is narrow and output-bounded** — each task has a clear deliverable file list.
4. **Sonnet integrates, reviews, and commits** — agents produce artifacts; Sonnet verifies correctness and wires them in.
5. **Do not delete frontend files** — adapt existing components; never remove large UI sections.

---

## 10. Island Support

| Island | v1 | v2+ |
|---|---|---|
| Hawaiʻi (Big Island) | ✅ Primary | — |
| Maui | Scaffold only | ✅ |
| Kauaʻi | Scaffold only | ✅ |
| Oʻahu | Scaffold only | ✅ |

Schema `island` field uses values: `big_island`, `maui`, `kauai`, `oahu`.
