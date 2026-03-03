import { Link } from "react-router-dom";
import { SearchBar } from "@/components/SearchBar";
import { PractitionerCard } from "@/components/PractitionerCard";
import { CenterCard } from "@/components/CenterCard";
import { ArticleCard } from "@/components/ArticleCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { usePractitioners } from "@/hooks/usePractitioners";
import { useCenters } from "@/hooks/useCenters";
import { useArticles } from "@/hooks/useArticles";
import { usePageMeta } from "@/hooks/usePageMeta";

const QUICK_MODALITIES = [
  { label: "Massage", query: "massage" },
  { label: "Chiropractor", query: "chiropractic" },
  { label: "Energy Healing", query: "energy healing" },
  { label: "Acupuncture", query: "acupuncture" },
  { label: "Naturopathic", query: "naturopathic" },
];

export interface IslandConfig {
  island: string;            // DB key: 'big_island' | 'maui' | 'oahu' | 'kauai'
  displayName: string;       // e.g. 'Maui'
  heroImageUrl: string;      // full URL or local import path
  heroTitle: string;
  heroSubtitle: string;
  pageTitle: string;
  pageDescription: string;
}

interface IslandHomeProps {
  config: IslandConfig;
}

export function IslandHome({ config }: IslandHomeProps) {
  usePageMeta(config.pageTitle, config.pageDescription);

  const { data: practitioners = [], isLoading: loadingPractitioners } = usePractitioners(config.island);
  const { data: centers = [], isLoading: loadingCenters } = useCenters(config.island);
  const { data: articles = [], isLoading: loadingArticles } = useArticles();

  const practitionerCardData = practitioners.map((p) => ({
    id: p.id,
    name: p.name,
    image: p.image,
    modality: p.modality,
    location: p.location,
    rating: p.rating,
    verified: false,
    acceptingClients: true,
    lat: p.lat,
    lng: p.lng,
  }));

  const articleCardData = articles.slice(0, 3);

  return (
    <main>
      <SearchBar island={config.island} heroImageUrl={config.heroImageUrl} heroTitle={config.heroTitle} heroSubtitle={config.heroSubtitle} />

      {/* Modality quick links */}
      <div className="border-b border-border bg-background">
        <div className="container flex items-center gap-2 overflow-x-auto py-3 scrollbar-hide">
          <span className="flex-shrink-0 text-xs font-medium text-muted-foreground">Browse:</span>
          {QUICK_MODALITIES.map(({ label, query }) => (
            <Link
              key={label}
              to={`/directory?q=${encodeURIComponent(query)}&island=${config.island}`}
              className="flex-shrink-0 rounded-full border border-border bg-background px-4 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-primary hover:text-primary-foreground hover:border-primary"
            >
              {label}
            </Link>
          ))}
        </div>
      </div>

      {/* Practitioners */}
      <section className="container py-12">
        <h2 className="mb-6 font-display text-2xl font-bold md:text-3xl">
          {config.displayName} Practitioners
        </h2>
        <div className="px-12">
          {loadingPractitioners ? (
            <div className="flex gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-48 w-56 flex-shrink-0 rounded-xl" />
              ))}
            </div>
          ) : practitionerCardData.length > 0 ? (
            <Carousel opts={{ align: "start", loop: true }}>
              <CarouselContent>
                {practitionerCardData.map((practitioner) => (
                  <CarouselItem key={practitioner.id} className="basis-full sm:basis-1/2 lg:basis-1/3 xl:basis-1/4">
                    <PractitionerCard practitioner={practitioner} />
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious />
              <CarouselNext />
            </Carousel>
          ) : (
            <p className="text-muted-foreground text-sm py-8">No practitioners listed yet for {config.displayName}.</p>
          )}
        </div>
      </section>

      {/* Centers */}
      <section className="bg-secondary/30 py-12">
        <div className="container">
          <h2 className="mb-6 font-display text-2xl font-bold md:text-3xl">
            {config.displayName} Wellness Centers
          </h2>
          <div className="px-12">
            {loadingCenters ? (
              <div className="flex gap-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-48 w-64 flex-shrink-0 rounded-xl" />
                ))}
              </div>
            ) : centers.length > 0 ? (
              <Carousel opts={{ align: "start", loop: true }}>
                <CarouselContent>
                  {centers.map((center) => (
                    <CarouselItem key={center.id} className="basis-full sm:basis-1/2 lg:basis-1/3">
                      <CenterCard center={center} />
                    </CarouselItem>
                  ))}
                </CarouselContent>
                <CarouselPrevious />
                <CarouselNext />
              </Carousel>
            ) : (
              <p className="text-muted-foreground text-sm py-8">No wellness centers listed yet for {config.displayName}.</p>
            )}
          </div>
        </div>
      </section>

      {/* Articles */}
      <section className="container py-12">
        <h2 className="mb-6 font-display text-2xl font-bold md:text-3xl">
          Latest Wellness News
        </h2>
        <div className="px-12">
          {loadingArticles ? (
            <div className="flex gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-64 w-64 flex-shrink-0 rounded-xl" />
              ))}
            </div>
          ) : articleCardData.length > 0 ? (
            <Carousel opts={{ align: "start" }}>
              <CarouselContent>
                {articleCardData.map((article) => (
                  <CarouselItem key={article.id} className="basis-full sm:basis-1/2 lg:basis-1/3">
                    <ArticleCard article={article} />
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious />
              <CarouselNext />
            </Carousel>
          ) : (
            <p className="text-muted-foreground text-sm py-8">No articles yet.</p>
          )}
        </div>
      </section>
    </main>
  );
}
