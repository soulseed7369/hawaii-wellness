import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface NameSuggestion {
  /** Unique key for the suggestion item */
  key: string;
  label: string;
  sublabel?: string;
  listingId: string;
  listingType: 'practitioner' | 'center';
}

/**
 * Fetches practitioner and center names that match the query string.
 * Used to power name-based autocomplete in SearchBar alongside taxonomy suggestions.
 * Only runs when query is ≥ 2 chars and Supabase is available.
 */
export function useNameSuggestions(query: string, island?: string) {
  return useQuery<NameSuggestion[]>({
    queryKey: ['name-suggestions', query, island],
    queryFn: async () => {
      if (!supabase || query.length < 2) return [];

      const islandFilter = island && island !== 'all' ? island : null;

      const [pracsResult, centersResult] = await Promise.all([
        // Practitioners: match on name, display_name, or business_name
        (() => {
          let q = supabase
            .from('practitioners')
            .select('id, name, display_name, city, island')
            .eq('status', 'published')
            .or(`name.ilike.%${query}%,display_name.ilike.%${query}%,business_name.ilike.%${query}%`)
            .limit(4);
          if (islandFilter) q = q.eq('island', islandFilter);
          return q;
        })(),
        // Centers: match on name
        (() => {
          let q = supabase
            .from('centers')
            .select('id, name, city, island')
            .eq('status', 'published')
            .ilike('name', `%${query}%`)
            .limit(3);
          if (islandFilter) q = q.eq('island', islandFilter);
          return q;
        })(),
      ]);

      const results: NameSuggestion[] = [];

      for (const p of pracsResult.data ?? []) {
        const displayName = p.display_name || p.name;
        results.push({
          key: `prac-${p.id}`,
          label: displayName,
          sublabel: [p.city, p.island?.replace('_', ' ')].filter(Boolean).join(', ') || undefined,
          listingId: p.id,
          listingType: 'practitioner',
        });
      }

      for (const c of centersResult.data ?? []) {
        results.push({
          key: `center-${c.id}`,
          label: c.name,
          sublabel: [c.city, c.island?.replace('_', ' ')].filter(Boolean).join(', ') || undefined,
          listingId: c.id,
          listingType: 'center',
        });
      }

      return results;
    },
    enabled: !!supabase && query.length >= 2,
    staleTime: 5 * 60 * 1000, // 5 min — names don't change often
    placeholderData: [],
  });
}
