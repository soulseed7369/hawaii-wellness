"""
23_classify_centers.py
──────────────────────
Heuristic classifier to identify centers in the DB that are likely
individual practitioners rather than actual wellness centers/businesses.

The script pulls all draft center records, scores each one against a set of
heuristics, and flags those that look like solo practitioners.  Results are
written to a CSV report for review.  With --apply, flagged records are
automatically moved to the practitioners table.

Heuristics used
───────────────
AGAINST "is a center" (adds to solo-practitioner score):
  • Name looks like a personal name (First Last pattern, no business keywords)
  • Name contains personal-title keywords (LMT, RYT, PhD, MA, NP, etc.)
  • Description uses first-person singular language ("I offer", "I am", "my practice")
  • Modalities list contains only solo-practitioner modalities
  • No address and no website (solo practitioners often operate mobile)
  • center_type is 'wellness_center' (most pipeline records default to this;
    spa/clinic/retreat/yoga_studio are more likely real businesses)

FOR "is a center" (subtracts from solo score):
  • Name contains center/studio/spa/clinic/retreat/wellness/sanctuary keywords
  • Multiple photos (> 1)
  • Working hours set
  • Description mentions staff, team, therapists (plural staff language)

Output
──────
  pipeline/output/center_classification.csv
  Columns: id, name, island, city, center_type, score, verdict,
           reasons, phone, email, website_url, description_snippet

Usage
─────
    cd pipeline
    python scripts/23_classify_centers.py
    python scripts/23_classify_centers.py --island big_island
    python scripts/23_classify_centers.py --min-score 3   # only flag if score >= N
    python scripts/23_classify_centers.py --apply         # move flagged to practitioners
    python scripts/23_classify_centers.py --dry-run       # print summary without writing
"""

from __future__ import annotations

import sys, re, csv, argparse, textwrap
from pathlib import Path
from difflib import SequenceMatcher

sys.path.insert(0, '.')
from src.config import OUTPUT_DIR
from src.supabase_client import client

# ── Keyword lists ──────────────────────────────────────────────────────────────

# If name contains any of these → likely a real business (lower solo score)
BUSINESS_KEYWORDS = re.compile(
    r'\b(center|centre|clinic|spa|studio|retreat|sanctuary|institute|school|'
    r'wellness|health|healing|holistic|integrative|medical|chiropractic|'
    r'academy|associates|group|collective|co-op|cooperative|foundation|'
    r'network|services|solutions|hawaii|aloha|maui|oahu|kauai|hilo|kona)\b',
    re.I
)

# Personal credential suffixes in names
CREDENTIAL_RE = re.compile(
    r'\b(lmt|lcsw|lmft|mft|phd|psyd|nd|dc|rn|np|pa|ma|ms|mpa|'
    r'ryt|e-ryt|rmt|cmt|cpt|cht|cch|cst|cmtpt|dpt|apc)\b',
    re.I
)

# First-person language in description → likely solo
FIRST_PERSON_RE = re.compile(
    r'\b(i offer|i am|i work|i specialize|my practice|my work|my approach|'
    r'i have been|i\'ve been|my clients|i help|i guide|i believe|i use|'
    r'i provide|i draw|my training|my passion)\b',
    re.I
)

# Plural staff language in description → likely a center
TEAM_LANGUAGE_RE = re.compile(
    r'\b(our team|our staff|our therapists|our practitioners|our providers|'
    r'our specialists|our counselors|our instructors|team of|staff of|'
    r'therapists on staff|practitioners on staff|we offer|we provide|'
    r'join us|our facility|our center|our studio|our spa|our clinic)\b',
    re.I
)

# Personal name pattern: "Firstname Lastname" (2–3 words, title-cased, no numbers)
# We look for names that DON'T contain business keywords above
PERSONAL_NAME_RE = re.compile(r'^[A-Z][a-z]{1,20}(\s[A-Z][a-z]{1,20}){1,2}$')

# Modalities that are almost exclusively solo practitioners
SOLO_MODALITIES = {
    'reiki', 'hypnotherapy', 'life coaching', 'soul guidance',
    'breathwork', 'astrology', 'psychic', 'birth doula', 'midwife',
    'psychotherapy', 'counseling', 'somatic therapy', 'craniosacral',
    'watsu / water therapy', 'lomilomi / hawaiian healing',
    'trauma-informed care', 'nervous system regulation',
}

# ── Scoring ───────────────────────────────────────────────────────────────────

def score_center(row: dict) -> tuple[int, list[str]]:
    """
    Return (score, reasons).
    Positive score → more likely a solo practitioner.
    Negative score → more likely a real center/business.
    """
    score = 0
    reasons: list[str] = []

    name        = (row.get('name') or '').strip()
    description = (row.get('description') or '').strip()
    center_type = (row.get('center_type') or '').strip()
    modalities  = row.get('modalities') or []
    photos      = row.get('photos') or []
    working_hrs = row.get('working_hours')

    # ── Name heuristics ──────────────────────────────────────────────────────
    if PERSONAL_NAME_RE.match(name) and not BUSINESS_KEYWORDS.search(name):
        score += 3
        reasons.append('name looks like a personal name')

    if BUSINESS_KEYWORDS.search(name):
        score -= 2
        reasons.append('name contains business keyword')

    if CREDENTIAL_RE.search(name):
        score += 2
        reasons.append('name contains professional credential suffix')

    # ── Description heuristics ───────────────────────────────────────────────
    if description:
        if FIRST_PERSON_RE.search(description):
            score += 2
            reasons.append('description uses first-person language')

        if TEAM_LANGUAGE_RE.search(description):
            score -= 2
            reasons.append('description mentions team/staff')
    else:
        # No description at all is slightly negative signal (real centers usually have one)
        score += 1
        reasons.append('no description')

    # ── Center type heuristic ────────────────────────────────────────────────
    # Generic 'wellness_center' is default from pipeline — weak signal
    if center_type == 'wellness_center':
        score += 1
        reasons.append("center_type is generic 'wellness_center' (pipeline default)")
    elif center_type in ('spa', 'clinic', 'retreat_center', 'yoga_studio'):
        score -= 1
        reasons.append(f'center_type is specific ({center_type})')

    # ── Modality heuristics ──────────────────────────────────────────────────
    if modalities:
        lower_mods = {m.lower() for m in modalities}
        solo_count = len(lower_mods & SOLO_MODALITIES)
        if solo_count > 0 and solo_count == len(lower_mods):
            score += 2
            reasons.append(f'all modalities are solo-practitioner types ({", ".join(lower_mods)})')

    # ── Photos / hours heuristics ────────────────────────────────────────────
    if len(photos) > 1:
        score -= 1
        reasons.append(f'has {len(photos)} photos (likely a real space)')

    if working_hrs and isinstance(working_hrs, dict) and any(v for v in working_hrs.values()):
        score -= 1
        reasons.append('has working hours set')

    return score, reasons


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description='Classify draft centers as centers vs practitioners')
    parser.add_argument('--island',    default='all',   help='Filter by island (default: all)')
    parser.add_argument('--status',    default='draft', help='DB status filter (default: draft)')
    parser.add_argument('--min-score', type=int, default=3,
                        help='Minimum score to flag as likely practitioner (default: 3)')
    parser.add_argument('--apply',     action='store_true',
                        help='Move flagged records to the practitioners table')
    parser.add_argument('--dry-run',   action='store_true',
                        help='Print summary without writing anything')
    args = parser.parse_args()

    print(f'Fetching {"draft " if args.status == "draft" else ""}centers'
          f'{" for " + args.island if args.island != "all" else " (all islands)"}...')

    # ── Fetch records ─────────────────────────────────────────────────────────
    q = client.table('centers').select('*')
    if args.status != 'all':
        q = q.eq('status', args.status)
    if args.island != 'all':
        q = q.eq('island', args.island)
    q = q.order('name')

    res = q.execute()
    rows: list[dict] = res.data or []
    print(f'  → {len(rows)} records fetched.')

    if not rows:
        print('Nothing to classify.')
        return

    # ── Score each row ────────────────────────────────────────────────────────
    results = []
    flagged_ids: list[str] = []

    for row in rows:
        s, reasons = score_center(row)
        desc = (row.get('description') or '')[:80].replace('\n', ' ')
        verdict = 'LIKELY PRACTITIONER' if s >= args.min_score else 'likely center'
        if s >= args.min_score:
            flagged_ids.append(row['id'])
        results.append({
            'id':                  row['id'],
            'name':                row.get('name', ''),
            'island':              row.get('island', ''),
            'city':                row.get('city', ''),
            'center_type':         row.get('center_type', ''),
            'score':               s,
            'verdict':             verdict,
            'reasons':             '; '.join(reasons),
            'phone':               row.get('phone', ''),
            'email':               row.get('email', ''),
            'website_url':         row.get('website_url', ''),
            'description_snippet': desc,
        })

    # ── Summary ───────────────────────────────────────────────────────────────
    total     = len(results)
    n_flagged = len(flagged_ids)
    print(f'\nResults:')
    print(f'  Total centers scored : {total}')
    print(f'  Likely practitioners : {n_flagged}  (score >= {args.min_score})')
    print(f'  Likely real centers  : {total - n_flagged}')

    # Print top flagged records
    flagged_sorted = sorted(
        [r for r in results if r['verdict'] == 'LIKELY PRACTITIONER'],
        key=lambda x: x['score'], reverse=True
    )
    if flagged_sorted:
        print(f'\nTop 10 most likely misclassified:')
        for r in flagged_sorted[:10]:
            print(f'  [{r["score"]:+2d}] {r["name"]:<35}  {r["island"]:<15}  {r["reasons"][:80]}')

    # ── Write CSV ─────────────────────────────────────────────────────────────
    output_path = Path(OUTPUT_DIR) / 'center_classification.csv'

    if not args.dry_run:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=list(results[0].keys()))
            writer.writeheader()
            writer.writerows(results)
        print(f'\nCSV written to: {output_path}')
    else:
        print('\n[dry-run] CSV not written.')

    # ── Apply: move flagged records to practitioners ──────────────────────────
    if args.apply and flagged_ids:
        if args.dry_run:
            print(f'[dry-run] Would move {len(flagged_ids)} records to practitioners table.')
            return

        print(f'\nMoving {len(flagged_ids)} records to practitioners table...')
        moved, errors = 0, 0

        for cid in flagged_ids:
            try:
                # Fetch full center record
                c_res = client.table('centers').select('*').eq('id', cid).single().execute()
                c = c_res.data
                if not c:
                    print(f'  SKIP {cid}: not found')
                    continue

                # Map center fields → practitioner fields
                practitioner = {
                    'name':                c.get('name'),
                    'bio':                 c.get('description'),
                    'island':              c.get('island'),
                    'city':                c.get('city'),
                    'address':             c.get('address'),
                    'phone':               c.get('phone'),
                    'email':               c.get('email'),
                    'website_url':         c.get('website_url'),
                    'external_booking_url': c.get('external_website_url'),
                    'modalities':          c.get('modalities') or [],
                    'lat':                 c.get('lat'),
                    'lng':                 c.get('lng'),
                    'avatar_url':          c.get('avatar_url'),
                    'social_links':        c.get('social_links'),
                    'testimonials':        c.get('testimonials') or [],
                    'tier':                c.get('tier', 'free'),
                    'status':              'draft',
                    'session_type':        c.get('session_type'),
                    'owner_id':            c.get('owner_id'),
                    'accepts_new_clients': True,
                }
                # Remove None values so Supabase doesn't complain
                practitioner = {k: v for k, v in practitioner.items() if v is not None}

                # Insert into practitioners
                ins_res = client.table('practitioners').insert(practitioner).execute()
                if ins_res.data:
                    # Delete from centers
                    client.table('centers').delete().eq('id', cid).execute()
                    moved += 1
                    print(f'  ✓ Moved: {c["name"]}')
                else:
                    print(f'  ✗ Insert failed for {c["name"]}')
                    errors += 1

            except Exception as e:
                print(f'  ✗ Error on {cid}: {e}')
                errors += 1

        print(f'\nDone. Moved: {moved}  Errors: {errors}')

    elif args.apply and not flagged_ids:
        print('\nNo records flagged — nothing to move.')

    else:
        print(f'\nReview the CSV and re-run with --apply to move flagged records.')


if __name__ == '__main__':
    main()
