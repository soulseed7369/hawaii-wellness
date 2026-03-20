import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Provider } from '@/data/mockData';

/**
 * Fetch up to 4 published practitioners whose modalities overlap with the given tags,
 * optionally filtered by island. Returns featured first, then premium, then free.
 */
export function useRelatedPractitioners(tags: string[], island?: string | null) {
  return useQuery<Provider[]>({
    queryKey: ['relatedPractitioners', tags, island],
    enabled: tags.length > 0,
    queryFn: async () => {
      if (!supabase) return [];
      let query = supabase
        .from('practitioners')
        .select('id, name, bio, modalities, city, island, avatar_url, photo_url, tier, session_type, external_booking_url, lat, lng')
        .eq('status', 'published')
        .overlaps('modalities', tags)
        .order('tier', { ascending: false })
        .limit(4);
      if (island) query = query.eq('island', island);
      const { data, error } = await query;
      if (error || !data) return [];
      return data.map(p => ({
        id: p.id,
        name: p.name,
        image: p.avatar_url || p.photo_url || '',
        type: 'practitioner' as const,
        modality: (p.modalities ?? []).join(', ') || 'Wellness Practitioner',
        modalities: p.modalities ?? undefined,
        sessionType: p.session_type ?? undefined,
        bio: p.bio ?? undefined,
        location: p.city || p.island || 'Hawaiʻi',
        rating: 5.0,
        lat: p.lat ?? 0,
        lng: p.lng ?? 0,
        tier: (p.tier as 'free' | 'premium' | 'featured') ?? 'free',
        externalBookingUrl: p.external_booking_url ?? undefined,
        island: p.island ?? undefined,
      }));
    },
    staleTime: 1000 * 60 * 10,
  });
}
