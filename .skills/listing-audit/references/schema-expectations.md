# Schema Expectations — Practitioners & Centers

Last updated: 2026-03-15

## Practitioners Table

### Required fields (record is broken without these)
| Field | Type | Constraint |
|---|---|---|
| `id` | uuid | PK, auto-generated |
| `name` | text | Non-empty, non-whitespace |
| `island` | text | Must be one of: big_island, maui, oahu, kauai, molokai |
| `status` | text | Must be: draft, published, or archived |
| `tier` | text | Must be: free, premium, or featured |
| `modalities` | text[] | Postgres array, at least 1 entry, each entry canonical |
| `session_type` | text | Must be: in_person, online, or both |

### Important fields (listing degrades without these)
| Field | Type | Quality check |
|---|---|---|
| `bio` | text | Should be >10 words to count as "populated" |
| `city` | text | Should match canonical city list for the island |
| `phone` | text | 10+ digits after stripping formatting |
| `email` | text | Contains @ and valid domain |
| `avatar_url` | text | Valid URL (Supabase storage or external) |
| `lat` | float8 | Must come in pair with lng; within Hawaii bbox |
| `lng` | float8 | Must come in pair with lat; within Hawaii bbox |
| `first_name` | text | Should look like a real personal name |
| `website_url` | text | http:// or https:// prefixed |
| `accepts_new_clients` | boolean | Defaults to true |

### Premium-tier fields (only expected for premium/featured)
| Field | Type | Notes |
|---|---|---|
| `social_links` | jsonb | Keys: instagram, facebook, linkedin, x, substack |
| `working_hours` | jsonb | Keys: mon-sun, each {open, close} or null |
| `testimonials` | jsonb[] | Array of {author, text, date} objects |
| `external_booking_url` | text | Calendly, Mindbody, etc. |
| `what_to_expect` | text | Session description |
| `lineage_or_training` | text | Credentials background |
| `years_experience` | integer | Training depth |

### Name resolution priority (adapters.ts)
The frontend displays names using this priority:
1. `first_name + last_name` (if first_name is set)
2. `display_name` (if set and != business_name)
3. `name` (fallback)

Common data quality issue: script 26 sometimes writes bio sentences into first_name/last_name. This causes garbage to display instead of the real name.

### Metadata fields
| Field | Type | Notes |
|---|---|---|
| `owner_id` | uuid | FK to auth.users; null for pipeline-ingested |
| `business_id` | uuid | FK to centers; links practitioner to center |
| `business_name` | text | Free-text alt when no center FK |
| `enriched_at` | timestamptz | Set by script 22 when crawled |
| `lead_score` | integer | 0-100, set by script 22 |
| `no_website_lead` | boolean | High-value leads without websites |
| `search_tsv` | tsvector | Full-text search (auto-triggered) |
| `search_embedding` | vector(384) | Sentence embedding |
| `profile_completeness` | integer | 0-100 completeness score |

---

## Centers Table

### Required fields
| Field | Type | Constraint |
|---|---|---|
| `id` | uuid | PK |
| `name` | text | Non-empty |
| `island` | text | Same enum as practitioners |
| `status` | text | draft, published, archived |
| `tier` | text | free, premium, featured |
| `modalities` | text[] | Same validation as practitioners |
| `center_type` | text | spa, wellness_center, clinic, retreat_center, yoga_studio, fitness_center |
| `session_type` | text | in_person, online, both |

### Important fields
| Field | Type | Quality check |
|---|---|---|
| `description` | text | >10 words (NOTE: this is called `description` on centers, NOT `bio`) |
| `city` | text | Canonical city for island |
| `phone` | text | 10+ digits |
| `email` | text | Valid email format |
| `avatar_url` | text | Valid URL |
| `lat`, `lng` | float8 | Paired, within Hawaii bbox |
| `website_url` | text | Valid URL |

### Center-specific fields
| Field | Type | Notes |
|---|---|---|
| `photos` | text[] | Up to 5 image URLs |
| `logo` | text | Logo URL |

---

## Featured Slots Table

| Field | Type | Constraint |
|---|---|---|
| `id` | uuid | PK |
| `listing_id` | uuid | FK to practitioners.id or centers.id |
| `listing_type` | text | 'practitioner' or 'center' |
| `island` | text | Island enum |
| `owner_id` | uuid | FK to auth.users |

**Hard constraint:** Maximum 5 featured slots per island (DB trigger enforced).

---

## Common schema-drift patterns

These are real bugs that have occurred in this codebase:

1. **New modality added to UI but not taxonomy** — Fitness was added to all hardcoded arrays but missing from `taxonomy_terms`, making it invisible to search.

2. **New center_type added to UI but not DB CHECK constraint** — `fitness_center` added to TypeScript types but Postgres CHECK constraint rejected saves.

3. **FILTER_MODALITIES falls behind** — Directory.tsx has its own list that frequently misses new modalities.

4. **Column name confusion** — Practitioners use `bio`, centers use `description`. Scripts that query both tables with the same column name crash with Postgres errors.

5. **display_name pollution** — Script 26 extracting bio text into name fields, causing adapters to display sentences instead of names.
