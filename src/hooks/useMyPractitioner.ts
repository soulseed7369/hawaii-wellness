import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { PractitionerRow, PractitionerInsert } from '@/types/database';

/**
 * Returns the practitioner profile row owned by the current user.
 * Returns null if the user hasn't created one yet.
 */
export function useMyPractitioner() {
  const { user } = useAuth();

  return useQuery<PractitionerRow | null>({
    queryKey: ['my-practitioner', user?.id],
    enabled: !!user && !!supabase,
    queryFn: async () => {
      if (!supabase || !user) return null;

      const { data, error } = await supabase
        .from('practitioners')
        .select('*')
        .eq('owner_id', user.id)
        .maybeSingle();

      if (error) throw error;
      return data ?? null;
    },
    staleTime: 1000 * 30,
  });
}

export type PractitionerFormData = {
  name: string;
  modalities: string; // comma-separated in form, split on save
  bio: string;
  city: string;
  region: string;
  address: string;
  phone: string;
  email: string;
  website_url: string;
  external_booking_url: string;
  accepts_new_clients: boolean;
};

/**
 * Upsert (create or update) the practitioner profile for the current user.
 */
export function useSavePractitioner() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (formData: PractitionerFormData) => {
      if (!supabase || !user) throw new Error('Not authenticated');

      const payload: Partial<PractitionerInsert> = {
        owner_id: user.id,
        name: formData.name.trim(),
        modalities: formData.modalities
          .split(',')
          .map((m) => m.trim())
          .filter(Boolean),
        bio: formData.bio.trim() || null,
        city: formData.city.trim() || null,
        region: formData.region.trim() || null,
        address: formData.address.trim() || null,
        phone: formData.phone.trim() || null,
        email: formData.email.trim() || null,
        website_url: formData.website_url.trim() || null,
        external_booking_url: formData.external_booking_url.trim() || null,
        accepts_new_clients: formData.accepts_new_clients,
        island: 'big_island',
        status: 'draft',
      };

      // Check if record already exists for this owner
      const { data: existing } = await supabase
        .from('practitioners')
        .select('id')
        .eq('owner_id', user.id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('practitioners')
          .update(payload)
          .eq('id', existing.id)
          .eq('owner_id', user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('practitioners')
          .insert(payload as PractitionerInsert);
        if (error) throw error;
      }
    },
    onSuccess: (_data, _vars, _ctx) => {
      queryClient.invalidateQueries({ queryKey: ['my-practitioner'] });
    },
  });
}
