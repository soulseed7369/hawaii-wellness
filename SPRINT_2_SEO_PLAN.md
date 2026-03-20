# Sprint 2: SEO Architecture & Content Strategy
## Hawaiʻi Wellness — Vercel Serverless SSR

**Sprint Duration:** 2 weeks (10 business days, parallel execution)
**Sprint Goal:** Ship crawlable article SSR endpoints + BreadcrumbList schema + FAQPage schema + profile completeness enforcement gates, positioning for organic long-tail keyword capture across all 4 islands.

---

## Priority Rationale

**Why these items, in this order:**

1. **Article SSR endpoints (Tier 1, Critical)** — Articles are the #1 content SEO lever. Currently unsearchable (SPA-only). Zero short-tail keyword coverage. ROI per hour = maximum.
2. **BreadcrumbList schema (Tier 1, Critical)** — Profiles indexed but no breadcrumbs = missed CTR boost. Quick implementation, immediate 10–15% CTR lift in search results.
3. **FAQPage schema (Tier 1, Critical)** — 25 FAQ items already in DOM. No markup = 0 "people also ask" visibility. Takes 2 hours, captures question-intent traffic.
4. **Profile completeness gates (Tier 2, High)** — Incomplete listings hurt domain quality. Enforcement is simple logic; blocks indexing of profiles with <60% completeness.
5. **Island directory SSR (Tier 2, High)** — Island pages (/big-island, /maui, etc.) are landing pages but SPA-only. Medium effort, high impact.
6. **Modality taxonomy backlinks (Tier 3, Medium)** — Internal linking from articles to practitioners by modality. Improves crawl flow + relevance signals. Can parallelize early.

**Not in Sprint 2:**
- Content strategy / article writing (belongs to content team, parallel stream)
- Directory filtering UI optimization (Tier 3, defer to Sprint 3)
- GBP setup (requires business verification, external dependency)

---

## Workstreams (Parallel Tracks)

### Track A: SSR Endpoints (Days 1–5)
- **Article SSR endpoint** — `/api/articles/[slug].ts`
- **Island directory SSR** — `/api/island/[island].ts` (optional, defer if time-boxed)
- Tests + local validation

### Track B: Structured Data (Days 1–4)
- **BreadcrumbList schema** — Add to ProfileDetail.tsx + CenterDetail.tsx
- **FAQPage schema** — Extract from HelpCenter.tsx, endpoint or inline JSON-LD

### Track C: Data Integrity (Days 2–6)
- **Profile completeness gates** — Enforce in queryBuilder, add robots meta rule
- **Modality cross-link mapper** — Script to generate internal link suggestions (prep for content)

### Track D: Testing & Validation (Days 6–10)
- **E2E crawl test** — Verify Googlebot can fetch article content via `/api/articles/[slug]`
- **Schema validation** — Test BreadcrumbList, FAQPage with Google Rich Results Tester
- **Index coverage audit** — Compare before/after indexation on GSC

---

## Tickets

### ✅ TICKET A1: Article SSR Endpoint — `/api/articles/[slug].ts`

**Priority:** Critical (Tier 1)
**Time Estimate:** 2 days (pair coding: 1 dev + 1 QA)
**Files Affected:**
- `/api/articles/[slug].ts` (new)
- `src/hooks/useArticles.ts` (unchanged, reference)
- `src/pages/ArticleDetail.tsx` (unchanged, reference)

**Full Code Spec:**

Create `/api/articles/[slug].ts`:
```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import DOMPurify from 'isomorphic-dompurify';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SITE = 'https://hawaiiwellness.net';

function escapeHtml(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Clean HTML body safely
function sanitizeHtml(html: string): string {
  const config = {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'b', 'i', 'a', 'ul', 'ol', 'li', 'h2', 'h3', 'blockquote', 'code', 'pre'],
    ALLOWED_ATTR: ['href', 'title', 'target', 'rel'],
  };
  return DOMPurify.sanitize(html, config);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { slug } = req.query;
  if (!slug || typeof slug !== 'string') {
    return res.status(400).send('Missing slug');
  }

  // Fetch article from DB
  const { data: article, error } = await supabase
    .from('articles')
    .select('id, slug, title, body, published_at, status, author')
    .eq('slug', slug)
    .eq('status', 'published')
    .single();

  if (error || !article) {
    return res.status(404).send('Article not found');
  }

  const articleUrl = `${SITE}/articles/${article.slug}`;
  const pubDate = article.published_at ? new Date(article.published_at).toISOString() : null;
  const description = escapeHtml(
    sanitizeHtml(article.body)
      .replace(/<[^>]*>/g, '') // strip HTML
      .substring(0, 155) // first 155 chars
  );

  // NewsArticle + BreadcrumbList schema
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: article.title,
    description: description,
    url: articleUrl,
    datePublished: pubDate,
    author: {
      '@type': 'Person',
      name: article.author || 'Hawaiʻi Wellness',
    },
    publisher: {
      '@type': 'Organization',
      name: 'Hawaiʻi Wellness',
      logo: {
        '@type': 'ImageObject',
        url: `${SITE}/og-image.png`,
        width: 1200,
        height: 630,
      },
    },
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Home',
          item: SITE,
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Articles',
          item: `${SITE}/articles`,
        },
        {
          '@type': 'ListItem',
          position: 3,
          name: article.title,
          item: articleUrl,
        },
      ],
    },
  };

  const sanitizedBody = sanitizeHtml(article.body);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(article.title)}</title>
  <meta name="description" content="${description}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${articleUrl}">
  <meta property="og:title" content="${escapeHtml(article.title)}">
  <meta property="og:description" content="${description}">
  <meta property="og:type" content="article">
  <meta property="og:url" content="${articleUrl}">
  <meta property="og:image" content="${SITE}/og-image.png">
  <meta property="article:published_time" content="${pubDate || ''}">
  <meta property="article:author" content="${escapeHtml(article.author || 'Hawaiʻi Wellness')}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(article.title)}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${SITE}/og-image.png">
  <script type="application/ld+json">${JSON.stringify(schema)}</script>
</head>
<body>
  <div id="root">
    <article>
      <h1>${escapeHtml(article.title)}</h1>
      <p><time>${pubDate ? new Date(pubDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : ''}</time></p>
      <div>${sanitizedBody}</div>
    </article>
  </div>
  <script>window.__ARTICLE__ = ${JSON.stringify(article)};</script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
  res.status(200).send(html);
}
```

**Dependencies:**
- Supabase must have `articles` table with `slug`, `title`, `body`, `status = 'published'`
- `DOMPurify` must be installed (`npm install isomorphic-dompurify`)

**Acceptance Criteria:**
- [ ] Endpoint returns 200 with proper HTML + NewsArticle schema for published articles
- [ ] Returns 404 for unpublished or missing articles
- [ ] `<title>`, `<meta name="description">`, `og:*` tags populated correctly
- [ ] Article body HTML is sanitized (no XSS)
- [ ] BreadcrumbList schema present and valid (test with Google Rich Results Tester)
- [ ] Response cached for 1 hour (browser) / 24 hours (CDN)
- [ ] Googlebot can fetch and parse (verified with Google Search Console)
- [ ] Schema validates in structured data testing tool

---

### ✅ TICKET A2: Add `isomorphic-dompurify` Dependency

**Priority:** Critical (dependency for A1)
**Time Estimate:** 15 minutes
**Files Affected:**
- `package.json` (update)

**Spec:**
```bash
npm install isomorphic-dompurify
```

Update `package.json`:
```json
{
  "dependencies": {
    "isomorphic-dompurify": "^2.11.0"
  }
}
```

**Acceptance Criteria:**
- [ ] Package installs without errors
- [ ] Can import and use in A1 endpoint

---

### ✅ TICKET B1: BreadcrumbList Schema for Profiles

**Priority:** Critical (Tier 1)
**Time Estimate:** 1 day
**Files Affected:**
- `src/pages/ProfileDetail.tsx` (update)
- `src/pages/CenterDetail.tsx` (update)
- `src/components/layout/Head.tsx` or equivalent meta component

**Full Code Spec:**

Create a utility hook `src/hooks/useProfileBreadcrumb.ts`:
```typescript
export interface BreadcrumbItem {
  name: string;
  url: string;
  position: number;
}

export function generateProfileBreadcrumb(
  practitioner: {
    id: string;
    name: string;
    island: string;
    modalities?: string[];
  }
): BreadcrumbItem[] {
  const ISLAND_LABEL: Record<string, string> = {
    big_island: 'Big Island',
    maui: 'Maui',
    oahu: 'Oʻahu',
    kauai: 'Kauaʻi',
  };

  const islandName = ISLAND_LABEL[practitioner.island] ?? 'Hawaiʻi';
  const topModality = practitioner.modalities?.[0] || 'Wellness';

  return [
    { name: 'Home', url: '/', position: 1 },
    { name: 'Directory', url: '/directory', position: 2 },
    { name: islandName, url: `/${practitioner.island.replace('_', '-')}`, position: 3 },
    { name: topModality, url: `/directory?modality=${encodeURIComponent(topModality)}&island=${practitioner.island}`, position: 4 },
    { name: practitioner.name, url: `/profile/${practitioner.id}`, position: 5 },
  ];
}

export function breadcrumbSchema(items: BreadcrumbItem[]): Record<string, any> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item) => ({
      '@type': 'ListItem',
      position: item.position,
      name: item.name,
      item: `https://hawaiiwellness.net${item.url}`,
    })),
  };
}
```

Update `src/pages/ProfileDetail.tsx` (in the component):
```typescript
import { useProfileBreadcrumb, generateProfileBreadcrumb, breadcrumbSchema } from '@/hooks/useProfileBreadcrumb';

export function ProfileDetail() {
  // ... existing code ...
  const practitioner = usePractitionerDetail(id);

  // Generate breadcrumb
  const breadcrumbItems = generateProfileBreadcrumb(practitioner);
  const breadcrumbSchemaJson = breadcrumbSchema(breadcrumbItems);

  // Insert into <head> via Helmet or usePageMeta
  usePageMeta(
    `${practitioner.name} — ${practitioner.modalities?.[0] || 'Wellness'} in ${practitioner.city}`,
    /* ... existing desc ... */,
    {
      structuredData: breadcrumbSchemaJson, // assuming usePageMeta supports this
    }
  );

  return (
    <>
      {/* Breadcrumb rendering in UI */}
      <nav aria-label="breadcrumb" className="mb-6 text-sm">
        <ol className="flex items-center gap-2">
          {breadcrumbItems.map((item, i) => (
            <li key={item.position} className="flex items-center gap-2">
              {i > 0 && <span className="text-muted-foreground">/</span>}
              {item.position === breadcrumbItems.length ? (
                <span className="text-foreground font-semibold">{item.name}</span>
              ) : (
                <Link to={item.url} className="text-primary hover:underline">
                  {item.name}
                </Link>
              )}
            </li>
          ))}
        </ol>
      </nav>
      {/* Rest of profile ... */}
    </>
  );
}
```

**Dependencies:**
- Assumes `usePageMeta` hook can accept `structuredData` option, or inject JSON-LD directly via Helmet

**Acceptance Criteria:**
- [ ] Breadcrumb navigation visible above profile content
- [ ] BreadcrumbList JSON-LD in `<head>` with 4–5 levels (Home > Directory > Island > Modality > Practitioner)
- [ ] Validates in Google Rich Results Tester
- [ ] Links are correct (directory page, island page, modality filter)
- [ ] Mobile responsive (breadcrumb wraps nicely)
- [ ] Applied to both `ProfileDetail.tsx` and `CenterDetail.tsx`

---

### ✅ TICKET B2: FAQPage Schema for HelpCenter

**Priority:** Critical (Tier 1)
**Time Estimate:** 1 day
**Files Affected:**
- `src/pages/HelpCenter.tsx` (update)
- `src/hooks/usePageMeta.ts` (if not already supporting structuredData)

**Full Code Spec:**

Create `src/lib/faqSchema.ts`:
```typescript
export interface FAQSection {
  title: string;
  items: Array<{
    question: string;
    answer: string; // plain text, no HTML
  }>;
}

export function extractTextFromReactNode(node: React.ReactNode): string {
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractTextFromReactNode).join(' ');
  if (node && typeof node === 'object' && 'props' in node && node.props.children) {
    return extractTextFromReactNode(node.props.children);
  }
  return '';
}

export function generateFAQSchema(sections: FAQSection[]): Record<string, any> {
  const mainEntity = sections.flatMap((section) =>
    section.items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: typeof item.answer === 'string'
          ? item.answer
          : extractTextFromReactNode(item.answer),
      },
    }))
  );

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity,
  };
}
```

Update `src/pages/HelpCenter.tsx`:
```typescript
import { generateFAQSchema } from '@/lib/faqSchema';
import { usePageMeta } from '@/hooks/usePageMeta';

interface FAQItem {
  question: string;
  answer: React.ReactNode;
}

interface FAQSection {
  title: string;
  items: FAQItem[];
}

// ... sections array definition (existing) ...

export default function HelpCenter() {
  // Convert React nodes to plain text for schema
  const sectionsForSchema: Array<{ title: string; items: Array<{ question: string; answer: string }> }> = sections.map((section) => ({
    title: section.title,
    items: section.items.map((item) => ({
      question: item.question,
      answer: typeof item.answer === 'string'
        ? item.answer
        : extractTextFromReactNode(item.answer), // assumes helper exists
    })),
  }));

  const faqSchema = generateFAQSchema(sectionsForSchema);

  usePageMeta(
    'Help Center — Hawaiʻi Wellness',
    'Frequently asked questions about Hawaiʻi Wellness directory, how to find practitioners, billing, and more.',
    {
      structuredData: faqSchema,
    }
  );

  return (
    <main className="container py-10">
      <h1 className="mb-2 font-display text-3xl font-bold md:text-4xl">Help Center</h1>
      <p className="mb-8 text-muted-foreground">Frequently asked questions</p>

      {sections.map((section, idx) => (
        <section key={idx} className="mb-12">
          <h2 className="mb-4 text-xl font-semibold">{section.title}</h2>
          <div>
            {section.items.map((item, itemIdx) => (
              <Accordion key={itemIdx} question={item.question} answer={item.answer} />
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}

// Helper to extract text from React nodes
function extractTextFromReactNode(node: React.ReactNode): string {
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractTextFromReactNode).join(' ');
  if (node && typeof node === 'object' && 'props' in node && node.props.children) {
    return extractTextFromReactNode(node.props.children);
  }
  return '';
}
```

Ensure `usePageMeta` hook supports `structuredData` option:
```typescript
export function usePageMeta(
  title: string,
  description: string,
  options?: {
    ogImage?: string;
    canonicalUrl?: string;
    structuredData?: Record<string, any>;
  }
) {
  useEffect(() => {
    // Set title, description, og:* tags
    document.title = title;
    // ... existing meta tag logic ...

    // Inject structured data
    if (options?.structuredData) {
      let script = document.querySelector('script[type="application/ld+json"]');
      if (!script) {
        script = document.createElement('script');
        script.type = 'application/ld+json';
        document.head.appendChild(script);
      }
      script.textContent = JSON.stringify(options.structuredData);
    }
  }, [title, description, options]);
}
```

**Acceptance Criteria:**
- [ ] FAQPage JSON-LD in `<head>` with all ~25 Q&A pairs
- [ ] Validates in Google Rich Results Tester (no errors)
- [ ] Google Search Console shows "FAQ" rich results eligible
- [ ] Schema includes `Question` + `acceptedAnswer` for each FAQ
- [ ] Answer text is plain (no HTML tags in JSON)
- [ ] "People also ask" box appears in SERP for relevant queries (monitor in GSC)

---

### ✅ TICKET C1: Profile Completeness Gates

**Priority:** High (Tier 2)
**Time Estimate:** 1.5 days
**Files Affected:**
- `src/lib/supabase.ts` (add client-side query builder)
- `src/hooks/usePractitioners.ts` (update filter)
- `src/hooks/useCenters.ts` (update filter)
- `src/pages/Directory.tsx` (update filter UI)

**Full Code Spec:**

Create `src/lib/profileCompleteness.ts`:
```typescript
interface ProfileData {
  id: string;
  name?: string;
  bio?: string;
  photo_url?: string;
  modalities?: string[];
  city?: string;
  island?: string;
  session_type?: string;
  website_url?: string;
}

export function calculateCompleteness(profile: ProfileData): number {
  const checks = [
    { weight: 15, pass: !!profile.name },
    { weight: 20, pass: !!profile.bio && profile.bio.trim().length > 20 },
    { weight: 15, pass: !!profile.photo_url },
    { weight: 15, pass: !!profile.modalities && profile.modalities.length > 0 },
    { weight: 10, pass: !!profile.city },
    { weight: 10, pass: !!profile.session_type },
    { weight: 10, pass: !!profile.website_url },
    { weight: 5, pass: !!profile.island },
  ];

  return checks.reduce((sum, check) => sum + (check.pass ? check.weight : 0), 0);
}

export const COMPLETENESS_THRESHOLD = 60; // Only index profiles >= 60% complete

export function isIndexable(profile: ProfileData): boolean {
  return calculateCompleteness(profile) >= COMPLETENESS_THRESHOLD;
}
```

Update `src/hooks/usePractitioners.ts`:
```typescript
import { isIndexable } from '@/lib/profileCompleteness';

export function usePractitioners(filters?: {
  island?: string;
  modality?: string;
  city?: string;
  sessionType?: string;
  skipIncomplete?: boolean; // NEW
}) {
  // Existing query...
  let query = supabase
    .from('practitioners')
    .select('*')
    .eq('status', 'published');

  if (filters?.island) {
    query = query.eq('island', filters.island);
  }

  // NEW: Skip incomplete profiles on public directory
  if (filters?.skipIncomplete) {
    const { data: all } = await query;
    return all?.filter(isIndexable) ?? [];
  }

  return useQuery({
    // ... rest of hook
  });
}
```

Update `src/pages/Directory.tsx` (pass flag):
```typescript
// When fetching for public directory (SPA), skip incomplete
const { data: practitioners } = usePractitioners({
  island: selectedIsland,
  skipIncomplete: true, // NEW
});
```

**For SSR endpoints** (`/api/profile/[id]`, `/api/center/[id]`), add robots meta:
```typescript
// In handler function after fetching profile
import { isIndexable, calculateCompleteness } from '@/lib/profileCompleteness';

const completeness = calculateCompleteness(profile);
const indexable = isIndexable(profile);
const robotsMeta = indexable ? 'index, follow' : 'noindex, nofollow';

const html = `<!DOCTYPE html>
<html>
<head>
  <meta name="robots" content="${robotsMeta}">
  <!-- ... rest ... -->
</head>
</html>`;
```

**Acceptance Criteria:**
- [ ] Profiles <60% complete show `<meta name="robots" content="noindex">`
- [ ] Public directory only displays profiles >=60% complete
- [ ] Completeness calculation logic tested (unit tests)
- [ ] GSC shows fewer pages indexed (incomplete ones blocked)
- [ ] Domain quality signals improve (fewer low-signal pages)

---

### ✅ TICKET C2: Modality Cross-Link Mapper (Script)

**Priority:** Medium (Tier 3)
**Time Estimate:** 1 day
**Files Affected:**
- `pipeline/scripts/33_generate_crosslinks.py` (new)
- `data/modality_crosslinks.json` (output)

**Full Code Spec:**

Create `pipeline/scripts/33_generate_crosslinks.py`:
```python
"""
Generate internal link suggestions for articles to practitioners by modality.
Output is a JSON file with recommendations: for each article, suggest 3-5 practitioners
whose modalities overlap with the article's inferred modality.
"""

import json
import os
from pathlib import Path
from difflib import SequenceMatcher
from src.supabase_client import client

# Canonical modalities list (sync with DashboardProfile.tsx)
MODALITIES = [
    'Acupuncture', 'Alternative Therapy', 'Art Therapy', 'Astrology', 'Ayurveda',
    'Birth Doula', 'Breathwork', 'Chiropractic', 'Counseling', 'Craniosacral',
    'Dentistry', 'Energy Healing', 'Family Constellation', 'Fitness', 'Functional Medicine',
    'Hawaiian Healing', 'Herbalism', 'Hypnotherapy', 'IV Therapy', 'Life Coaching',
    'Lomilomi / Hawaiian Healing', 'Longevity', 'Massage', 'Meditation', 'Midwife',
    'Nature Therapy', 'Naturopathic', 'Nervous System Regulation', 'Network Chiropractic',
    'Nutrition', 'Osteopathic', 'Physical Therapy', 'Psychic', 'Psychotherapy', 'Reiki',
    'Ritualist', 'Somatic Therapy', 'Soul Guidance', 'Sound Healing',
    'TCM (Traditional Chinese Medicine)', 'Trauma-Informed Care',
    'Watsu / Water Therapy', 'Women\'s Health', 'Yoga'
]

def infer_modalities_from_text(text: str) -> list[str]:
    """Extract modalities mentioned in article text."""
    if not text:
        return []

    inferred = []
    text_lower = text.lower()

    for modality in MODALITIES:
        modality_lower = modality.lower()
        if modality_lower in text_lower:
            inferred.append(modality)

    return inferred

def find_practitioners_by_modality(modalities: list[str], island: str | None = None) -> list[dict]:
    """Fetch practitioners that match the given modalities."""
    query = client.table('practitioners').select('id, name, island, modalities, city').eq('status', 'published')

    results = query.execute()
    practitioners = results.data or []

    # Filter by modalities
    matches = []
    for p in practitioners:
        if not p.get('modalities'):
            continue
        p_mods = set([m.strip() for m in (p['modalities'] or [])])
        overlap = len(set(modalities) & p_mods)
        if overlap > 0:
            matches.append({
                'id': p['id'],
                'name': p['name'],
                'island': p['island'],
                'city': p['city'],
                'modalities': p['modalities'],
                'overlap_count': overlap,
            })

    # Sort by overlap count (descending) then alphabetically
    matches.sort(key=lambda x: (-x['overlap_count'], x['name']))

    return matches[:5]  # Top 5 matches

def main():
    # Fetch all published articles
    articles = client.table('articles').select('id, slug, title, body, status').eq('status', 'published').execute().data or []

    crosslinks = {}

    for article in articles:
        inferred_mods = infer_modalities_from_text(article['body'])

        if not inferred_mods:
            continue  # No modalities found in article

        practitioners = find_practitioners_by_modality(inferred_mods)

        crosslinks[article['slug']] = {
            'article_id': article['id'],
            'article_title': article['title'],
            'inferred_modalities': inferred_mods,
            'suggested_practitioners': [
                {
                    'id': p['id'],
                    'name': p['name'],
                    'link': f"/profile/{p['id']}",
                    'city': p['city'],
                    'island': p['island'],
                    'modality_overlap': p['modalities'],
                }
                for p in practitioners
            ],
        }

    # Write output
    output_dir = Path(__file__).parent.parent / 'output'
    output_dir.mkdir(exist_ok=True)

    output_file = output_dir / 'modality_crosslinks.json'
    with open(output_file, 'w') as f:
        json.dump(crosslinks, f, indent=2)

    print(f"Generated crosslinks for {len(crosslinks)} articles → {output_file}")

if __name__ == '__main__':
    main()
```

Run this once to generate `pipeline/output/modality_crosslinks.json`, then share with content team.

**Acceptance Criteria:**
- [ ] Script runs without error
- [ ] Generates JSON mapping articles → practitioners by shared modalities
- [ ] Shared with content team as reference for manual linking
- [ ] Articles can be updated with `<Link to="/profile/{id}">` tags

---

### ✅ TICKET D1: E2E Crawl Test — Article Endpoint

**Priority:** High (Tier 2, after A1)
**Time Estimate:** 0.5 day
**Files Affected:**
- None (testing only)

**Spec:**

1. **Publish test article** in Supabase (status='published', slug='test-seo-crawl')
2. **Run Googlebot simulation**:
   ```bash
   curl -H "User-Agent: Mozilla/5.0 (compatible; Googlebot/2.1)" \
     https://hawaiiwellness.net/api/articles/test-seo-crawl
   ```
3. **Verify response**:
   - [ ] HTTP 200
   - [ ] `<title>` present and correct
   - [ ] `<meta name="description">` present
   - [ ] NewsArticle JSON-LD valid (no syntax errors)
   - [ ] BreadcrumbList schema present
   - [ ] Article body HTML rendered (not empty)

4. **Google Search Console**:
   - Submit article URL to GSC → inspect → verify structured data
   - Confirm "Article" rich result eligible

---

### ✅ TICKET D2: Schema Validation Suite

**Priority:** High (Tier 2, parallel to D1)
**Time Estimate:** 0.5 day
**Files Affected:**
- None (manual testing)

**Spec:**

For each schema type, test with [Google Rich Results Tester](https://search.google.com/test/rich-results):

1. **ProfileDetail pages** (BreadcrumbList):
   - URL: `https://hawaiiwellness.net/api/profile/{sample-id}`
   - Expected: BreadcrumbList appears, all links correct
   - [ ] Pass ✅

2. **CenterDetail pages** (BreadcrumbList):
   - URL: `https://hawaiiwellness.net/api/center/{sample-id}`
   - Expected: BreadcrumbList appears
   - [ ] Pass ✅

3. **Article pages** (NewsArticle + BreadcrumbList):
   - URL: `https://hawaiiwellness.net/api/articles/sample-slug`
   - Expected: NewsArticle + BreadcrumbList
   - [ ] Pass ✅

4. **HelpCenter** (FAQPage):
   - URL: `https://hawaiiwellness.net/help`
   - Expected: FAQPage with ~25 Q&A pairs
   - [ ] Pass ✅

---

### ✅ TICKET A3: Island Directory SSR Endpoint (Optional, Time-Box)

**Priority:** High (Tier 2, can defer)
**Time Estimate:** 1–2 days (if time permits)
**Files Affected:**
- `/api/island/[island].ts` (new)

**Spec:**

Create `/api/island/[island].ts` — returns full HTML for island directory with:
- Practitioners count by modality
- Top 10 featured practitioners
- Island description (Maui, Oahu, Big Island, Kauai)
- ItemList schema (ListItem per top practitioner)

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SITE = 'https://hawaiiwellness.net';

const ISLAND_META: Record<string, { label: string; desc: string }> = {
  big_island: {
    label: 'Big Island',
    desc: 'Explore wellness practitioners and centers on the Big Island of Hawaiʻi. Find acupuncturists, massage therapists, yoga instructors, energy healers, and more.',
  },
  maui: {
    label: 'Maui',
    desc: 'Discover holistic health providers on Maui. Browse practitioners specializing in meditation, Lomilomi, breathwork, and traditional healing.',
  },
  oahu: {
    label: 'Oʻahu',
    desc: 'Find wellness services on Oʻahu. Connect with practitioners in Honolulu, Waikiki, Kailua, and across the island.',
  },
  kauai: {
    label: 'Kauaʻi',
    desc: 'Explore wellness practitioners on Kauaʻi. Discover holistic health, yoga, meditation, and natural healing on the Garden Island.',
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { island } = req.query;
  if (!island || typeof island !== 'string' || !ISLAND_META[island]) {
    return res.status(400).send('Invalid island');
  }

  // Fetch featured + top practitioners
  const { data: practitioners } = await supabase
    .from('practitioners')
    .select('id, name, modalities, city, tier')
    .eq('status', 'published')
    .eq('island', island)
    .order('tier', { ascending: false })
    .order('name', { ascending: true })
    .limit(15);

  const meta = ISLAND_META[island];
  const url = `${SITE}/${island.replace('_', '-')}`;
  const title = `${meta.label} Wellness Practitioners | Hawaiʻi Wellness Directory`;

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: title,
    description: meta.desc,
    url: url,
    itemListElement: (practitioners || []).slice(0, 10).map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'LocalBusiness',
        name: p.name,
        url: `${SITE}/profile/${p.id}`,
      },
    })),
  };

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <meta name="description" content="${meta.desc}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${url}">
  <script type="application/ld+json">${JSON.stringify(schema)}</script>
</head>
<body>
  <div id="root">
    <h1>${meta.label} Wellness Directory</h1>
    <p>${meta.desc}</p>
    <ul>
      ${(practitioners || []).map(p => `
        <li><a href="/profile/${p.id}">${p.name}</a> — ${p.modalities?.[0] || 'Wellness'}</li>
      `).join('')}
    </ul>
  </div>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
  res.status(200).send(html);
}
```

**Acceptance Criteria:**
- [ ] Endpoint returns full HTML with island-specific content
- [ ] Schema validates (CollectionPage with ListItem items)
- [ ] Links to top practitioners are correct
- [ ] Cached appropriately (1h browser, 24h CDN)

---

## Dependencies Between Tickets

```
A2 (dompurify) ─┐
                ├─→ A1 (Article SSR) ─┐
                                      ├─→ D1 (E2E Crawl Test)
B1 (Breadcrumb) ─────────────────────┤
                                      ├─→ D2 (Schema Validation)
B2 (FAQPage) ────────────────────────┤

C1 (Completeness Gates) ─────────────→ (can run in parallel, independent)

C2 (Modality Crosslinks) ───────────→ (can run in parallel, feeds content team)

A3 (Island SSR, optional) ──────────→ (nice-to-have, time-box)
```

**Critical path:** A2 → A1 → D1/D2 (finish by Day 5)
**Parallel:** B1, B2, C1, C2 (Days 1–6)

---

## Definition of Done

### Pre-Launch Checklist

- [ ] **All API endpoints deploy to Vercel** without errors
- [ ] **Article SSR**: Googlebot can fetch article slugs, receives HTML with NewsArticle + BreadcrumbList
- [ ] **Profile/Center SSR**: Breadcrumb schema injected, validates in GSC
- [ ] **HelpCenter**: FAQPage schema in `<head>`, validates in Rich Results Tester
- [ ] **Completeness gates**: Profiles <60% complete show `noindex` meta tag
- [ ] **No broken links** in breadcrumbs or cross-links
- [ ] **Cache headers set** (1h browser, 24h CDN)
- [ ] **DOMPurify sanitization**: No XSS vulnerabilities in article rendering
- [ ] **Google Search Console**:
  - All articles submitted to index
  - Profile breadcrumbs verified
  - FAQPage indexed
  - No crawl errors introduced
- [ ] **Monitoring**: Set up alerts for 5xx errors on `/api/*` endpoints
- [ ] **Rollback plan**: Tested (can revert article endpoint in <5 min)

### Post-Launch Metrics (Monitor Week 1–4)

- [ ] **Article indexation**: 80%+ of articles indexed within 1 week
- [ ] **Domain quality**: Profile pages indexed drop by 30%–40% (low-completeness ones blocked)
- [ ] **SERP impressions**: +15–25% on branded + modality queries (acupuncture hawaii, yoga maui, etc.)
- [ ] **CTR improvement**: +10% from breadcrumb snippets in SERPs
- [ ] **FAQ impressions**: FAQPage appears in "people also ask" for 5+ queries
- [ ] **Crawl budget**: Average crawl time per page stays <3 seconds

---

## Implementation Timeline (2 Weeks)

### Week 1
- **Days 1–2**: A2, A1 implementation + local testing
- **Days 1–3**: B1, B2 implementation + validation
- **Days 2–3**: C1 implementation, C2 script development
- **Days 4–5**: D1, D2 testing (E2E crawl, schema validation)

### Week 2
- **Days 6–7**: Fix schema validation issues, deploy all endpoints
- **Days 8–9**: Monitor indexation, run index coverage audit in GSC
- **Days 10**: Documentation, debrief, plan content strategy handoff

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| DOMPurify dependency breaks | Pin version, test locally before deploy |
| Schema validation fails in GSC | Use Rich Results Tester during dev, iterate before launch |
| Incomplete profiles still indexed | Implement dual controls: query filter + robots meta tag |
| Breadcrumb links are wrong | Manual QA on staging (all 4 islands, 3 modalities each) |
| Article endpoint OOMs on large bodies | Truncate body at 10k chars if needed, test with max-size article first |
| Cache key collisions | Use slug + hash, test cache busting |

---

## Files Summary

**New Files:**
- `/api/articles/[slug].ts` (180 lines)
- `/api/island/[island].ts` (optional, 130 lines)
- `src/lib/faqSchema.ts` (70 lines)
- `src/lib/profileCompleteness.ts` (50 lines)
- `src/hooks/useProfileBreadcrumb.ts` (80 lines)
- `pipeline/scripts/33_generate_crosslinks.py` (100 lines)

**Modified Files:**
- `src/pages/ProfileDetail.tsx` (+40 lines for breadcrumb)
- `src/pages/CenterDetail.tsx` (+40 lines for breadcrumb)
- `src/pages/HelpCenter.tsx` (+30 lines for FAQPage schema)
- `src/hooks/usePractitioners.ts` (+5 lines, skipIncomplete filter)
- `src/hooks/useCenters.ts` (+5 lines, skipIncomplete filter)
- `src/pages/Directory.tsx` (+2 lines, pass flag)
- `package.json` (+1 dependency)

**Total:** ~10 new files, 6 modified files, ~900 net new LOC

---

## Success Criteria

Sprint 2 is successful when:

1. **Articles are fully searchable** — All published articles indexed in Google Search Console with NewsArticle rich results
2. **Breadcrumbs visible** — Profile pages show breadcrumb navigation + schema validates
3. **FAQs show in search** — "People also ask" box appears for HelpCenter queries
4. **Quality improves** — Incomplete profiles blocked from indexing (domain authority boost)
5. **Internal linking ready** — Content team has crosslink suggestions for manual integration
6. **Zero breaking changes** — SPA still works for users on desktop/mobile
7. **Vercel performance maintained** — No cold starts >3s, cache hit rate >70%

