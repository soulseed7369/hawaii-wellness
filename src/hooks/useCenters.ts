import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { centerRowToCenter, centerRowToProvider } from '@/lib/adapters';
import { mockCenters, type Center, type Provider } from '@/data/mockData';

/**
 * Returns published centers on the Big Island, mapped to the Center shape
 * expected by CenterCard.
 *
 * Falls back to mockCenters when Supabase is not configured.
 */
export function useCenters(island = 'big_island') {
  return useQuery<Center[]>({
    queryKey: ['centers', island],
    queryFn: async () => {
      if (!supabase) return mockCenters;

      const { data, error } = await supabase
        .from('centers')
        .select('*')
        .eq('island', island)
        .eq('status', 'published')
        .order('is_featured', { ascending: false })
        .order('tier', { ascending: false })
        .order('name');

      if (error) throw error;
      return (data ?? []).map(centerRowToCenter);
    },
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Returns published centers as Provider shapes for DirectoryMap.
 */
export function useCentersAsProviders(island = 'big_island') {
  return useQuery<Provider[]>({
    queryKey: ['centers-as-providers', island],
    queryFn: async () => {
      if (!supabase) {
        return mockCenters.map((c) => ({
          id: c.id,
          name: c.name,
          image: c.image,
          type: 'center' as const,
          modality: c.modality,
          location: c.location,
          rating: c.rating,
          lat: c.lat,
          lng: c.lng,
        }));
      }

      const { data, error } = await supabase
        .from('centers')
        .select('*')
        .eq('island', island)
        .eq('status', 'published')
        .order('is_featured', { ascending: false })
        .order('tier', { ascending: false })
        .order('name');

      if (error) throw error;
      return (data ?? []).map(centerRowToProvider);
    },
    staleTime: 1000 * 60 * 5,
  });
}
