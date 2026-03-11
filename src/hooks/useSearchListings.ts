import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { parseSearchQuery, AliasMap, SearchIntent, TaxonomyTerm } from '@/lib/parseSearchQuery';
import { useMemo } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────

export interface SearchParams {
  query?: string;
  island?: string;
  city?: string;
  modalities?: number[];
  concerns?: number[];
  approaches?: number[];
  formats?: number[];
  audiences?: number[];
  listingType?: 'practitioner' | 'center' | null;
  sessionType?: string;
  acceptsNew?: boolean;
  page?: number;
  pageSize?: number;
}

export interface SearchResult {
  id: string;
  listing_type: 'practitioner' | 'center';
  name: string;
  bio: string | null;
  photo_url: string | null;
  city: string | null;
  island: string | null;
  tier: string | null;
  modalities: string[] | null;
  session_type: string | null;
  accepts_new_clients: boolean | null;
  phone: string | null;
  email: string | null;
  website_url: string | null;
  external_booking_url: string | null;
  lat: number | null;
  lng: number | null;
  modality_labels: string[];
  concern_labels: string[];
  approach_labels: string[];
  fts_rank: number;
  embedding_score: number;
  taxonomy_score: number;
  composite_score: number;
  profile_completeness: number;
  total_count: number;
}

// ── useAliasMap ────────────────────────────────────────────────────────────

/**
 * Loads taxonomy terms + aliases on mount, builds a client-side AliasMap.
 * Cached indefinitely (staleTime: Infinity) — aliases rarely change.
 */
export function useAliasMap() {
  const { data, isLoading } = useQuery({
    queryKey: ['taxonomy-alias-map'],
    queryFn: async (): Promise<AliasMap> => {
      // Fetch all three tables in parallel
      const [axesRes, termsRes, aliasesRes] = await Promise.all([
        supabase.from('taxonomy_axes').select('id, slug'),
        supabase.from('taxonomy_terms').select('id, slug, label, axis_id'),
        supabase.from('taxonomy_aliases').select('alias, term_id'),
      ]);

      if (axesRes.error) throw axesRes.error;
      if (termsRes.error) throw termsRes.error;
      if (aliasesRes.error) throw aliasesRes.error;

      // Build axis ID → slug lookup
      const axisSlugById = new Map<number, string>();
      for (const a of axesRes.data) {
        axisSlugById.set(a.id, a.slug);
      }

      // Build term ID → TaxonomyTerm lookup
      const termById = new Map<number, TaxonomyTerm>();
      const aliasMap: AliasMap = new Map();

      for (const t of termsRes.data) {
        const axisSlug = axisSlugById.get(t.axis_id);
        if (!axisSlug) continue;
        // Only include axes we use for search facets
        if (!['modality', 'concern', 'approach', 'format', 'audience'].includes(axisSlug)) continue;

        const term: TaxonomyTerm = {
          id: t.id,
          slug: t.slug,
          label: t.label,
          axis: axisSlug as TaxonomyTerm['axis'],
        };
        termById.set(t.id, term);

        // Index by lowercased label
        aliasMap.set(t.label.toLowerCase(), term);
        // Index by slug (hyphens → spaces for matching)
        aliasMap.set(t.slug.replace(/-/g, ' '), term);
      }

      // Add aliases
      for (const a of aliasesRes.data) {
        const term = termById.get(a.term_id);
        if (term) {
          aliasMap.set(a.alias.toLowerCase(), term);
        }
      }

      return aliasMap;
    },
    staleTime: Infinity,
  });

  return { aliasMap: data, isLoading };
}

// ── useSearchListings ──────────────────────────────────────────────────────

/**
 * Calls the search_listings Supabase RPC with the given params.
 */
export function useSearchListings(params: SearchParams, enabled = true) {
  return useQuery({
    queryKey: ['search-listings', params],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('search_listings', {
        p_query: params.query || '',
        p_island: params.island || null,
        p_city: params.city || null,
        p_modalities: params.modalities?.length ? params.modalities : null,
        p_concerns: params.concerns?.length ? params.concerns : null,
        p_approaches: params.approaches?.length ? params.approaches : null,
        p_formats: params.formats?.length ? params.formats : null,
        p_audiences: params.audiences?.length ? params.audiences : null,
        p_listing_type: params.listingType || null,
        p_session_type: params.sessionType || null,
        p_accepts_new: params.acceptsNew ?? null,
        p_page: params.page ?? 0,
        p_page_size: params.pageSize ?? 20,
      });

      if (error) throw error;

      const results = (data || []) as SearchResult[];
      const totalCount = results.length > 0 ? results[0].total_count : 0;

      return { results, totalCount };
    },
    enabled,
    select: (data) => data,
  });
}

// ── useParsedSearch ────────────────────────────────────────────────────────

/**
 * Convenience hook: loads alias map + parses a raw query string into SearchIntent.
 */
export function useParsedSearch(rawQuery: string) {
  const { aliasMap, isLoading } = useAliasMap();

  const intent = useMemo<SearchIntent | null>(() => {
    if (isLoading || !aliasMap) return null;
    return parseSearchQuery(rawQuery, aliasMap);
  }, [rawQuery, aliasMap, isLoading]);

  return { intent, isReady: !isLoading && !!aliasMap };
}
