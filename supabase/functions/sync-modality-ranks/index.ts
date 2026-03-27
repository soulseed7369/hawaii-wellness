/**
 * sync-modality-ranks/index.ts
 * Supabase Edge Function — syncs practitioner/center modalities to listing_modalities join table
 * with tier-based search limits.
 *
 * Deploy:
 *   supabase functions deploy sync-modality-ranks
 *
 * Request body:
 *   {
 *     listing_id: uuid,
 *     listing_type: 'practitioner' | 'center',
 *     modalities: string[],  -- ordered array of modality labels
 *     tier: 'free' | 'premium' | 'featured'
 *   }
 *
 * Logic:
 *   1. Fetch all modality taxonomy terms by label (axis=modality)
 *   2. Map each modality label to its term ID
 *   3. Insert to listing_modalities with rank based on array order
 *   4. Only insert top N based on tier:
 *      - free: top 2
 *      - premium: top 5
 *      - featured: all
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

interface SyncModalityRanksRequest {
  listing_id: string;
  listing_type: 'practitioner' | 'center';
  modalities: string[];
  tier: 'free' | 'premium' | 'featured';
}

function getTierLimit(tier: string): number {
  switch (tier) {
    case 'featured': return Infinity; // all
    case 'premium': return 5;
    case 'free': return 2;
    default: return 2;
  }
}

async function getModalityTermsByLabel(): Promise<Record<string, number>> {
  // Fetch the modality axis first
  const { data: axis, error: axisError } = await supabase
    .from('taxonomy_axes')
    .select('id')
    .eq('slug', 'modality')
    .maybeSingle();

  if (axisError) {
    throw new Error(`Failed to fetch modality axis: ${axisError.message}`);
  }

  if (!axis) {
    throw new Error('Modality axis not found in taxonomy_axes');
  }

  // Fetch all modality terms from the modality axis
  const { data: terms, error: termsError } = await supabase
    .from('taxonomy_terms')
    .select('id, label')
    .eq('axis_id', axis.id);

  if (termsError) {
    throw new Error(`Failed to fetch modality terms: ${termsError.message}`);
  }

  // Build a map: lowercase label → term_id
  const labelMap: Record<string, number> = {};
  if (terms) {
    for (const term of terms) {
      labelMap[term.label.toLowerCase()] = term.id;
    }
  }

  return labelMap;
}

async function syncModalities(req: SyncModalityRanksRequest): Promise<void> {
  const tierLimit = getTierLimit(req.tier);
  const labelMap = await getModalityTermsByLabel();

  // Map modality labels to term IDs, respecting tier limit
  const toInsert = [];
  const skipped: string[] = [];

  for (let i = 0; i < req.modalities.length && i < tierLimit; i++) {
    const modalityLabel = req.modalities[i].trim();
    const termId = labelMap[modalityLabel.toLowerCase()];

    if (termId) {
      toInsert.push({
        listing_id: req.listing_id,
        listing_type: req.listing_type,
        term_id: termId,
        rank: i + 1, // rank = position in array (1-indexed)
        is_primary: i === 0, // first modality is primary
      });
    } else {
      skipped.push(modalityLabel);
    }
  }

  // Log any modalities that exceed tier limit (not inserted, but still valid)
  if (req.modalities.length > tierLimit) {
    const excess = req.modalities.slice(tierLimit).map(m => m.trim());
    console.log(
      `Modality rank cap: tier=${req.tier} limit=${tierLimit}, will not index modalities: ${excess.join(', ')}`
    );
  }

  if (skipped.length > 0) {
    console.warn(
      `Unmatched modality labels (not found in taxonomy): ${skipped.join(', ')}`
    );
  }

  // Insert rows
  if (toInsert.length > 0) {
    const { error: insertError } = await supabase
      .from('listing_modalities')
      .insert(toInsert);

    if (insertError) {
      throw new Error(`Failed to insert modality ranks: ${insertError.message}`);
    }
  }

  console.log(
    `Synced ${toInsert.length}/${req.modalities.length} modalities (tier=${req.tier}, limit=${tierLimit})`
  );
}

async function validateOwnership(
  userId: string,
  listing_id: string,
  listing_type: string
): Promise<boolean> {
  const tableName = listing_type === 'center' ? 'centers' : 'practitioners';
  const { data, error } = await supabase
    .from(tableName)
    .select('id')
    .eq('id', listing_id)
    .eq('owner_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to validate ownership: ${error.message}`);
  }

  return !!data;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const body: SyncModalityRanksRequest = await req.json();

    // Validate request
    if (!body.listing_id || !body.listing_type || !body.modalities || !body.tier) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate modalities array
    if (!Array.isArray(body.modalities) || body.modalities.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Modalities must be a non-empty array' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Extract and validate user from JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid authorization' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.slice(7);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verify ownership before syncing
    const isOwner = await validateOwnership(user.id, body.listing_id, body.listing_type);
    if (!isOwner) {
      return new Response(
        JSON.stringify({ error: 'Not authorized to sync modalities for this listing' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    await syncModalities(body);

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Error in sync-modality-ranks:', message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
