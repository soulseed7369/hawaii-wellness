-- ============================================================================
-- ADD RANKING TO listing_modalities FOR TIER-BASED SEARCH LIMITS
-- ============================================================================
-- Purpose: Track modality search priority per listing.
-- The rank column stores the 1-based position in the modalities[] array.
--
-- Tier limits (enforced by sync-modality-ranks edge function):
--   free:     top 2 modalities are searchable (rank 1-2)
--   premium:  top 5 modalities are searchable (rank 1-5)
--   featured: all modalities are searchable
--
-- NOTE: is_primary column already exists (added in 20260310000001).
-- This migration adds only the rank column and its index.
--
-- How it works:
--   1. Dashboard save triggers hook → invokes sync-modality-ranks edge function
--   2. Edge function deletes ALL listing_modalities rows for that listing
--   3. Edge function inserts new rows with rank=1,2,3... based on array order
--   4. Edge function applies tier limit: only inserts first N rows
--   5. Search RPC queries listing_modalities, filtered by rank (enforces tier limit)
--
-- Migration safety:
--   - Adds column with DEFAULT 999 (no existing data disrupted)
--   - IF NOT EXISTS guards against re-runs
--   - Index added for search performance
-- ============================================================================

ALTER TABLE listing_modalities
ADD COLUMN IF NOT EXISTS rank int NOT NULL DEFAULT 999;

-- Index on (listing_id, listing_type, rank) for efficient tier-limited searches
CREATE INDEX IF NOT EXISTS idx_listing_modalities_rank ON listing_modalities(listing_id, listing_type, rank);
