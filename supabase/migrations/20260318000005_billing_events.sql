CREATE TABLE IF NOT EXISTS billing_events (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type        text NOT NULL,
  old_tier          text,
  new_tier          text,
  old_status        text,
  new_status        text,
  stripe_event_id   text UNIQUE,
  stripe_object_id  text,
  metadata          jsonb,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS billing_events_user_id_idx ON billing_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS billing_events_stripe_event_id_idx ON billing_events(stripe_event_id);

-- Only service role can insert; nobody can read their own billing events from client
ALTER TABLE billing_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_only" ON billing_events;
CREATE POLICY "service_role_only" ON billing_events USING (false);
