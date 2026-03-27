-- ============================================================================
-- NAME SEARCH IMPROVEMENTS
-- 1. Add business_name to practitioner tsvector (weight 'A')
-- 2. Boost FTS weight 0.30 → 0.35 in search_listings RPC
--    (offset by reducing freshness 0.10 → 0.05; weights still sum to 1.0)
-- 3. Touch all practitioner rows to rebuild search_document
-- ============================================================================

-- ── 1. Update practitioner search trigger ────────────────────────────────────
CREATE OR REPLACE FUNCTION build_practitioner_search_document()
RETURNS trigger AS $$
DECLARE
  modality_labels  text;
  concern_labels   text;
  approach_labels  text;
  old_modalities   text;
BEGIN
  SELECT string_agg(t.label, ' ') INTO modality_labels
    FROM listing_modalities lm JOIN taxonomy_terms t ON t.id = lm.term_id
    WHERE lm.listing_id = NEW.id AND lm.listing_type = 'practitioner';

  SELECT string_agg(t.label, ' ') INTO concern_labels
    FROM listing_concerns lc JOIN taxonomy_terms t ON t.id = lc.term_id
    WHERE lc.listing_id = NEW.id AND lc.listing_type = 'practitioner';

  SELECT string_agg(t.label, ' ') INTO approach_labels
    FROM listing_approaches la JOIN taxonomy_terms t ON t.id = la.term_id
    WHERE la.listing_id = NEW.id AND la.listing_type = 'practitioner';

  old_modalities := array_to_string(COALESCE(NEW.modalities, ARRAY[]::text[]), ' ');

  NEW.search_document :=
    setweight(to_tsvector('english',
      coalesce(NEW.display_name, NEW.name, '') || ' ' ||
      coalesce(NEW.business_name, '') || ' ' ||   -- ← added
      coalesce(modality_labels, '') || ' ' ||
      old_modalities
    ), 'A') ||
    setweight(to_tsvector('english',
      coalesce(concern_labels, '') || ' ' ||
      coalesce(approach_labels, '') || ' ' ||
      coalesce(NEW.city, '') || ' ' ||
      coalesce(NEW.island, '')
    ), 'B') ||
    setweight(to_tsvector('english',
      coalesce(NEW.bio, '') || ' ' ||
      coalesce(NEW.search_summary, '')
    ), 'C');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── 2. Rebuild search_document for all practitioners ─────────────────────────
-- Touch every row to fire the trigger so business_name is indexed immediately.
UPDATE practitioners SET updated_at = updated_at WHERE status = 'published';

-- ── 3. Update search_listings RPC — boost FTS weight, trim freshness ─────────
-- (Full RPC replaced; only the composite score weights change)
CREATE OR REPLACE FUNCTION search_listings(
  p_query            text    DEFAULT NULL,
  p_island           text    DEFAULT NULL,
  p_city             text    DEFAULT NULL,
  p_modality_ids     int[]   DEFAULT NULL,
  p_concern_ids      int[]   DEFAULT NULL,
  p_approach_ids     int[]   DEFAULT NULL,
  p_format_ids       int[]   DEFAULT NULL,
  p_audience_ids     int[]   DEFAULT NULL,
  p_listing_types    text[]  DEFAULT NULL,
  p_session_types    text[]  DEFAULT NULL,
  p_accepts_new      boolean DEFAULT NULL,
  p_user_lat         float8  DEFAULT NULL,
  p_user_lng         float8  DEFAULT NULL,
  p_limit            int     DEFAULT 20,
  p_offset           int     DEFAULT 0
)
RETURNS TABLE (
  id                 uuid,
  listing_type       text,
  name               text,
  display_name       text,
  bio                text,
  island             text,
  city               text,
  lat                float8,
  lng                float8,
  tier               text,
  modalities         text[],
  photo_url          text,
  website_url        text,
  session_type       text,
  accepts_new_clients boolean,
  profile_completeness int,
  fts_rank           real,
  embedding_score    real,
  taxonomy_score     real,
  composite_score    real,
  total_count        bigint,
  matched_concerns   text[],
  matched_approaches text[]
)
LANGUAGE sql STABLE
AS $$
WITH

-- ── Phase 1: Candidate pool ────────────────────────────────────────────────
candidates AS (
  SELECT
    p.id,
    'practitioner'::text                       AS listing_type,
    p.name,
    p.display_name,
    p.bio,
    p.island,
    p.city,
    p.lat,
    p.lng,
    p.tier,
    p.modalities,
    p.avatar_url                               AS photo_url,
    p.website_url,
    p.session_type,
    p.accepts_new_clients,
    p.profile_completeness,
    p.search_document,
    p.search_embedding
  FROM practitioners p
  WHERE p.status = 'published'
    AND (p_island        IS NULL OR p.island = p_island)
    AND (p_city          IS NULL OR lower(p.city) = lower(p_city))
    AND (p_session_types IS NULL OR p.session_type = ANY(p_session_types) OR p.session_type = 'both')
    AND (p_accepts_new   IS NULL OR p.accepts_new_clients = p_accepts_new)
    AND (
      p_listing_types IS NULL
      OR 'practitioner' = ANY(p_listing_types)
    )
    AND (
      p_modality_ids IS NULL
      OR EXISTS (
        SELECT 1 FROM listing_modalities lm
        WHERE lm.listing_id = p.id
          AND lm.listing_type = 'practitioner'
          AND lm.term_id = ANY(p_modality_ids)
      )
      OR (
        SELECT COUNT(*) FROM listing_modalities lm
        WHERE lm.listing_id = p.id AND lm.listing_type = 'practitioner'
      ) = 0
    )

  UNION ALL

  SELECT
    c.id,
    'center'::text                             AS listing_type,
    c.name,
    NULL::text                                 AS display_name,
    c.description                              AS bio,
    c.island,
    c.city,
    c.lat,
    c.lng,
    c.tier,
    c.modalities,
    CASE WHEN array_length(c.photos, 1) > 0 THEN c.photos[1] ELSE NULL END AS photo_url,
    c.website_url,
    NULL::text                                 AS session_type,
    NULL::boolean                              AS accepts_new_clients,
    c.profile_completeness,
    c.search_document,
    c.search_embedding
  FROM centers c
  WHERE c.status = 'published'
    AND (p_island        IS NULL OR c.island = p_island)
    AND (p_city          IS NULL OR lower(c.city) = lower(p_city))
    AND (p_accepts_new   IS NULL OR p_accepts_new = false)
    AND (
      p_listing_types IS NULL
      OR 'center' = ANY(p_listing_types)
    )
    AND (
      p_modality_ids IS NULL
      OR EXISTS (
        SELECT 1 FROM listing_modalities lm
        WHERE lm.listing_id = c.id
          AND lm.listing_type = 'center'
          AND lm.term_id = ANY(p_modality_ids)
      )
      OR (
        SELECT COUNT(*) FROM listing_modalities lm
        WHERE lm.listing_id = c.id AND lm.listing_type = 'center'
      ) = 0
    )
),

-- ── Phase 2: Compute scores ────────────────────────────────────────────────
scored AS (
  SELECT
    c.*,

    -- FTS rank (0.0–1.0 before normalisation)
    CASE
      WHEN p_query IS NULL OR p_query = '' THEN 0.0
      WHEN c.search_document IS NULL       THEN 0.0
      ELSE ts_rank_cd(c.search_document,
             websearch_to_tsquery('english', p_query),
             32)
    END::real AS raw_fts_rank,

    -- Embedding similarity score (0.0–1.0)
    CASE
      WHEN p_query IS NULL OR p_query = '' THEN 0.0
      WHEN c.search_embedding IS NULL      THEN 0.0
      ELSE 0.0  -- populated post-query by application layer when needed
    END::real AS raw_embedding_score,

    -- Taxonomy match score
    (
      COALESCE(
        (SELECT COUNT(*)::real
         FROM listing_modalities lm
         WHERE lm.listing_id = c.id
           AND lm.listing_type = c.listing_type
           AND (p_modality_ids IS NULL OR lm.term_id = ANY(p_modality_ids))
        ) / NULLIF(array_length(p_modality_ids, 1), 0),
        CASE WHEN p_modality_ids IS NULL THEN 0.0 ELSE 0.0 END
      ) +
      COALESCE(
        (SELECT COUNT(*)::real
         FROM listing_concerns lc
         WHERE lc.listing_id = c.id
           AND lc.listing_type = c.listing_type
           AND (p_concern_ids IS NULL OR lc.term_id = ANY(p_concern_ids))
        ) / NULLIF(array_length(p_concern_ids, 1), 0),
        CASE WHEN p_concern_ids IS NULL THEN 0.0 ELSE 0.0 END
      ) +
      COALESCE(
        (SELECT COUNT(*)::real
         FROM listing_approaches la
         WHERE la.listing_id = c.id
           AND la.listing_type = c.listing_type
           AND (p_approach_ids IS NULL OR la.term_id = ANY(p_approach_ids))
        ) / NULLIF(array_length(p_approach_ids, 1), 0),
        CASE WHEN p_approach_ids IS NULL THEN 0.0 ELSE 0.0 END
      )
    ) / 3.0 AS raw_taxonomy_score,

    -- Tier boost
    CASE c.tier
      WHEN 'featured' THEN 1.0
      WHEN 'premium'  THEN 0.5
      ELSE                 0.0
    END::real AS tier_boost,

    -- Freshness score
    CASE
      WHEN c.id IN (SELECT listing_id FROM featured_slots) THEN 1.0
      ELSE LEAST(1.0,
        EXTRACT(EPOCH FROM (now() - INTERVAL '30 days'))::real /
        NULLIF(EXTRACT(EPOCH FROM (now() - INTERVAL '365 days'))::real, 0)
      )
    END::real AS freshness

  FROM candidates c
),

-- ── Phase 3: Normalise + composite ────────────────────────────────────────
weighted AS (
  SELECT
    s.*,
    CASE
      WHEN max(s.raw_fts_rank) OVER () > 0
      THEN s.raw_fts_rank / max(s.raw_fts_rank) OVER ()
      ELSE 0.0
    END::real AS norm_fts_rank,

    -- Composite score — weights: FTS 0.35, embedding 0.20, taxonomy 0.20,
    --                            completeness 0.10, tier 0.10, freshness 0.05
    (
      0.35 * (CASE WHEN max(s.raw_fts_rank) OVER () > 0
               THEN s.raw_fts_rank / max(s.raw_fts_rank) OVER ()
               ELSE 0.0 END)
    + 0.20 * s.raw_embedding_score
    + 0.20 * s.raw_taxonomy_score
    + 0.10 * (COALESCE(s.profile_completeness, 0)::real / 100.0)
    + 0.10 * s.tier_boost
    + 0.05 * s.freshness
    )::real AS final_composite
  FROM scored s
),

-- ── Phase 4: Count ────────────────────────────────────────────────────────
total AS (
  SELECT COUNT(*)::bigint AS n FROM weighted w
  WHERE
    p_query IS NULL
    OR p_query = ''
    OR w.raw_fts_rank > 0.0
    OR w.final_composite > 0.0
),

-- ── Phase 5: Taxonomy label enrichment ───────────────────────────────────
enriched AS (
  SELECT
    w.*,
    (SELECT array_agg(t.label ORDER BY t.label)
     FROM listing_concerns lc
     JOIN taxonomy_terms t ON t.id = lc.term_id
     WHERE lc.listing_id = w.id AND lc.listing_type = w.listing_type
       AND (p_concern_ids IS NULL OR lc.term_id = ANY(p_concern_ids))
    ) AS matched_concern_labels,
    (SELECT array_agg(t.label ORDER BY t.label)
     FROM listing_approaches la
     JOIN taxonomy_terms t ON t.id = la.term_id
     WHERE la.listing_id = w.id AND la.listing_type = w.listing_type
       AND (p_approach_ids IS NULL OR la.term_id = ANY(p_approach_ids))
    ) AS matched_approach_labels
  FROM weighted w
)

-- ── Final output ─────────────────────────────────────────────────────────
SELECT
  e.id,
  e.listing_type,
  e.name,
  e.display_name,
  e.bio,
  e.island,
  e.city,
  e.lat,
  e.lng,
  e.tier,
  e.modalities,
  e.photo_url,
  e.website_url,
  e.session_type,
  e.accepts_new_clients,
  e.profile_completeness,
  e.raw_fts_rank       AS fts_rank,
  e.raw_embedding_score AS embedding_score,
  e.raw_taxonomy_score  AS taxonomy_score,
  e.final_composite     AS composite_score,
  t.n                   AS total_count,
  e.matched_concern_labels   AS matched_concerns,
  e.matched_approach_labels  AS matched_approaches
FROM enriched e
CROSS JOIN total t
WHERE
  p_query IS NULL
  OR p_query = ''
  OR e.raw_fts_rank > 0.0
  OR e.final_composite > 0.0
ORDER BY
  -- Featured always float first
  (e.tier = 'featured') DESC,
  -- Then by composite score descending
  e.final_composite DESC,
  e.name
LIMIT  p_limit
OFFSET p_offset;
$$;
