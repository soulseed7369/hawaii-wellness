import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getPractitioner } from '@/lib/ssr';
import { SITE_NAME, SITE_URL } from '@/lib/siteConfig';

interface Props {
  params: { id: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await getPractitioner(params.id);
  if (!p) return { title: 'Practitioner Not Found' };

  const description = p.about
    ? p.about.slice(0, 155)
    : `${p.name} — ${p.services.slice(0, 3).join(', ')} practitioner in Hawaiʻi. View profile, services, and contact info.`;

  return {
    title: p.name,
    description,
    openGraph: {
      title: p.name,
      description,
      type: 'profile',
      url: `${SITE_URL}/profile/${p.id}`,
      images: p.profileImage ? [p.profileImage] : undefined,
    },
  };
}

export default async function ProfilePage({ params }: Props) {
  const p = await getPractitioner(params.id);
  if (!p) notFound();

  const displayIsland = p.island
    ? p.island.replace('_', ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
    : null;

  const localBusinessSchema = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: p.name,
    description: p.about || undefined,
    image: p.profileImage || undefined,
    address: p.address
      ? { '@type': 'PostalAddress', streetAddress: p.address, addressRegion: 'HI', addressCountry: 'US' }
      : undefined,
    geo: p.lat && p.lng ? { '@type': 'GeoCoordinates', latitude: p.lat, longitude: p.lng } : undefined,
    telephone: p.phone || undefined,
    url: p.website || `${SITE_URL}/profile/${p.id}`,
    knowsAbout: p.services,
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Directory', item: `${SITE_URL}/directory` },
      { '@type': 'ListItem', position: 3, name: p.name, item: `${SITE_URL}/profile/${p.id}` },
    ],
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      {/* Structured data */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />

      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="mb-8 text-sm text-muted-foreground">
        <ol className="flex items-center gap-1.5">
          <li><Link href="/" className="hover:text-foreground transition-colors">Home</Link></li>
          <li aria-hidden>/</li>
          <li><Link href="/directory" className="hover:text-foreground transition-colors">Directory</Link></li>
          <li aria-hidden>/</li>
          <li className="text-foreground font-medium">{p.name}</li>
        </ol>
      </nav>

      {/* Profile header */}
      <div className="flex flex-col sm:flex-row gap-6 mb-8">
        {p.profileImage && (
          <img
            src={p.profileImage}
            alt={p.name}
            className="h-28 w-28 shrink-0 rounded-full object-cover"
            loading="eager"
          />
        )}
        <div className="flex-1">
          <h1 className="mb-1 font-display text-3xl font-bold">{p.name}</h1>
          {p.businessName && (
            <p className="mb-2 text-muted-foreground">{p.businessName}</p>
          )}
          <div className="flex flex-wrap gap-2 text-sm">
            {displayIsland && (
              <span className="rounded-full bg-muted px-3 py-1">{displayIsland}</span>
            )}
            {p.location && p.location !== displayIsland && (
              <span className="rounded-full bg-muted px-3 py-1">{p.location}</span>
            )}
            {p.acceptingClients && (
              <span className="rounded-full bg-green-100 text-green-800 px-3 py-1">
                Accepting New Clients
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Modality pills */}
      {p.services.length > 0 && (
        <div className="mb-8 flex flex-wrap gap-2">
          {p.services.map((s: string) => (
            <Link
              key={s}
              href={`/directory?island=${p.island ?? ''}&modality=${encodeURIComponent(s)}`}
              className="rounded-full border border-border bg-card px-3 py-1 text-sm hover:bg-accent transition-colors"
            >
              {s}
            </Link>
          ))}
        </div>
      )}

      {/* Bio */}
      {p.about && (
        <section className="mb-8">
          <h2 className="mb-3 font-display text-xl font-semibold">About</h2>
          <p className="text-muted-foreground leading-relaxed whitespace-pre-line">{p.about}</p>
        </section>
      )}

      {/* Contact */}
      <section className="mb-8 rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 font-display text-xl font-semibold">Contact</h2>
        <dl className="space-y-2 text-sm">
          {p.website && (
            <div className="flex gap-2">
              <dt className="w-20 shrink-0 text-muted-foreground">Website</dt>
              <dd><a href={p.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{p.website.replace(/^https?:\/\//, '')}</a></dd>
            </div>
          )}
          {p.externalBookingUrl && (
            <div className="flex gap-2">
              <dt className="w-20 shrink-0 text-muted-foreground">Booking</dt>
              <dd><a href={p.externalBookingUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Book a Session</a></dd>
            </div>
          )}
          {p.address && (
            <div className="flex gap-2">
              <dt className="w-20 shrink-0 text-muted-foreground">Location</dt>
              <dd className="text-foreground">{p.address}</dd>
            </div>
          )}
        </dl>
      </section>

      {/* Back to directory */}
      <Link
        href={`/directory${p.island ? `?island=${p.island}` : ''}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        ← Back to Directory
      </Link>
    </div>
  );
}
