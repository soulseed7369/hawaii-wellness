"""
14_sprint1_name_migration.py
────────────────────────────
Backfill Sprint-2 (Practitioner-First) columns for all existing rows.

For practitioners:
  - Splits `name` into `first_name` / `last_name`
  - Sets `display_name` = existing `name` (preserves original capitalisation)
  - Generates a unique URL-safe `slug`  (e.g. "tracy-kelleher")

For centers:
  - Generates a unique URL-safe `slug`  (e.g. "hilo-healing-center")

Rules
-----
* Idempotent: rows that already have a slug are SKIPPED.
* Slug uniqueness: if "tracy-kelleher" is taken, tries
  "tracy-kelleher-2", "tracy-kelleher-3", … until a free slot is found.
* Name splitting heuristic: first word → first_name, rest → last_name.
  Single-word names (e.g. "Kailua Wellness") are stored entirely in
  first_name; last_name is left NULL.
* `display_name` is set to the original `name` value unchanged.

Usage:
    cd pipeline
    python scripts/14_sprint1_name_migration.py [--dry-run] [--table practitioners|centers|both]
"""

from __future__ import annotations

import sys, re, argparse
sys.path.insert(0, '.')
from src.supabase_client import client


# ── Slug helpers ──────────────────────────────────────────────────────────────

def slugify(text: str) -> str:
    """Convert any text to a lowercase hyphen-separated URL slug."""
    # Lowercase
    text = text.lower()
    # Remove common honorifics / suffixes so they don't bloat the slug
    text = re.sub(
        r"\b(dr\.?|mr\.?|ms\.?|mrs\.?|prof\.?|rev\.?|"
        r"lmt|lcsw|rn|phd|md|nd|lac|dac|nmd|dpt|mft|ma|ms|msc)\b",
        "", text,
    )
    # Replace any non-alphanumeric characters (including apostrophes, commas) with space
    text = re.sub(r"[^a-z0-9]+", " ", text)
    # Collapse spaces and trim
    text = re.sub(r"\s+", " ", text).strip()
    # Replace spaces with hyphens
    return text.replace(" ", "-")


def unique_slug(base: str, existing_slugs: set[str]) -> str:
    """Return `base` slug; if taken, append -2, -3, … until unique."""
    candidate = base
    n = 2
    while candidate in existing_slugs:
        candidate = f"{base}-{n}"
        n += 1
    return candidate


# ── Name splitting ────────────────────────────────────────────────────────────

def split_name(full_name: str) -> tuple[str, str | None]:
    """
    Split 'First Last…' into (first_name, last_name | None).
    Handles honorifics / suffixes gracefully:
      "Dr. Tracy Kelleher, LMT" → ("Tracy", "Kelleher")
      "Hilo Healing Center"     → ("Hilo", "Healing Center")
      "Kaipo"                   → ("Kaipo", None)
    """
    # Strip common leading honorifics for the split (keep display_name unchanged)
    cleaned = re.sub(
        r"^(dr\.?|mr\.?|ms\.?|mrs\.?|prof\.?|rev\.?)\s+",
        "", full_name, flags=re.IGNORECASE,
    )
    # Strip trailing credentials after comma: "Tracy Kelleher, LMT"
    cleaned = re.sub(r",\s*\S+$", "", cleaned).strip()

    parts = cleaned.split(None, 1)   # split on first whitespace
    if len(parts) == 1:
        return parts[0], None
    return parts[0], parts[1]


# ── Practitioners ─────────────────────────────────────────────────────────────

def migrate_practitioners(dry_run: bool) -> None:
    print("── Practitioners ────────────────────────────────────────────")

    # Fetch all practitioners that don't yet have a slug
    resp = client.table("practitioners").select(
        "id, name, first_name, last_name, display_name, slug"
    ).is_("slug", "null").execute()

    rows = resp.data or []
    print(f"  {len(rows)} practitioners without a slug")

    if not rows:
        print("  Nothing to do.")
        return

    # Build the set of ALL existing slugs to guarantee uniqueness
    all_slugs_resp = client.table("practitioners").select("slug").not_.is_("slug", "null").execute()
    existing_slugs: set[str] = {r["slug"] for r in (all_slugs_resp.data or []) if r.get("slug")}

    updates = []
    for row in rows:
        name = row["name"] or ""
        first, last = split_name(name)
        base_slug  = slugify(name)
        if not base_slug:
            base_slug = f"practitioner-{row['id'][:8]}"
        slug = unique_slug(base_slug, existing_slugs)
        existing_slugs.add(slug)   # reserve it for subsequent iterations

        updates.append({
            "id":           row["id"],
            "first_name":   row["first_name"] or first,
            "last_name":    row["last_name"]  or last,
            "display_name": row["display_name"] or name,
            "slug":         slug,
        })

    if dry_run:
        print(f"  [dry-run] Would update {len(updates)} practitioners.")
        for u in updates[:5]:
            print(f"    {u}")
        if len(updates) > 5:
            print(f"    … and {len(updates) - 5} more")
        return

    # Batch update in groups of 50
    batch_size = 50
    updated = 0
    for i in range(0, len(updates), batch_size):
        batch = updates[i : i + batch_size]
        for u in batch:
            client.table("practitioners").update({
                "first_name":   u["first_name"],
                "last_name":    u["last_name"],
                "display_name": u["display_name"],
                "slug":         u["slug"],
            }).eq("id", u["id"]).execute()
        updated += len(batch)
        print(f"  Updated {updated}/{len(updates)}…")

    print(f"  ✓ Done — {updated} practitioners updated.")


# ── Centers ───────────────────────────────────────────────────────────────────

def migrate_centers(dry_run: bool) -> None:
    print("── Centers ──────────────────────────────────────────────────")

    resp = client.table("centers").select("id, name, slug").is_("slug", "null").execute()
    rows = resp.data or []
    print(f"  {len(rows)} centers without a slug")

    if not rows:
        print("  Nothing to do.")
        return

    all_slugs_resp = client.table("centers").select("slug").not_.is_("slug", "null").execute()
    existing_slugs: set[str] = {r["slug"] for r in (all_slugs_resp.data or []) if r.get("slug")}

    updates = []
    for row in rows:
        name = row["name"] or ""
        base_slug = slugify(name)
        if not base_slug:
            base_slug = f"center-{row['id'][:8]}"
        slug = unique_slug(base_slug, existing_slugs)
        existing_slugs.add(slug)

        updates.append({"id": row["id"], "slug": slug})

    if dry_run:
        print(f"  [dry-run] Would update {len(updates)} centers.")
        for u in updates[:5]:
            print(f"    {u}")
        if len(updates) > 5:
            print(f"    … and {len(updates) - 5} more")
        return

    batch_size = 50
    updated = 0
    for i in range(0, len(updates), batch_size):
        batch = updates[i : i + batch_size]
        for u in batch:
            client.table("centers").update({"slug": u["slug"]}).eq("id", u["id"]).execute()
        updated += len(batch)
        print(f"  Updated {updated}/{len(updates)}…")

    print(f"  ✓ Done — {updated} centers updated.")


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Backfill Sprint-2 Practitioner-First columns."
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Print what would change without writing to the database.",
    )
    parser.add_argument(
        "--table", choices=["practitioners", "centers", "both"], default="both",
        help="Which table to migrate (default: both).",
    )
    args = parser.parse_args()

    if args.dry_run:
        print("⚠️  DRY-RUN mode — no changes will be written.\n")

    if args.table in ("practitioners", "both"):
        migrate_practitioners(args.dry_run)
    if args.table in ("centers", "both"):
        migrate_centers(args.dry_run)

    print("\n✓ Migration complete.")
