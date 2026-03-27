-- ============================================================================
-- FIX: Auto-sync listing_modalities on practitioners/centers update
-- ============================================================================
--
-- Problem: Edge function 'sync-modality-ranks' is not deployed, so
-- listing_modalities join table never gets populated when users save profiles.
-- This breaks search for practitioners on modalities.
--
-- Solution: Add a database trigger that auto-syncs listing_modalities
-- whenever practitioners.modalities or centers.modalities changes,
-- respecting tier-based limits (free: 2, premium: 5, featured: all).
--
-- Trigger executes AFTER the practitioner/center row is updated,
-- so owner_id is guaranteed to exist.

-- ── Helper function: sync modalities to listing_modalities table ──────────

CREATE OR REPLACE FUNCTION sync_listing_modalities(
  p_listing_id uuid,
  p_listing_type text,
  p_modalities text[],
  p_tier text DEFAULT 'free'
)
RETURNS void AS $$
DECLARE
  v_modality_axis_id int;
  v_mod_label text;
  v_term_id int;
  v_rank int;
  v_tier_limit int;
BEGIN
  -- Get the modality axis ID
  SELECT id INTO v_modality_axis_id
  FROM taxonomy_axes
  WHERE slug = 'modality'
  LIMIT 1;

  IF v_modality_axis_id IS NULL THEN
    -- If taxonomy doesn't exist, skip silently (might be in early migration)
    RETURN;
  END IF;

  -- Determine tier limit
  v_tier_limit := CASE p_tier
    WHEN 'featured' THEN array_length(p_modalities, 1)  -- all modalities
    WHEN 'premium' THEN 5
    ELSE 2  -- free (default)
  END;

  -- Delete existing modality mappings for this listing
  DELETE FROM listing_modalities
  WHERE listing_id = p_listing_id
    AND listing_type = p_listing_type;

  -- If no modalities to insert, we're done
  IF p_modalities IS NULL OR array_length(p_modalities, 1) = 0 THEN
    RETURN;
  END IF;

  -- Insert new mappings, respecting tier limit
  FOR v_rank IN 1..least(array_length(p_modalities, 1), v_tier_limit) LOOP
    v_mod_label := p_modalities[v_rank];

    -- Look up term ID by lowercase label match
    SELECT t.id INTO v_term_id
    FROM taxonomy_terms t
    WHERE t.axis_id = v_modality_axis_id
      AND lower(t.label) = lower(v_mod_label)
    LIMIT 1;

    -- Only insert if we found a matching term
    IF v_term_id IS NOT NULL THEN
      INSERT INTO listing_modalities (listing_id, listing_type, term_id, rank, is_primary)
      VALUES (p_listing_id, p_listing_type, v_term_id, v_rank, (v_rank = 1))
      ON CONFLICT DO NOTHING;  -- Silently skip if already exists
    ELSE
      -- Log unmatched modality for debugging
      RAISE NOTICE 'Unmatched modality label: %', v_mod_label;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ── Trigger: Auto-sync on practitioners update ──────────────────────────

CREATE OR REPLACE FUNCTION trg_practitioners_sync_modalities()
RETURNS trigger AS $$
BEGIN
  -- Only re-sync if modalities actually changed
  IF NEW.modalities IS DISTINCT FROM OLD.modalities THEN
    PERFORM sync_listing_modalities(
      NEW.id,
      'practitioner',
      NEW.modalities,
      COALESCE(NEW.tier, 'free')
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_practitioners_sync_modalities_after_update
  ON practitioners;

CREATE TRIGGER trg_practitioners_sync_modalities_after_update
  AFTER UPDATE ON practitioners
  FOR EACH ROW
  EXECUTE FUNCTION trg_practitioners_sync_modalities();

-- ── Trigger: Auto-sync on centers update ────────────────────────────────

CREATE OR REPLACE FUNCTION trg_centers_sync_modalities()
RETURNS trigger AS $$
BEGIN
  -- Only re-sync if modalities actually changed
  IF NEW.modalities IS DISTINCT FROM OLD.modalities THEN
    PERFORM sync_listing_modalities(
      NEW.id,
      'center',
      NEW.modalities,
      COALESCE(NEW.tier, 'free')
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_centers_sync_modalities_after_update
  ON centers;

CREATE TRIGGER trg_centers_sync_modalities_after_update
  AFTER UPDATE ON centers
  FOR EACH ROW
  EXECUTE FUNCTION trg_centers_sync_modalities();

-- ── BACKFILL: Sync all practitioners and centers ──────────────────────────
-- This ensures existing listings (like Kai) get their modalities synced.

DO $$
DECLARE
  r RECORD;
BEGIN
  -- Sync all practitioners
  FOR r IN SELECT id, modalities, tier FROM practitioners WHERE modalities IS NOT NULL AND array_length(modalities, 1) > 0
  LOOP
    PERFORM sync_listing_modalities(r.id, 'practitioner', r.modalities, COALESCE(r.tier, 'free'));
  END LOOP;

  -- Sync all centers
  FOR r IN SELECT id, modalities, tier FROM centers WHERE modalities IS NOT NULL AND array_length(modalities, 1) > 0
  LOOP
    PERFORM sync_listing_modalities(r.id, 'center', r.modalities, COALESCE(r.tier, 'free'));
  END LOOP;

  RAISE NOTICE 'Backfilled modality mappings for all practitioners and centers';
END $$;
