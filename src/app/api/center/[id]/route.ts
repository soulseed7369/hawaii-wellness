import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

const SITE = 'https://www.hawaiiwellness.net';
const ISLAND_LABEL: Record<string, string> = {
  big_island: 'Big Island', maui: 'Maui', oahu: 'Oʻahu', kauai: 'Kauaʻi',
};
const CENTER_TYPE_LABEL: Record<string, string> = {
  spa: 'Spa', wellness_center: 'Wellness Center', clinic: 'Clinic',
  retreat_center: 'Retreat Center', fitness_center: 'Fitness Center',
};

// Profile completeness calculation
function calcCompleteness(c: {
  name?: string | null;
  description?: string | null;
  photo_url?: string | null;
  modalities?: string[] | null;
  city?: string | null;
  island?: string | null;
  session_type?: string | null;
  website_url?: string | null;
}): number {
  return [
    { weight: 15, pass: !!c.name },
    { weight: 20, pass: !!c.description && c.description.trim().length > 20 },
    { weight: 15, pass: !!c.photo_url },
    { weight: 15, pass: !!c.modalities && c.modalities.length > 0 },
    { weight: 10, pass: !!c.city },
    { weight: 10, pass: !!c.session_type },
    { weight: 10, pass: !!c.website_url },
    { weight: 5, pass: !!c.island },
  ].reduce((sum, item) => sum + (item.pass ? item.weight : 0), 0);
}

function escapeHtml(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) return new NextResponse('Missing id', { status: 400 });

  // Select ONLY non-PII fields
  const { data: c, error } = await supabase
    .from('centers')
    .select(`
      id, name, description, modalities, city, island, address,
      website_url, center_type, working_hours,
      lat, lng, photo_url, tier, session_type, testimonials
    `)
    .eq('id', id)
    .eq('status', 'published')
    .single();

  if (error || !c) return new NextResponse('Not found', { status: 404 });

  const centerUrl = `${SITE}/center/${c.id}`;
  const islandName = ISLAND_LABEL[c.island] ?? 'Hawaiʻi';
  const islandSlug = c.island?.replace('_', '-') ?? 'hawaii';
  const centerTypeLabel = escapeHtml(CENTER_TYPE_LABEL[c.center_type] ?? 'Wellness Center');
  const topModality = escapeHtml(c.modalities?.[0] ?? 'Wellness');
  const title = `${escapeHtml(c.name)} — ${centerTypeLabel} in ${escapeHtml(c.city ?? islandName)} | Hawaiʻi Wellness`;
  const desc = escapeHtml((c.description ?? '').substring(0, 155));

  // Profile completeness gate
  const completeness = calcCompleteness(c);
  const robotsMeta = completeness >= 60 ? 'index, follow' : 'noindex, nofollow';

  // Breadcrumb schema
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: 'Directory', item: `${SITE}/directory` },
      { '@type': 'ListItem', position: 3, name: islandName, item: `${SITE}/${islandSlug}` },
      { '@type': 'ListItem', position: 4, name: centerTypeLabel, item: `${SITE}/directory?island=${c.island}` },
      { '@type': 'ListItem', position: 5, name: c.name, item: centerUrl },
    ],
  };

  // HealthAndBeautyBusiness schema (no telephone, no email)
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': ['HealthAndBeautyBusiness', 'LocalBusiness'],
    name: c.name,
    description: c.description ?? undefined,
    url: centerUrl,
    image: c.photo_url ?? undefined,
    address: c.address ? {
      '@type': 'PostalAddress',
      streetAddress: c.address,
      addressLocality: c.city,
      addressRegion: 'HI',
      addressCountry: 'US',
    } : undefined,
    geo: c.lat && c.lng ? {
      '@type': 'GeoCoordinates',
      latitude: c.lat, longitude: c.lng,
    } : undefined,
    areaServed: `${c.city ?? ''}, ${islandName}, Hawaii`,
    knowsAbout: c.modalities ?? [],
    breadcrumb: breadcrumbSchema,
  };

  // Testimonial/review enrichment
  const testimonials = Array.isArray(c.testimonials)
    ? c.testimonials as Array<{ text: string; author: string; date?: string; rating?: number }>
    : [];
  if (testimonials.length > 0) {
    schema.review = testimonials.map(t => ({
      '@type': 'Review',
      author: { '@type': 'Person', name: t.author || 'Anonymous' },
      reviewBody: t.text,
      ...(t.date ? { datePublished: t.date } : {}),
      reviewRating: {
        '@type': 'Rating',
        ratingValue: t.rating ?? 5,
        bestRating: 5,
      },
    }));
    schema.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: String(
        Math.round(testimonials.reduce((s, t) => s + (t.rating ?? 5), 0) / testimonials.length * 10) / 10
      ),
      reviewCount: String(testimonials.length),
    };
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <meta name="description" content="${desc}">
  <meta name="robots" content="${robotsMeta}">
  <link rel="canonical" href="${centerUrl}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${desc}">
  <meta property="og:url" content="${centerUrl}">
  <meta property="og:type" content="place">
  ${c.photo_url ? `<meta property="og:image" content="${c.photo_url}">` : ''}
  <meta name="geo.region" content="US-HI">
  <script type="application/ld+json">${JSON.stringify(schema)}</script>
</head>
<body>
  <h1>${escapeHtml(c.name)}</h1>
  <p>${centerTypeLabel} in ${escapeHtml(c.city ?? islandName)}, Hawaiʻi</p>
  ${c.description ? `<p>${escapeHtml(c.description)}</p>` : ''}
  ${c.modalities?.length ? `<p>Services: ${c.modalities.map(escapeHtml).join(', ')}</p>` : ''}
  ${c.city ? `<p>Location: ${escapeHtml(c.city)}, ${escapeHtml(islandName)}</p>` : ''}
  ${c.session_type ? `<p>Sessions: ${escapeHtml(c.session_type.replace('_', ' '))}</p>` : ''}
  ${c.website_url ? `<p><a href="${c.website_url}">Visit website</a></p>` : ''}
  <p><a href="${SITE}/directory">Browse all wellness centers</a></p>
  <p>© Hawaiʻi Wellness — <a href="${SITE}">hawaiiwellness.net</a></p>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=43200',
    },
  });
}
