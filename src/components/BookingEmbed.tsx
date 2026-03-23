import { CalendarClock, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

// ── Types ────────────────────────────────────────────────────────────────────

interface BookingEmbedProps {
  bookingUrl: string;
  practitionerName: string;
  tier: string;
  /** Custom CTA label — e.g. "Schedule a Discovery Call", "Book an Appointment" */
  bookingLabel?: string | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function isValidHttpUrl(raw: string): boolean {
  try {
    const { protocol } = new URL(raw);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

// ── Main component ───────────────────────────────────────────────────────────

/**
 * Booking CTA section for premium/featured listings.
 * Always opens in a new tab — no inline embed.
 * Hidden entirely when URL is missing or invalid.
 */
export function BookingEmbed({
  bookingUrl,
  practitionerName,
  tier,
  bookingLabel,
}: BookingEmbedProps) {
  // Premium+ gating
  if (tier !== "premium" && tier !== "featured") return null;
  if (!isValidHttpUrl(bookingUrl)) return null;
  if (!practitionerName?.trim()) return null;

  const heading = bookingLabel || "Book an Appointment";

  // Extract display domain for secondary text
  let domain = "";
  try {
    domain = new URL(bookingUrl).hostname.replace(/^www\./, "");
  } catch { /* ignore */ }

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <CalendarClock className="h-5 w-5 text-primary" />
        <h2 className="font-display text-xl font-bold">{heading}</h2>
      </div>
      <div className="rounded-xl border border-border bg-card p-5">
        <p className="text-sm text-muted-foreground mb-4">
          View available times and book directly
          {domain ? ` on ${domain}` : ` through ${practitionerName}'s scheduling page`}.
        </p>
        <Button className="gap-2" asChild>
          <a href={bookingUrl} target="_blank" rel="noopener noreferrer">
            {heading}
            <ExternalLink className="h-4 w-4" />
          </a>
        </Button>
      </div>
    </div>
  );
}
