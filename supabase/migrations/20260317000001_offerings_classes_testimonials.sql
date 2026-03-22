-- ─── Offerings, Classes & Testimonials for Practitioner Profiles ─────────────
-- Sprint: Offerings & Events feature
-- Replaces the standalone /retreats section for practitioner profiles.
-- Centers will get a separate migration.

-- ─── 1. New columns on practitioners ─────────────────────────────────────────

ALTER TABLE practitioners
  ADD COLUMN IF NOT EXISTS show_phone            boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_email            boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS booking_enabled       boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS messaging_enabled     boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS discovery_call_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS discovery_call_url    text;

-- ─── 2. offerings table ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS offerings (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id   uuid NOT NULL REFERENCES practitioners(id) ON DELETE CASCADE,
  title             text NOT NULL,
  description       text,
  offering_type     text NOT NULL DEFAULT 'workshop'
                    CHECK (offering_type IN ('retreat','workshop','immersion','mentorship','ceremony','event')),
  price_mode        text NOT NULL DEFAULT 'fixed'
                    CHECK (price_mode IN ('fixed','range','sliding','contact','free')),
  price_fixed       numeric(10,2),
  price_min         numeric(10,2),
  price_max         numeric(10,2),
  image_url         text,
  start_date        date,
  end_date          date,
  location          text,
  registration_url  text,
  max_spots         integer,
  spots_booked      integer NOT NULL DEFAULT 0,
  sort_order        integer NOT NULL DEFAULT 0,
  status            text NOT NULL DEFAULT 'published'
                    CHECK (status IN ('draft','published')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_offerings_practitioner ON offerings (practitioner_id, status, start_date);

-- ─── 3. classes table ─────────────────────────────────────────────────────────
-- Recurring sessions (yoga, sound bath, breathwork circle, etc.)
-- Each row = one class type; future: expand to class_sessions for individual dates.

CREATE TABLE IF NOT EXISTS classes (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id   uuid NOT NULL REFERENCES practitioners(id) ON DELETE CASCADE,
  title             text NOT NULL,
  description       text,
  price_mode        text NOT NULL DEFAULT 'fixed'
                    CHECK (price_mode IN ('fixed','range','sliding','contact','free')),
  price_fixed       numeric(10,2),
  price_min         numeric(10,2),
  price_max         numeric(10,2),
  duration_minutes  integer,
  day_of_week       text CHECK (day_of_week IN ('mon','tue','wed','thu','fri','sat','sun')),
  start_time        time,            -- wall-clock time (no timezone; stored as provider's local time)
  location          text,
  registration_url  text,
  max_spots         integer,
  spots_booked      integer NOT NULL DEFAULT 0,
  sort_order        integer NOT NULL DEFAULT 0,
  status            text NOT NULL DEFAULT 'published'
                    CHECK (status IN ('draft','published')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_classes_practitioner ON classes (practitioner_id, status);

-- ─── 4. practitioner_testimonials table ──────────────────────────────────────
-- Separate from the JSONB testimonials[] column on practitioners.
-- These are provider-curated quotes; verified reviews come later.

CREATE TABLE IF NOT EXISTS practitioner_testimonials (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id   uuid NOT NULL REFERENCES practitioners(id) ON DELETE CASCADE,
  author            text NOT NULL,
  text              text NOT NULL,
  author_location   text,
  testimonial_date  date,
  -- Optional link to an offering or class for context
  linked_type       text CHECK (linked_type IN ('offering','class')),
  linked_id         uuid,
  sort_order        integer NOT NULL DEFAULT 0,
  status            text NOT NULL DEFAULT 'published'
                    CHECK (status IN ('draft','published')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prac_testimonials ON practitioner_testimonials (practitioner_id, status);

-- ─── 5. updated_at triggers ──────────────────────────────────────────────────

-- Reuse existing trigger function if it exists (most projects have one)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at'
  ) THEN
    CREATE OR REPLACE FUNCTION set_updated_at()
    RETURNS trigger LANGUAGE plpgsql AS '
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    ';
  END IF;
END $$;

DROP TRIGGER IF EXISTS offerings_updated_at ON offerings;
CREATE TRIGGER offerings_updated_at
  BEFORE UPDATE ON offerings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS classes_updated_at ON classes;
CREATE TRIGGER classes_updated_at
  BEFORE UPDATE ON classes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS practitioner_testimonials_updated_at ON practitioner_testimonials;
CREATE TRIGGER practitioner_testimonials_updated_at
  BEFORE UPDATE ON practitioner_testimonials
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── 6. Row Level Security ────────────────────────────────────────────────────

ALTER TABLE offerings ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE practitioner_testimonials ENABLE ROW LEVEL SECURITY;

-- Public can read published records
DROP POLICY IF EXISTS "offerings_public_read" ON offerings;
CREATE POLICY "offerings_public_read"
  ON offerings FOR SELECT
  USING (status = 'published');

DROP POLICY IF EXISTS "classes_public_read" ON classes;
CREATE POLICY "classes_public_read"
  ON classes FOR SELECT
  USING (status = 'published');

DROP POLICY IF EXISTS "prac_testimonials_public_read" ON practitioner_testimonials;
CREATE POLICY "prac_testimonials_public_read"
  ON practitioner_testimonials FOR SELECT
  USING (status = 'published');

-- Owners can do full CRUD on their own records (matched via practitioners.owner_id)
DROP POLICY IF EXISTS "offerings_owner_all" ON offerings;
CREATE POLICY "offerings_owner_all"
  ON offerings FOR ALL
  USING (
    practitioner_id IN (
      SELECT id FROM practitioners WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    practitioner_id IN (
      SELECT id FROM practitioners WHERE owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "classes_owner_all" ON classes;
CREATE POLICY "classes_owner_all"
  ON classes FOR ALL
  USING (
    practitioner_id IN (
      SELECT id FROM practitioners WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    practitioner_id IN (
      SELECT id FROM practitioners WHERE owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "prac_testimonials_owner_all" ON practitioner_testimonials;
CREATE POLICY "prac_testimonials_owner_all"
  ON practitioner_testimonials FOR ALL
  USING (
    practitioner_id IN (
      SELECT id FROM practitioners WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    practitioner_id IN (
      SELECT id FROM practitioners WHERE owner_id = auth.uid()
    )
  );
