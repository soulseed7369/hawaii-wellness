# Aloha Health Hub

A lead-generation wellness directory for Hawaiʻi — practitioners, spas & wellness centers, retreats, and articles. Starting with the Big Island; schema supports Maui, Kauaʻi, and Oʻahu.

**No on-site payments in v1.** All booking/registration is via external links.

---

## Quickstart (Local Development)

### Prerequisites
- Node.js ≥ 18 and npm (or use [nvm](https://github.com/nvm-sh/nvm))
- A [Supabase](https://supabase.com) project (free tier is fine for development)

### 1. Clone and install

```sh
git clone <YOUR_GIT_URL>
cd aloha-health-hub
npm install
```

### 2. Configure environment

```sh
cp .env.example .env.local
```

Open `.env.local` and fill in your Supabase credentials:

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here   # scripts only
```

> ⚠️ `SUPABASE_SERVICE_ROLE_KEY` is used only by local ingestion scripts. It is never exposed to the browser.

### 3. Apply the database schema

After Sprint 1 is complete, the migration SQL will be in `supabase/migrations/`. Apply it via the Supabase dashboard SQL editor or CLI:

```sh
# Using Supabase CLI (optional)
npx supabase db push
```

### 4. Start the dev server

```sh
npm run dev
```

The app runs at `http://localhost:5173` by default.

### 5. Run tests

```sh
npm test
```

---

## Data Ingestion (Cold-Start Scraping)

See [`docs/SCRAPING_PLAYBOOK.md`](docs/SCRAPING_PLAYBOOK.md) for the full guide on collecting and ingesting directory listings.

Quick version:

```sh
# Validate a raw CSV
node scripts/validate-csv.mjs data/samples/my-batch.csv

# Normalize CSV → JSON
node scripts/normalize.mjs data/samples/my-batch.csv > data/samples/normalized.json

# Ingest into Supabase (dry-run first)
node scripts/ingest.mjs data/samples/normalized.json --dry-run
node scripts/ingest.mjs data/samples/normalized.json
```

---

## Project Structure

```
aloha-health-hub/
├── src/
│   ├── pages/           # Route-level components
│   │   ├── Index.tsx          # Homepage (featured carousels)
│   │   ├── Directory.tsx      # Practitioners + Centers tabbed directory + map
│   │   ├── Retreats.tsx       # Retreats listing
│   │   ├── Articles.tsx       # Articles hub
│   │   ├── ProfileDetail.tsx  # Single practitioner/center profile
│   │   ├── RetreatDetail.tsx  # Single retreat detail
│   │   └── dashboard/         # Provider dashboard (auth-protected)
│   ├── components/      # Shared UI components
│   │   ├── layout/      # Header + Footer
│   │   ├── dashboard/   # Dashboard layout + sidebar
│   │   └── ui/          # shadcn/ui primitives
│   ├── data/
│   │   └── mockData.ts  # Temporary mock data (replaced by Supabase in Sprint 2)
│   ├── lib/
│   │   └── utils.ts     # cn() helper
│   └── App.tsx          # Route definitions
├── docs/
│   └── SCRAPING_PLAYBOOK.md  # Data collection + ingestion guide
├── scripts/             # Local-only Node.js scripts (ingestion, scraping)
├── data/
│   └── samples/         # Raw CSVs + normalized JSON batches
├── SYSTEM_PLAN.md       # Source-of-truth architecture + sprint plan
└── .env.example         # Environment variable template
```

---

## Sprint Progress

| Sprint | Description | Status |
|---|---|---|
| 0 | Repo audit + planning + docs | ✅ Complete |
| 1 | Database schema + RLS | ✅ Complete |
| 2 | Read-only frontend wiring (Supabase) | ✅ Complete |
| 3 | Auth + Provider Dashboard CRUD | 🔒 Blocked on Sprint 2 |
| 4 | Ingestion pipeline + scraping utilities | 🔒 Blocked on Sprint 1 |
| 5 | Polish + SEO + final verification | 🔒 Blocked on Sprint 4 |

---

## Tech Stack

- **Frontend:** React 18 + Vite + TypeScript + Tailwind CSS
- **UI Components:** shadcn/ui (Radix primitives)
- **Map:** Leaflet / react-leaflet
- **Data fetching:** TanStack Query v5
- **Backend:** Supabase (Postgres + RLS + Auth)

---

## Deployment

The app can be deployed to any static host (Vercel, Netlify, Cloudflare Pages):

```sh
npm run build
# dist/ folder is the output
```

For Supabase, ensure your project's RLS policies are active before going live.

---

## Contributing / Editing

- **Lovable:** Visit your [Lovable Project](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) for visual editing.
- **Local IDE:** Clone, edit, push — changes sync back to Lovable.
- **GitHub Codespaces:** Open directly in a cloud IDE from the repo page.
