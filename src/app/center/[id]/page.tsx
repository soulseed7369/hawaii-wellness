import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getCenter } from '@/lib/ssr';
import { SITE_NAME, SITE_URL } from '@/lib/siteConfig';

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const c = await getCenter(id);
  if (!c) return { title: 'Wellness Center Not Found' };

  const description = `${c.name} — ${c.centerTypeLabel} in Hawaiʻi. View services, hours, and contact info.`;

  return {
    title: c.name,
    description,
    openGraph: {
      title: c.name,
      description,
      type: 'profile',
      url: `${SITE_URL}/center/${c.id}`,
      images: c.photos?.[0] ? [c.photos[0]] : c.profileImage ? [c.profileImage] : undefined,
    },
  };
}

export default async function CenterPage({ params }: Props) {
  const { id } = await params;
  const c = await getCenter(id);
  if (!c) notFound();

  const displayIsland = c.island
    ? c.island.replace('_', ' ').replace(/\b\w/g, (ch: string) => ch.toUpperCase())
    : null;

  const localBusinessSchema = {
    '@context': 'https://schema.org',
    '@type': 'HealthAndBeautyBusiness',
    name: c.name,
    description: c.about || undefined,
    image: c.photos?.[0] || c.profileImage || undefined,
    address: c.address
      ? { '@type': 'PostalAddress', streetAddress: c.address, addressRegion: 'HI', addressCountry: 'US' }
      : undefined,
    geo: c.lat && c.lng ? { '@type': 'GeoCoordinates', latitude: c.lat, longitude: c.lng } : undefined,
    url: c.website || `${SITE_URL}/center/${c.id}`,
    knowsAbout: c.modalities,
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Directory', item: `${SITE_URL}/directory` },
      { '@type': 'ListItem', position: 3, name: c.name, item: `${SITE_URL}/center/${c.id}` },
    ],
  };

  const coverImage = c.photos?.[0] || null;

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
          <li className="text-foreground font-medium">{c.name}</li>
        </ol>
      </nav>

      {/* Cover photo */}
      {coverImage && (
        <div className="mb-8 overflow-hidden rounded-xl">
          <img
            src={coverImage}
            alt={c.name}
            className="w-full object-cover"
            style={{ maxHeight: '320px' }}
            loading="eager"
          />
        </div>
      )}

      {/* Center header */}
      <div className="flex flex-col sm:flex-row gap-6 mb-8">
        {c.profileImage && !coverImage && (
          <img
            src={c.profileImage}
            alt={c.name}
            className="h-28 w-28 shrink-0 rounded-full object-cover"
            loading="eager"
          />
        )}
        <div className="flex-1">
          <h1 className="mb-1 font-display text-3xl font-bold">{c.name}</h1>
          {c.centerTypeLabel && (
            <p className="mb-2 text-muted-foreground">{c.centerTypeLabel}</p>
          )}
          <div className="flex flex-wrap gap-2 text-sm">
            {displayIsland && (
              <span className="rounded-full bg-muted px-3 py-1">{displayIsland}</span>
            )}
            {c.location && c.location !== displayIsland && (
              <span className="rounded-full bg-muted px-3 py-1">{c.location}</span>
            )}
            {c.acceptsNewClients && (
              <span className="rounded-full bg-green-100 text-green-800 px-3 py-1">
                Accepting New Clients
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Modality pills */}
      {c.modalities && c.modalities.length > 0 && (
        <div className="mb-8 flex flex-wrap gap-2">
          {c.modalities.map((mod: string) => (
            <Link
              key={mod}
              href={`/directory?island=${c.island ?? ''}&modality=${encodeURIComponent(mod)}`}
              className="rounded-full border border-border bg-card px-3 py-1 text-sm hover:bg-accent transition-colors"
            >
              {mod}
            </Link>
          ))}
        </div>
      )}

      {/* Description */}
      {c.about && (
        <section className="mb-8">
          <h2 className="mb-3 font-display text-xl font-semibold">About</h2>
          <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
            {c.about}
          </p>
        </section>
      )}

      {/* Contact */}
      <section className="mb-8 rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 font-display text-xl font-semibold">Contact</h2>
        <dl className="space-y-2 text-sm">
          {c.website && (
            <div className="flex gap-2">
              <dt className="w-20 shrink-0 text-muted-foreground">Website</dt>
              <dd><a href={c.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{c.website.replace(/^https?:\/\//, '')}</a></dd>
            </div>
          )}
          {c.address && (
            <div className="flex gap-2">
              <dt className="w-20 shrink-0 text-muted-foreground">Location</dt>
              <dd className="text-foreground">{c.address}</dd>
            </div>
          )}
          {/* Phone/email revealed client-side in the SPA via ContactReveal */}
        </dl>
      </section>

      {/* Back to directory */}
      <Link
        href={`/directory${c.island ? `?island=${c.island}` : ''}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        ← Back to Directory
      </Link>
    </div>
  );
}
