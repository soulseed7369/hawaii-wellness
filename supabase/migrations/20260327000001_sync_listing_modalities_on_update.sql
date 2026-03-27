-- ============================================================================
-- SYNC listing_modalities ON MODALITY UPDATE
--
-- REQUIRES: 20260327000000_embedding_dirty_flag.sql must be applied first.
-- This migration references NEW.embedding_dirty added by that migration.
--
-- Problem: when a user saves updated modalities[] via the dashboard, the
-- listing_modalities join table (used for taxonomy overlap scoring + embedding
-- composition) never gets updated. This silently degrades search quality.
--
-- Fix: replace the existing build_practitioner_search_document() and
-- build_center_search_document() trigger functions to also sync the
-- listing_modalities join table BEFORE building the tsvector, so the
-- tsvector reads fresh join data in the same pass.
--
-- Also sets embedding_dirty = true whenever search-relevant fields change,
-- so the nightly batch script knows which rows need re-embedding.
--
-- The trigger definitions themselves (trg_practitioners_search_doc,
-- trg_centers_search_doc) do NOT need to change — only the functions.
-- ============================================================================


-- ── Practitioners ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION build_practitioner_search_document()
RETURNS trigger AS $$
DECLARE
  mod_label        text;
  term_rec         record;
  i                int := 0;
  modality_labels  text;
  concern_labels   text;
  approach_labels  text;
  old_modalities   text;
BEGIN

  -- ── Step A: DISABLED — Sync moved to sync-modality-ranks edge function ──────
  -- Previously: trigger synced listing_modalities WITHOUT rank support.
  -- Now: the edge function (invoked from dashboard hooks) syncs WITH rank + tier limits.
  -- The edge function is invoked AFTER the listing is saved, ensuring owner_id is set.
  -- Rank enforcement: free=2, premium=5, featured=all.
  -- To avoid duplicate writes: trigger does NOT insert to listing_modalities.
  --
  -- Edge function: supabase/functions/sync-modality-ranks/index.ts
  -- Hooks that invoke it: src/hooks/useMyPractitioner.ts (lines 131, 167)
  --
  -- NOTE: If modalities change via direct DB update (admin query), they will NOT
  -- be synced to listing_modalities. This is intentional (admin operations bypass
  -- tier limits). Use the dashboard UI for tier-respecting saves.

  -- ── Step B: Mark embedding as stale if any search-relevant field changed ───
  IF (OLD.modalities IS DISTINCT FROM NEW.modalities OR
      OLD.bio        IS DISTINCT FROM NEW.bio        OR
      OLD.name       IS DISTINCT FROM NEW.name       OR
      OLD.city       IS DISTINCT FROM NEW.city) THEN
    NEW.embedding_dirty := true;
  END IF;

  -- ── Step C: Rebuild tsvector (original logic, reads fresh join data) ────────
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


-- ── Centers ──────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION build_center_search_document()
RETURNS trigger AS $$
DECLARE
  mod_label        text;
  term_rec         record;
  i                int := 0;
  modality_labels  text;
  concern_labels   text;
  approach_labels  text;
  old_modalities   text;
BEGIN

  -- ── Step A: DISABLED — Sync moved to sync-modality-ranks edge function ──────
  -- Previously: trigger synced listing_modalities WITHOUT rank support.
  -- Now: the edge function (invoked from dashboard hooks) syncs WITH rank + tier limits.
  -- The edge function is invoked AFTER the listing is saved, ensuring owner_id is set.
  -- Rank enforcement: free=2, premium=5, featured=all.
  -- To avoid duplicate writes: trigger does NOT insert to listing_modalities.
  --
  -- Edge function: supabase/functions/sync-modality-ranks/index.ts
  -- Hooks that invoke it: src/hooks/useMyCenters.ts (lines 152, 188)
  --
  -- NOTE: If modalities change via direct DB update (admin query), they will NOT
  -- be synced to listing_modalities. This is intentional (admin operations bypass
  -- tier limits). Use the dashboard UI for tier-respecting saves.

  -- ── Step B: Mark embedding as stale ────────────────────────────────────────
  IF (OLD.modalities    IS DISTINCT FROM NEW.modalities    OR
      OLD.description   IS DISTINCT FROM NEW.description   OR
      OLD.name          IS DISTINCT FROM NEW.name          OR
      OLD.city          IS DISTINCT FROM NEW.city) THEN
    NEW.embedding_dirty := true;
  END IF;

  -- ── Step C: Rebuild tsvector ────────────────────────────────────────────────
  SELECT string_agg(t.label, ' ') INTO modality_labels
    FROM listing_modalities lm JOIN taxonomy_terms t ON t.id = lm.term_id
    WHERE lm.listing_id = NEW.id AND lm.listing_type = 'center';

  SELECT string_agg(t.label, ' ') INTO concern_labels
    FROM listing_concerns lc JOIN taxonomy_terms t ON t.id = lc.term_id
    WHERE lc.listing_id = NEW.id AND lc.listing_type = 'center';

  SELECT string_agg(t.label, ' ') INTO approach_labels
    FROM listing_approaches la JOIN taxonomy_terms t ON t.id = la.term_id
    WHERE la.listing_id = NEW.id AND la.listing_type = 'center';

  old_modalities := array_to_string(COALESCE(NEW.modalities, ARRAY[]::text[]), ' ');

  NEW.search_document :=
    setweight(to_tsvector('english',
      coalesce(NEW.name, '') || ' ' ||
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
      coalesce(NEW.description, '') || ' ' ||
      coalesce(NEW.search_summary, '')
    ), 'C');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
