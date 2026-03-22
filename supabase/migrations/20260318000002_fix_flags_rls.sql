-- Fix overly permissive RLS on listing_flags
-- Previously allowed ANY authenticated user to read/update all flags

-- Ensure prerequisite types and table exist (may have been applied manually before)
DO $$ BEGIN CREATE TYPE flag_reason AS ENUM ('closed','inaccurate','duplicate'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE flag_status AS ENUM ('pending','reviewed','dismissed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS listing_flags (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_type  text NOT NULL CHECK (listing_type IN ('practitioner', 'center')),
  listing_id    uuid NOT NULL,
  listing_name  text,
  reason        flag_reason NOT NULL,
  details       text,
  reporter_email text,
  reporter_id   uuid,
  status        flag_status NOT NULL DEFAULT 'pending',
  admin_notes   text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE listing_flags ADD COLUMN IF NOT EXISTS reporter_id uuid;
CREATE INDEX IF NOT EXISTS listing_flags_status_idx ON listing_flags (status, created_at DESC);
CREATE INDEX IF NOT EXISTS listing_flags_listing_idx ON listing_flags (listing_type, listing_id);
ALTER TABLE listing_flags ENABLE ROW LEVEL SECURITY;

-- Ensure base insert policy exists
DROP POLICY IF EXISTS "Anyone can submit a flag" ON listing_flags;
CREATE POLICY "Anyone can submit a flag" ON listing_flags FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can delete flags" ON listing_flags;
CREATE POLICY "Admins can delete flags" ON listing_flags FOR DELETE TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "Admins can view all flags" ON listing_flags;
DROP POLICY IF EXISTS "Admins can update flags" ON listing_flags;

-- Only admins (via is_admin() function) can read all flags
CREATE POLICY "Admins can view all flags" ON listing_flags
  FOR SELECT TO authenticated
  USING (is_admin());

-- Only admins can update flags
CREATE POLICY "Admins can update flags" ON listing_flags
  FOR UPDATE TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Users can still see their own submitted flags
DROP POLICY IF EXISTS "Users can view own flags" ON listing_flags;
CREATE POLICY "Users can view own flags" ON listing_flags
  FOR SELECT TO authenticated
  USING (auth.uid() = reporter_id);
