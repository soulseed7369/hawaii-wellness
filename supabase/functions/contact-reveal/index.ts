import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Allowed origins: production, www subdomain, and Vercel preview deployments
const ALLOWED_ORIGINS = [
  'https://hawaiiwellness.net',
  'https://www.hawaiiwellness.net',
];

function getCorsHeaders(origin: string | null): Record<string, string> {
  // If origin is from an allowed domain or a vercel preview, allow it
  if (origin) {
    if (ALLOWED_ORIGINS.includes(origin)) {
      return {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      };
    }
    // Allow vercel.app preview deployments
    if (origin.endsWith('.vercel.app')) {
      return {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      };
    }
  }

  // Fallback to production origin
  return {
    'Access-Control-Allow-Origin': 'https://hawaiiwellness.net',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

// Simple IP hash (no raw IPs stored)
async function hashIp(ip: string): Promise<string> {
  const data = new TextEncoder().encode(ip + (Deno.env.get('RATE_LIMIT_SALT') ?? 'hw-salt'));
  const hash = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const cors = getCorsHeaders(origin);

  // CORS preflight
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });

  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  const type = url.searchParams.get('type');
  const listingType = url.searchParams.get('listing_type') ?? 'practitioner';

  // Validate
  if (!id || !type || !['phone', 'email'].includes(type)
      || !['practitioner', 'center'].includes(listingType)) {
    return new Response(JSON.stringify({ error: 'Bad request' }), {
      status: 400, headers: { ...cors, 'Content-Type': 'application/json' }
    });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Rate limit: 10 reveals per IP per hour
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const ipHash = await hashIp(ip);
  const oneHourAgo = new Date(Date.now() - 3600000).toISOString();

  const { count } = await supabase
    .from('contact_reveals')
    .select('*', { count: 'exact', head: true })
    .eq('ip_hash', ipHash)
    .gte('created_at', oneHourAgo);

  if ((count ?? 0) >= 10) {
    return new Response(JSON.stringify({ error: 'Rate limit — try again later' }), {
      status: 429, headers: { ...cors, 'Content-Type': 'application/json' }
    });
  }

  // Fetch the contact field (only from published listings)
  const table = listingType === 'center' ? 'centers' : 'practitioners';
  const field = type === 'phone' ? 'phone' : 'email';

  const { data, error } = await supabase
    .from(table)
    .select(field)
    .eq('id', id)
    .eq('status', 'published')
    .single();

  if (error || !data) {
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404, headers: { ...cors, 'Content-Type': 'application/json' }
    });
  }

  // Log the reveal with error handling
  try {
    await supabase.from('contact_reveals').insert({
      listing_id: id, listing_type: listingType, reveal_type: type,
      ip_hash: ipHash,
    });
  } catch (insertError) {
    console.error('Failed to log contact reveal:', insertError);
    // Continue anyway — logging failure shouldn't block the reveal
  }

  return new Response(JSON.stringify({ value: (data as any)[field] }), {
    headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
});
