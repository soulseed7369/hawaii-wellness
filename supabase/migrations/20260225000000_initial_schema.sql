-- =============================================================
-- Migration: 20260225000000_initial_schema
-- Project:   Hawaii Wellness
-- Sprint:    1 — Database Schema + RLS
-- Generated: 2026-02-25
-- Reviewed:  Sonnet (Overseer) — verified columns, constraints,
--            trigger, indexes, and RLS policies.
-- Apply via: Supabase Dashboard → SQL Editor, or `supabase db push`
-- =============================================================

-- NOTE: gen_random_uuid() is built-in on Supabase (PG 15+).
-- No extension needed.

-- -------------------------------------------------------------
-- TABLE: practitioners
-- -------------------------------------------------------------
CREATE TABLE practitioners (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id             uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name                 text NOT NULL,
  modalities           text[] NOT NULL DEFAULT '{}',
  bio                  text,
  island               text NOT NULL DEFAULT 'big_island',
  region               text,
  city                 text,
  address              text,
  lat                  numeric(9,6),
  lng                  numeric(9,6),
  phone                text,
  email                text,
  website_url          text,
  external_booking_url text,
  accepts_new_clients  boolean DEFAULT true,
  status               text NOT NULL DEFAULT 'draft'
                         CHECK (status IN ('draft','published','archived')),
  tier                 text NOT NULL DEFAULT 'free'
                         CHECK (tier IN ('free','premium','featured')),
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now()
);

-- -------------------------------------------------------------
-- TABLE: centers
-- -------------------------------------------------------------
CREATE TABLE centers (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id             uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name                 text NOT NULL,
  center_type          text NOT NULL DEFAULT 'wellness_center'
                         CHECK (center_type IN ('spa','wellness_center','clinic','retreat_center')),
  description          text,
  island               text NOT NULL DEFAULT 'big_island',
  region               text,
  city                 text,
  address              text,
  lat                  numeric(9,6),
  lng                  numeric(9,6),
  phone                text,
  email                text,
  website_url          text,
  external_website_url text,
  status               text NOT NULL DEFAULT 'draft'
                         CHECK (status IN ('draft','published','archived')),
  tier                 text NOT NULL DEFAULT 'free'
                         CHECK (tier IN ('free','premium','featured')),
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now()
);

-- -------------------------------------------------------------
-- TABLE: retreats
-- -------------------------------------------------------------
CREATE TABLE retreats (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title            text NOT NULL,
  venue_name       text,
  island           text NOT NULL DEFAULT 'big_island',
  region           text,
  city             text,
  address          text,
  lat              numeric(9,6),
  lng              numeric(9,6),
  start_date       date NOT NULL,
  end_date         date NOT NULL,
  starting_price   numeric(10,2),          -- display only; no on-site checkout in v1
  description      text,
  cover_image_url  text,
  registration_url text,                   -- external booking link
  status           text NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft','published','archived')),
  tier             text NOT NULL DEFAULT 'free'
                     CHECK (tier IN ('free','premium','featured')),
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

-- -------------------------------------------------------------
-- TABLE: articles
-- -------------------------------------------------------------
CREATE TABLE articles (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            text UNIQUE NOT NULL,    -- UNIQUE creates an implicit index
  title           text NOT NULL,
  excerpt         text,
  body            text,
  cover_image_url text,
  island          text,
  tags            text[] DEFAULT '{}',
  featured        boolean DEFAULT false,
  published_at    timestamptz,
  status          text NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','published','archived')),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- -------------------------------------------------------------
-- TRIGGER FUNCTION: auto-update updated_at on any row change
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_practitioners_updated_at
  BEFORE UPDATE ON practitioners
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_centers_updated_at
  BEFORE UPDATE ON centers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_retreats_updated_at
  BEFORE UPDATE ON retreats
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_articles_updated_at
  BEFORE UPDATE ON articles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -------------------------------------------------------------
-- INDEXES
-- Composite (island, status) supports the most common query:
--   WHERE island = 'big_island' AND status = 'published'
-- owner_id indexes support dashboard queries (all my listings).
-- retreats.start_date supports date-range filtering.
-- articles: slug covered by UNIQUE; status+featured for homepage query.
-- -------------------------------------------------------------
CREATE INDEX idx_practitioners_island_status ON practitioners(island, status);
CREATE INDEX idx_practitioners_owner_id      ON practitioners(owner_id);

CREATE INDEX idx_centers_island_status       ON centers(island, status);
CREATE INDEX idx_centers_owner_id            ON centers(owner_id);

CREATE INDEX idx_retreats_island_status      ON retreats(island, status);
CREATE INDEX idx_retreats_start_date         ON retreats(start_date);
CREATE INDEX idx_retreats_owner_id           ON retreats(owner_id);

-- articles.slug already indexed by UNIQUE constraint; skip duplicate.
CREATE INDEX idx_articles_status_featured    ON articles(status, featured);

-- -------------------------------------------------------------
-- ROW LEVEL SECURITY
-- service_role key bypasses RLS automatically — used by ingestion
-- scripts to insert unclaimed (owner_id = NULL, status = 'draft') rows.
-- Authenticated users can only INSERT/UPDATE/DELETE their own rows.
-- Unclaimed rows (owner_id IS NULL) are invisible to authenticated
-- users via RLS (NULL != auth.uid()), so only service role can touch them.
-- -------------------------------------------------------------
ALTER TABLE practitioners ENABLE ROW LEVEL SECURITY;
ALTER TABLE centers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE retreats      ENABLE ROW LEVEL SECURITY;
ALTER TABLE articles      ENABLE ROW LEVEL SECURITY;

-- practitioners --
CREATE POLICY "public_read_published" ON practitioners
  FOR SELECT TO public
  USING (status = 'published');

CREATE POLICY "owner_insert" ON practitioners
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "owner_update" ON practitioners
  FOR UPDATE TO authenticated
  USING  (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "owner_delete" ON practitioners
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- centers --
CREATE POLICY "public_read_published" ON centers
  FOR SELECT TO public
  USING (status = 'published');

CREATE POLICY "owner_insert" ON centers
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "owner_update" ON centers
  FOR UPDATE TO authenticated
  USING  (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "owner_delete" ON centers
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- retreats --
CREATE POLICY "public_read_published" ON retreats
  FOR SELECT TO public
  USING (status = 'published');

CREATE POLICY "owner_insert" ON retreats
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "owner_update" ON retreats
  FOR UPDATE TO authenticated
  USING  (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "owner_delete" ON retreats
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- articles: public read only; all writes are service-role-only --
CREATE POLICY "public_read_published" ON articles
  FOR SELECT TO public
  USING (status = 'published');
