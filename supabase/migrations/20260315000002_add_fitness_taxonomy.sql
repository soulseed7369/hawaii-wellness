-- Add 'Fitness' as a modality term in the taxonomy, under a new
-- 'Movement & Fitness' parent category, with aliases for search.
-- This is what makes the new search system (search_listings RPC)
-- recognise practitioners tagged with the Fitness modality.

-- ── 1. Add parent category 'Movement & Fitness' ──────────────────────────────
INSERT INTO taxonomy_terms (axis_id, slug, label, sort_order)
SELECT a.id, 'movement-and-fitness', 'Movement & Fitness', 10
FROM taxonomy_axes a
WHERE a.slug = 'modality'
ON CONFLICT (axis_id, slug) DO NOTHING;

-- ── 2. Add 'Fitness' as child term ───────────────────────────────────────────
INSERT INTO taxonomy_terms (axis_id, slug, label, parent_id, sort_order)
SELECT a.id, 'fitness', 'Fitness', p.id, 1
FROM taxonomy_axes a
JOIN taxonomy_terms p ON p.slug = 'movement-and-fitness' AND p.axis_id = a.id
WHERE a.slug = 'modality'
ON CONFLICT (axis_id, slug) DO NOTHING;

-- ── 3. Aliases for 'Fitness' ─────────────────────────────────────────────────
INSERT INTO taxonomy_aliases (term_id, alias)
SELECT t.id, v.alias
FROM taxonomy_terms t,
(VALUES
  ('personal trainer'),
  ('personal training'),
  ('fitness trainer'),
  ('fitness coach'),
  ('fitness instructor'),
  ('gym'),
  ('crossfit'),
  ('strength training'),
  ('strength coach'),
  ('weight training'),
  ('weightlifting'),
  ('functional fitness'),
  ('hiit'),
  ('bootcamp'),
  ('boot camp'),
  ('group fitness'),
  ('cardio'),
  ('pilates'),
  ('movement coach'),
  ('movement therapy'),
  ('athletic training'),
  ('sports conditioning')
) AS v(alias)
WHERE t.slug = 'fitness'
  AND t.axis_id = (SELECT id FROM taxonomy_axes WHERE slug = 'modality')
ON CONFLICT DO NOTHING;
