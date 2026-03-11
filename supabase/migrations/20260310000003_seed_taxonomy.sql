-- ============================================================================
-- SEED TAXONOMY — All axes, terms, and initial data
-- ============================================================================

-- ── 1. Axes ─────────────────────────────────────────────────────────────────
INSERT INTO taxonomy_axes (slug, label, description, sort_order) VALUES
  ('modality',      'Modality',            'What method or discipline they practice',          1),
  ('concern',       'Concern / Need',      'What the user is hoping to get help with',         2),
  ('approach',      'Approach / Style',    'How the care feels and the practitioner''s style', 3),
  ('provider_type', 'Provider Type',       'Who or what is offering the service',              4),
  ('format',        'Service Format',      'How the service is delivered',                     5),
  ('audience',      'Audience',            'Who the service is designed for',                  6),
  ('geography',     'Geography',           'Where the service is available',                   7);

-- ── 2. Modality: parent categories ──────────────────────────────────────────
INSERT INTO taxonomy_terms (axis_id, slug, label, sort_order)
SELECT a.id, v.slug, v.label, v.so
FROM taxonomy_axes a,
(VALUES
  ('bodywork',              'Bodywork',                  1),
  ('energy-and-healing',    'Energy & Healing',          2),
  ('mind-body',             'Mind-Body',                 3),
  ('hawaiian-and-indigenous','Hawaiian & Indigenous',     4),
  ('clinical-and-medical',  'Clinical & Medical',        5),
  ('mental-health',         'Mental Health & Counseling', 6),
  ('nutrition-and-herbalism','Nutrition & Herbalism',     7),
  ('birth-and-womens',      'Birth & Women''s Health',   8),
  ('divination-and-intuitive','Divination & Intuitive',  9)
) AS v(slug, label, so)
WHERE a.slug = 'modality';

-- ── 3. Modality: child terms under each parent ──────────────────────────────

-- Bodywork children
INSERT INTO taxonomy_terms (axis_id, slug, label, parent_id, sort_order)
SELECT a.id, v.slug, v.label, p.id, v.so
FROM taxonomy_axes a
JOIN taxonomy_terms p ON p.slug = 'bodywork' AND p.axis_id = a.id,
(VALUES
  ('massage',               'Massage',                    1),
  ('craniosacral',          'Craniosacral',               2),
  ('lomilomi-hawaiian-healing','Lomilomi / Hawaiian Healing',3),
  ('watsu-water-therapy',   'Watsu / Water Therapy',      4),
  ('myofascial-release',    'Myofascial Release',         5)
) AS v(slug, label, so)
WHERE a.slug = 'modality';

-- Energy & Healing children
INSERT INTO taxonomy_terms (axis_id, slug, label, parent_id, sort_order)
SELECT a.id, v.slug, v.label, p.id, v.so
FROM taxonomy_axes a
JOIN taxonomy_terms p ON p.slug = 'energy-and-healing' AND p.axis_id = a.id,
(VALUES
  ('reiki',          'Reiki',          1),
  ('sound-healing',  'Sound Healing',  2),
  ('energy-healing', 'Energy Healing', 3)
) AS v(slug, label, so)
WHERE a.slug = 'modality';

-- Mind-Body children
INSERT INTO taxonomy_terms (axis_id, slug, label, parent_id, sort_order)
SELECT a.id, v.slug, v.label, p.id, v.so
FROM taxonomy_axes a
JOIN taxonomy_terms p ON p.slug = 'mind-body' AND p.axis_id = a.id,
(VALUES
  ('yoga',            'Yoga',            1),
  ('breathwork',      'Breathwork',      2),
  ('meditation',      'Meditation',      3),
  ('somatic-therapy', 'Somatic Therapy', 4),
  ('hypnotherapy',    'Hypnotherapy',    5)
) AS v(slug, label, so)
WHERE a.slug = 'modality';

-- Hawaiian & Indigenous children
INSERT INTO taxonomy_terms (axis_id, slug, label, parent_id, sort_order)
SELECT a.id, v.slug, v.label, p.id, v.so
FROM taxonomy_axes a
JOIN taxonomy_terms p ON p.slug = 'hawaiian-and-indigenous' AND p.axis_id = a.id,
(VALUES
  ('hawaiian-healing', 'Hawaiian Healing', 1),
  ('ritualist',        'Ritualist',        2)
) AS v(slug, label, so)
WHERE a.slug = 'modality';

-- Clinical & Medical children
INSERT INTO taxonomy_terms (axis_id, slug, label, parent_id, sort_order)
SELECT a.id, v.slug, v.label, p.id, v.so
FROM taxonomy_axes a
JOIN taxonomy_terms p ON p.slug = 'clinical-and-medical' AND p.axis_id = a.id,
(VALUES
  ('acupuncture',         'Acupuncture',                      1),
  ('tcm',                 'TCM (Traditional Chinese Medicine)', 2),
  ('naturopathic',        'Naturopathic',                     3),
  ('functional-medicine', 'Functional Medicine',              4),
  ('chiropractic',        'Chiropractic',                     5),
  ('network-chiropractic','Network Chiropractic',             6),
  ('osteopathic',         'Osteopathic',                      7),
  ('physical-therapy',    'Physical Therapy',                 8),
  ('dentistry',           'Dentistry',                        9),
  ('iv-therapy',          'IV Therapy',                      10),
  ('longevity',           'Longevity',                       11)
) AS v(slug, label, so)
WHERE a.slug = 'modality';

-- Mental Health & Counseling children
INSERT INTO taxonomy_terms (axis_id, slug, label, parent_id, sort_order)
SELECT a.id, v.slug, v.label, p.id, v.so
FROM taxonomy_axes a
JOIN taxonomy_terms p ON p.slug = 'mental-health' AND p.axis_id = a.id,
(VALUES
  ('psychotherapy',             'Psychotherapy',             1),
  ('counseling',                'Counseling',                2),
  ('life-coaching',             'Life Coaching',             3),
  ('soul-guidance',             'Soul Guidance',             4),
  ('trauma-informed-care',      'Trauma-Informed Care',      5),
  ('nervous-system-regulation', 'Nervous System Regulation', 6),
  ('family-constellation',      'Family Constellation',      7)
) AS v(slug, label, so)
WHERE a.slug = 'modality';

-- Nutrition & Herbalism children
INSERT INTO taxonomy_terms (axis_id, slug, label, parent_id, sort_order)
SELECT a.id, v.slug, v.label, p.id, v.so
FROM taxonomy_axes a
JOIN taxonomy_terms p ON p.slug = 'nutrition-and-herbalism' AND p.axis_id = a.id,
(VALUES
  ('nutrition',  'Nutrition',  1),
  ('herbalism',  'Herbalism',  2),
  ('ayurveda',   'Ayurveda',   3)
) AS v(slug, label, so)
WHERE a.slug = 'modality';

-- Birth & Women's Health children
INSERT INTO taxonomy_terms (axis_id, slug, label, parent_id, sort_order)
SELECT a.id, v.slug, v.label, p.id, v.so
FROM taxonomy_axes a
JOIN taxonomy_terms p ON p.slug = 'birth-and-womens' AND p.axis_id = a.id,
(VALUES
  ('birth-doula', 'Birth Doula', 1),
  ('midwife',     'Midwife',     2)
) AS v(slug, label, so)
WHERE a.slug = 'modality';

-- Divination & Intuitive children
INSERT INTO taxonomy_terms (axis_id, slug, label, parent_id, sort_order)
SELECT a.id, v.slug, v.label, p.id, v.so
FROM taxonomy_axes a
JOIN taxonomy_terms p ON p.slug = 'divination-and-intuitive' AND p.axis_id = a.id,
(VALUES
  ('astrology', 'Astrology', 1),
  ('psychic',   'Psychic',   2)
) AS v(slug, label, so)
WHERE a.slug = 'modality';

-- Standalone modalities (no parent)
INSERT INTO taxonomy_terms (axis_id, slug, label, sort_order)
SELECT a.id, v.slug, v.label, v.so
FROM taxonomy_axes a,
(VALUES
  ('nature-therapy',      'Nature Therapy',      100),
  ('art-therapy',         'Art Therapy',         101),
  ('alternative-therapy', 'Alternative Therapy', 102)
) AS v(slug, label, so)
WHERE a.slug = 'modality';

-- ── 4. Concern terms ────────────────────────────────────────────────────────
INSERT INTO taxonomy_terms (axis_id, slug, label, sort_order)
SELECT a.id, v.slug, v.label, v.so
FROM taxonomy_axes a,
(VALUES
  ('anxiety',                'Anxiety',                  1),
  ('burnout',                'Burnout',                  2),
  ('chronic-pain',           'Chronic Pain',             3),
  ('depression',             'Depression',               4),
  ('digestive-health',       'Digestive Health',         5),
  ('fatigue',                'Fatigue',                  6),
  ('fertility',              'Fertility',                7),
  ('grief',                  'Grief',                    8),
  ('gut-health',             'Gut Health',               9),
  ('headaches-migraines',    'Headaches & Migraines',   10),
  ('hormonal-balance',       'Hormonal Balance',        11),
  ('immune-support',         'Immune Support',          12),
  ('insomnia',               'Insomnia & Sleep',        13),
  ('joint-pain',             'Joint & Muscle Pain',     14),
  ('life-transitions',       'Life Transitions',        15),
  ('menopause',              'Menopause',               16),
  ('nervous-system-support', 'Nervous System Support',  17),
  ('overwhelm',              'Overwhelm & Stress',      18),
  ('postpartum-recovery',    'Postpartum Recovery',     19),
  ('prenatal-care',          'Prenatal Care',           20),
  ('relationship-healing',   'Relationship Healing',    21),
  ('self-discovery',         'Self-Discovery & Growth', 22),
  ('sexual-health',          'Sexual Health',           23),
  ('skin-conditions',        'Skin Conditions',         24),
  ('spiritual-growth',       'Spiritual Growth',        25),
  ('sports-recovery',        'Sports & Athletic Recovery', 26),
  ('stress',                 'Stress',                  27),
  ('trauma',                 'Trauma & PTSD',           28),
  ('weight-management',      'Weight Management',       29),
  ('womens-health',          'Women''s Health',         30)
) AS v(slug, label, so)
WHERE a.slug = 'concern';

-- ── 5. Approach terms ───────────────────────────────────────────────────────
INSERT INTO taxonomy_terms (axis_id, slug, label, sort_order)
SELECT a.id, v.slug, v.label, v.so
FROM taxonomy_axes a,
(VALUES
  ('body-based',            'Body-Based',            1),
  ('ceremonial',            'Ceremonial',            2),
  ('clinical',              'Clinical',              3),
  ('compassionate',         'Compassionate',         4),
  ('evidence-informed',     'Evidence-Informed',     5),
  ('family-centered',       'Family-Centered',       6),
  ('gentle',                'Gentle',                7),
  ('holistic',              'Holistic',              8),
  ('indigenous',            'Indigenous',            9),
  ('integrative',           'Integrative',          10),
  ('intuitive',             'Intuitive',            11),
  ('luxury',                'Luxury',               12),
  ('performance-oriented',  'Performance-Oriented', 13),
  ('practical',             'Practical',            14),
  ('somatic',               'Somatic',              15),
  ('spiritual',             'Spiritual',            16),
  ('traditional',           'Traditional',          17),
  ('trauma-informed',       'Trauma-Informed',      18)
) AS v(slug, label, so)
WHERE a.slug = 'approach';

-- ── 6. Provider Type terms ──────────────────────────────────────────────────
INSERT INTO taxonomy_terms (axis_id, slug, label, sort_order)
SELECT a.id, v.slug, v.label, v.so
FROM taxonomy_axes a,
(VALUES
  ('individual-practitioner', 'Individual Practitioner', 1),
  ('wellness-center',         'Wellness Center',         2),
  ('retreat-center',          'Retreat Center',          3),
  ('clinic',                  'Clinic',                  4),
  ('spa',                     'Spa',                     5),
  ('yoga-studio',             'Yoga Studio',             6),
  ('coach',                   'Coach',                   7),
  ('therapist',               'Therapist',               8),
  ('physician',               'Physician',               9),
  ('bodyworker',              'Bodyworker',             10),
  ('birth-worker',            'Birth Worker',           11),
  ('spiritual-guide',         'Spiritual Guide',        12)
) AS v(slug, label, so)
WHERE a.slug = 'provider_type';

-- ── 7. Format terms ─────────────────────────────────────────────────────────
INSERT INTO taxonomy_terms (axis_id, slug, label, sort_order)
SELECT a.id, v.slug, v.label, v.so
FROM taxonomy_axes a,
(VALUES
  ('in-person',        'In-Person',                     1),
  ('virtual',          'Virtual',                       2),
  ('hybrid',           'Hybrid (In-Person & Virtual)',  3),
  ('private-session',  'Private Sessions',              4),
  ('group-session',    'Group Sessions',                5),
  ('classes',          'Classes',                       6),
  ('workshops',        'Workshops',                     7),
  ('retreats',         'Retreats',                      8),
  ('memberships',      'Memberships',                   9),
  ('home-visits',      'Home Visits',                  10)
) AS v(slug, label, so)
WHERE a.slug = 'format';

-- ── 8. Audience terms ───────────────────────────────────────────────────────
INSERT INTO taxonomy_terms (axis_id, slug, label, sort_order)
SELECT a.id, v.slug, v.label, v.so
FROM taxonomy_axes a,
(VALUES
  ('adults',     'Adults',              1),
  ('couples',    'Couples',             2),
  ('families',   'Families',            3),
  ('children',   'Children',            4),
  ('teens',      'Teens',              5),
  ('elders',     'Elders / Kupuna',     6),
  ('women',      'Women',              7),
  ('men',        'Men',                8),
  ('prenatal',   'Prenatal',            9),
  ('postpartum', 'Postpartum',         10),
  ('athletes',   'Athletes',           11),
  ('visitors',   'Visitors / Tourists', 12),
  ('locals',     'Local Residents',    13),
  ('lgbtq',      'LGBTQ+',            14)
) AS v(slug, label, so)
WHERE a.slug = 'audience';
