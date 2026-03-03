-- Add premium and feature fields to practitioners
ALTER TABLE practitioners
  ADD COLUMN IF NOT EXISTS session_type text DEFAULT 'in_person',
  ADD COLUMN IF NOT EXISTS is_featured boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS social_links jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS testimonials jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS working_hours jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS retreat_links text[] DEFAULT '{}';

-- Add premium and feature fields to centers
ALTER TABLE centers
  ADD COLUMN IF NOT EXISTS session_type text DEFAULT 'in_person',
  ADD COLUMN IF NOT EXISTS is_featured boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS social_links jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS testimonials jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS working_hours jsonb DEFAULT '{}';
