-- ============================================================================
-- SEARCH COLUMNS — Full-text search + vector embeddings on listings
-- ============================================================================

-- Enable pgvector for embedding storage
CREATE EXTENSION IF NOT EXISTS vector;

-- Make extensions schema visible so vector type resolves correctly
SET search_path TO public, extensions;

-- ── Add search columns to practitioners ─────────────────────────────────────
ALTER TABLE practitioners
  ADD COLUMN IF NOT EXISTS search_document       tsvector,
  ADD COLUMN IF NOT EXISTS search_embedding      vector(384),
  ADD COLUMN IF NOT EXISTS profile_completeness  int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS search_summary        text;

-- ── Add search columns to centers ───────────────────────────────────────────
ALTER TABLE centers
  ADD COLUMN IF NOT EXISTS search_document       tsvector,
  ADD COLUMN IF NOT EXISTS search_embedding      vector(384),
  ADD COLUMN IF NOT EXISTS profile_completeness  int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS search_summary        text;

-- ── Indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_practitioners_search_doc ON practitioners USING gin(search_document);
CREATE INDEX IF NOT EXISTS idx_centers_search_doc       ON centers       USING gin(search_document);

-- IVFFlat for embedding similarity. Rebuild after data load for optimal performance.
-- If table has <100 rows, Postgres may warn; safe to ignore during initial migration.
CREATE INDEX IF NOT EXISTS idx_practitioners_embedding
  ON practitioners USING ivfflat(search_embedding vector_cosine_ops) WITH (lists = 50);
CREATE INDEX IF NOT EXISTS idx_centers_embedding
  ON centers       USING ivfflat(search_embedding vector_cosine_ops) WITH (lists = 50);

-- ── Trigger: build practitioner search document ─────────────────────────────
CREATE OR REPLACE FUNCTION build_practitioner_search_document()
RETURNS trigger AS $$
DECLARE
  modality_labels  text;
  concern_labels   text;
  approach_labels  text;
  old_modalities   text;
BEGIN
  -- Taxonomy labels from join tables
  SELECT string_agg(t.label, ' ') INTO modality_labels
    FROM listing_modalities lm JOIN taxonomy_terms t ON t.id = lm.term_id
    WHERE lm.listing_id = NEW.id AND lm.listing_type = 'practitioner';

  SELECT string_agg(t.label, ' ') INTO concern_labels
    FROM listing_concerns lc JOIN taxonomy_terms t ON t.id = lc.term_id
    WHERE lc.listing_id = NEW.id AND lc.listing_type = 'practitioner';

  SELECT string_agg(t.label, ' ') INTO approach_labels
    FROM listing_approaches la JOIN taxonomy_terms t ON t.id = la.term_id
    WHERE la.listing_id = NEW.id AND la.listing_type = 'practitioner';

  -- Backward compat: include old modalities text[] until fully migrated
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

CREATE TRIGGER trg_practitioners_search_doc
  BEFORE INSERT OR UPDATE ON practitioners
  FOR EACH ROW EXECUTE FUNCTION build_practitioner_search_document();

-- ── Trigger: build center search document ───────────────────────────────────
CREATE OR REPLACE FUNCTION build_center_search_document()
RETURNS trigger AS $$
DECLARE
  modality_labels  text;
  concern_labels   text;
  approach_labels  text;
  old_modalities   text;
BEGIN
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

CREATE TRIGGER trg_centers_search_doc
  BEFORE INSERT OR UPDATE ON centers
  FOR EACH ROW EXECUTE FUNCTION build_center_search_document();
