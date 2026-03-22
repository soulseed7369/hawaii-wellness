# Hawaiʻi Wellness — Full Codebase Audit Report

**Date:** 2026-03-22
**Auditor:** Claude
**Scope:** Site speed, SEO, accessibility, architecture, maintainability, reliability, user flows, mobile experience

---

## Pass 1: Baseline Summary

- **Stack:** React 18 + TypeScript 5.8 + Vite 5.4 + Tailwind 3.4 + Supabase + Stripe + Vercel
- **Build:** ✅ Passes cleanly (6.7s)
- **TypeScript:** ✅ `tsc --noEmit` passes (strict mode OFF — `noImplicitAny: false`, `strictNullChecks: false`)
- **Lint:** ❌ 148 errors, 15 warnings (mostly `no-explicit-any` in admin panel + edge functions)
- **Tests:** ⚠️ Only 1 placeholder test file exists
- **Total source:** ~175 TS/TSX files, ~33,600 lines in `src/`
- **Routes:** 40+ (public pages, auth, dashboard, admin)
- **Bundle:** 14 MB total dist; largest public chunk = Directory at 177 KB (52 KB gzip)
- **Admin chunk:** 1,052 KB (306 KB gzip) — acceptable, behind auth wall

---

## Pass 2: Top 10 Issues by Business Impact

### Issue #1 — Hero images are 2–3 MB each (UNCOMPRESSED JPEGs)

| Field | Value |
|-------|-------|
| **Severity** | 🔴 Critical |
| **Evidence** | `public/maui hero.jpg` = 2.3 MB, `oahu hero.jpg` = 2.4 MB, `kauai hero.jpg` = 2.9 MB, `big_island_hero_mauna_kea.jpg` = 778 KB. OG image = 2.2 MB. |
| **Impacted files** | `public/*.jpg`, `src/components/SearchBar.tsx` (renders hero `<img>` without lazy/srcset) |
| **Why it matters** | On mobile 4G (~1.5 Mbps), the Kauai page takes ~15 seconds just for the hero image. This is the #1 Largest Contentful Paint (LCP) killer. Google penalizes LCP > 2.5s in Core Web Vitals → lower search rankings → fewer visitors. |
| **Recommended fix** | Convert to WebP (70–80% smaller), generate responsive sizes (640w/1024w/1920w), add `<picture>` with srcset in SearchBar.tsx, add `fetchpriority="high"` to hero. |
| **Fix timing** | 🟢 Fix now (Pass 3) |

---

### Issue #2 — Google Fonts loaded via render-blocking @import

| Field | Value |
|-------|-------|
| **Severity** | 🔴 Critical |
| **Evidence** | `src/index.css` line 1: `@import url('https://fonts.googleapis.com/css2?...')` loads 10 font weights synchronously. |
| **Impacted files** | `src/index.css`, `index.html` |
| **Why it matters** | @import blocks CSS parsing → blocks first paint. Users see a blank page until Google Fonts DNS resolves + downloads. On slow connections, this adds 500ms–2s to Time to First Contentful Paint (FCP). |
| **Recommended fix** | Replace @import with `<link rel="preconnect">` + `<link rel="stylesheet">` in index.html. Reduce to 2–3 weights per family (body: 400/600, headings: 600/700). Add `font-display: swap`. |
| **Fix timing** | 🟢 Fix now (Pass 3) |

---

### Issue #3 — Directory.tsx fires 3 duplicate/unused DB queries

| Field | Value |
|-------|-------|
| **Severity** | 🟠 High |
| **Evidence** | Lines 577–579 in `Directory.tsx`: `usePractitioners()`, `useCenters()`, and `useCentersAsProviders()` all fire unconditionally even when the new search RPC (`VITE_USE_NEW_SEARCH=true`) handles everything. `centersAsProviders` is never read. |
| **Impacted files** | `src/pages/Directory.tsx`, `src/hooks/usePractitioners.ts`, `src/hooks/useCenters.ts` |
| **Why it matters** | Every Directory page load fires 3 extra Supabase queries that return hundreds of rows for nothing. Wastes bandwidth, slows Supabase response, and increases Supabase bill. |
| **Recommended fix** | Pass `enabled: !USE_NEW_SEARCH` to old hooks. Remove the unused `centersAsProviders` call entirely. |
| **Fix timing** | 🟢 Fix now (Pass 3) |

---

### Issue #4 — Dead code ships in production (Index.tsx, recharts, mockData)

| Field | Value |
|-------|-------|
| **Severity** | 🟠 High |
| **Evidence** | `Index.tsx` is lazy-imported in App.tsx but never routed. Recharts is installed + chunked but never actually rendered (DashboardAnalytics uses custom HTML bars). `mockData.ts` has 4 unused exports. |
| **Impacted files** | `src/pages/Index.tsx`, `src/App.tsx` (line 20), `src/components/ui/chart.tsx`, `src/data/mockData.ts`, `package.json` |
| **Why it matters** | Recharts + d3 dependencies add ~150 KB to the build for zero benefit. Dead imports bloat the dependency tree and confuse future developers. |
| **Recommended fix** | Delete Index.tsx + its lazy import. Remove recharts from package.json if not planned. Clean unused mockData exports. |
| **Fix timing** | 🟢 Fix now (Pass 3) |

---

### Issue #5 — Island homepages fetch ALL practitioners/centers, display only 4

| Field | Value |
|-------|-------|
| **Severity** | 🟠 High |
| **Evidence** | `IslandHome.tsx` calls `usePractitioners(island)` and `useCenters(island)` which return ALL published listings, then `.slice(0, 4)` to show only the top 4 featured. |
| **Impacted files** | `src/pages/IslandHome.tsx`, `src/hooks/usePractitioners.ts`, `src/hooks/useCenters.ts` |
| **Why it matters** | Big Island may have 200+ practitioners. Fetching all of them just to show 4 wastes bandwidth and slows page load. Mobile users on cellular connections feel this. |
| **Recommended fix** | Add `.limit(8)` to the Supabase queries in the hooks (or create a separate `useFeaturedPractitioners(island, limit)` hook). |
| **Fix timing** | 🟡 Fix later (Pass 4 — needs hook refactor to avoid breaking Directory) |

---

### Issue #6 — No Content Security Policy (CSP)

| Field | Value |
|-------|-------|
| **Severity** | 🟠 High |
| **Evidence** | `vercel.json` has X-Frame-Options, HSTS, etc. but no `Content-Security-Policy` header. |
| **Impacted files** | `vercel.json` |
| **Why it matters** | Without CSP, the site is vulnerable to XSS injection from third-party scripts. DOMPurify mitigates article body XSS, but doesn't protect against injected `<script>` tags from other vectors (e.g., user-generated content in testimonials, admin-edited HTML). Google also flags missing CSP in security audits. |
| **Recommended fix** | Add a report-only CSP first (`Content-Security-Policy-Report-Only`), then tighten once stable. Allow self, Google Fonts, Supabase, Stripe, Leaflet CDN. |
| **Fix timing** | 🟡 Fix later (Pass 4 — needs careful testing) |

---

### Issue #7 — Directory map (Leaflet) loads eagerly even when hidden

| Field | Value |
|-------|-------|
| **Severity** | 🟡 Medium |
| **Evidence** | `Directory.tsx` line 12 imports `DirectoryMap` statically. Line 823 renders it with CSS `hidden` instead of conditional mount. Leaflet JS + CSS loads regardless. |
| **Impacted files** | `src/pages/Directory.tsx`, `src/components/DirectoryMap.tsx` |
| **Why it matters** | Leaflet adds ~40 KB to the Directory chunk. On mobile (where map is hidden by default), this is pure waste. Users who only want the list pay the map tax. |
| **Recommended fix** | Use `React.lazy()` for DirectoryMap. Render conditionally: `{showMap && <Suspense><DirectoryMap /></Suspense>}`. |
| **Fix timing** | 🟢 Fix now (Pass 3) |

---

### Issue #8 — Accessibility gaps in Directory filter UI

| Field | Value |
|-------|-------|
| **Severity** | 🟡 Medium |
| **Evidence** | Radio buttons in FilterPanel lack `id`/`htmlFor` pairing. Search input at line 691 has no `aria-label`. Result count has no `aria-live` region. |
| **Impacted files** | `src/pages/Directory.tsx` (lines 248, 318–322, 691, 754–755) |
| **Why it matters** | Screen reader users can't identify filter controls. Directory is the core product page — it must be accessible. ADA compliance risk for a Hawaii business directory. |
| **Recommended fix** | Add `id` + `htmlFor` to all form inputs. Add `aria-label` to search. Add `aria-live="polite"` to result count. |
| **Fix timing** | 🟢 Fix now (Pass 3) |

---

### Issue #9 — TypeScript strict mode is OFF

| Field | Value |
|-------|-------|
| **Severity** | 🟡 Medium |
| **Evidence** | `tsconfig.app.json`: `strict: false`, `noImplicitAny: false`, `strictNullChecks: false`. ESLint: `no-unused-vars: off`. |
| **Impacted files** | `tsconfig.app.json`, `eslint.config.js` |
| **Why it matters** | Null/undefined errors can crash the app at runtime with no TypeScript warning. 148 lint errors are ignored. This makes refactoring dangerous and hides real bugs. |
| **Recommended fix** | Enable `strictNullChecks` first (catches the most real bugs). Fix errors incrementally. Re-enable `no-unused-vars` as warning. |
| **Fix timing** | 🟡 Fix later (Pass 4 — large scope, high value) |

---

### Issue #10 — No test coverage

| Field | Value |
|-------|-------|
| **Severity** | 🟡 Medium |
| **Evidence** | `src/test/example.test.ts` contains 1 placeholder test. Vitest + React Testing Library are installed but unused. |
| **Impacted files** | `src/test/`, `vitest.config.ts` |
| **Why it matters** | Any code change risks breaking the site silently. The Stripe checkout flow, auth flow, and tier management are all untested. Regressions in these areas directly cost revenue. |
| **Recommended fix** | Add tests for critical paths: auth flow, checkout session creation, tier management, Directory search. Start with integration tests for hooks. |
| **Fix timing** | 🟡 Fix later (Pass 4 — ongoing effort) |

---

## Pass 3 Plan: Quick Wins to Implement Now

Based on the analysis above, these are safe to fix immediately:

1. **Optimize hero images** → convert to WebP, generate responsive sizes
2. **Fix font loading** → move from @import to `<link>` tags with preconnect
3. **Remove dead code** → delete Index.tsx, clean unused mockData exports, remove recharts if unused
4. **Fix Directory duplicate queries** → add `enabled` flag to old hooks
5. **Lazy-load DirectoryMap** → conditional render + React.lazy
6. **Fix Directory accessibility** → add aria-labels, id/htmlFor, aria-live
7. **Update browserslist** → `npx update-browserslist-db@latest`

Each fix will be verified with build + typecheck before committing.
