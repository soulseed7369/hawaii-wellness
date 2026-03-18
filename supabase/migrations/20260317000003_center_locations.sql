-- ─── Center Locations: Multiple Locations per Center ─────────────────────────
-- Allows a center (e.g. a spa or wellness group) to operate across multiple
-- physical locations. The centers table retains its existing address/city/island
-- columns as the PRIMARY location for backward-compat with directory search.
-- Additional locations are stored here.
--
-- Apply in Supabase Dashboard → SQL Editor.

CREATE TABLE IF NOT EXISTS center_locations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id     uuid NOT NULL REFERENCES centers(id) ON DELETE CASCADE,

  -- Location identity
  name          text,                    -- e.g. "Kailua-Kona Branch", "Waikiki Studio"
  is_primary    boolean NOT NULL DEFAULT false,

  -- Address
  island        text NOT NULL,           -- 'big_island' | 'maui' | 'oahu' | 'kauai'
  city          text,
  address       text,
  lat           float8,
  lng           float8,

  -- Contact (can differ per location)
  phone         text,
  email         text,

  -- Hours (same JSONB shape as centers.working_hours)
  working_hours jsonb DEFAULT '{}'::jsonb,

  -- Ordering
  sort_order    integer NOT NULL DEFAULT 0,

  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Only one primary location per center
CREATE UNIQUE INDEX IF NOT EXISTS idx_center_locations_primary
  ON center_locations (center_id)
  WHERE is_primary = true;

CREATE INDEX IF NOT EXISTS idx_center_locations_center
  ON center_locations (center_id, sort_order);

-- updated_at trigger
CREATE TRIGGER center_locations_updated_at
  BEFORE UPDATE ON center_locations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE center_locations ENABLE ROW LEVEL SECURITY;

-- Public can read all locations (no status gate — locations are always visible)
CREATE POLICY "center_locations_public_read"
  ON center_locations FOR SELECT USING (true);

-- Owners can manage their own center's locations
CREATE POLICY "center_locations_owner_all"
  ON center_locations FOR ALL
  USING  (center_id IN (SELECT id FROM centers WHERE owner_id = auth.uid()))
  WITH CHECK (center_id IN (SELECT id FROM centers WHERE owner_id = auth.uid()));
