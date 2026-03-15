-- Add response_time column to practitioners table
-- Stores the provider's self-reported typical response time to enquiries.
-- Displayed as a badge on the public profile page.

ALTER TABLE practitioners
  ADD COLUMN IF NOT EXISTS response_time text
    CHECK (response_time IN ('within_hours', 'within_day', 'within_2_3_days', 'within_week') OR response_time IS NULL);

COMMENT ON COLUMN practitioners.response_time IS
  'Self-reported typical response time: within_hours | within_day | within_2_3_days | within_week';
