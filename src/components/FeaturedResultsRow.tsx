import { Star } from "lucide-react";
import { ProviderCard } from "./ProviderCard";
import { CenterCard } from "./CenterCard";
import type { Provider, Center } from "@/data/mockData";

export interface FeaturedItem {
  id: string;
  listing_type: "practitioner" | "center";
  provider?: Provider;
  center?: Center;
}

interface FeaturedResultsRowProps {
  items: FeaturedItem[];
  highlightModality?: string;
}

/**
 * Renders up to 3 featured listings in an accent-styled row above
 * the main results.  Horizontally scrollable on mobile, flex-wrap
 * on desktop.  Clearly labelled so users see the separation.
 */
export function FeaturedResultsRow({ items, highlightModality }: FeaturedResultsRowProps) {
  if (items.length === 0) return null;

  return (
    <section className="mb-5" aria-label="Featured listings">
      {/* Header */}
      <div className="mb-2 flex items-center gap-1.5">
        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
        <span className="text-xs font-semibold uppercase tracking-wider text-amber-700">
          Featured
        </span>
      </div>

      {/* Cards — scroll on mobile, stack on desktop */}
      <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory lg:flex-wrap lg:overflow-visible lg:pb-0">
        {items.map((item) => (
          <div
            key={item.id}
            className="min-w-[280px] max-w-[340px] flex-shrink-0 snap-start rounded-lg border border-amber-200/60 bg-gradient-to-br from-amber-50/40 to-transparent"
          >
            {item.listing_type === "practitioner" && item.provider ? (
              <ProviderCard
                provider={item.provider}
                highlightModality={highlightModality}
                compact
              />
            ) : item.center ? (
              <CenterCard
                center={item.center}
                highlightModality={highlightModality}
                compact
              />
            ) : null}
          </div>
        ))}
      </div>

      {/* Divider */}
      <div className="mt-4 border-b border-border" />
    </section>
  );
}
