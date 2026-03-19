"""
23_validate_enrichment.py
────────────────────────
Weekly pipeline health report: measure data completeness by island × status.

Tracks the following metrics for each island/status combination:
  • % email populated
  • % phone populated
  • % bio/description populated (>10 words)
  • % avatar_url (photo) populated
  • % meaningful modalities (not empty, not just ["Alternative Therapy"])
  • % website_url populated
  • % first_name populated (practitioners only)
  • % enriched_at populated (ever crawled by script 22)
  • % lead_score populated
  • Count of no_website_lead=true listings
  • Average lead_score (for scored listings)

Output formats: table (terminal with color), csv, or json.
Color coding: green ≥80%, yellow 50–79%, red <50%.

Usage:
    cd pipeline
    python scripts/23_validate_enrichment.py                    # all islands, all statuses, table format
    python scripts/23_validate_enrichment.py --island big_island
    python scripts/23_validate_enrichment.py --island big_island --status published
    python scripts/23_validate_enrichment.py --format csv
    python scripts/23_validate_enrichment.py --format json
    python scripts/23_validate_enrichment.py --save              # save to output/validation_report_{date}.txt
"""

from __future__ import annotations
import sys, json, argparse, datetime
from pathlib import Path
from typing import Any

sys.path.insert(0, '.')
from src.config import OUTPUT_DIR
from src.supabase_client import client

# ─────────────────────────────────────────────────────────────────────────────
# ANSI color codes for terminal output
# ─────────────────────────────────────────────────────────────────────────────

class Colors:
    """ANSI color codes for terminal output."""
    RESET = '\033[0m'
    BOLD = '\033[1m'
    DIM = '\033[2m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    CYAN = '\033[96m'
    GRAY = '\033[90m'

def colorize(value: str, percentage: float | None = None, force_color: bool = False) -> str:
    """Colorize text based on percentage threshold (if provided)."""
    if percentage is None:
        return value

    # Only apply colors if terminal supports it or force_color is True
    if not force_color and not sys.stdout.isatty():
        return value

    if percentage >= 80:
        return f"{Colors.GREEN}{value}{Colors.RESET}"
    elif percentage >= 50:
        return f"{Colors.YELLOW}{value}{Colors.RESET}"
    else:
        return f"{Colors.RED}{value}{Colors.RESET}"

# ─────────────────────────────────────────────────────────────────────────────
# Data fetching
# ─────────────────────────────────────────────────────────────────────────────

def has_meaningful_modalities(modalities: list[str] | None) -> bool:
    """Check if modalities array is meaningful (not empty, not just ["Alternative Therapy"])."""
    if not modalities:
        return False
    if modalities == ["Alternative Therapy"]:
        return False
    return True

def is_bio_populated(text: str | None) -> bool:
    """Check if bio/description is populated (>10 words)."""
    if not text:
        return False
    word_count = len(text.strip().split())
    return word_count >= 10

def fetch_listings(
    listing_type: str,  # 'practitioners' | 'centers'
    island: str | None = None,
    status: str | None = None,
) -> list[dict]:
    """Fetch all listings of a given type, optionally filtered by island/status."""
    listings = []
    page_size = 1000
    offset = 0

    try:
        # practitioners use 'bio'; centers use 'description'
        bio_col = "bio" if listing_type == "practitioners" else "description"

        while True:
            # Build query — only request the bio column that exists for this table
            q = client.table(listing_type).select(
                f"id, island, status, email, phone, {bio_col}, avatar_url, "
                "modalities, website_url, first_name, enriched_at, lead_score, "
                "no_website_lead, created_at"
            )

            if island:
                q = q.eq("island", island)

            if status:
                q = q.eq("status", status)

            # Execute paginated query
            resp = q.range(offset, offset + page_size - 1).execute()

            if not resp.data:
                break

            listings.extend(resp.data)

            if len(resp.data) < page_size:
                break

            offset += page_size
    except Exception as e:
        print(f"[23] Warning: Error fetching {listing_type}: {e}", file=sys.stderr)

    return listings

def measure_completeness(
    listings: list[dict],
    listing_type: str,  # 'practitioners' | 'centers'
) -> dict[str, Any]:
    """Measure completeness metrics for a set of listings."""
    if not listings:
        return {
            "count": 0,
            "email": 0,
            "phone": 0,
            "bio": 0,
            "photo": 0,
            "modalities": 0,
            "website_url": 0,
            "first_name": 0,
            "enriched_at": 0,
            "lead_score": 0,
            "no_website_lead_count": 0,
            "avg_lead_score": 0,
        }

    count = len(listings)
    email_count = sum(1 for l in listings if l.get("email"))
    phone_count = sum(1 for l in listings if l.get("phone"))

    # Bio for practitioners, description for centers
    bio_field = "bio" if listing_type == "practitioners" else "description"
    bio_count = sum(
        1 for l in listings if is_bio_populated(l.get(bio_field))
    )

    photo_count = sum(1 for l in listings if l.get("avatar_url"))
    modalities_count = sum(
        1 for l in listings if has_meaningful_modalities(l.get("modalities"))
    )
    website_count = sum(1 for l in listings if l.get("website_url"))
    first_name_count = sum(1 for l in listings if l.get("first_name"))
    enriched_at_count = sum(1 for l in listings if l.get("enriched_at"))
    lead_score_count = sum(1 for l in listings if l.get("lead_score") is not None)
    no_website_lead_count = sum(1 for l in listings if l.get("no_website_lead") is True)

    # Average lead score for those that have one
    scored_listings = [l for l in listings if l.get("lead_score") is not None]
    avg_lead_score = (
        sum(l["lead_score"] for l in scored_listings) / len(scored_listings)
        if scored_listings else 0
    )

    return {
        "count": count,
        "email": round(100 * email_count / count, 1),
        "phone": round(100 * phone_count / count, 1),
        "bio": round(100 * bio_count / count, 1),
        "photo": round(100 * photo_count / count, 1),
        "modalities": round(100 * modalities_count / count, 1),
        "website_url": round(100 * website_count / count, 1),
        "first_name": round(100 * first_name_count / count, 1) if listing_type == "practitioners" else None,
        "enriched_at": round(100 * enriched_at_count / count, 1),
        "lead_score": round(100 * lead_score_count / count, 1),
        "no_website_lead_count": no_website_lead_count,
        "avg_lead_score": round(avg_lead_score, 1),
    }

# ─────────────────────────────────────────────────────────────────────────────
# Report generation
# ─────────────────────────────────────────────────────────────────────────────

def generate_table_report(
    practitioners_data: dict,
    centers_data: dict,
    summary: dict,
    use_color: bool = True,
) -> str:
    """Generate a formatted table report."""
    lines = []

    # Header
    lines.append("═" * 110)
    lines.append(f"  {Colors.BOLD}ALOHA HEALTH HUB — Enrichment Validation Report{Colors.RESET}")
    lines.append(
        f"  Generated: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}  |  "
        f"Run: python scripts/23_validate_enrichment.py"
    )
    lines.append("═" * 110)
    lines.append("")

    # Summary section
    lines.append(f"{Colors.BOLD}SUMMARY{Colors.RESET}")
    lines.append(
        f"  Total listings: {summary['total_listings']} "
        f"({summary['published_count']} published, {summary['draft_count']} draft)"
    )
    lines.append(
        f"  Overall completeness score: {summary['overall_completeness']:.0f}% "
        f"(across all tracked fields)"
    )
    lines.append(f"  Islands processed: {summary['islands_str']}")
    lines.append(f"  Listings needing enrichment: {summary['needs_enrichment']} (no enriched_at)")
    lines.append(f"  Hot leads (no website): {summary['no_website_leads']}")
    lines.append(f"  Avg lead score: {summary['avg_lead_score']:.0f}/100")
    lines.append("")

    # Practitioners table
    lines.append(f"{Colors.BOLD}PRACTITIONERS{Colors.RESET}")
    lines.append(
        "┌──────────────┬──────────┬─────────┬────────┬───────┬────────┬───────────┬──────────┬─────────────┐"
    )
    lines.append(
        "│ Island       │ Status   │ Total   │ Email  │ Phone │  Bio   │  Photo    │ Modality │ enriched_at │"
    )
    lines.append(
        "├──────────────┼──────────┼─────────┼────────┼───────┼────────┼───────────┼──────────┼─────────────┤"
    )

    for key, metrics in sorted(practitioners_data.items()):
        island, status = key
        status_short = "pub" if status == "published" else "draft"

        email_str = colorize(f"{metrics['email']:>5.0f}%", metrics["email"], use_color)
        phone_str = colorize(f"{metrics['phone']:>5.0f}%", metrics["phone"], use_color)
        bio_str = colorize(f"{metrics['bio']:>5.0f}%", metrics["bio"], use_color)
        photo_str = colorize(f"{metrics['photo']:>8.0f}%", metrics["photo"], use_color)
        modalities_str = colorize(f"{metrics['modalities']:>5.0f}%", metrics["modalities"], use_color)
        enriched_str = colorize(f"{metrics['enriched_at']:>9.0f}%", metrics["enriched_at"], use_color)

        lines.append(
            f"│ {island:12} │ {status_short:8} │ {metrics['count']:7} │ {email_str} │ {phone_str} │ {bio_str} │ {photo_str} │ {modalities_str}   │ {enriched_str} │"
        )

    lines.append(
        "└──────────────┴──────────┴─────────┴────────┴───────┴────────┴───────────┴──────────┴─────────────┘"
    )
    lines.append("")

    # Centers table
    lines.append(f"{Colors.BOLD}CENTERS{Colors.RESET}")
    lines.append(
        "┌──────────────┬──────────┬─────────┬────────┬───────┬────────┬───────────┬──────────┬─────────────┐"
    )
    lines.append(
        "│ Island       │ Status   │ Total   │ Email  │ Phone │  Desc  │  Photo    │ Modality │ enriched_at │"
    )
    lines.append(
        "├──────────────┼──────────┼─────────┼────────┼───────┼────────┼───────────┼──────────┼─────────────┤"
    )

    for key, metrics in sorted(centers_data.items()):
        island, status = key
        status_short = "pub" if status == "published" else "draft"

        email_str = colorize(f"{metrics['email']:>5.0f}%", metrics["email"], use_color)
        phone_str = colorize(f"{metrics['phone']:>5.0f}%", metrics["phone"], use_color)
        bio_str = colorize(f"{metrics['bio']:>5.0f}%", metrics["bio"], use_color)
        photo_str = colorize(f"{metrics['photo']:>8.0f}%", metrics["photo"], use_color)
        modalities_str = colorize(f"{metrics['modalities']:>5.0f}%", metrics["modalities"], use_color)
        enriched_str = colorize(f"{metrics['enriched_at']:>9.0f}%", metrics["enriched_at"], use_color)

        lines.append(
            f"│ {island:12} │ {status_short:8} │ {metrics['count']:7} │ {email_str} │ {phone_str} │ {bio_str} │ {photo_str} │ {modalities_str}   │ {enriched_str} │"
        )

    lines.append(
        "└──────────────┴──────────┴─────────┴────────┴───────┴────────┴───────────┴──────────┴─────────────┘"
    )
    lines.append("")

    # Top issues section
    if summary["top_issues"]:
        lines.append(f"{Colors.BOLD}TOP ISSUES (3 worst-performing field × island combinations){Colors.RESET}")
        for i, issue in enumerate(summary["top_issues"][:3], 1):
            lines.append(f"  {i}. {issue['field']:15} {issue['island']:12} {issue['avg_pct']:5.0f}% avg")
        lines.append("")

    return "\n".join(lines)

def generate_csv_report(practitioners_data: dict, centers_data: dict) -> str:
    """Generate CSV format report."""
    lines = [
        "listing_type,island,status,count,email,phone,bio_or_desc,photo,modalities,website_url,first_name,enriched_at,lead_score,no_website_lead_count,avg_lead_score"
    ]

    for key, metrics in sorted(practitioners_data.items()):
        island, status = key
        lines.append(
            f"practitioners,{island},{status},{metrics['count']},{metrics['email']},{metrics['phone']},"
            f"{metrics['bio']},{metrics['photo']},{metrics['modalities']},{metrics['website_url']},"
            f"{metrics['first_name']},{metrics['enriched_at']},{metrics['lead_score']},"
            f"{metrics['no_website_lead_count']},{metrics['avg_lead_score']}"
        )

    for key, metrics in sorted(centers_data.items()):
        island, status = key
        lines.append(
            f"centers,{island},{status},{metrics['count']},{metrics['email']},{metrics['phone']},"
            f"{metrics['bio']},{metrics['photo']},{metrics['modalities']},{metrics['website_url']},"
            f"N/A,{metrics['enriched_at']},{metrics['lead_score']},"
            f"{metrics['no_website_lead_count']},{metrics['avg_lead_score']}"
        )

    return "\n".join(lines)

def generate_json_report(
    practitioners_data: dict,
    centers_data: dict,
    summary: dict,
) -> str:
    """Generate JSON format report."""
    report = {
        "generated_at": datetime.datetime.now().isoformat(),
        "summary": summary,
        "practitioners": {str(k): v for k, v in practitioners_data.items()},
        "centers": {str(k): v for k, v in centers_data.items()},
    }
    return json.dumps(report, indent=2)

def compute_top_issues(practitioners_data: dict, centers_data: dict, limit: int = 3) -> list[dict]:
    """Find the 3 worst-performing field × island combinations."""
    issues = []

    fields = [
        "email", "phone", "bio", "photo", "modalities", "website_url", "enriched_at", "lead_score"
    ]

    # Combine both practitioners and centers
    all_data = {**practitioners_data, **centers_data}

    for key, metrics in all_data.items():
        island, status = key
        for field in fields:
            if metrics.get(field) is not None:
                pct = metrics[field]
                issues.append({
                    "field": field,
                    "island": island,
                    "status": status,
                    "pct": pct,
                })

    # Sort by percentage and return top N
    issues.sort(key=lambda x: x["pct"])

    # Group by field + island, average across statuses
    grouped = {}
    for issue in issues:
        key = (issue["field"], issue["island"])
        if key not in grouped:
            grouped[key] = []
        grouped[key].append(issue["pct"])

    aggregated = []
    for (field, island), pcts in grouped.items():
        aggregated.append({
            "field": field,
            "island": island,
            "avg_pct": sum(pcts) / len(pcts),
        })

    aggregated.sort(key=lambda x: x["avg_pct"])
    return aggregated[:limit]

# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Weekly enrichment validation report for Hawaii Wellness."
    )
    parser.add_argument(
        "--island",
        default="all",
        help="Island to filter: big_island, maui, oahu, kauai, or 'all' (default: all)",
    )
    parser.add_argument(
        "--status",
        default="all",
        help="Status to filter: published, draft, or 'all' (default: all)",
    )
    parser.add_argument(
        "--format",
        default="table",
        help="Output format: table, csv, or json (default: table)",
    )
    parser.add_argument(
        "--save",
        action="store_true",
        help="Save output to pipeline/output/validation_report_{date}.txt",
    )

    args = parser.parse_args()

    # Validate args
    valid_islands = ["big_island", "maui", "oahu", "kauai", "all"]
    if args.island not in valid_islands:
        print(f"[23] Error: --island must be one of {valid_islands}", file=sys.stderr)
        sys.exit(1)

    valid_statuses = ["published", "draft", "all"]
    if args.status not in valid_statuses:
        print(f"[23] Error: --status must be one of {valid_statuses}", file=sys.stderr)
        sys.exit(1)

    valid_formats = ["table", "csv", "json"]
    if args.format not in valid_formats:
        print(f"[23] Error: --format must be one of {valid_formats}", file=sys.stderr)
        sys.exit(1)

    print("[23] Fetching practitioners and centers...")

    # Determine which islands to process
    islands_to_process = [args.island] if args.island != "all" else ["big_island", "maui", "oahu", "kauai"]
    statuses_to_process = [args.status] if args.status != "all" else ["published", "draft"]

    practitioners_data = {}
    centers_data = {}
    all_practitioners = []
    all_centers = []

    # Fetch and measure for each island × status combination
    for island in islands_to_process:
        for status in statuses_to_process:
            print(f"  Processing {island} / {status}...")

            # Practitioners
            pracs = fetch_listings("practitioners", island=island, status=status)
            all_practitioners.extend(pracs)
            metrics = measure_completeness(pracs, "practitioners")
            practitioners_data[(island, status)] = metrics

            # Centers
            cents = fetch_listings("centers", island=island, status=status)
            all_centers.extend(cents)
            metrics = measure_completeness(cents, "centers")
            centers_data[(island, status)] = metrics

    # Compute summary stats
    total_listings = len(all_practitioners) + len(all_centers)
    published_count = sum(
        1 for l in all_practitioners + all_centers if l.get("status") == "published"
    )
    draft_count = total_listings - published_count

    # Overall completeness: average across all field percentages in practitioners + centers
    all_metrics = list(practitioners_data.values()) + list(centers_data.values())
    all_percentages = []
    for m in all_metrics:
        for field in ["email", "phone", "bio", "photo", "modalities", "website_url", "enriched_at", "lead_score"]:
            if m.get(field) is not None:
                all_percentages.append(m[field])
    overall_completeness = (
        sum(all_percentages) / len(all_percentages) if all_percentages else 0
    )

    # Enrichment needs (no enriched_at)
    needs_enrichment = sum(
        1 for l in all_practitioners + all_centers if not l.get("enriched_at")
    )

    # No website leads
    no_website_leads = sum(
        m["no_website_lead_count"] for m in all_metrics
    )

    # Avg lead score
    all_lead_scores = []
    for l in all_practitioners + all_centers:
        if l.get("lead_score") is not None:
            all_lead_scores.append(l["lead_score"])
    avg_lead_score = (
        sum(all_lead_scores) / len(all_lead_scores) if all_lead_scores else 0
    )

    # Top issues
    top_issues = compute_top_issues(practitioners_data, centers_data, limit=3)

    summary = {
        "total_listings": total_listings,
        "published_count": published_count,
        "draft_count": draft_count,
        "overall_completeness": overall_completeness,
        "islands_str": ", ".join(islands_to_process),
        "needs_enrichment": needs_enrichment,
        "no_website_leads": no_website_leads,
        "avg_lead_score": avg_lead_score,
        "top_issues": top_issues,
    }

    # Generate output
    if args.format == "table":
        output = generate_table_report(
            practitioners_data,
            centers_data,
            summary,
            use_color=sys.stdout.isatty(),
        )
    elif args.format == "csv":
        output = generate_csv_report(practitioners_data, centers_data)
    else:  # json
        output = generate_json_report(practitioners_data, centers_data, summary)

    # Print and optionally save
    print(output)

    if args.save:
        output_file = OUTPUT_DIR / f"validation_report_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
        output_file.parent.mkdir(parents=True, exist_ok=True)
        output_file.write_text(output)
        print(f"\n[23] Report saved to {output_file}")

if __name__ == "__main__":
    main()
