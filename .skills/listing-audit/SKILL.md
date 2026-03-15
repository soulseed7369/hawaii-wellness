---
name: listing-audit
description: |
  Audit Aloha Health Hub directory listings for data quality, production readiness, and frontend compatibility.
  Use this skill whenever the user mentions: audit listings, check data quality, validate listings, review listings,
  production readiness check, data health report, find bad data, clean up listings, check for duplicates,
  verify modalities, normalize data, schema drift, broken listings, missing fields, or data completeness.
  Also trigger when the user asks about how many listings are ready to publish, which listings need work,
  or whether the data is clean enough for launch. Especially useful for detecting practitioners that were
  misclassified as centers by the pipeline — a common and high-impact data quality issue.
  This skill is purpose-built for the hawaiiwellness.net directory — it knows the exact schema, taxonomy,
  normalization rules, and frontend expectations.
---

# Listing Audit Skill — Aloha Health Hub

You are auditing directory listing data for hawaiiwellness.net, a Hawaiian wellness practitioner/center directory built on React + Supabase. This skill captures hard-won knowledge about exactly what "good data" looks like for this project, so you can find problems fast and suggest concrete fixes.

## When to use this skill

Run an audit when:
- New listings have been ingested from the Google Maps pipeline
- Website enrichment (script 22) has completed a batch
- Before publishing a batch of draft listings
- The user wants to understand overall data health
- Before a launch or marketing push on a new island
- After any bulk data operation (imports, migrations, backfills)

## How the audit works

The audit has 10 checks organized into 3 tiers. Run them in order — earlier checks often explain later failures.

### Tier 1: Schema & Structure (run first — blocks everything else)

**Check 1: Field presence & types**
Query practitioners and centers from Supabase. For each record, verify:

| Field | Practitioners | Centers | Type | Required |
|-------|:---:|:---:|------|:---:|
| `name` | yes | yes | non-empty string | REQUIRED |
| `island` | yes | yes | enum (see reference) | REQUIRED |
| `status` | yes | yes | 'draft' \| 'published' \| 'archived' | REQUIRED |
| `tier` | yes | yes | 'free' \| 'premium' \| 'featured' | REQUIRED |
| `modalities` | yes | yes | text[] (Postgres array, NOT comma string) | REQUIRED |
| `bio` | yes | — | string, >10 words to be "populated" | important |
| `description` | — | yes | string, >10 words to be "populated" | important |
| `center_type` | — | yes | enum (see reference) | REQUIRED |
| `city` | yes | yes | string from canonical city list | important |
| `phone` | yes | yes | string | important |
| `email` | yes | yes | string (valid email format) | important |
| `website_url` | yes | yes | string (valid URL) | nice-to-have |
| `avatar_url` | yes | yes | string (valid URL) | important |
| `lat`, `lng` | yes | yes | float pair, both present or both null | important |
| `session_type` | yes | yes | 'in_person' \| 'online' \| 'both' | REQUIRED |
| `first_name` | yes | — | string | important for practitioners |
| `social_links` | yes | yes | jsonb object | premium-only |
| `working_hours` | yes | yes | jsonb object | premium-only |

Note: `bio` is ONLY on practitioners, `description` is ONLY on centers. Using the wrong column name is a common bug (see script 23 column name fix). The adapter in `src/lib/adapters.ts` handles this mapping.

**Check 2: Enum value validation**
Every enum field must contain only allowed values:

```
island:       big_island | maui | oahu | kauai | molokai
status:       draft | published | archived
tier:         free | premium | featured
session_type: in_person | online | both
center_type:  spa | wellness_center | clinic | retreat_center | yoga_studio | fitness_center
```

Flag any record with a value outside these sets — it will break UI Select components and adapter type assertions.

### Tier 2: Data Quality & Consistency

**Check 3: Modality validation**
Read `references/canonical-modalities.md` for the full canonical list (44 modalities). For each listing:

1. Every modality string must exactly match a canonical entry (case-sensitive)
2. Flag non-canonical values — these won't match directory filters
3. Check for common normalization issues:
   - Lowercase variants: "massage" should be "Massage"
   - Synonym variants: "Massage Therapy" should be "Massage"
   - "Alternative Therapy" alone is meaningless — flag as needs-review
4. Check for duplicates within the same array
5. Check for empty arrays (every listing should have at least one modality)
6. Cross-reference with `references/normalization-map.md` for auto-fixable issues

**Check 4: Location integrity**
Read `references/canonical-locations.md` for island→city mappings. Verify:

1. `city` value exists in the canonical city list for the listing's `island`
2. Cities not in any list are flagged (may be valid but need review)
3. `lat`/`lng` pair: both present or both null (never one without the other)
4. If lat/lng present: lat should be 18.9–22.3, lng should be -160.3 to -154.7 (Hawaii bounding box)
5. No listings with `island = 'big_island'` but lat/lng placing them on Maui (common GPS error)

**Check 5: Name & identity quality**
For practitioners:

1. `name` should not be empty or just whitespace
2. If `first_name` is set, verify it looks like a real first name (not a sentence, not a business description, not a single lowercase word)
3. `last_name` should not contain addresses, business descriptions, or full sentences (script 26 false positive pattern)
4. `display_name` should not duplicate `business_name` (adapter skips it if so, but it's messy data)
5. Flag names that are clearly business names in the `name` field for practitioner records (contains words like "LLC", "Inc", "Center", "Clinic", "Studio")

For centers:
1. `name` should not be empty
2. `center_type` should plausibly match the name (a "Yoga Studio" named "Dr. Smith Chiropractic" is suspect)

**Check 6: Contact & URL validation**

1. `email`: valid format (contains @ and domain with TLD)
2. `phone`: should be 10+ digits after stripping formatting; no letters
3. `website_url`: should start with http:// or https://; no trailing whitespace
4. `external_booking_url`: same URL validation
5. `avatar_url`: should be a valid URL (Supabase storage URL or external)
6. Flag duplicate phone numbers across different listings (potential duplication)
7. Flag duplicate emails across different listings
8. Flag duplicate website domains across different listings (strongest duplicate signal)

**Check 7: Duplicate detection**
Use the same signals as `pipeline/scripts/25_db_dedup.py`:

1. **Phone match**: normalize to 10 digits, strip country code → exact match
2. **Website domain match**: strip protocol, www, trailing slash → exact match
3. **Fuzzy name match**: SequenceMatcher ratio ≥ 85% on same island
4. Flag but don't auto-merge — duplicates need human review

### Tier 3: Production & Search Readiness

**Check 8: Frontend compatibility**

1. Every `published` listing should have enough data to render a ProviderCard:
   - `name` (non-empty)
   - At least one modality (for the subtitle line)
   - `city` or `island` (for location display)
2. Featured listings (`tier = 'featured'`) need extra scrutiny — they show prominently:
   - Should have `avatar_url` (photo)
   - Should have `bio`/`description` (>10 words)
   - Should have valid `lat`/`lng` (they appear on the map)
3. Verify featured slot counts per island don't exceed 5 (DB trigger enforces this, but check for sanity)
4. Check that `FILTER_MODALITIES` in `src/pages/Directory.tsx` includes all modalities that actually appear in published listings

**Check 9: Search & taxonomy readiness**

1. Check if `search_tsv` is populated (needs trigger or backfill)
2. Check if `profile_completeness` is scored (0–100)
3. For each modality in use: verify it exists in `taxonomy_terms` table
4. Check `taxonomy_aliases` coverage — popular search terms should have aliases
5. Flag listings with modalities that exist in the `modalities` array but have no corresponding `taxonomy_terms` entry (invisible to new search)

**Check 10: Cross-list synchronization**
The canonical modality list appears in 6+ places. Verify they're in sync:

1. `src/pages/admin/AdminPanel.tsx` — `MODALITIES_LIST`
2. `src/pages/dashboard/DashboardProfile.tsx` — `MODALITIES`
3. `src/pages/Directory.tsx` — `FILTER_MODALITIES`
4. `src/pages/IslandHome.tsx` — `BROWSE_MODALITIES`
5. `pipeline/scripts/11_gm_classify.py` — `CANONICAL_MODALITIES`
6. `pipeline/scripts/24_normalize_modalities.py` — `CANONICAL`
7. `supabase/migrations/20260310000003_seed_taxonomy.sql` — taxonomy terms

Also check center_type lists:
1. `src/types/database.ts` — TypeScript union
2. `src/lib/adapters.ts` — `CENTER_TYPE_LABELS`
3. `src/pages/admin/AdminPanel.tsx` — SelectItem values
4. `src/pages/dashboard/DashboardCenters.tsx` — `centerTypeLabels`
5. DB CHECK constraint on `centers.center_type`

**Check 11: Practitioner-vs-center misclassification**

This is the single most impactful data quality problem in the directory. The Google Maps pipeline (`11_gm_classify.py`) classifies listings as "center" when the name contains keywords like "wellness", "holistic", "practice", "healing", "spa", "clinic", "studio". But many solo practitioners operate under business names that contain these words — "Kona Holistic Massage", "Sarah's Healing Practice", "Island Wellness Acupuncture". These get ingested into the `centers` table when they should be `practitioners`.

**Why this matters:** Misclassified practitioners don't appear in practitioner search results, can't have `first_name`/`last_name` set, miss out on the name-resolution logic in the adapter, and show up as faceless "centers" without a personal touch. This directly hurts the directory's core value proposition — connecting people with individual practitioners.

**Detection heuristics — flag a center as "likely misclassified practitioner" when 3+ of these signals are true:**

1. **Solo-practitioner modalities**: The center's modalities are all individual-practice modalities (Massage, Acupuncture, Reiki, Counseling, Chiropractic, Naturopathic, Hypnotherapy, Psychotherapy, Life Coaching, Energy Healing) rather than multi-provider modalities (Fitness, Yoga when combined with "Studio").

2. **Personal name embedded in business name**: The name contains a pattern like "FirstName LastName" followed by or preceded by a modality/business word. Examples: "Sarah West Acupuncture", "Dr. Kim Chiropractic", "Healing by Jane Doe". Use the credential suffixes from the pipeline (LAc, LMT, ND, DC, PhD, MD, etc.) as strong signals.

3. **Single-practitioner website pattern**: If `website_url` is present, check if the domain contains a personal name (e.g., sarahwestlmt.com, drkim.com) or is hosted on a personal-site platform (squarespace, wix, weebly patterns in the URL).

4. **No photos array or only 1 photo**: Real centers (spas, clinics, studios) typically have facility photos. A "center" with 0–1 photos is likely a solo practitioner.

5. **Missing description but would have bio**: The center has no `description` (because it was classified as center, not practitioner, so enrichment script wrote nothing to the bio field pattern).

6. **center_type is generic**: `center_type` is `wellness_center` (the default) rather than something specific like `spa`, `fitness_center`, or `yoga_studio`.

7. **Only one modality**: Real multi-provider centers typically offer several modalities. A "center" with exactly 1 modality (e.g., just ["Massage"]) is suspicious.

8. **Google types are practitioner-like**: If the record came from the pipeline and has `_review_flags` or metadata, check if Google categorized it as "health", "doctor", "physiotherapist" rather than "spa", "gym", "yoga_studio".

**Scoring:** Count the signals. 3+ = "likely misclassified", 5+ = "almost certainly misclassified". Produce output grouped by confidence:

```
## Likely Misclassified Centers (should be practitioners)

### High confidence (5+ signals)
| ID | Name | Signals | Recommended action |
|---|---|---|---|
| abc-123 | Sarah West Acupuncture | solo modality, personal name, single photo, generic type, 1 modality | Move to practitioners table |

### Medium confidence (3-4 signals)
| ID | Name | Signals | Recommended action |
|---|---|---|---|
| def-456 | Kona Holistic Healing | solo modalities, generic type, no description | Review manually |
```

**Remediation SQL for confirmed misclassifications:**
```sql
-- Template: move a center to practitioners
-- Step 1: Insert into practitioners (map description → bio)
INSERT INTO practitioners (name, bio, island, city, address, phone, email,
  website_url, modalities, lat, lng, session_type, status, tier, avatar_url)
SELECT name, description, island, city, address, phone, email,
  website_url, modalities, lat, lng, session_type, status, tier, avatar_url
FROM centers WHERE id = '{center_id}';

-- Step 2: Delete the center record (after confirming practitioner was created)
DELETE FROM centers WHERE id = '{center_id}';
```

**Prevention:** After identifying misclassifications, also recommend improvements to `pipeline/scripts/11_gm_classify.py`:
- Expand `looks_like_personal_name()` to catch "Name + Modality" patterns
- Add a "probably solo practitioner" path that checks Google types + modality count
- Lower confidence when assigning center type based only on name keywords without corroborating Google types

## Output format

Structure the audit report as:

```
# Listing Audit Report — {island or "All Islands"}
Generated: {timestamp}

## Executive Summary
- Total listings: X practitioners, Y centers
- Published: N | Draft: M
- Overall data quality score: X/100
- Critical issues: N (blocks publishing)
- Warnings: N (degrades experience)
- Info: N (nice to fix)

## Critical Issues (must fix before publishing)
### C1: {title}
- **Affected:** N records
- **Example:** {id} — {name} — {specific problem}
- **Fix:** {exact SQL or code change}

## Warnings (degrades user experience)
### W1: {title}
...

## Info (nice to have)
### I1: {title}
...

## Normalization Fixes (auto-applicable)
{SQL statements or pipeline commands that can be run to fix issues in bulk}

## Field Completeness Heatmap
{table showing % populated for each field × island × status}

## Recommended Next Steps
1. {prioritized action}
2. ...
```

## Running the audit

### Quick audit (single island, published only)
```python
# From pipeline/ directory
from src.supabase_client import client

# Fetch all published practitioners on big_island
pracs = client.table('practitioners').select('*').eq('island', 'big_island').eq('status', 'published').execute()

# Fetch all published centers on big_island
centers = client.table('centers').select('*').eq('island', 'big_island').eq('status', 'published').execute()
```

### Full audit (all islands, all statuses)
```python
# Paginate in batches of 1000
def fetch_all(table, **filters):
    records, offset = [], 0
    while True:
        q = client.table(table).select('*')
        for k, v in filters.items():
            q = q.eq(k, v)
        batch = q.range(offset, offset + 999).execute().data or []
        records.extend(batch)
        if len(batch) < 1000:
            break
        offset += 1000
    return records
```

### Using existing pipeline scripts
```bash
cd pipeline

# Field completeness report (script 23)
python scripts/23_validate_enrichment.py --island big_island --format json

# Modality normalization dry-run (script 24)
python scripts/24_normalize_modalities.py --island big_island --dry-run

# Duplicate detection (script 25)
python scripts/25_db_dedup.py --island big_island
```

## Key project-specific gotchas

These are patterns that have caused real bugs in this codebase:

1. **bio vs description**: Practitioners have `bio`, centers have `description`. Querying the wrong column returns a Postgres error. The adapter handles this but scripts must be careful.

2. **Modalities are arrays, not strings**: `modalities` is `text[]` in Postgres. Never store as comma-separated. Always check with `Array.includes()` or `@>` operator.

3. **Island defaults to big_island**: Many listings have this by accident. Verify listings actually belong on the island they claim.

4. **display_name gotcha**: Script 26 sometimes writes bio text into `first_name`/`last_name`/`display_name`. The adapter prioritizes `first_name + last_name` over `name`, so bad extractions show garbage in the UI.

5. **FILTER_MODALITIES drift**: `Directory.tsx` has its own hardcoded modality list that frequently falls behind the canonical list. A modality can exist in the DB but be unfilterable if missing from this list.

6. **Taxonomy vs UI lists**: The new search system uses `taxonomy_terms` in Supabase, not the hardcoded arrays. A modality present in the UI but missing from taxonomy is invisible to search.

7. **Featured slots cap**: 5 per island, enforced by DB trigger. Attempting to set a 6th featured listing will throw an error.

8. **supabaseAdmin is null client-side**: Any audit code running in the browser cannot use service-role access. Pipeline scripts use the Python Supabase client which has full access.

## Learning and evolution

This skill is designed to get smarter over time. The mechanism is the `references/audit-learnings.md` file — a living document that captures patterns, false positives, calibrated thresholds, and new rules discovered through actual use.

### Before every audit

Read `references/audit-learnings.md` FIRST. It contains:
- **Learned rules**: Patterns discovered in previous audits that change how checks should run
- **Known false positives**: Issues that look like problems but aren't — skip these
- **Calibrated thresholds**: Thresholds that have been adjusted based on real data
- **New checks proposed**: Ideas for checks not yet in the main workflow
- **Schema changes log**: When DB columns were added/changed, affecting what to validate

Apply everything in this file. It overrides defaults in the main workflow when there's a conflict.

### After every audit

Append new findings to `audit-learnings.md`. Specifically:

1. **Any new pattern you discovered** — a new class of bad data, a normalization rule you had to invent, a field combination that breaks the UI. Add it to "Learned Rules" with date, context, discovery, and the rule for next time.

2. **Any false positive the user pointed out** — something you flagged that turned out to be fine. Add it to "Known False Positives" so future audits don't waste time on it.

3. **Any threshold that performed poorly** — if a threshold generated too many or too few flags, note the adjustment in "Threshold Calibration".

4. **Any new check idea** — if during the audit you think "I should also check X", add it to "New Checks Proposed" even if you don't implement it this run.

5. **Any schema change** — if new columns were added, types changed, or constraints modified, log it in "Schema Changes Log" so future audits know to validate the new fields.

This creates a flywheel: each audit improves the next one. The skill never forgets a lesson, even across sessions.

### When to update SKILL.md itself

If a learned rule in `audit-learnings.md` has been stable through 3+ audits and clearly belongs in the core workflow, promote it: add it to the appropriate Check in SKILL.md and note in the learnings file that it was promoted. Keep `audit-learnings.md` as the fast-moving scratch pad; keep SKILL.md as the stable, proven workflow.

### Updating canonical reference files

When the user adds a new modality, center type, island, or city:
1. Update the relevant reference file (`canonical-modalities.md`, `canonical-locations.md`, or `schema-expectations.md`)
2. Log the change in `audit-learnings.md` Schema Changes Log
3. Note which code files also need updating (the cross-list sync problem)

## Reference files

Read these for exact canonical values:
- `references/canonical-modalities.md` — all 44 modalities + normalization map
- `references/canonical-locations.md` — island enum + city lists per island
- `references/schema-expectations.md` — full field-by-field spec for practitioners and centers
- `references/audit-learnings.md` — living document of patterns, false positives, and calibrated thresholds (READ THIS FIRST)
