import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { RetreatRow } from '@/types/database';

export function useMyRetreats() {
  const { user } = useAuth();

  return useQuery<RetreatRow[]>({
    queryKey: ['my-retreats', user?.id],
    enabled: !!user && !!supabase,
    queryFn: async () => {
      if (!supabase || !user) return [];

      const { data, error } = await supabase
        .from('retreats')
        .select('*')
        .eq('owner_id', user.id)
        .neq('status', 'archived')
        .order('start_date');

      if (error) throw error;
      return data ?? [];
    },
    staleTime: 1000 * 30,
  });
}

export type RetreatFormData = {
  title: string;
  venue_name: string;
  city: string;
  description: string;
  start_date: string;
  end_date: string;
  starting_price: string; // string in form, parsed to number on save
  registration_url: string;
};

export function useAddRetreat() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (formData: RetreatFormData) => {
      if (!supabase || !user) throw new Error('Not authenticated');

      const price = formData.starting_price
        ? parseFloat(formData.starting_price)
        : null;

      const { error } = await supabase.from('retreats').insert({
        owner_id: user.id,
        title: formData.title.trim(),
        venue_name: formData.venue_name.trim() || null,
        city: formData.city.trim() || null,
        description: formData.description.trim() || null,
        start_date: formData.start_date,
        end_date: formData.end_date,
        starting_price: isNaN(price as number) ? null : price,
        registration_url: formData.registration_url.trim() || null,
        island: 'big_island',
        status: 'draft',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-retreats'] });
    },
  });
}

export function useDeleteRetreat() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (retreatId: string) => {
      if (!supabase || !user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('retreats')
        .update({ status: 'archived' })
        .eq('id', retreatId)
        .eq('owner_id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-retreats'] });
    },
  });
}
