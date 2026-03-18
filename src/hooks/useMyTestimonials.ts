import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { PractitionerTestimonialRow, PractitionerTestimonialInsert } from '@/types/database';

export type TestimonialFormData = {
  id?: string;
  practitioner_id: string;
  author: string;
  text: string;
  author_location: string;
  testimonial_date: string;
  linked_type: 'offering' | 'class' | null;
  linked_id: string;
  sort_order: number;
  status: 'draft' | 'published';
};

export function useMyTestimonials() {
  const { user } = useAuth();

  return useQuery<PractitionerTestimonialRow[]>({
    queryKey: ['my-testimonials', user?.id],
    enabled: !!user && !!supabase,
    queryFn: async () => {
      if (!supabase || !user) return [];

      const { data: practitioner, error: practitionerError } = await supabase
        .from('practitioners')
        .select('id')
        .eq('owner_id', user.id)
        .maybeSingle();

      if (practitionerError) throw practitionerError;
      if (!practitioner) return [];

      const { data, error } = await supabase
        .from('practitioner_testimonials')
        .select('*')
        .eq('practitioner_id', practitioner.id)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
    staleTime: 1000 * 30,
  });
}

export function useSaveTestimonial() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (formData: TestimonialFormData) => {
      if (!supabase || !user) throw new Error('Not authenticated');

      const payload: PractitionerTestimonialInsert = {
        practitioner_id: formData.practitioner_id,
        author: formData.author.trim(),
        text: formData.text.trim(),
        author_location: formData.author_location.trim() || null,
        testimonial_date: formData.testimonial_date || null,
        linked_type: formData.linked_type,
        linked_id: formData.linked_id || null,
        sort_order: formData.sort_order,
        status: formData.status,
      };

      if (formData.id) {
        const { error } = await supabase
          .from('practitioner_testimonials')
          .update(payload)
          .eq('id', formData.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('practitioner_testimonials')
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-testimonials'] });
    },
  });
}

export function useDeleteTestimonial() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!supabase) throw new Error('Supabase not configured');

      const { error } = await supabase
        .from('practitioner_testimonials')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-testimonials'] });
    },
  });
}
