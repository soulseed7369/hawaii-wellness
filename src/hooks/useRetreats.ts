import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { retreatRowToRetreatEvent } from '@/lib/adapters';
import { mockRetreatEvents, type RetreatEvent } from '@/data/mockData';

/**
 * Returns upcoming published retreats on the given island, mapped to
 * RetreatEvent shapes expected by RetreatEventCard and the Retreats page.
 *
 * Falls back to mockRetreatEvents when Supabase is not configured.
 */
export function useRetreats(island = 'big_island') {
  const today = new Date().toISOString().split('T')[0];

  return useQuery<RetreatEvent[]>({
    queryKey: ['retreats', island],
    queryFn: async () => {
      if (!supabase) return mockRetreatEvents;

      const { data, error } = await supabase
        .from('retreats')
        .select('*')
        .eq('island', island)
        .gte('start_date', today)
        .order('start_date');

      if (error) throw error;
      return (data ?? []).map(retreatRowToRetreatEvent);
    },
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Returns a single retreat by ID.
 * Falls back to mockRetreatEvents when Supabase is not configured.
 */
export function useRetreat(id: string | undefined) {
  return useQuery<RetreatEvent | null>({
    queryKey: ['retreat', id],
    enabled: !!id,
    queryFn: async () => {
      if (!id) return null;

      if (!supabase) {
        return mockRetreatEvents.find((r) => r.id === id) ?? null;
      }

      const { data, error } = await supabase
        .from('retreats')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // not found
        throw error;
      }
      return data ? retreatRowToRetreatEvent(data) : null;
    },
    staleTime: 1000 * 60 * 5,
  });
}
