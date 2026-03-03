import { useParams, Link } from "react-router-dom";
import { usePractitioner } from "@/hooks/usePractitioner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle, MapPin, Phone, Mail, Globe, ExternalLink, ArrowLeft, Quote, Flag } from "lucide-react";
import { usePageMeta } from "@/hooks/usePageMeta";

const ProfileDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { data: p, isLoading } = usePractitioner(id);

  usePageMeta(
    p ? p.name : "Practitioner Profile",
    p?.about ?? "View practitioner profile and services on Hawa'i Wellness."
  );

  if (isLoading) {
    return (
      <main>
        <section className="relative">
          <Skeleton className="h-48 w-full md:h-64" />
          <div className="container">
            <div className="flex flex-col gap-4 pb-6 pt-4 md:flex-row md:gap-6">
              <Skeleton className="-mt-16 h-32 w-32 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-4 w-48" />
              </div>
            </div>
          </div>
        </section>
        <section className="container grid gap-8 py-8 lg:grid-cols-3">
          <div className="space-y-8 lg:col-span-2">
            <Skeleton className="h-32 w-full rounded-xl" />
            <Skeleton className="h-48 w-full rounded-xl" />
          </div>
          <Skeleton className="h-64 w-full rounded-xl" />
        </section>
      </main>
    );
  }

  if (!p) {
    return (
      <div className="container py-20 text-center">
        <h1 className="font-display text-2xl font-bold">Profile not found</h1>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/directory">Back to Directory</Link>
        </Button>
      </div>
    );
  }

  const isClaimed = !!p.ownerId;

  return (
    <main>
      {/* Hero */}
      <section className="relative">
        <div className="h-48 overflow-hidden md:h-64">
          <img src={p.coverImage} alt="Cover" className="h-full w-full object-cover" />
        </div>
        <div className="container relative">
          <div className="flex flex-col items-start gap-4 pb-6 pt-0 md:flex-row md:items-end md:gap-6">
            <img
              src={p.profileImage}
              alt={p.name}
              className="-mt-16 h-32 w-32 rounded-xl border-4 border-background object-cover shadow-lg"
            />
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-2xl font-bold md:text-3xl">{p.name}</h1>
                {p.verified && (
                  <Badge className="gap-1 bg-sage text-white">
                    <CheckCircle className="h-3 w-3" /> Verified
                  </Badge>
                )}
                {p.acceptingClients && (
                  <Badge variant="secondary">Accepting New Clients</Badge>
                )}
              </div>
              <p className="mt-1 text-muted-foreground">{p.title}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="container grid gap-8 py-8 lg:grid-cols-3">
        {/* Left - Main Content */}
        <div className="space-y-8 lg:col-span-2">
          {p.about && (
            <div>
              <h2 className="mb-3 font-display text-xl font-bold">About</h2>
              <p className="leading-relaxed text-muted-foreground">{p.about}</p>
            </div>
          )}

          {p.services.length > 0 && (
            <div>
              <h2 className="mb-3 font-display text-xl font-bold">Services &amp; Modalities</h2>
              <ul className="grid gap-2 sm:grid-cols-2">
                {p.services.map((service) => (
                  <li key={service} className="flex items-center gap-2 text-sm">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                    {service}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {p.gallery.length > 0 && (
            <div>
              <h2 className="mb-3 font-display text-xl font-bold">Gallery</h2>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {p.gallery.map((img, i) => (
                  <img
                    key={i}
                    src={img}
                    alt={`Gallery ${i + 1}`}
                    className="aspect-[4/3] rounded-lg object-cover"
                    loading="lazy"
                  />
                ))}
              </div>
            </div>
          )}

          {/* Testimonials */}
          {p.testimonials.length > 0 && (
            <div>
              <h2 className="mb-4 font-display text-xl font-bold">What Clients Say</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {p.testimonials.map((t, i) => (
                  <Card key={i} className="bg-secondary/30">
                    <CardContent className="p-4">
                      <Quote className="mb-2 h-5 w-5 text-primary/40" />
                      <p className="mb-3 text-sm leading-relaxed text-muted-foreground">
                        {t.text}
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{t.author}</span>
                        {t.date && (
                          <span className="text-xs text-muted-foreground">{t.date}</span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar */}
        <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardContent className="p-0">
              <div className="flex h-40 items-center justify-center rounded-t-lg bg-ocean-light">
                <MapPin className="h-8 w-8 text-ocean" />
              </div>
              <div className="space-y-3 p-4">
                {p.address && <p className="text-sm font-medium">{p.address}</p>}
                <div className="space-y-2 text-sm text-muted-foreground">
                  {p.phone && (
                    <a href={`tel:${p.phone}`} className="flex items-center gap-2 hover:text-foreground">
                      <Phone className="h-4 w-4" /> {p.phone}
                    </a>
                  )}
                  {p.email && (
                    <a href={`mailto:${p.email}`} className="flex items-center gap-2 hover:text-foreground">
                      <Mail className="h-4 w-4" /> {p.email}
                    </a>
                  )}
                  {p.website && (
                    <a href={p.website} className="flex items-center gap-2 hover:text-foreground" target="_blank" rel="noopener noreferrer">
                      <Globe className="h-4 w-4" /> Website
                    </a>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {p.externalBookingUrl ? (
            <Button className="w-full gap-2" size="lg" asChild>
              <a href={p.externalBookingUrl} target="_blank" rel="noopener noreferrer">
                Book / Request Appointment
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          ) : (
            <Button className="w-full gap-2" size="lg" asChild>
              <Link to="/list-your-practice">
                <ArrowLeft className="h-4 w-4 rotate-180" />
                Contact Practitioner
              </Link>
            </Button>
          )}

          {/* Claim this listing */}
          {!isClaimed && (
            <Card className="border-dashed border-muted-foreground/30 bg-muted/30">
              <CardContent className="p-4 text-center">
                <Flag className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
                <p className="mb-1 text-sm font-medium">Is this your practice?</p>
                <p className="mb-3 text-xs text-muted-foreground">
                  Claim this listing to manage your profile, add photos, and respond to clients.
                </p>
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="w-full"
                >
                  <Link to={`/auth?claim=${id}`}>
                    Claim this listing
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </section>
    </main>
  );
};

export default ProfileDetail;
