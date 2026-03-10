-- Add what_to_expect column to practitioners table
-- Displayed on the profile page below Services & Modalities

ALTER TABLE practitioners
  ADD COLUMN IF NOT EXISTS what_to_expect text;
