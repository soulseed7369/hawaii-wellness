import { useEffect, useRef, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarClock, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

// ── Provider detection ────────────────────────────────────────────────────────

type BookingProvider = "calendly" | "acuity" | "generic";

/** Validates that a URL is safe http(s) before rendering. */
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
    const { hostname } = new URL(url);
    if (hostname.includes("calendly.com")) return "calendly";
    if (hostname.includes("acuityscheduling.com")) return "acuity";
  } catch {
    // fall through
  }
  return "generic";
}

// ── Calendly widget type ──────────────────────────────────────────────────────

interface CalendlyAPI {
  initInlineWidget?: (opts: { url: string; parentElement: HTMLElement }) => void;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface BookingEmbedProps {
  bookingUrl: string;
  practitionerName: string;
  tier: string;
}

// ── Error fallback ────────────────────────────────────────────────────────────

function EmbedError({ url, label }: { url: string; label: string }) {
  return (
    <div className="flex h-40 flex-col items-center justify-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 text-center">
      <p className="text-sm text-muted-foreground">Could not load the booking calendar.</p>
      <Button variant="outline" size="sm" asChild>
        <a href={url} target="_blank" rel="noopener noreferrer">
          {label} <ExternalLink className="ml-1.5 h-3 w-3" />
        </a>
      </Button>
    </div>
  );
}

// ── Calendly inline widget ────────────────────────────────────────────────────

function CalendlyEmbed({ url }: { url: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const SCRIPT_SRC = "https://assets.calendly.com/assets/external/widget.js";

    // Clear the container whenever url changes (prevents double-widget on re-render)
    if (containerRef.current) {
      containerRef.current.innerHTML = "";
    }
    setLoaded(false);
    setError(false);

    const initWidget = () => {
      if (cancelled) return;
      const calendly = (window as unknown as { Calendly?: CalendlyAPI }).Calendly;
      if (calendly?.initInlineWidget && containerRef.current) {
        calendly.initInlineWidget({ url, parentElement: containerRef.current });
        setLoaded(true);
      } else if (!cancelled) {
        // Script tag exists but Calendly API not available — show error
        setError(true);
      }
    };

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    // Only reuse existing script if the Calendly API actually loaded successfully
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

    // Cleanup: flag as cancelled + clear container so stale widget doesn't linger
    return () => {
      cancelled = true;
      if (containerRef.current) containerRef.current.innerHTML = "";
    };
  }, [url]);

  if (error) {
    return <EmbedError url={url} label="Open booking page" />;
  }

  return (
    <div className="relative w-full">
      {!loaded && <Skeleton className="absolute inset-0 rounded-xl" style={{ height: "700px" }} />}
      <div
        ref={containerRef}
        className="w-full overflow-hidden rounded-xl"
        style={{ minWidth: "320px", height: "700px" }}
      />
    </div>
  );
}

// ── Iframe embed (Acuity + generic) ──────────────────────────────────────────

function IframeEmbed({
  url,
  practitionerName,
}: {
  url: string;
  practitionerName: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  // Ref tracks actual loaded state so the timeout closure is never stale
  const loadedRef = useRef(false);

  // Reset state when URL changes (e.g. navigating between practitioners)
  useEffect(() => {
    setLoaded(false);
    setError(false);
    loadedRef.current = false;
  }, [url]);

  // Keep ref in sync with state
  useEffect(() => {
    loadedRef.current = loaded;
  }, [loaded]);

  // Fallback timeout: fires once per mount/URL-change; uses ref to avoid stale closure
  useEffect(() => {
    const id = setTimeout(() => {
      if (!loadedRef.current) setError(true);
    }, 15_000);
    return () => clearTimeout(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]); // reset timer on URL change

  if (error) {
    return <EmbedError url={url} label="Open booking page" />;
  }

  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-border bg-card">
      {!loaded && <Skeleton className="absolute inset-0" style={{ height: "700px" }} />}
      <iframe
        src={url}
        title={`Book an appointment with ${practitionerName || "this practitioner"}`}
        className="w-full"
        style={{ minHeight: "700px", display: "block" }}
        frameBorder="0"
        // allow-same-origin: needed so the booking service can access its own resources
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
        loading="lazy"
        onLoad={() => setLoaded(true)}
      />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function BookingEmbed({
  bookingUrl,
  practitionerName,
  tier,
}: BookingEmbedProps) {
  // Premium+ gating — free tier falls back to the external link button in the sidebar
  if (tier !== "premium" && tier !== "featured") return null;

  // Reject invalid / non-http(s) URLs silently
  if (!isValidHttpUrl(bookingUrl)) return null;

  // Guard against missing name
  if (!practitionerName?.trim()) return null;

  const provider = detectProvider(bookingUrl);

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <CalendarClock className="h-5 w-5 text-primary" />
        <h2 className="font-display text-xl font-bold">Book an Appointment</h2>
        <a
          href={bookingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-primary"
        >
          Open in new tab <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      {provider === "calendly" ? (
        <CalendlyEmbed url={bookingUrl} />
      ) : (
        <IframeEmbed url={bookingUrl} practitionerName={practitionerName} />
      )}
    </div>
  );
}
