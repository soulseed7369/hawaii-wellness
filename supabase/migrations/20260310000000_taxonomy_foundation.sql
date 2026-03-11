-- ============================================================================
-- TAXONOMY FOUNDATION — Multi-axis wellness ontology
-- ============================================================================
-- Part of the search rebuild. Creates the core taxonomy tables that replace
-- the hardcoded synonym map in Directory.tsx.

-- ── taxonomy_axes ───────────────────────────────────────────────────────────
-- Each axis represents a search dimension: modality, concern, approach, etc.
CREATE TABLE taxonomy_axes (
  id          serial PRIMARY KEY,
  slug        text UNIQUE NOT NULL,
  label       text NOT NULL,
  description text,
  sort_order  int NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true
);

-- ── taxonomy_terms ──────────────────────────────────────────────────────────
-- Canonical terms within each axis. Optional parent_id for hierarchy.
CREATE TABLE taxonomy_terms (
  id          serial PRIMARY KEY,
  axis_id     int NOT NULL REFERENCES taxonomy_axes(id),
  slug        text NOT NULL,
  label       text NOT NULL,
  description text,
  parent_id   int REFERENCES taxonomy_terms(id),
  sort_order  int NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (axis_id, slug)
);

CREATE INDEX idx_taxonomy_terms_axis   ON taxonomy_terms(axis_id);
CREATE INDEX idx_taxonomy_terms_parent ON taxonomy_terms(parent_id);

-- ── taxonomy_aliases ────────────────────────────────────────────────────────
-- User-facing search phrases that resolve to a canonical term.
-- Replaces the 354-entry JS synonym map.
CREATE TABLE taxonomy_aliases (
  id       serial PRIMARY KEY,
  term_id  int NOT NULL REFERENCES taxonomy_terms(id) ON DELETE CASCADE,
  alias    text NOT NULL,
  locale   text NOT NULL DEFAULT 'en',
  UNIQUE (alias, locale)
);

CREATE INDEX idx_taxonomy_aliases_alias ON taxonomy_aliases(alias);

-- ── taxonomy_relationships ──────────────────────────────────────────────────
-- Cross-axis associations (e.g. acupuncture → treats → chronic pain).
-- Strength 0.0–1.0 weights search boost.
CREATE TABLE taxonomy_relationships (
  id              serial PRIMARY KEY,
  source_term_id  int NOT NULL REFERENCES taxonomy_terms(id) ON DELETE CASCADE,
  target_term_id  int NOT NULL REFERENCES taxonomy_terms(id) ON DELETE CASCADE,
  relationship    text NOT NULL DEFAULT 'related'
                  CHECK (relationship IN ('related', 'treats', 'uses', 'requires')),
  strength        real NOT NULL DEFAULT 0.5
                  CHECK (strength >= 0.0 AND strength <= 1.0),
  UNIQUE (source_term_id, target_term_id, relationship)
);

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Taxonomy is public-read. Writes happen via service role (pipeline, admin
-- edge functions) which bypasses RLS, or via admin users.
ALTER TABLE taxonomy_axes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxonomy_terms         ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxonomy_aliases       ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxonomy_relationships ENABLE ROW LEVEL SECURITY;

-- Public read
CREATE POLICY "taxonomy_axes_public_read"
  ON taxonomy_axes FOR SELECT USING (true);
CREATE POLICY "taxonomy_terms_public_read"
  ON taxonomy_terms FOR SELECT USING (true);
CREATE POLICY "taxonomy_aliases_public_read"
  ON taxonomy_aliases FOR SELECT USING (true);
CREATE POLICY "taxonomy_relationships_public_read"
  ON taxonomy_relationships FOR SELECT USING (true);

-- Admin write (uses existing is_admin() function from admin_read_policies migration)
CREATE POLICY "taxonomy_axes_admin_write"
  ON taxonomy_axes FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "taxonomy_terms_admin_write"
  ON taxonomy_terms FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "taxonomy_aliases_admin_write"
  ON taxonomy_aliases FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "taxonomy_relationships_admin_write"
  ON taxonomy_relationships FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
