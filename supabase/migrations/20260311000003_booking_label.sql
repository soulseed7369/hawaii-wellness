-- Add booking_label column to practitioners table.
-- Stores the custom CTA button text for premium/featured practitioners.
-- Default NULL means the UI falls back to 'Book Appointment'.

alter table practitioners
  add column if not exists booking_label text default null;

comment on column practitioners.booking_label is
  'Custom booking button label shown on the practitioner profile page (premium/featured only). NULL → "Book Appointment".';
