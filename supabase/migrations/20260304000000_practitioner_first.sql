-- =============================================================
-- Migration: 20260304000000_practitioner_first
-- Project:   Aloha Health Hub
-- Sprint:    2 — Practitioner-First Data Model
-- Generated: 2026-03-04
-- Apply via: Supabase Dashboard → SQL Editor
-- =============================================================
-- All changes are additive (ADD COLUMN IF NOT EXISTS).
-- Existing rows will have NULL in every new column.
-- Run pipeline/scripts/14_sprint1_name_migration.py afterwards
-- to backfill first_name, last_name, display_name, and slug.
-- =============================================================

-- -------------------------------------------------------------
-- practitioners — new identity + professional columns
-- -------------------------------------------------------------
ALTER TABLE practitioners
  -- Split-name fields (backfilled by 14_sprint1_name_migration.py)
  ADD COLUMN IF NOT EXISTS first_name          text,
  ADD COLUMN IF NOT EXISTS last_name           text,
  -- display_name is the preferred public name (e.g. "Dr. Tracy Kelleher, LMT")
  ADD COLUMN IF NOT EXISTS display_name        text,
  -- URL-safe unique slug, e.g. "tracy-kelleher"
  ADD COLUMN IF NOT EXISTS slug                text,
  -- Professional background
  ADD COLUMN IF NOT EXISTS years_experience    integer CHECK (years_experience >= 0),
  ADD COLUMN IF NOT EXISTS lineage_or_training text,
  -- Optional FK linking practitioner to a center they work at
  ADD COLUMN IF NOT EXISTS business_id         uuid REFERENCES centers(id) ON DELETE SET NULL;

-- Unique index on slug (partial — only enforces uniqueness when slug IS NOT NULL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_practitioners_slug
  ON practitioners(slug)
  WHERE slug IS NOT NULL;

-- Index for center-based lookups ("show all practitioners at this center")
CREATE INDEX IF NOT EXISTS idx_practitioners_business_id
  ON practitioners(business_id)
  WHERE business_id IS NOT NULL;

-- -------------------------------------------------------------
-- centers — slug + logo
-- -------------------------------------------------------------
ALTER TABLE centers
  ADD COLUMN IF NOT EXISTS slug  text,
  ADD COLUMN IF NOT EXISTS logo  text;   -- URL to center logo image

CREATE UNIQUE INDEX IF NOT EXISTS idx_centers_slug
  ON centers(slug)
  WHERE slug IS NOT NULL;
