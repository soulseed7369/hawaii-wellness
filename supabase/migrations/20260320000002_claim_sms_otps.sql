-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: 20260320000002_claim_sms_otps
-- Purpose:   Temporary OTP storage for SMS-based listing claims.
--            Rows are short-lived (10 min TTL) and cleaned up on use.
-- Apply via: Supabase Dashboard → SQL Editor → paste and run
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.claim_sms_otps (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id   uuid        NOT NULL,
  listing_type text        NOT NULL CHECK (listing_type IN ('practitioner', 'center')),
  code_hash    text        NOT NULL,
  attempts     int         NOT NULL DEFAULT 0,
  expires_at   timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- No RLS — only accessible via service role key in the edge function
-- Index for fast lookup and expiry-based cleanup
CREATE INDEX IF NOT EXISTS idx_claim_sms_otps_listing
  ON public.claim_sms_otps (listing_id, listing_type, expires_at);

-- Optional: pg_cron cleanup job (if pg_cron extension is enabled)
-- SELECT cron.schedule('clean-claim-sms-otps', '*/15 * * * *',
--   'DELETE FROM public.claim_sms_otps WHERE expires_at < now()');

-- ── Helper: increment wrong-attempt counter ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.increment_claim_otp_attempts(
  p_listing_id   uuid,
  p_listing_type text
) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE claim_sms_otps
     SET attempts = attempts + 1
   WHERE id = (
     SELECT id FROM claim_sms_otps
      WHERE listing_id   = p_listing_id
        AND listing_type = p_listing_type
        AND expires_at   > now()
      ORDER BY created_at DESC
      LIMIT 1
   );
$$;

-- ── claim_listing_sms — claim a practitioner via SMS OTP ─────────────────────
-- Called by the edge function as service role; p_user_id is the claiming user.
CREATE OR REPLACE FUNCTION public.claim_listing_sms(
  p_listing_id uuid,
  p_user_id    uuid
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE practitioners
     SET owner_id          = p_user_id,
         phone_verified_at = now(),
         status            = CASE WHEN status = 'draft' THEN 'published' ELSE status END
   WHERE id       = p_listing_id
     AND owner_id IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'claim_failed: listing not found or already claimed';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_listing_sms(uuid, uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.claim_listing_sms(uuid, uuid) TO service_role;

-- ── claim_listing_center_sms — claim a center via SMS OTP ───────────────────
CREATE OR REPLACE FUNCTION public.claim_listing_center_sms(
  p_listing_id uuid,
  p_user_id    uuid
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE centers
     SET owner_id          = p_user_id,
         phone_verified_at = now(),
         status            = CASE WHEN status = 'draft' THEN 'published' ELSE status END
   WHERE id       = p_listing_id
     AND owner_id IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'claim_failed: listing not found or already claimed';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_listing_center_sms(uuid, uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.claim_listing_center_sms(uuid, uuid) TO service_role;
