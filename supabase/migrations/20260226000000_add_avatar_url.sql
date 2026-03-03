-- Sprint 8: add avatar_url to practitioners and centers
ALTER TABLE practitioners ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE centers       ADD COLUMN IF NOT EXISTS avatar_url TEXT;
