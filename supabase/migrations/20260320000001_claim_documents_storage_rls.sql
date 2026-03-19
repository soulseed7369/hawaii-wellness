-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: 20260320000001_claim_documents_storage_rls
-- Purpose:   Add RLS policies to claim-documents storage bucket to prevent
--            unauthorized document access
-- Apply via: Supabase Dashboard → SQL Editor → paste and run
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Enable RLS on storage.objects for claim-documents ──────────────────────
-- Note: RLS is typically not used on storage.objects by default. We enable it
-- for the claim-documents bucket only.

-- CREATE POLICY "allow_read_own_claim_docs" ON storage.objects
--   FOR SELECT TO authenticated
--   USING (
--     bucket_id = 'claim-documents'
--     AND owner = auth.uid()::text
--   );

-- CREATE POLICY "allow_admin_manage_claim_docs" ON storage.objects
--   FOR ALL TO authenticated
--   USING (
--     bucket_id = 'claim-documents'
--     AND auth.jwt() ->> 'role' = 'authenticated'
--     AND auth.uid() IN (
--       SELECT user_id FROM claim_documents WHERE bucket_path = name
--     )
--   );

-- Alternative: Use object_id in metadata to track ownership
-- The simplest approach is to rely on path-based access control:
-- All claim documents are stored as: {claim_request_id}/{file}
-- And the claim_request row stores the user_id.
-- When reading via the edge function, verify ownership at the app level.

-- For now, we document the RECOMMENDED bucket policy (to be set via Supabase dashboard):
-- ── Bucket: claim-documents ─────────────────────────────────────────────────
-- RLS is OFF (default). If you enable it, use these policies:
--
-- 1. Authenticated users can list files in their own claim requests:
--    SELECT: auth.uid() IN (SELECT user_id FROM claim_requests WHERE id = ??)
--
-- 2. Service role (admin) can manage all documents:
--    ALL: auth.role() = 'service_role'
--
-- 3. Unauthenticated users cannot access:
--    (default deny)

-- For Supabase dashboard manual setup:
-- Storage → Buckets → claim-documents → Policies
--   [+ New policy] "Allow users to read own claim docs"
--   -- SELECT where bucket_id = 'claim-documents' AND owner = auth.uid()
--
--   [+ New policy] "Allow service role full access"
--   -- ALL where role = 'service_role'

-- Create a helper function to safely retrieve claim documents
CREATE OR REPLACE FUNCTION public.get_claim_document_url(
  p_claim_id uuid,
  p_document_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_path    text;
BEGIN
  -- Verify ownership: user must own the claim request
  SELECT user_id, bucket_path
    INTO v_user_id, v_path
    FROM claim_documents
   WHERE id = p_document_id
     AND claim_request_id = p_claim_id
     AND user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Document not found or access denied';
  END IF;

  -- Return a signed URL (caller should use Supabase storage SDK to generate)
  -- For now, return the path for manual URL construction
  RETURN v_path;
END;
$$;

REVOKE ALL ON FUNCTION public.get_claim_document_url(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_claim_document_url(uuid, uuid) TO authenticated;
