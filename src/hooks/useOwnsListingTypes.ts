/**
 * useOwnsListingTypes.ts
 * Check whether the current user owns practitioner and/or center listings.
 * Used by the dashboard sidebar to decide whether to show the account-type switcher.
 */
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

export interface ListingOwnership {
  hasPractitioner: boolean;
  hasCenter: boolean;
  hasBoth: boolean;
}

export function useOwnsListingTypes() {
  const { user } = useAuth();

  return useQuery<ListingOwnership>({
    queryKey: ['owns-listing-types', user?.id],
    enabled: !!user && !!supabase,
    queryFn: async () => {
      if (!supabase || !user) return { hasPractitioner: false, hasCenter: false, hasBoth: false };

      // Two lightweight count queries in parallel
      const [practResult, centerResult] = await Promise.all([
        supabase
          .from('practitioners')
          .select('id', { count: 'exact', head: true })
          .eq('owner_id', user.id)
          .neq('status', 'archived'),
        supabase
          .from('centers')
          .select('id', { count: 'exact', head: true })
          .eq('owner_id', user.id)
          .neq('status', 'archived'),
      ]);

      const hasPractitioner = (practResult.count ?? 0) > 0;
      const hasCenter = (centerResult.count ?? 0) > 0;

      return {
        hasPractitioner,
        hasCenter,
        hasBoth: hasPractitioner && hasCenter,
      };
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
