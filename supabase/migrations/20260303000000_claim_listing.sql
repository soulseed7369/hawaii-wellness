-- ─────────────────────────────────────────────────────────────────────────────
-- Listing Claim System
-- Apply via: Supabase Dashboard → SQL Editor → paste and run
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. claim_requests table ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.claim_requests (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id  uuid NOT NULL REFERENCES practitioners(id) ON DELETE CASCADE,
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email       text NOT NULL,
  document_url     text,
  document_name    text,
  status           text NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'approved', 'denied')),
  admin_notes      text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  reviewed_at      timestamptz
);

-- ── 2. RLS on claim_requests ──────────────────────────────────────────────────
ALTER TABLE public.claim_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "claim_requests_insert" ON public.claim_requests
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "claim_requests_select_own" ON public.claim_requests
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ── 3. claim_listing() RPC — Tier 1 (email match + OTP verified) ─────────────
CREATE OR REPLACE FUNCTION public.claim_listing(p_practitioner_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE practitioners
  SET
    owner_id = auth.uid(),
    status   = CASE WHEN status = 'draft' THEN 'published' ELSE status END
  WHERE
    id       = p_practitioner_id
    AND owner_id IS NULL
    AND lower(email) = lower(auth.email());

  IF NOT FOUND THEN
    RAISE EXCEPTION 'claim_failed: no unclaimed listing found matching your email';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_listing(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_listing(uuid) TO authenticated;

-- ── 4. approve_claim() RPC — Tier 4 admin approval ───────────────────────────
CREATE OR REPLACE FUNCTION public.approve_claim(p_claim_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_practitioner_id uuid;
  v_user_id         uuid;
BEGIN
  SELECT practitioner_id, user_id
    INTO v_practitioner_id, v_user_id
    FROM claim_requests
   WHERE id = p_claim_id AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Claim not found or already processed';
  END IF;

  UPDATE practitioners
     SET owner_id = v_user_id,
         status   = CASE WHEN status = 'draft' THEN 'published' ELSE status END
   WHERE id = v_practitioner_id AND owner_id IS NULL;

  -- Mark approved — caller deletes document from storage after this succeeds
  UPDATE claim_requests
     SET status = 'approved', reviewed_at = now()
   WHERE id = p_claim_id;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_claim(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_claim(uuid) TO service_role;

-- ── 5. deny_claim() RPC ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.deny_claim(p_claim_id uuid, p_notes text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE claim_requests
     SET status = 'denied', admin_notes = p_notes, reviewed_at = now()
   WHERE id = p_claim_id AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Claim not found or already processed';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.deny_claim(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.deny_claim(uuid, text) TO service_role;
