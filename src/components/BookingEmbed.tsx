import { useEffect, useRef, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarClock, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

// ── Constants ────────────────────────────────────────────────────────────────

/** Compact height — shows week + 3-4 time slots without dominating the page */
const EMBED_HEIGHT = 350;

// ── Provider detection ───────────────────────────────────────────────────────

type BookingProvider = "calendly" | "google_cal" | "acuity" | "unsupported";

function isValidHttpUrl(raw: string): boolean {
  try {
    const { protocol } = new URL(raw);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

function detectProvider(url: string): BookingProvider {
  try {
    const u = new URL(url);
    if (u.hostname.includes("calendly.com")) return "calendly";
    if (
      u.hostname.includes("calendar.google.com") &&
      u.pathname.includes("/appointments/")
    )
      return "google_cal";
    if (u.hostname.includes("acuityscheduling.com")) return "acuity";
  } catch {
    // fall through
  }
  return "unsupported";
}

// ── Calendly widget type ─────────────────────────────────────────────────────

interface CalendlyAPI {
  initInlineWidget?: (opts: { url: string; parentElement: HTMLElement }) => void;
}

// ── Types ────────────────────────────────────────────────────────────────────

interface BookingEmbedProps {
  bookingUrl: string;
  practitionerName: string;
  tier: string;
  /** Custom CTA label — e.g. "Schedule a Discovery Call", "Book an Appointment" */
  bookingLabel?: string | null;
}

// ── Calendly inline widget ───────────────────────────────────────────────────

function CalendlyEmbed({ url, onFail }: { url: string; onFail: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (error) onFail();
  }, [error, onFail]);

  useEffect(() => {
    let cancelled = false;
    const SCRIPT_SRC = "https://assets.calendly.com/assets/external/widget.js";

    if (containerRef.current) containerRef.current.innerHTML = "";
    setLoaded(false);
    setError(false);

    const initWidget = () => {
      if (cancelled) return;
      const calendly = (window as unknown as { Calendly?: CalendlyAPI }).Calendly;
      if (calendly?.initInlineWidget && containerRef.current) {
        calendly.initInlineWidget({ url, parentElement: containerRef.current });
        setLoaded(true);
      } else if (!cancelled) {
        setError(true);
      }
    };

    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${SCRIPT_SRC}"]`
    );
    if (existing && (window as unknown as { Calendly?: CalendlyAPI }).Calendly) {
      initWidget();
      return () => { cancelled = true; };
    }

    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = initWidget;
    script.onerror = () => { if (!cancelled) setError(true); };
    document.head.appendChild(script);

    return () => {
      cancelled = true;
      if (containerRef.current) containerRef.current.innerHTML = "";
    };
  }, [url]);

  if (error) return null;

  return (
    <div className="relative w-full">
      {!loaded && (
        <Skeleton
          className="absolute inset-0 rounded-xl"
          style={{ height: `${EMBED_HEIGHT}px` }}
        />
      )}
      <div
        ref={containerRef}
        className="w-full overflow-hidden rounded-xl"
        style={{ minWidth: "320px", height: `${EMBED_HEIGHT}px` }}
      />
    </div>
  );
}

// ── Iframe embed (Google Calendar Appointments, Acuity) ─────────────────────

function IframeEmbed({
  url,
  practitionerName,
  onFail,
}: {
  url: string;
  practitionerName: string;
  onFail: () => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (error) onFail();
  }, [error, onFail]);

  useEffect(() => {
    setLoaded(false);
    setError(false);
    loadedRef.current = false;
  }, [url]);

  useEffect(() => {
    loadedRef.current = loaded;
  }, [loaded]);

  // If the iframe doesn't fire onLoad within 12s, consider it failed
  useEffect(() => {
    const id = setTimeout(() => {
      if (!loadedRef.current) setError(true);
    }, 12_000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  if (error) return null;

  return (
    <div
      className="relative w-full overflow-hidden rounded-xl border border-border bg-card"
    >
      {!loaded && (
        <Skeleton
          className="absolute inset-0"
          style={{ height: `${EMBED_HEIGHT}px` }}
        />
      )}
      <iframe
        src={url}
        title={`Book an appointment with ${practitionerName || "this practitioner"}`}
        className="w-full"
        style={{ height: `${EMBED_HEIGHT}px`, display: "block" }}
        frameBorder="0"
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
        loading="lazy"
        onLoad={() => setLoaded(true)}
      />
    </div>
  );
}

// ── Website booking button (unsupported providers or embed failure) ──────────

function WebsiteBookingButton({
  url,
  practitionerName,
}: {
  url: string;
  practitionerName: string;
}) {
  // Extract display domain for the button
  let domain = "";
  try {
    domain = new URL(url).hostname.replace(/^www\./, "");
  } catch { /* ignore */ }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="text-sm text-muted-foreground mb-4">
        Book directly through {practitionerName ? `${practitionerName}'s` : "their"} website.
      </p>
      <Button className="gap-2" asChild>
        <a href={url} target="_blank" rel="noopener noreferrer">
          Book on {domain || "their website"}
          <ExternalLink className="h-4 w-4" />
        </a>
      </Button>
    </div>
  );
}

// ── Inner embed that reports failure upward via callback ─────────────────────

function EmbedInner({
  provider,
  bookingUrl,
  practitionerName,
  onFail,
}: {
  provider: BookingProvider;
  bookingUrl: string;
  practitionerName: string;
  onFail: () => void;
}) {
  if (provider === "calendly") {
    return <CalendlyEmbed url={bookingUrl} onFail={onFail} />;
  }
  // google_cal + acuity use iframe
  return <IframeEmbed url={bookingUrl} practitionerName={practitionerName} onFail={onFail} />;
}

// ── Main component ───────────────────────────────────────────────────────────

export function BookingEmbed({
  bookingUrl,
  practitionerName,
  tier,
  bookingLabel,
}: BookingEmbedProps) {
  const [embedFailed, setEmbedFailed] = useState(false);

  // Premium+ gating
  if (tier !== "premium" && tier !== "featured") return null;
  if (!isValidHttpUrl(bookingUrl)) return null;
  if (!practitionerName?.trim()) return null;

  const provider = detectProvider(bookingUrl);
  const isEmbeddable = provider !== "unsupported";
  const heading = bookingLabel || "Book an Appointment";

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-5 w-5 text-primary" />
          <h2 className="font-display text-xl font-bold">{heading}</h2>
        </div>
        <a
          href={bookingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-primary"
        >
          Open in new tab <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      {isEmbeddable && !embedFailed ? (
        <EmbedInner
          provider={provider}
          bookingUrl={bookingUrl}
          practitionerName={practitionerName}
          onFail={() => setEmbedFailed(true)}
        />
      ) : (
        <WebsiteBookingButton url={bookingUrl} practitionerName={practitionerName} />
      )}
    </div>
  );
}
