import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin } from "lucide-react";
import type { Provider } from "@/data/mockData";
import { Link } from "react-router-dom";

// ── Avatar fallback: initials on a gradient background ───────────────────────
const GRADIENT_PAIRS = [
  ["from-teal-400 to-cyan-500", "text-white"],
  ["from-emerald-400 to-green-500", "text-white"],
  ["from-violet-400 to-purple-500", "text-white"],
  ["from-amber-400 to-orange-500", "text-white"],
  ["from-rose-400 to-pink-500", "text-white"],
];

function AvatarFallback({ name, className }: { name: string; className?: string }) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
  const idx = name.charCodeAt(0) % GRADIENT_PAIRS.length;
  const [gradient, textColor] = GRADIENT_PAIRS[idx];
  return (
    <div className={`flex items-center justify-center bg-gradient-to-br ${gradient} font-semibold ${textColor} ${className}`}>
      {initials}
    </div>
  );
}

const SESSION_TYPE_LABELS: Record<string, string> = {
  in_person: "In Person",
  online: "Online",
  both: "In Person & Online",
};

interface ProviderCardProps {
  provider: Provider;
}

export function ProviderCard({ provider }: ProviderCardProps) {
  const displayModalities = provider.modalities ?? (provider.modality ? [provider.modality] : []);
  const visibleModalities = displayModalities.slice(0, 3);
  const extraCount = displayModalities.length - visibleModalities.length;
  const hasImage = !!provider.image && !provider.image.includes("no%20image") && !provider.image.includes("no image");

  return (
    <Link to={`/profile/${provider.id}`} className="block group focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg">
      <Card className="overflow-hidden transition-all duration-200 group-hover:shadow-md group-hover:scale-[1.01]">
        <div className="flex gap-4 p-4">
          {/* Avatar */}
          {hasImage ? (
            <img
              src={provider.image}
              alt={`Photo of ${provider.name}`}
              className="h-20 w-20 flex-shrink-0 rounded-lg object-cover"
              loading="lazy"
            />
          ) : (
            <AvatarFallback name={provider.name} className="h-20 w-20 flex-shrink-0 rounded-lg text-xl" />
          )}

          {/* Info */}
          <div className="min-w-0 flex-1">
            <h3 className="mb-0.5 truncate font-display text-base font-semibold group-hover:text-primary transition-colors">
              {provider.name}
            </h3>
            {provider.businessName && (
              <p className="mb-1 truncate text-sm text-muted-foreground">
                {provider.businessName}
              </p>
            )}

            {/* Location */}
            <div className="mb-2 flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
              <span className="sr-only">Location: </span>
              <span className="truncate">{provider.location}</span>
            </div>

            {/* Modality pills */}
            {visibleModalities.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1" role="list" aria-label="Modalities">
                {visibleModalities.map((m) => (
                  <Badge key={m} variant="secondary" className="text-xs font-normal" role="listitem">
                    {m}
                  </Badge>
                ))}
                {extraCount > 0 && (
                  <Badge variant="outline" className="text-xs font-normal">
                    +{extraCount} more
                  </Badge>
                )}
              </div>
            )}

            {/* Session type + accepting badge row */}
            <div className="flex flex-wrap items-center gap-1.5">
              {provider.sessionType && provider.sessionType !== 'in_person' && (
                <span className="text-xs text-muted-foreground">
                  {SESSION_TYPE_LABELS[provider.sessionType] ?? provider.sessionType}
                </span>
              )}
              {provider.acceptsNewClients === true && (
                <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Accepting Clients
                </span>
              )}
              {provider.acceptsNewClients === false && (
                <span className="text-xs text-muted-foreground/60">Not accepting</span>
              )}
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}
