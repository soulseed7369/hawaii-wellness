-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: 20260320000000_claim_centers_support
-- Purpose:   Extend claim system to fully support centers, add storage RLS,
--            add claim document metadata table, and create approve/deny RPCs
-- Apply via: Supabase Dashboard → SQL Editor → paste and run
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Add claim_documents metadata table ──────────────────────────────────
-- Tracks claims at both the DB level for proper RLS + versioning
CREATE TABLE IF NOT EXISTS public.claim_documents (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_request_id  uuid NOT NULL REFERENCES claim_requests(id) ON DELETE CASCADE,
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bucket_path       text NOT NULL,           -- e.g. "{claim_request_id}/{filename}"
  file_name         text NOT NULL,
  file_size         int NOT NULL,            -- in bytes
  file_type         text NOT NULL,           -- MIME type
  created_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.claim_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "claim_documents_select_own" ON public.claim_documents;
CREATE POLICY "claim_documents_select_own" ON public.claim_documents
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Indexed for claim_request lookup
CREATE INDEX IF NOT EXISTS idx_claim_documents_request
  ON public.claim_documents (claim_request_id);

-- ── 2. Extend claim_requests table with metadata ────────────────────────────
ALTER TABLE public.claim_requests
  ADD COLUMN IF NOT EXISTS listing_type text DEFAULT 'practitioner'
    CHECK (listing_type IN ('practitioner', 'center'));

ALTER TABLE public.claim_requests
  ADD COLUMN IF NOT EXISTS center_id uuid REFERENCES centers(id) ON DELETE CASCADE;

-- Update existing rows to have listing_type = 'practitioner' (backward compat)
UPDATE claim_requests SET listing_type = 'practitioner' WHERE listing_type IS NULL;

-- ── 3. claim_listing_center() RPC — Tier 1 for centers ─────────────────────
-- Email match + OTP verified → claim center immediately
CREATE OR REPLACE FUNCTION public.claim_listing_center(p_center_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE centers
  SET
    owner_id = auth.uid(),
    status   = CASE WHEN status = 'draft' THEN 'published' ELSE status END,
    email_verified_at = now()  -- Tier 1 claim proves email ownership
  WHERE
    id       = p_center_id
    AND owner_id IS NULL
    AND lower(email) = lower(auth.email());

  IF NOT FOUND THEN
    RAISE EXCEPTION 'claim_failed: no unclaimed center found matching your email';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_listing_center(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_listing_center(uuid) TO authenticated;

-- ── 4. approve_claim_center() RPC — Tier 4 admin approval for centers ──────
-- Admin approves a document-based claim for a center
CREATE OR REPLACE FUNCTION public.approve_claim_center(p_claim_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_center_id uuid;
  v_user_id   uuid;
BEGIN
  SELECT center_id, user_id
    INTO v_center_id, v_user_id
    FROM claim_requests
   WHERE id = p_claim_id
     AND status = 'pending'
     AND listing_type = 'center';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Center claim not found or already processed';
  END IF;

  UPDATE centers
     SET owner_id = v_user_id,
         status   = CASE WHEN status = 'draft' THEN 'published' ELSE status END
   WHERE id = v_center_id AND owner_id IS NULL;

  UPDATE claim_requests
     SET status = 'approved', reviewed_at = now()
   WHERE id = p_claim_id;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_claim_center(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_claim_center(uuid) TO service_role;

-- ── 5. deny_claim_center() RPC ────────────────────────────────────────────
-- Admin denies a center claim with optional notes
CREATE OR REPLACE FUNCTION public.deny_claim_center(p_claim_id uuid, p_notes text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE claim_requests
     SET status = 'denied', admin_notes = p_notes, reviewed_at = now()
   WHERE id = p_claim_id
     AND status = 'pending'
     AND listing_type = 'center';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Center claim not found or already processed';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.deny_claim_center(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.deny_claim_center(uuid, text) TO service_role;

-- ── 6. Update approve_claim() and deny_claim() to handle both types ────────
-- Existing RPCs now support polymorphic listing_type
CREATE OR REPLACE FUNCTION public.approve_claim(p_claim_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_practitioner_id uuid;
  v_center_id       uuid;
  v_user_id         uuid;
  v_listing_type    text;
BEGIN
  SELECT practitioner_id, center_id, user_id, listing_type
    INTO v_practitioner_id, v_center_id, v_user_id, v_listing_type
    FROM claim_requests
   WHERE id = p_claim_id AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Claim not found or already processed';
  END IF;

  -- Handle practitioner claim
  IF v_listing_type = 'practitioner' OR v_practitioner_id IS NOT NULL THEN
    UPDATE practitioners
       SET owner_id = v_user_id,
           status   = CASE WHEN status = 'draft' THEN 'published' ELSE status END
     WHERE id = v_practitioner_id AND owner_id IS NULL;
  -- Handle center claim
  ELSIF v_listing_type = 'center' OR v_center_id IS NOT NULL THEN
    UPDATE centers
       SET owner_id = v_user_id,
           status   = CASE WHEN status = 'draft' THEN 'published' ELSE status END
     WHERE id = v_center_id AND owner_id IS NULL;
  END IF;

  UPDATE claim_requests
     SET status = 'approved', reviewed_at = now()
   WHERE id = p_claim_id;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_claim(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_claim(uuid) TO service_role;

-- ── 7. Update deny_claim() to handle both types ────────────────────────────
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

-- ── 8. Validate claim requests integrity ───────────────────────────────────
-- Ensure either practitioner_id or center_id is set (not both, not neither)
-- Wrapped in DO block so it's safe to re-run (no IF NOT EXISTS for constraints in PG)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'claim_requests_listing_type_check'
       AND conrelid = 'public.claim_requests'::regclass
  ) THEN
    ALTER TABLE public.claim_requests
      ADD CONSTRAINT claim_requests_listing_type_check
      CHECK (
        (listing_type = 'practitioner' AND practitioner_id IS NOT NULL AND center_id IS NULL)
        OR
        (listing_type = 'center' AND center_id IS NOT NULL AND practitioner_id IS NULL)
      );
  END IF;
END;
$$;
