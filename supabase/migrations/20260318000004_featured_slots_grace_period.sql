-- Add grace_until to featured_slots so slots aren't immediately deleted on cancellation
-- Instead they enter a 90-day grace period before being fully released
ALTER TABLE featured_slots ADD COLUMN IF NOT EXISTS grace_until timestamptz DEFAULT NULL;

-- Index for efficient cleanup queries
CREATE INDEX IF NOT EXISTS featured_slots_grace_until_idx ON featured_slots(grace_until) WHERE grace_until IS NOT NULL;
