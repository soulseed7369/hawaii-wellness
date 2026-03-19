-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: 20260318000006_centers_contact_privacy
-- Purpose:   Add contact privacy columns to centers table
--            Allows premium/featured centers to hide phone/email from spam bots
-- Apply via: Supabase Dashboard → SQL Editor → paste and run
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE centers
  ADD COLUMN IF NOT EXISTS show_phone boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_email boolean NOT NULL DEFAULT true;
