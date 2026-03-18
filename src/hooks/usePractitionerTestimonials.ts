import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { PractitionerTestimonialRow } from '@/types/database';

export function usePractitionerTestimonials(practitionerId: string | null) {
  return useQuery<PractitionerTestimonialRow[]>({
    queryKey: ['practitioner-testimonials', practitionerId],
    enabled: !!practitionerId && !!supabase,
    queryFn: async () => {
      if (!supabase || !practitionerId) return [];

      const { data, error } = await supabase
        .from('practitioner_testimonials')
        .select('*')
        .eq('practitioner_id', practitionerId)
        .eq('status', 'published')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
    staleTime: 1000 * 60 * 5,
  });
}
