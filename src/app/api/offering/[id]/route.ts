import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

const SITE = 'https://www.hawaiiwellness.net';

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
  { params }: { params: { id: string } }
) {
  const { id } = params;
  if (!id) return new NextResponse('Missing id', { status: 400 });

  // Join offering with its practitioner
  const { data: offering, error } = await supabase
    .from('offerings')
    .select(`
      id, title, description, offering_type,
      price_mode, price_fixed, price_min, price_max,
      start_date, end_date, location, registration_url,
      max_spots, image_url,
      practitioner_id,
      practitioners!practitioner_id(id, name, island, city, avatar_url)
    `)
    .eq('id', id)
    .eq('status', 'published')
    .single();

  if (error || !offering) return new NextResponse('Offering not found', { status: 404 });

  // Extract practitioner from the joined object
  const practitioner = Array.isArray(offering.practitioners)
    ? offering.practitioners[0]
    : (offering.practitioners as {
        id: string;
        name: string;
        island: string;
        city: string | null;
        avatar_url: string | null;
      } | null);

  if (!practitioner) return new NextResponse('Practitioner not found', { status: 404 });

  const offeringUrl = `${SITE}/api/offering/${offering.id}`;
  const practitionerUrl = `${SITE}/api/profile/${practitioner.id}`;

  // Build price string
  let priceStr = '';
  if (offering.price_mode === 'fixed' && offering.price_fixed != null) {
    priceStr = `$${offering.price_fixed}`;
  } else if (offering.price_mode === 'range' && offering.price_min != null) {
    priceStr = `$${offering.price_min}${offering.price_max ? '–$' + offering.price_max : '+'}`;
  } else if (offering.price_mode === 'free') {
    priceStr = 'Free';
  } else if (offering.price_mode === 'donation') {
    priceStr = 'Donation-based';
  }

  // Format dates
  const startLabel = offering.start_date
    ? new Date(offering.start_date).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;
  const endLabel = offering.end_date
    ? new Date(offering.end_date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;

  const title = `${escapeHtml(offering.title)} — ${escapeHtml(practitioner.name)} | Hawaiʻi Wellness`;
  const desc = escapeHtml((offering.description ?? '').substring(0, 155));

  // Event JSON-LD schema
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: offering.title,
    description: offering.description ?? undefined,
    url: offeringUrl,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    organizer: {
      '@type': 'Person',
      name: practitioner.name,
      url: practitionerUrl,
    },
    location: {
      '@type': 'Place',
      name: offering.location || practitioner.city || 'Hawaiʻi',
      address: {
        '@type': 'PostalAddress',
        addressLocality: practitioner.city ?? undefined,
        addressRegion: 'HI',
        addressCountry: 'US',
      },
    },
  };

  if (offering.start_date) schema.startDate = offering.start_date;
  if (offering.end_date) schema.endDate = offering.end_date;
  if (offering.image_url) schema.image = offering.image_url;
  if (offering.max_spots != null) schema.maximumAttendeeCapacity = offering.max_spots;

  if (offering.price_mode !== 'free' && offering.price_fixed != null) {
    schema.offers = {
      '@type': 'Offer',
      price: String(offering.price_fixed),
      priceCurrency: 'USD',
      url: offering.registration_url ?? offeringUrl,
      availability: 'https://schema.org/InStock',
    };
  } else if (offering.price_mode === 'free') {
    schema.offers = {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      url: offering.registration_url ?? offeringUrl,
    };
  }

  const typeLabel =
    (offering.offering_type as string).charAt(0).toUpperCase() +
    (offering.offering_type as string).slice(1).replace('_', ' ');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <meta name="description" content="${desc}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${offeringUrl}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${desc}">
  <meta property="og:url" content="${offeringUrl}">
  <meta property="og:type" content="event">
  ${offering.image_url ? `<meta property="og:image" content="${offering.image_url}">` : ''}
  <meta name="geo.region" content="US-HI">
  <script type="application/ld+json">${JSON.stringify(schema)}</script>
</head>
<body>
  <nav><a href="${SITE}">Home</a> / <a href="${practitionerUrl}">${escapeHtml(practitioner.name)}</a> / ${escapeHtml(offering.title)}</nav>
  <h1>${escapeHtml(offering.title)}</h1>
  <p>${escapeHtml(typeLabel)} hosted by <a href="${practitionerUrl}">${escapeHtml(practitioner.name)}</a></p>
  ${startLabel ? `<p>Dates: ${escapeHtml(startLabel)}${endLabel ? ` – ${escapeHtml(endLabel)}` : ''}</p>` : ''}
  ${priceStr ? `<p>Price: ${escapeHtml(priceStr)}</p>` : ''}
  ${offering.location ? `<p>Location: ${escapeHtml(offering.location)}</p>` : ''}
  ${offering.description ? `<p>${escapeHtml(offering.description)}</p>` : ''}
  ${offering.max_spots != null ? `<p>Capacity: ${offering.max_spots} spots</p>` : ''}
  ${offering.registration_url ? `<p><a href="${offering.registration_url}">Register / Learn more</a></p>` : ''}
  <p><a href="${practitionerUrl}">View ${escapeHtml(practitioner.name)}'s full profile</a></p>
  <p><a href="${SITE}/directory">Browse all practitioners</a> · <a href="${SITE}">Hawaiʻi Wellness</a></p>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=1800',
    },
  });
}
