-- Add video_url column to practitioners and centers tables
-- Used for YouTube/Vimeo embed on featured listings

ALTER TABLE practitioners
  ADD COLUMN IF NOT EXISTS video_url text;

ALTER TABLE centers
  ADD COLUMN IF NOT EXISTS video_url text;

COMMENT ON COLUMN practitioners.video_url IS 'YouTube or Vimeo URL for featured listing video embed';
COMMENT ON COLUMN centers.video_url IS 'YouTube or Vimeo URL for featured listing video embed';
