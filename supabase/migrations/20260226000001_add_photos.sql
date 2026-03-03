-- Migration: 20260226000001_add_photos
-- Adds avatar_url (if not already present) and photos array to centers.
-- practitioners.avatar_url was added in 20260226000000_add_avatar_url.sql

ALTER TABLE practitioners
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

ALTER TABLE centers
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS photos    TEXT[] NOT NULL DEFAULT '{}';
