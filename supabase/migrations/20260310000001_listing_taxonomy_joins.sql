-- ============================================================================
-- LISTING ↔ TAXONOMY JOIN TABLES
-- ============================================================================
-- Links practitioners and centers to taxonomy terms across all axes.
-- Each table follows the same composite-PK pattern.

-- ── listing_modalities ──────────────────────────────────────────────────────
CREATE TABLE listing_modalities (
  listing_id   uuid NOT NULL,
  listing_type text NOT NULL CHECK (listing_type IN ('practitioner', 'center')),
  term_id      int  NOT NULL REFERENCES taxonomy_terms(id) ON DELETE CASCADE,
  is_primary   boolean NOT NULL DEFAULT false,
  PRIMARY KEY (listing_id, listing_type, term_id)
);
CREATE INDEX idx_listing_modalities_term ON listing_modalities(term_id);

-- ── listing_concerns ────────────────────────────────────────────────────────
CREATE TABLE listing_concerns (
  listing_id   uuid NOT NULL,
  listing_type text NOT NULL CHECK (listing_type IN ('practitioner', 'center')),
  term_id      int  NOT NULL REFERENCES taxonomy_terms(id) ON DELETE CASCADE,
  PRIMARY KEY (listing_id, listing_type, term_id)
);
CREATE INDEX idx_listing_concerns_term ON listing_concerns(term_id);

-- ── listing_approaches ──────────────────────────────────────────────────────
CREATE TABLE listing_approaches (
  listing_id   uuid NOT NULL,
  listing_type text NOT NULL CHECK (listing_type IN ('practitioner', 'center')),
  term_id      int  NOT NULL REFERENCES taxonomy_terms(id) ON DELETE CASCADE,
  PRIMARY KEY (listing_id, listing_type, term_id)
);
CREATE INDEX idx_listing_approaches_term ON listing_approaches(term_id);

-- ── listing_formats ─────────────────────────────────────────────────────────
CREATE TABLE listing_formats (
  listing_id   uuid NOT NULL,
  listing_type text NOT NULL CHECK (listing_type IN ('practitioner', 'center')),
  term_id      int  NOT NULL REFERENCES taxonomy_terms(id) ON DELETE CASCADE,
  PRIMARY KEY (listing_id, listing_type, term_id)
);
CREATE INDEX idx_listing_formats_term ON listing_formats(term_id);

-- ── listing_audiences ───────────────────────────────────────────────────────
CREATE TABLE listing_audiences (
  listing_id   uuid NOT NULL,
  listing_type text NOT NULL CHECK (listing_type IN ('practitioner', 'center')),
  term_id      int  NOT NULL REFERENCES taxonomy_terms(id) ON DELETE CASCADE,
  PRIMARY KEY (listing_id, listing_type, term_id)
);
CREATE INDEX idx_listing_audiences_term ON listing_audiences(term_id);

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Helper: check if listing_id belongs to a published listing
CREATE OR REPLACE FUNCTION listing_is_published(p_id uuid, p_type text)
RETURNS boolean AS $$
BEGIN
  IF p_type = 'practitioner' THEN
    RETURN EXISTS (SELECT 1 FROM practitioners WHERE id = p_id AND status = 'published');
  ELSIF p_type = 'center' THEN
    RETURN EXISTS (SELECT 1 FROM centers WHERE id = p_id AND status = 'published');
  END IF;
  RETURN false;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Helper: check if listing_id belongs to current user
CREATE OR REPLACE FUNCTION listing_is_owned(p_id uuid, p_type text)
RETURNS boolean AS $$
BEGIN
  IF p_type = 'practitioner' THEN
    RETURN EXISTS (SELECT 1 FROM practitioners WHERE id = p_id AND owner_id = auth.uid());
  ELSIF p_type = 'center' THEN
    RETURN EXISTS (SELECT 1 FROM centers WHERE id = p_id AND owner_id = auth.uid());
  END IF;
  RETURN false;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

ALTER TABLE listing_modalities ENABLE ROW LEVEL SECURITY;
ALTER TABLE listing_concerns   ENABLE ROW LEVEL SECURITY;
ALTER TABLE listing_approaches ENABLE ROW LEVEL SECURITY;
ALTER TABLE listing_formats    ENABLE ROW LEVEL SECURITY;
ALTER TABLE listing_audiences  ENABLE ROW LEVEL SECURITY;

-- Macro: create the 3 standard policies on each table
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'listing_modalities','listing_concerns','listing_approaches',
    'listing_formats','listing_audiences'
  ] LOOP
    -- Public read for published listings
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR SELECT USING (listing_is_published(listing_id, listing_type))',
      tbl || '_public_read', tbl
    );
    -- Owner can manage their own listing taxonomy
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL TO authenticated USING (listing_is_owned(listing_id, listing_type)) WITH CHECK (listing_is_owned(listing_id, listing_type))',
      tbl || '_owner_manage', tbl
    );
    -- Admin full access
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin())',
      tbl || '_admin_manage', tbl
    );
  END LOOP;
END;
$$;
