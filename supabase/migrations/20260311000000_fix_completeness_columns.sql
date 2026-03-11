-- Fix profile completeness functions to use correct column names:
--   photo_url  → avatar_url  (both tables)
--   centers.external_booking_url → centers.external_website_url

CREATE OR REPLACE FUNCTION compute_practitioner_completeness(p practitioners)
RETURNS int AS $$
DECLARE
  score int := 0;
  mod_count int;
  concern_count int;
BEGIN
  -- Identity (20 points)
  IF p.name IS NOT NULL AND length(p.name) > 0 THEN score := score + 10; END IF;
  IF p.avatar_url IS NOT NULL AND length(p.avatar_url) > 0 THEN score := score + 10; END IF;

  -- Bio (15 points)
  IF p.bio IS NOT NULL AND length(p.bio) > 30 THEN score := score + 15;
  ELSIF p.bio IS NOT NULL AND length(p.bio) > 0 THEN score := score + 5;
  END IF;

  -- Location (15 points)
  IF p.island IS NOT NULL THEN score := score + 5; END IF;
  IF p.city IS NOT NULL AND length(p.city) > 0 THEN score := score + 5; END IF;
  IF p.address IS NOT NULL AND length(p.address) > 0 THEN score := score + 5; END IF;

  -- Contact (15 points)
  IF p.phone IS NOT NULL AND length(p.phone) > 0 THEN score := score + 5; END IF;
  IF p.email IS NOT NULL AND length(p.email) > 0 THEN score := score + 5; END IF;
  IF p.website_url IS NOT NULL AND length(p.website_url) > 0 THEN score := score + 5; END IF;

  -- Taxonomy richness (25 points)
  SELECT count(*) INTO mod_count
  FROM listing_modalities
  WHERE listing_id = p.id AND listing_type = 'practitioner';

  SELECT count(*) INTO concern_count
  FROM listing_concerns
  WHERE listing_id = p.id AND listing_type = 'practitioner';

  IF mod_count >= 3 THEN score := score + 10;
  ELSIF mod_count >= 1 THEN score := score + 5;
  END IF;

  IF concern_count >= 2 THEN score := score + 10;
  ELSIF concern_count >= 1 THEN score := score + 5;
  END IF;

  IF p.session_type IS NOT NULL THEN score := score + 5; END IF;

  -- Social / booking (10 points)
  IF p.external_booking_url IS NOT NULL AND length(p.external_booking_url) > 0 THEN
    score := score + 5;
  END IF;
  IF p.social_links IS NOT NULL AND p.social_links != '{}'::jsonb AND p.social_links != 'null'::jsonb THEN
    score := score + 5;
  END IF;

  RETURN LEAST(score, 100);
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION compute_center_completeness(c centers)
RETURNS int AS $$
DECLARE
  score int := 0;
  mod_count int;
  concern_count int;
BEGIN
  -- Identity (20 points)
  IF c.name IS NOT NULL AND length(c.name) > 0 THEN score := score + 10; END IF;
  IF c.avatar_url IS NOT NULL AND length(c.avatar_url) > 0 THEN score := score + 5; END IF;
  IF c.photos IS NOT NULL AND array_length(c.photos, 1) > 0 THEN score := score + 5; END IF;

  -- Description (15 points)
  IF c.description IS NOT NULL AND length(c.description) > 30 THEN score := score + 15;
  ELSIF c.description IS NOT NULL AND length(c.description) > 0 THEN score := score + 5;
  END IF;

  -- Location (15 points)
  IF c.island IS NOT NULL THEN score := score + 5; END IF;
  IF c.city IS NOT NULL AND length(c.city) > 0 THEN score := score + 5; END IF;
  IF c.address IS NOT NULL AND length(c.address) > 0 THEN score := score + 5; END IF;

  -- Contact (15 points)
  IF c.phone IS NOT NULL AND length(c.phone) > 0 THEN score := score + 5; END IF;
  IF c.email IS NOT NULL AND length(c.email) > 0 THEN score := score + 5; END IF;
  IF c.website_url IS NOT NULL AND length(c.website_url) > 0 THEN score := score + 5; END IF;

  -- Taxonomy richness (20 points)
  SELECT count(*) INTO mod_count
  FROM listing_modalities
  WHERE listing_id = c.id AND listing_type = 'center';

  SELECT count(*) INTO concern_count
  FROM listing_concerns
  WHERE listing_id = c.id AND listing_type = 'center';

  IF mod_count >= 3 THEN score := score + 10;
  ELSIF mod_count >= 1 THEN score := score + 5;
  END IF;

  IF concern_count >= 2 THEN score := score + 5;
  ELSIF concern_count >= 1 THEN score := score + 3;
  END IF;

  IF c.center_type IS NOT NULL THEN score := score + 5; END IF;

  -- Extras (15 points)
  IF c.working_hours IS NOT NULL AND c.working_hours != '{}'::jsonb AND c.working_hours != 'null'::jsonb THEN
    score := score + 5;
  END IF;
  IF c.social_links IS NOT NULL AND c.social_links != '{}'::jsonb AND c.social_links != 'null'::jsonb THEN
    score := score + 5;
  END IF;
  IF c.external_website_url IS NOT NULL AND length(c.external_website_url) > 0 THEN
    score := score + 5;
  END IF;

  RETURN LEAST(score, 100);
END;
$$ LANGUAGE plpgsql STABLE;
