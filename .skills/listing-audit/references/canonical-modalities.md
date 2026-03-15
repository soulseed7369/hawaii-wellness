# Canonical Modalities — Source of Truth

Last updated: 2026-03-15

## The 44 Canonical Modalities

These are the ONLY valid values for the `modalities` text[] column. Case-sensitive exact match required.

```
Acupuncture
Alternative Therapy
Art Therapy
Astrology
Ayurveda
Birth Doula
Breathwork
Chiropractic
Counseling
Craniosacral
Dentistry
Energy Healing
Family Constellation
Fitness
Functional Medicine
Hawaiian Healing
Herbalism
Hypnotherapy
IV Therapy
Life Coaching
Lomilomi / Hawaiian Healing
Longevity
Massage
Meditation
Midwife
Nature Therapy
Naturopathic
Nervous System Regulation
Network Chiropractic
Nutrition
Osteopathic
Physical Therapy
Psychic
Psychotherapy
Reiki
Ritualist
Somatic Therapy
Soul Guidance
Sound Healing
TCM (Traditional Chinese Medicine)
Trauma-Informed Care
Watsu / Water Therapy
Women's Health
Yoga
```

## Normalization Map

These are known variants that should be auto-corrected to their canonical form:

| Found in data | Correct canonical value |
|---|---|
| `massage` | `Massage` |
| `Massage Therapy` | `Massage` |
| `massage therapy` | `Massage` |
| `Massage Therapist` | `Massage` |
| `acupuncture` | `Acupuncture` |
| `Acupuncture Clinic` | `Acupuncture` |
| `counseling` | `Counseling` |
| `chiropractic` | `Chiropractic` |
| `craniosacral` | `Craniosacral` |
| `reiki` | `Reiki` |
| `naturopathic` | `Naturopathic` |
| `nutrition` | `Nutrition` |
| `yoga` | `Yoga` |
| `meditation` | `Meditation` |
| `breathwork` | `Breathwork` |
| `herbalism` | `Herbalism` |
| `Wellness Coach` | `Life Coaching` |
| `Integrative Healthcare` | `Alternative Therapy` |
| `Psychologist` | `Psychotherapy` |
| `therapy` | `Psychotherapy` |
| `Longevity Medicine` | `Longevity` |

## Modalities that are meaningless alone

- `Alternative Therapy` — too generic; usually means the pipeline couldn't classify. Flag for review if it's the only modality on a listing.

## Where modality lists live in the codebase

| File | Variable | Count | Notes |
|---|---|---|---|
| `src/pages/admin/AdminPanel.tsx` | `MODALITIES_LIST` | 44 | Admin edit forms |
| `src/pages/dashboard/DashboardProfile.tsx` | `MODALITIES` | 44 | Provider self-edit |
| `src/pages/Directory.tsx` | `FILTER_MODALITIES` | ~35 | Public filter sidebar — OFTEN BEHIND |
| `src/pages/IslandHome.tsx` | `BROWSE_MODALITIES` | ~21 | Island homepage browse chips |
| `pipeline/scripts/11_gm_classify.py` | `CANONICAL_MODALITIES` | 44 | Pipeline classification |
| `pipeline/scripts/24_normalize_modalities.py` | `CANONICAL` | 44 | Pipeline normalization |
| `supabase taxonomy_terms` | DB rows | varies | New search system |
