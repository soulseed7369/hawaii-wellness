-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: 20260320000002_fix_public_profile_rpc_drop_show_columns
-- Purpose:   Remove references to show_phone / show_email columns that were
--            dropped in migration 20260320000001. Phone and email are now
--            protected by the click-to-reveal Edge Function, so the public
--            RPC always nulls them out unconditionally.
-- Apply via: Supabase Dashboard → SQL Editor → paste and run
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── get_practitioner_public ─────────────────────────────────────────────────
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
    -- Phone and email are protected by the click-to-reveal Edge Function.
    -- Always null them here so they are never exposed in the public RPC response.
    r.phone := NULL;
    r.email := NULL;
    RETURN NEXT r;
  END IF;
END;
$$;

-- ─── get_center_public ───────────────────────────────────────────────────────
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
    -- Same as above: always null phone and email for click-to-reveal protection.
    r.phone := NULL;
    r.email := NULL;
    RETURN NEXT r;
  END IF;
END;
$$;
