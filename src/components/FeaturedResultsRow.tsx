import { Star, MapPin, CheckCircle, Building2 } from "lucide-react";
import { OptimizedImage } from "./OptimizedImage";
import { Link } from "react-router-dom";
import type { Provider, Center } from "@/data/mockData";
import { isValidListingImage, avatarGradient, modalityBadgeClass } from "@/lib/cardUtils";

export interface FeaturedItem {
  id: string;
  listing_type: "practitioner" | "center";
  provider?: Provider;
  center?: Center;
}

interface FeaturedResultsRowProps {
  items: FeaturedItem[];
  highlightModality?: string;
  /** The active modality filter or search query — shown as bubble next to "Featured" */
  activeModality?: string;
}

/** Compact avatar fallback */
function MiniAvatar({ name, type }: { name: string; type: "practitioner" | "center" }) {
  const { gradient, textColor } = avatarGradient(name);
  return (
    <div className={`flex items-center justify-center bg-gradient-to-br ${gradient} ${textColor} h-11 w-11 rounded-full flex-shrink-0`}>
      {type === "center"
        ? <Building2 className="h-4 w-4 opacity-80" />
        : <span className="text-xs font-semibold">{name.split(" ").filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join("")}</span>
      }
    </div>
  );
}

/**
 * Renders up to 3 featured listings as compact horizontal cards.
 * Always horizontal — scrollable on mobile, flex row on desktop.
 */
export function FeaturedResultsRow({ items, highlightModality, activeModality }: FeaturedResultsRowProps) {
  if (items.length === 0) return null;

  // Find a matched modality to show in the header bubble
  // Priority: active modality filter > search query match from first featured item
  const headerModality = activeModality?.trim() || null;

  return (
    <section className="mb-4" aria-label="Featured listings">
      {/* Header — star + "Featured" + optional modality bubble */}
      <div className="mb-2 flex items-center gap-1.5 flex-wrap">
        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
        <span className="text-xs font-semibold uppercase tracking-wider text-amber-700">
          Featured
        </span>
        {headerModality && (
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${modalityBadgeClass(headerModality)}`}>
            {headerModality}
          </span>
        )}
      </div>

      {/* Compact horizontal cards */}
      <div className="flex gap-2 overflow-x-auto pb-1 snap-x snap-mandatory scrollbar-thin">
        {items.map((item) => {
          const name = item.provider?.name || item.center?.name || "";
          const image = item.provider?.image || item.center?.image || "";
          const location = item.provider?.location || item.center?.location || "";
          const tier = item.provider?.tier || item.center?.tier || "free";
          const allModalities = item.provider?.modalities || item.center?.modalities || [];
          const primaryModality = allModalities[0] || item.provider?.modality || item.center?.modality || "";
          const hasImage = isValidListingImage(image);
          const isPremiumOrFeatured = tier === "premium" || tier === "featured";
          const linkTo = item.listing_type === "center"
            ? `/center/${item.id}`
            : `/profile/${item.id}`;

          // Show the modality count as credibility signal
          const modalityCount = allModalities.length;

          return (
            <Link
              key={item.id}
              to={linkTo}
              className="group snap-start flex-shrink-0 w-[210px] rounded-lg border border-amber-200 bg-gradient-to-br from-amber-50/50 to-white p-2.5 transition-all hover:shadow-md hover:scale-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex items-center gap-2.5">
                {/* Small circular avatar */}
                {hasImage ? (
                  <OptimizedImage
                    src={image}
                    alt={name}
                    width={44}
                    height={44}
                    className="h-11 w-11 flex-shrink-0 rounded-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <MiniAvatar name={name} type={item.listing_type} />
                )}

                {/* Name + check + location */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-0.5">
                    <p className="truncate text-sm font-semibold leading-tight group-hover:text-primary transition-colors">
                      {name}
                    </p>
                    {isPremiumOrFeatured && (
                      <CheckCircle className="h-3.5 w-3.5 flex-shrink-0 text-emerald-500" aria-label="Verified" />
                    )}
                  </div>
                  {location && (
                    <p className="flex items-center gap-0.5 text-[11px] text-muted-foreground mt-0.5">
                      <MapPin className="h-2.5 w-2.5 flex-shrink-0" />
                      <span className="truncate">{location.split(",")[0]}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Bottom row: primary modality + count */}
              <div className="mt-1.5 flex items-center gap-1 flex-wrap">
                {primaryModality && (
                  <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium leading-none ${modalityBadgeClass(primaryModality)}`}>
                    {primaryModality}
                  </span>
                )}
                {modalityCount > 1 && (
                  <span className="text-[10px] text-muted-foreground">+{modalityCount - 1} more</span>
                )}
              </div>
            </Link>
          );
        })}
      </div>

      {/* Divider */}
      <div className="mt-3 border-b border-border" />
    </section>
  );
}
