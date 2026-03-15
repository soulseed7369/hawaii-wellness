-- Add 'fitness_center' to the center_type CHECK constraint on the centers table.
-- Follows the same pattern as 20260308000000_add_yoga_studio_center_type.sql

ALTER TABLE centers
  DROP CONSTRAINT IF EXISTS centers_center_type_check;

ALTER TABLE centers
  ADD CONSTRAINT centers_center_type_check
    CHECK (center_type IN ('spa', 'wellness_center', 'clinic', 'retreat_center', 'yoga_studio', 'fitness_center'));
