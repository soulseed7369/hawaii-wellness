-- Campaign Command Center tables
-- Tracks outreach to every listing across Phase 1 (free signups) and Phase 2 (premium/website upsell)

CREATE TABLE IF NOT EXISTS campaign_outreach (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id      uuid NOT NULL,
  listing_type    text NOT NULL CHECK (listing_type IN ('practitioner', 'center')),

  -- Denormalized from listing for fast dashboard reads
  name            text,
  email           text,
  phone           text,
  island          text,
  city            text,
  modalities      text[],
  website_url     text,
  tier            text,
  has_owner       boolean DEFAULT false,

  -- Campaign segmentation
  segment         text NOT NULL CHECK (segment IN (
    'unclaimed',
    'claimed_has_website',
    'claimed_no_website',
    'bundle_prospect',
    'upgraded',
    'excluded'
  )),
  phase           text CHECK (phase IN ('phase1', 'phase2')),

  -- Pipeline status
  status          text NOT NULL DEFAULT 'not_contacted' CHECK (status IN (
    'not_contacted',
    'email_queued',
    'email_1_sent',
    'email_1_opened',
    'email_2_sent',
    'replied',
    'call_scheduled',
    'called',
    'sms_sent',
    'claimed',
    'upgraded',
    'bundle_sold',
    'not_interested',
    'bad_contact',
    'no_response'
  )),

  -- Outreach history
  email_1_sent_at     timestamptz,
  email_1_opened_at   timestamptz,
  email_1_clicked_at  timestamptz,
  email_1_template    text,
  email_2_sent_at     timestamptz,
  email_2_template    text,
  call_at             timestamptz,
  call_notes          text,
  sms_at              timestamptz,
  reply_at            timestamptz,
  reply_summary       text,

  -- Conversion tracking
  claimed_at          timestamptz,
  upgraded_at         timestamptz,
  upgraded_to         text,
  revenue_monthly     numeric(10,2),
  revenue_onetime     numeric(10,2),

  -- Meta
  notes               text,
  priority            integer DEFAULT 0,
  batch_id            text,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now(),

  UNIQUE(listing_id, listing_type)
);

CREATE INDEX IF NOT EXISTS idx_campaign_outreach_segment ON campaign_outreach(segment);
CREATE INDEX IF NOT EXISTS idx_campaign_outreach_status ON campaign_outreach(status);
CREATE INDEX IF NOT EXISTS idx_campaign_outreach_island ON campaign_outreach(island);
CREATE INDEX IF NOT EXISTS idx_campaign_outreach_listing ON campaign_outreach(listing_id);
CREATE INDEX IF NOT EXISTS idx_campaign_outreach_phase ON campaign_outreach(phase);
CREATE INDEX IF NOT EXISTS idx_campaign_outreach_batch ON campaign_outreach(batch_id);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_campaign_outreach_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS campaign_outreach_updated_at ON campaign_outreach;
CREATE TRIGGER campaign_outreach_updated_at
  BEFORE UPDATE ON campaign_outreach
  FOR EACH ROW EXECUTE FUNCTION update_campaign_outreach_timestamp();


-- Email log — every email sent through Resend
CREATE TABLE IF NOT EXISTS campaign_emails (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outreach_id     uuid REFERENCES campaign_outreach(id) ON DELETE CASCADE,
  resend_id       text,
  to_email        text NOT NULL,
  to_name         text,
  subject         text NOT NULL,
  template        text NOT NULL,
  body_preview    text,
  status          text DEFAULT 'sent' CHECK (status IN (
    'sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained'
  )),
  sent_at         timestamptz DEFAULT now(),
  delivered_at    timestamptz,
  opened_at       timestamptz,
  clicked_at      timestamptz,
  bounced_at      timestamptz,
  bounce_reason   text
);

CREATE INDEX IF NOT EXISTS idx_campaign_emails_outreach ON campaign_emails(outreach_id);
CREATE INDEX IF NOT EXISTS idx_campaign_emails_resend ON campaign_emails(resend_id);
CREATE INDEX IF NOT EXISTS idx_campaign_emails_template ON campaign_emails(template);
CREATE INDEX IF NOT EXISTS idx_campaign_emails_status ON campaign_emails(status);
