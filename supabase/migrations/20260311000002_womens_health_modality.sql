-- Migration: Add Women's Health modality tag to Midwife / Birth Doula listings
-- Run date: 2026-03-11
--
-- Adds "Women's Health" to the modalities array of any practitioner or center
-- that already has 'Midwife' or 'Birth Doula', without duplicating it.

UPDATE practitioners
SET modalities = array_append(modalities, 'Women''s Health')
WHERE (
  modalities @> ARRAY['Midwife']
  OR modalities @> ARRAY['Birth Doula']
)
AND NOT modalities @> ARRAY['Women''s Health'];

UPDATE centers
SET modalities = array_append(modalities, 'Women''s Health')
WHERE (
  modalities @> ARRAY['Midwife']
  OR modalities @> ARRAY['Birth Doula']
)
AND NOT modalities @> ARRAY['Women''s Health'];
