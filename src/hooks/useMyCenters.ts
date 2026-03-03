import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { CenterRow } from '@/types/database';

export function useMyCenters() {
  const { user } = useAuth();

  return useQuery<CenterRow[]>({
    queryKey: ['my-centers', user?.id],
    enabled: !!user && !!supabase,
    queryFn: async () => {
      if (!supabase || !user) return [];

      const { data, error } = await supabase
        .from('centers')
        .select('*')
        .eq('owner_id', user.id)
        .neq('status', 'archived')
        .order('name');

      if (error) throw error;
      return data ?? [];
    },
    staleTime: 1000 * 30,
  });
}

export type CenterFormData = {
  name: string;
  center_type: CenterRow['center_type'];
  description: string;
  city: string;
  address: string;
  phone: string;
  email: string;
  website_url: string;
  external_website_url: string;
};

export function useAddCenter() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (formData: CenterFormData) => {
      if (!supabase || !user) throw new Error('Not authenticated');

      const { error } = await supabase.from('centers').insert({
        owner_id: user.id,
        name: formData.name.trim(),
        center_type: formData.center_type,
        description: formData.description.trim() || null,
        city: formData.city.trim() || null,
        address: formData.address.trim() || null,
        phone: formData.phone.trim() || null,
        email: formData.email.trim() || null,
        website_url: formData.website_url.trim() || null,
        external_website_url: formData.external_website_url.trim() || null,
        island: 'big_island',
        status: 'draft',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-centers'] });
    },
  });
}

export function useDeleteCenter() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (centerId: string) => {
      if (!supabase || !user) throw new Error('Not authenticated');

      // Soft delete — set status to archived
      const { error } = await supabase
        .from('centers')
        .update({ status: 'archived' })
        .eq('id', centerId)
        .eq('owner_id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-centers'] });
    },
  });
}
