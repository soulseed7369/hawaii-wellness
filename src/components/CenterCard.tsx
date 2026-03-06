import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin } from "lucide-react";
import type { Center } from "@/data/mockData";
import { Link } from "react-router-dom";

interface CenterCardProps {
  center: Center;
}

export function CenterCard({ center }: CenterCardProps) {
  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-md">
      <div className="flex gap-4 p-4">
        <img
          src={center.image}
          alt={`Photo of ${center.name}`}
          className="h-24 w-24 flex-shrink-0 rounded-lg object-cover"
          loading="lazy"
        />
        <div className="min-w-0 flex-1">
          <p className="mb-0.5 text-xs font-medium uppercase tracking-wider text-sage">
            {center.modality}
          </p>
          <h3 className="mb-1 truncate font-display text-base font-semibold">
            {center.name}
          </h3>
          <div className="mb-2 flex items-center gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="sr-only">Location: </span>
              {center.location}
            </span>
          </div>
          <div className="mb-3 flex flex-wrap gap-1.5" role="list" aria-label="Services">
            {center.services.slice(0, 3).map((s) => (
              <Badge key={s} variant="secondary" className="text-xs font-normal" role="listitem">
                {s}
              </Badge>
            ))}
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link
              to={`/profile/${center.id}`}
              aria-label={`View center profile for ${center.name}`}
            >
              View Center
            </Link>
          </Button>
        </div>
      </div>
    </Card>
  );
}
