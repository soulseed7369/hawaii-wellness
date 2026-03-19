-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: 20260318000007_practitioner_public_profile_rpc
-- Purpose:   Security-definer RPC functions to expose public profiles with
--            contact info nulled out when hidden (show_phone/show_email = false)
-- Apply via: Supabase Dashboard → SQL Editor → paste and run
--
-- Uses plpgsql row variables (SELECT * INTO r) so no column enumeration is
-- needed — the function is resilient to future ADD COLUMN migrations.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── get_practitioner_public: public profile with hidden contact info ────────
CREATE OR REPLACE FUNCTION public.get_practitioner_public(p_id uuid)
RETURNS SETOF practitioners
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  r practitioners%ROWTYPE;
BEGIN
  SELECT * INTO r
  FROM practitioners
  WHERE id = p_id
    AND status = 'published';

  IF FOUND THEN
    IF NOT r.show_phone THEN r.phone := NULL; END IF;
    IF NOT r.show_email THEN r.email := NULL; END IF;
    RETURN NEXT r;
  END IF;
END;
$$;

-- ─── get_center_public: public profile with hidden contact info ──────────────
CREATE OR REPLACE FUNCTION public.get_center_public(p_id uuid)
RETURNS SETOF centers
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  r centers%ROWTYPE;
BEGIN
  SELECT * INTO r
  FROM centers
  WHERE id = p_id
    AND status = 'published';

  IF FOUND THEN
    IF NOT r.show_phone THEN r.phone := NULL; END IF;
    IF NOT r.show_email THEN r.email := NULL; END IF;
    RETURN NEXT r;
  END IF;
END;
$$;
