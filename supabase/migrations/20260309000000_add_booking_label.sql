-- Add booking_label column to practitioners table
-- Allows premium/featured providers to customise the button text on their profile
-- (e.g. "Book Appointment", "Schedule Discovery Call", etc.)

ALTER TABLE practitioners
  ADD COLUMN IF NOT EXISTS booking_label text;
