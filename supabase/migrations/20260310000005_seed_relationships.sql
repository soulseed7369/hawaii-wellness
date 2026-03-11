-- ============================================================================
-- SEED TAXONOMY RELATIONSHIPS — Cross-axis modality ↔ concern / approach maps
-- ============================================================================
-- Populates the taxonomy_relationships table with clinically-informed
-- associations between modalities and the concerns they commonly address,
-- plus modality ↔ approach affinities.
--
-- Relationship types:
--   'treats'  — modality is commonly used for this concern
--   'related' — modality has affinity with this approach style
--
-- Strength scale:
--   0.9–1.0  Primary indication / strong match
--   0.7–0.8  Common secondary indication
--   0.5–0.6  Supportive / adjunctive
--   0.3–0.4  Sometimes helpful

-- Helper: resolve a (axis_slug, term_slug) pair to term_id
CREATE OR REPLACE FUNCTION _resolve_term(p_axis text, p_term text) RETURNS int AS $$
  SELECT t.id FROM taxonomy_terms t
  JOIN taxonomy_axes a ON a.id = t.axis_id
  WHERE a.slug = p_axis AND t.slug = p_term;
$$ LANGUAGE sql STABLE;

-- ── Modality → Concern ("treats") relationships ───────────────────────────

INSERT INTO taxonomy_relationships (source_term_id, target_term_id, relationship, strength) VALUES

-- Acupuncture
(_resolve_term('modality','acupuncture'), _resolve_term('concern','chronic-pain'),       'treats', 0.9),
(_resolve_term('modality','acupuncture'), _resolve_term('concern','headaches-migraines'), 'treats', 0.9),
(_resolve_term('modality','acupuncture'), _resolve_term('concern','anxiety'),             'treats', 0.7),
(_resolve_term('modality','acupuncture'), _resolve_term('concern','stress'),              'treats', 0.7),
(_resolve_term('modality','acupuncture'), _resolve_term('concern','digestive-health'),    'treats', 0.7),
(_resolve_term('modality','acupuncture'), _resolve_term('concern','insomnia'),            'treats', 0.7),
(_resolve_term('modality','acupuncture'), _resolve_term('concern','fertility'),           'treats', 0.6),
(_resolve_term('modality','acupuncture'), _resolve_term('concern','hormonal-balance'),    'treats', 0.6),
(_resolve_term('modality','acupuncture'), _resolve_term('concern','immune-support'),      'treats', 0.5),
(_resolve_term('modality','acupuncture'), _resolve_term('concern','joint-pain'),          'treats', 0.8),

-- TCM
(_resolve_term('modality','tcm'), _resolve_term('concern','digestive-health'),    'treats', 0.9),
(_resolve_term('modality','tcm'), _resolve_term('concern','hormonal-balance'),    'treats', 0.8),
(_resolve_term('modality','tcm'), _resolve_term('concern','immune-support'),      'treats', 0.8),
(_resolve_term('modality','tcm'), _resolve_term('concern','chronic-pain'),        'treats', 0.7),
(_resolve_term('modality','tcm'), _resolve_term('concern','fatigue'),             'treats', 0.7),
(_resolve_term('modality','tcm'), _resolve_term('concern','skin-conditions'),     'treats', 0.6),
(_resolve_term('modality','tcm'), _resolve_term('concern','fertility'),           'treats', 0.7),

-- Massage
(_resolve_term('modality','massage'), _resolve_term('concern','chronic-pain'),       'treats', 0.9),
(_resolve_term('modality','massage'), _resolve_term('concern','joint-pain'),         'treats', 0.9),
(_resolve_term('modality','massage'), _resolve_term('concern','stress'),             'treats', 0.8),
(_resolve_term('modality','massage'), _resolve_term('concern','sports-recovery'),    'treats', 0.8),
(_resolve_term('modality','massage'), _resolve_term('concern','headaches-migraines'),'treats', 0.6),
(_resolve_term('modality','massage'), _resolve_term('concern','insomnia'),           'treats', 0.5),
(_resolve_term('modality','massage'), _resolve_term('concern','anxiety'),            'treats', 0.5),

-- Craniosacral
(_resolve_term('modality','craniosacral'), _resolve_term('concern','headaches-migraines'),    'treats', 0.9),
(_resolve_term('modality','craniosacral'), _resolve_term('concern','chronic-pain'),            'treats', 0.7),
(_resolve_term('modality','craniosacral'), _resolve_term('concern','nervous-system-support'),  'treats', 0.8),
(_resolve_term('modality','craniosacral'), _resolve_term('concern','trauma'),                  'treats', 0.6),
(_resolve_term('modality','craniosacral'), _resolve_term('concern','anxiety'),                 'treats', 0.6),

-- Lomilomi / Hawaiian Healing
(_resolve_term('modality','lomilomi-hawaiian-healing'), _resolve_term('concern','stress'),             'treats', 0.9),
(_resolve_term('modality','lomilomi-hawaiian-healing'), _resolve_term('concern','chronic-pain'),       'treats', 0.7),
(_resolve_term('modality','lomilomi-hawaiian-healing'), _resolve_term('concern','spiritual-growth'),   'treats', 0.7),
(_resolve_term('modality','lomilomi-hawaiian-healing'), _resolve_term('concern','grief'),              'treats', 0.6),
(_resolve_term('modality','lomilomi-hawaiian-healing'), _resolve_term('concern','trauma'),             'treats', 0.5),

-- Watsu / Water Therapy
(_resolve_term('modality','watsu-water-therapy'), _resolve_term('concern','chronic-pain'),       'treats', 0.8),
(_resolve_term('modality','watsu-water-therapy'), _resolve_term('concern','joint-pain'),         'treats', 0.8),
(_resolve_term('modality','watsu-water-therapy'), _resolve_term('concern','stress'),             'treats', 0.8),
(_resolve_term('modality','watsu-water-therapy'), _resolve_term('concern','trauma'),             'treats', 0.6),
(_resolve_term('modality','watsu-water-therapy'), _resolve_term('concern','prenatal-care'),      'treats', 0.6),

-- Reiki
(_resolve_term('modality','reiki'), _resolve_term('concern','anxiety'),            'treats', 0.7),
(_resolve_term('modality','reiki'), _resolve_term('concern','stress'),             'treats', 0.8),
(_resolve_term('modality','reiki'), _resolve_term('concern','grief'),              'treats', 0.7),
(_resolve_term('modality','reiki'), _resolve_term('concern','spiritual-growth'),   'treats', 0.7),
(_resolve_term('modality','reiki'), _resolve_term('concern','trauma'),             'treats', 0.5),
(_resolve_term('modality','reiki'), _resolve_term('concern','insomnia'),           'treats', 0.5),

-- Sound Healing
(_resolve_term('modality','sound-healing'), _resolve_term('concern','stress'),             'treats', 0.8),
(_resolve_term('modality','sound-healing'), _resolve_term('concern','anxiety'),            'treats', 0.7),
(_resolve_term('modality','sound-healing'), _resolve_term('concern','insomnia'),           'treats', 0.6),
(_resolve_term('modality','sound-healing'), _resolve_term('concern','spiritual-growth'),   'treats', 0.6),

-- Energy Healing
(_resolve_term('modality','energy-healing'), _resolve_term('concern','fatigue'),             'treats', 0.7),
(_resolve_term('modality','energy-healing'), _resolve_term('concern','stress'),              'treats', 0.7),
(_resolve_term('modality','energy-healing'), _resolve_term('concern','spiritual-growth'),    'treats', 0.7),
(_resolve_term('modality','energy-healing'), _resolve_term('concern','grief'),               'treats', 0.5),

-- Yoga
(_resolve_term('modality','yoga'), _resolve_term('concern','stress'),              'treats', 0.9),
(_resolve_term('modality','yoga'), _resolve_term('concern','anxiety'),             'treats', 0.8),
(_resolve_term('modality','yoga'), _resolve_term('concern','chronic-pain'),        'treats', 0.6),
(_resolve_term('modality','yoga'), _resolve_term('concern','joint-pain'),          'treats', 0.6),
(_resolve_term('modality','yoga'), _resolve_term('concern','insomnia'),            'treats', 0.6),
(_resolve_term('modality','yoga'), _resolve_term('concern','prenatal-care'),       'treats', 0.6),
(_resolve_term('modality','yoga'), _resolve_term('concern','self-discovery'),      'treats', 0.5),
(_resolve_term('modality','yoga'), _resolve_term('concern','sports-recovery'),     'treats', 0.5),

-- Breathwork
(_resolve_term('modality','breathwork'), _resolve_term('concern','anxiety'),             'treats', 0.9),
(_resolve_term('modality','breathwork'), _resolve_term('concern','stress'),              'treats', 0.9),
(_resolve_term('modality','breathwork'), _resolve_term('concern','trauma'),              'treats', 0.7),
(_resolve_term('modality','breathwork'), _resolve_term('concern','nervous-system-support'),'treats', 0.8),
(_resolve_term('modality','breathwork'), _resolve_term('concern','overwhelm'),           'treats', 0.7),
(_resolve_term('modality','breathwork'), _resolve_term('concern','grief'),               'treats', 0.5),

-- Meditation
(_resolve_term('modality','meditation'), _resolve_term('concern','stress'),              'treats', 0.9),
(_resolve_term('modality','meditation'), _resolve_term('concern','anxiety'),             'treats', 0.8),
(_resolve_term('modality','meditation'), _resolve_term('concern','insomnia'),            'treats', 0.7),
(_resolve_term('modality','meditation'), _resolve_term('concern','overwhelm'),           'treats', 0.7),
(_resolve_term('modality','meditation'), _resolve_term('concern','self-discovery'),      'treats', 0.7),
(_resolve_term('modality','meditation'), _resolve_term('concern','spiritual-growth'),    'treats', 0.6),

-- Somatic Therapy
(_resolve_term('modality','somatic-therapy'), _resolve_term('concern','trauma'),              'treats', 0.9),
(_resolve_term('modality','somatic-therapy'), _resolve_term('concern','anxiety'),             'treats', 0.8),
(_resolve_term('modality','somatic-therapy'), _resolve_term('concern','nervous-system-support'),'treats', 0.9),
(_resolve_term('modality','somatic-therapy'), _resolve_term('concern','chronic-pain'),        'treats', 0.6),
(_resolve_term('modality','somatic-therapy'), _resolve_term('concern','overwhelm'),           'treats', 0.7),

-- Hypnotherapy
(_resolve_term('modality','hypnotherapy'), _resolve_term('concern','anxiety'),             'treats', 0.8),
(_resolve_term('modality','hypnotherapy'), _resolve_term('concern','insomnia'),            'treats', 0.7),
(_resolve_term('modality','hypnotherapy'), _resolve_term('concern','trauma'),              'treats', 0.6),
(_resolve_term('modality','hypnotherapy'), _resolve_term('concern','weight-management'),   'treats', 0.5),
(_resolve_term('modality','hypnotherapy'), _resolve_term('concern','stress'),              'treats', 0.6),

-- Psychotherapy
(_resolve_term('modality','psychotherapy'), _resolve_term('concern','anxiety'),             'treats', 0.9),
(_resolve_term('modality','psychotherapy'), _resolve_term('concern','depression'),          'treats', 0.9),
(_resolve_term('modality','psychotherapy'), _resolve_term('concern','trauma'),              'treats', 0.9),
(_resolve_term('modality','psychotherapy'), _resolve_term('concern','grief'),               'treats', 0.8),
(_resolve_term('modality','psychotherapy'), _resolve_term('concern','relationship-healing'),'treats', 0.8),
(_resolve_term('modality','psychotherapy'), _resolve_term('concern','life-transitions'),    'treats', 0.7),
(_resolve_term('modality','psychotherapy'), _resolve_term('concern','burnout'),             'treats', 0.6),

-- Counseling
(_resolve_term('modality','counseling'), _resolve_term('concern','anxiety'),             'treats', 0.8),
(_resolve_term('modality','counseling'), _resolve_term('concern','depression'),          'treats', 0.8),
(_resolve_term('modality','counseling'), _resolve_term('concern','grief'),               'treats', 0.8),
(_resolve_term('modality','counseling'), _resolve_term('concern','relationship-healing'),'treats', 0.8),
(_resolve_term('modality','counseling'), _resolve_term('concern','life-transitions'),    'treats', 0.8),
(_resolve_term('modality','counseling'), _resolve_term('concern','stress'),              'treats', 0.7),
(_resolve_term('modality','counseling'), _resolve_term('concern','burnout'),             'treats', 0.7),

-- Life Coaching
(_resolve_term('modality','life-coaching'), _resolve_term('concern','burnout'),             'treats', 0.8),
(_resolve_term('modality','life-coaching'), _resolve_term('concern','life-transitions'),    'treats', 0.9),
(_resolve_term('modality','life-coaching'), _resolve_term('concern','self-discovery'),      'treats', 0.8),
(_resolve_term('modality','life-coaching'), _resolve_term('concern','overwhelm'),           'treats', 0.6),
(_resolve_term('modality','life-coaching'), _resolve_term('concern','relationship-healing'),'treats', 0.5),

-- Soul Guidance
(_resolve_term('modality','soul-guidance'), _resolve_term('concern','spiritual-growth'),    'treats', 0.9),
(_resolve_term('modality','soul-guidance'), _resolve_term('concern','self-discovery'),      'treats', 0.8),
(_resolve_term('modality','soul-guidance'), _resolve_term('concern','life-transitions'),    'treats', 0.7),
(_resolve_term('modality','soul-guidance'), _resolve_term('concern','grief'),               'treats', 0.6),

-- Trauma-Informed Care
(_resolve_term('modality','trauma-informed-care'), _resolve_term('concern','trauma'),              'treats', 0.9),
(_resolve_term('modality','trauma-informed-care'), _resolve_term('concern','anxiety'),             'treats', 0.7),
(_resolve_term('modality','trauma-informed-care'), _resolve_term('concern','nervous-system-support'),'treats', 0.8),
(_resolve_term('modality','trauma-informed-care'), _resolve_term('concern','depression'),          'treats', 0.6),

-- Nervous System Regulation
(_resolve_term('modality','nervous-system-regulation'), _resolve_term('concern','nervous-system-support'), 'treats', 0.9),
(_resolve_term('modality','nervous-system-regulation'), _resolve_term('concern','anxiety'),               'treats', 0.8),
(_resolve_term('modality','nervous-system-regulation'), _resolve_term('concern','trauma'),                'treats', 0.7),
(_resolve_term('modality','nervous-system-regulation'), _resolve_term('concern','overwhelm'),             'treats', 0.7),
(_resolve_term('modality','nervous-system-regulation'), _resolve_term('concern','stress'),                'treats', 0.7),

-- Naturopathic
(_resolve_term('modality','naturopathic'), _resolve_term('concern','digestive-health'),    'treats', 0.8),
(_resolve_term('modality','naturopathic'), _resolve_term('concern','hormonal-balance'),    'treats', 0.8),
(_resolve_term('modality','naturopathic'), _resolve_term('concern','immune-support'),      'treats', 0.8),
(_resolve_term('modality','naturopathic'), _resolve_term('concern','fatigue'),             'treats', 0.7),
(_resolve_term('modality','naturopathic'), _resolve_term('concern','skin-conditions'),     'treats', 0.6),
(_resolve_term('modality','naturopathic'), _resolve_term('concern','weight-management'),   'treats', 0.5),

-- Functional Medicine
(_resolve_term('modality','functional-medicine'), _resolve_term('concern','fatigue'),             'treats', 0.8),
(_resolve_term('modality','functional-medicine'), _resolve_term('concern','digestive-health'),    'treats', 0.8),
(_resolve_term('modality','functional-medicine'), _resolve_term('concern','hormonal-balance'),    'treats', 0.8),
(_resolve_term('modality','functional-medicine'), _resolve_term('concern','immune-support'),      'treats', 0.7),
(_resolve_term('modality','functional-medicine'), _resolve_term('concern','gut-health'),          'treats', 0.8),
(_resolve_term('modality','functional-medicine'), _resolve_term('concern','weight-management'),   'treats', 0.6),

-- Chiropractic
(_resolve_term('modality','chiropractic'), _resolve_term('concern','chronic-pain'),        'treats', 0.9),
(_resolve_term('modality','chiropractic'), _resolve_term('concern','joint-pain'),          'treats', 0.9),
(_resolve_term('modality','chiropractic'), _resolve_term('concern','headaches-migraines'), 'treats', 0.7),
(_resolve_term('modality','chiropractic'), _resolve_term('concern','sports-recovery'),     'treats', 0.6),

-- Network Chiropractic
(_resolve_term('modality','network-chiropractic'), _resolve_term('concern','nervous-system-support'), 'treats', 0.9),
(_resolve_term('modality','network-chiropractic'), _resolve_term('concern','chronic-pain'),          'treats', 0.7),
(_resolve_term('modality','network-chiropractic'), _resolve_term('concern','stress'),                'treats', 0.6),

-- Physical Therapy
(_resolve_term('modality','physical-therapy'), _resolve_term('concern','chronic-pain'),        'treats', 0.9),
(_resolve_term('modality','physical-therapy'), _resolve_term('concern','joint-pain'),          'treats', 0.9),
(_resolve_term('modality','physical-therapy'), _resolve_term('concern','sports-recovery'),     'treats', 0.9),
(_resolve_term('modality','physical-therapy'), _resolve_term('concern','postpartum-recovery'), 'treats', 0.5),

-- Nutrition
(_resolve_term('modality','nutrition'), _resolve_term('concern','weight-management'),   'treats', 0.9),
(_resolve_term('modality','nutrition'), _resolve_term('concern','digestive-health'),    'treats', 0.8),
(_resolve_term('modality','nutrition'), _resolve_term('concern','gut-health'),          'treats', 0.8),
(_resolve_term('modality','nutrition'), _resolve_term('concern','hormonal-balance'),    'treats', 0.6),
(_resolve_term('modality','nutrition'), _resolve_term('concern','fatigue'),             'treats', 0.6),
(_resolve_term('modality','nutrition'), _resolve_term('concern','immune-support'),      'treats', 0.6),

-- Herbalism
(_resolve_term('modality','herbalism'), _resolve_term('concern','digestive-health'),    'treats', 0.8),
(_resolve_term('modality','herbalism'), _resolve_term('concern','immune-support'),      'treats', 0.8),
(_resolve_term('modality','herbalism'), _resolve_term('concern','hormonal-balance'),    'treats', 0.7),
(_resolve_term('modality','herbalism'), _resolve_term('concern','skin-conditions'),     'treats', 0.6),
(_resolve_term('modality','herbalism'), _resolve_term('concern','insomnia'),            'treats', 0.6),
(_resolve_term('modality','herbalism'), _resolve_term('concern','anxiety'),             'treats', 0.5),

-- Ayurveda
(_resolve_term('modality','ayurveda'), _resolve_term('concern','digestive-health'),    'treats', 0.9),
(_resolve_term('modality','ayurveda'), _resolve_term('concern','stress'),              'treats', 0.7),
(_resolve_term('modality','ayurveda'), _resolve_term('concern','hormonal-balance'),    'treats', 0.7),
(_resolve_term('modality','ayurveda'), _resolve_term('concern','skin-conditions'),     'treats', 0.6),
(_resolve_term('modality','ayurveda'), _resolve_term('concern','weight-management'),   'treats', 0.6),

-- Birth Doula
(_resolve_term('modality','birth-doula'), _resolve_term('concern','prenatal-care'),       'treats', 0.9),
(_resolve_term('modality','birth-doula'), _resolve_term('concern','postpartum-recovery'), 'treats', 0.8),
(_resolve_term('modality','birth-doula'), _resolve_term('concern','womens-health'),       'treats', 0.7),

-- Midwife
(_resolve_term('modality','midwife'), _resolve_term('concern','prenatal-care'),       'treats', 0.9),
(_resolve_term('modality','midwife'), _resolve_term('concern','postpartum-recovery'), 'treats', 0.8),
(_resolve_term('modality','midwife'), _resolve_term('concern','fertility'),           'treats', 0.5),
(_resolve_term('modality','midwife'), _resolve_term('concern','womens-health'),       'treats', 0.8),

-- Astrology
(_resolve_term('modality','astrology'), _resolve_term('concern','self-discovery'),      'treats', 0.8),
(_resolve_term('modality','astrology'), _resolve_term('concern','spiritual-growth'),    'treats', 0.7),
(_resolve_term('modality','astrology'), _resolve_term('concern','life-transitions'),    'treats', 0.6),

-- Family Constellation
(_resolve_term('modality','family-constellation'), _resolve_term('concern','relationship-healing'), 'treats', 0.9),
(_resolve_term('modality','family-constellation'), _resolve_term('concern','trauma'),               'treats', 0.7),
(_resolve_term('modality','family-constellation'), _resolve_term('concern','grief'),                'treats', 0.6),

-- Nature Therapy
(_resolve_term('modality','nature-therapy'), _resolve_term('concern','stress'),              'treats', 0.8),
(_resolve_term('modality','nature-therapy'), _resolve_term('concern','anxiety'),             'treats', 0.7),
(_resolve_term('modality','nature-therapy'), _resolve_term('concern','burnout'),             'treats', 0.7),
(_resolve_term('modality','nature-therapy'), _resolve_term('concern','self-discovery'),      'treats', 0.5),

-- Osteopathic
(_resolve_term('modality','osteopathic'), _resolve_term('concern','chronic-pain'),        'treats', 0.8),
(_resolve_term('modality','osteopathic'), _resolve_term('concern','joint-pain'),          'treats', 0.8),
(_resolve_term('modality','osteopathic'), _resolve_term('concern','headaches-migraines'), 'treats', 0.6);

-- ── Modality → Approach ("related") affinities ────────────────────────────

INSERT INTO taxonomy_relationships (source_term_id, target_term_id, relationship, strength) VALUES

-- Bodywork modalities → body-based approach
(_resolve_term('modality','massage'),                  _resolve_term('approach','body-based'),  'related', 0.9),
(_resolve_term('modality','craniosacral'),             _resolve_term('approach','body-based'),  'related', 0.9),
(_resolve_term('modality','craniosacral'),             _resolve_term('approach','gentle'),      'related', 0.8),
(_resolve_term('modality','watsu-water-therapy'),      _resolve_term('approach','body-based'),  'related', 0.9),
(_resolve_term('modality','watsu-water-therapy'),      _resolve_term('approach','gentle'),      'related', 0.8),

-- Hawaiian & Indigenous → indigenous, ceremonial, spiritual
(_resolve_term('modality','lomilomi-hawaiian-healing'),_resolve_term('approach','indigenous'),  'related', 0.9),
(_resolve_term('modality','lomilomi-hawaiian-healing'),_resolve_term('approach','spiritual'),   'related', 0.7),
(_resolve_term('modality','hawaiian-healing'),         _resolve_term('approach','indigenous'),  'related', 0.9),
(_resolve_term('modality','hawaiian-healing'),         _resolve_term('approach','ceremonial'),  'related', 0.8),
(_resolve_term('modality','hawaiian-healing'),         _resolve_term('approach','traditional'), 'related', 0.7),

-- Energy modalities → spiritual, intuitive
(_resolve_term('modality','reiki'),          _resolve_term('approach','spiritual'),   'related', 0.8),
(_resolve_term('modality','reiki'),          _resolve_term('approach','gentle'),      'related', 0.8),
(_resolve_term('modality','energy-healing'), _resolve_term('approach','intuitive'),   'related', 0.8),
(_resolve_term('modality','energy-healing'), _resolve_term('approach','spiritual'),   'related', 0.7),
(_resolve_term('modality','sound-healing'),  _resolve_term('approach','spiritual'),   'related', 0.7),
(_resolve_term('modality','sound-healing'),  _resolve_term('approach','ceremonial'),  'related', 0.5),

-- Clinical modalities → clinical, evidence-informed
(_resolve_term('modality','acupuncture'),         _resolve_term('approach','clinical'),           'related', 0.7),
(_resolve_term('modality','acupuncture'),         _resolve_term('approach','traditional'),        'related', 0.7),
(_resolve_term('modality','acupuncture'),         _resolve_term('approach','holistic'),           'related', 0.6),
(_resolve_term('modality','tcm'),                 _resolve_term('approach','traditional'),        'related', 0.9),
(_resolve_term('modality','tcm'),                 _resolve_term('approach','holistic'),           'related', 0.8),
(_resolve_term('modality','naturopathic'),        _resolve_term('approach','holistic'),           'related', 0.9),
(_resolve_term('modality','naturopathic'),        _resolve_term('approach','integrative'),        'related', 0.8),
(_resolve_term('modality','functional-medicine'), _resolve_term('approach','evidence-informed'),  'related', 0.8),
(_resolve_term('modality','functional-medicine'), _resolve_term('approach','integrative'),        'related', 0.8),
(_resolve_term('modality','chiropractic'),        _resolve_term('approach','clinical'),           'related', 0.8),
(_resolve_term('modality','chiropractic'),        _resolve_term('approach','body-based'),         'related', 0.7),
(_resolve_term('modality','physical-therapy'),    _resolve_term('approach','evidence-informed'),  'related', 0.9),
(_resolve_term('modality','physical-therapy'),    _resolve_term('approach','clinical'),           'related', 0.8),
(_resolve_term('modality','physical-therapy'),    _resolve_term('approach','performance-oriented'),'related', 0.6),

-- Mind-body → somatic, holistic, gentle
(_resolve_term('modality','yoga'),            _resolve_term('approach','body-based'),  'related', 0.8),
(_resolve_term('modality','yoga'),            _resolve_term('approach','holistic'),    'related', 0.7),
(_resolve_term('modality','breathwork'),      _resolve_term('approach','somatic'),     'related', 0.8),
(_resolve_term('modality','somatic-therapy'), _resolve_term('approach','somatic'),     'related', 0.9),
(_resolve_term('modality','somatic-therapy'), _resolve_term('approach','trauma-informed'), 'related', 0.9),
(_resolve_term('modality','somatic-therapy'), _resolve_term('approach','body-based'),  'related', 0.8),
(_resolve_term('modality','meditation'),      _resolve_term('approach','gentle'),      'related', 0.8),
(_resolve_term('modality','meditation'),      _resolve_term('approach','spiritual'),   'related', 0.5),

-- Mental health → trauma-informed, compassionate, evidence-informed
(_resolve_term('modality','psychotherapy'),             _resolve_term('approach','evidence-informed'),  'related', 0.8),
(_resolve_term('modality','psychotherapy'),             _resolve_term('approach','compassionate'),      'related', 0.7),
(_resolve_term('modality','counseling'),                _resolve_term('approach','compassionate'),      'related', 0.8),
(_resolve_term('modality','counseling'),                _resolve_term('approach','practical'),          'related', 0.6),
(_resolve_term('modality','trauma-informed-care'),      _resolve_term('approach','trauma-informed'),    'related', 0.9),
(_resolve_term('modality','trauma-informed-care'),      _resolve_term('approach','compassionate'),      'related', 0.8),
(_resolve_term('modality','nervous-system-regulation'), _resolve_term('approach','somatic'),            'related', 0.8),
(_resolve_term('modality','nervous-system-regulation'), _resolve_term('approach','trauma-informed'),    'related', 0.7),
(_resolve_term('modality','life-coaching'),             _resolve_term('approach','practical'),          'related', 0.8),
(_resolve_term('modality','life-coaching'),             _resolve_term('approach','compassionate'),      'related', 0.6),

-- Soul Guidance / Astrology → spiritual, intuitive
(_resolve_term('modality','soul-guidance'), _resolve_term('approach','spiritual'),   'related', 0.9),
(_resolve_term('modality','soul-guidance'), _resolve_term('approach','intuitive'),   'related', 0.8),
(_resolve_term('modality','astrology'),    _resolve_term('approach','intuitive'),    'related', 0.9),
(_resolve_term('modality','astrology'),    _resolve_term('approach','spiritual'),    'related', 0.7),

-- Nutrition & Herbalism → holistic, practical
(_resolve_term('modality','nutrition'),  _resolve_term('approach','practical'),          'related', 0.8),
(_resolve_term('modality','nutrition'),  _resolve_term('approach','evidence-informed'),  'related', 0.7),
(_resolve_term('modality','herbalism'),  _resolve_term('approach','holistic'),           'related', 0.8),
(_resolve_term('modality','herbalism'),  _resolve_term('approach','traditional'),        'related', 0.7),
(_resolve_term('modality','ayurveda'),   _resolve_term('approach','traditional'),        'related', 0.9),
(_resolve_term('modality','ayurveda'),   _resolve_term('approach','holistic'),           'related', 0.8),

-- Birth work → family-centered, compassionate, gentle
(_resolve_term('modality','birth-doula'), _resolve_term('approach','family-centered'),  'related', 0.9),
(_resolve_term('modality','birth-doula'), _resolve_term('approach','compassionate'),    'related', 0.8),
(_resolve_term('modality','birth-doula'), _resolve_term('approach','gentle'),           'related', 0.7),
(_resolve_term('modality','midwife'),     _resolve_term('approach','family-centered'),  'related', 0.9),
(_resolve_term('modality','midwife'),     _resolve_term('approach','clinical'),         'related', 0.6),

-- Nature therapy → holistic
(_resolve_term('modality','nature-therapy'), _resolve_term('approach','holistic'),    'related', 0.8),
(_resolve_term('modality','nature-therapy'), _resolve_term('approach','gentle'),      'related', 0.7);

-- ── Cleanup helper function ────────────────────────────────────────────────
DROP FUNCTION IF EXISTS _resolve_term(text, text);
