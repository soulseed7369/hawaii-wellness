import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

export async function GET() {
  const { data, error } = await supabase
    .from('centers')
    .select('id, updated_at')
    .eq('status', 'published')
    .order('updated_at', { ascending: false });

  if (error || !data) {
    return new NextResponse('Error generating sitemap', { status: 500 });
  }

  const urls = data.map(c => `
  <url>
    <loc>https://www.hawaiiwellness.net/center/${c.id}</loc>
    <lastmod>${c.updated_at?.substring(0, 10) ?? '2026-03-01'}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`).join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}
</urlset>`;

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=43200',
    },
  });
}
