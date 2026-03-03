-- Add modalities array to centers table
ALTER TABLE centers
  ADD COLUMN IF NOT EXISTS modalities text[] DEFAULT '{}';
