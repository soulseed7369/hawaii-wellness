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

const Index = () => {
  usePageMeta("Hawaiʻi Big Island Wellness Directory", "Discover top practitioners and wellness centers on the Big Island of Hawaiʻi. Browse holistic health providers and book through external links.");
  const { data: practitioners = [], isLoading: loadingPractitioners } = usePractitioners();
  const { data: centers = [], isLoading: loadingCenters } = useCenters();
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
      <SearchBar />

      {/* Practitioners */}
      <section className="container py-12">
        <h2 className="mb-6 font-display text-2xl font-bold md:text-3xl">
          Local Practitioners
        </h2>
        <div className="px-12">
          {loadingPractitioners ? (
            <div className="flex gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-48 w-56 flex-shrink-0 rounded-xl" />
              ))}
            </div>
          ) : (
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
          )}
        </div>
      </section>

      {/* Wellness Centers */}
      <section className="bg-secondary/30 py-12">
        <div className="container">
          <h2 className="mb-6 font-display text-2xl font-bold md:text-3xl">
            Wellness Centers &amp; Clinics
          </h2>
          <div className="px-12">
            {loadingCenters ? (
              <div className="flex gap-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-48 w-64 flex-shrink-0 rounded-xl" />
                ))}
              </div>
            ) : (
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
            )}
          </div>
        </div>
      </section>

      {/* Latest Articles */}
      <section className="container py-12">
        <h2 className="mb-6 font-display text-2xl font-bold md:text-3xl">
          Latest from the Big Island Health Scene
        </h2>
        <div className="px-12">
          {loadingArticles ? (
            <div className="flex gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-64 w-64 flex-shrink-0 rounded-xl" />
              ))}
            </div>
          ) : (
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
          )}
        </div>
      </section>
    </main>
  );
};

export default Index;
