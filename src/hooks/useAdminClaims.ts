/**
 * useAdminClaims.ts
 * Admin hooks for managing claim requests (Tier 4 document-based claims).
 *
 * Usage:
 *   const { pendingClaims } = usePendingClaims();
 *   await approveClaim.mutateAsync(claimId);
 *   await rejectClaim.mutateAsync({ claimId, notes });
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, supabaseAdmin } from '@/lib/supabase';

// ── Types ───────────────────────────────────────────────────────────────────

export interface ClaimRequest {
  id: string;
  practitioner_id: string | null;
  center_id: string | null;
  listing_type: 'practitioner' | 'center';
  user_id: string;
  user_email: string;
  document_url: string | null;
  document_name: string | null;
  status: 'pending' | 'approved' | 'denied';
  admin_notes: string | null;
  created_at: string;
  reviewed_at: string | null;
  listing_name?: string;  // Joined from practitioners/centers
}

export interface ClaimDocumentInfo {
  id: string;
  claim_request_id: string;
  user_id: string;
  bucket_path: string;
  file_name: string;
  file_size: number;
  file_type: string;
  created_at: string;
}

// ── Fetch pending claims ────────────────────────────────────────────────────

export function usePendingClaims() {
  return useQuery({
    queryKey: ['admin-pending-claims'],
    queryFn: async (): Promise<ClaimRequest[]> => {
      if (!supabaseAdmin) {
        throw new Error('Admin access not available');
      }

      const { data, error } = await supabaseAdmin
        .from('claim_requests')
        .select(
          `
            id,
            practitioner_id,
            center_id,
            listing_type,
            user_id,
            user_email,
            document_url,
            document_name,
            status,
            admin_notes,
            created_at,
            reviewed_at
          `
        )
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Enrich with listing names
      const claims: ClaimRequest[] = [];
      for (const claim of data || []) {
        let listing_name = '';

        if (claim.listing_type === 'practitioner' && claim.practitioner_id) {
          const { data: prac } = await supabaseAdmin
            .from('practitioners')
            .select('name')
            .eq('id', claim.practitioner_id)
            .single();
          listing_name = prac?.name || 'Unknown';
        } else if (claim.listing_type === 'center' && claim.center_id) {
          const { data: center } = await supabaseAdmin
            .from('centers')
            .select('name')
            .eq('id', claim.center_id)
            .single();
          listing_name = center?.name || 'Unknown';
        }

        claims.push({ ...claim, listing_name });
      }

      return claims;
    },
    staleTime: 30 * 1000,  // 30 seconds
    enabled: !!supabaseAdmin,
  });
}

// ── Approve a claim ─────────────────────────────────────────────────────────

export function useApproveClaim() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (claimId: string): Promise<void> => {
      if (!supabaseAdmin) {
        throw new Error('Admin access not available');
      }

      // Call appropriate RPC based on claim type
      const { data: claim } = await supabaseAdmin
        .from('claim_requests')
        .select('listing_type')
        .eq('id', claimId)
        .single();

      if (!claim) {
        throw new Error('Claim not found');
      }

      const rpcName = claim.listing_type === 'center'
        ? 'approve_claim_center'
        : 'approve_claim';

      const { error } = await supabaseAdmin.rpc(rpcName, {
        p_claim_id: claimId,
      });

      if (error) throw error;

      // Delete the document from storage
      const { data: claimReq } = await supabaseAdmin
        .from('claim_requests')
        .select('document_url')
        .eq('id', claimId)
        .single();

      if (claimReq?.document_url) {
        await supabaseAdmin.storage
          .from('claim-documents')
          .remove([claimReq.document_url]);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-pending-claims'] });
    },
  });
}

// ── Reject a claim ──────────────────────────────────────────────────────────

export function useRejectClaim() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      claimId,
      notes = '',
    }: {
      claimId: string;
      notes?: string;
    }): Promise<void> => {
      if (!supabaseAdmin) {
        throw new Error('Admin access not available');
      }

      // Call appropriate RPC based on claim type
      const { data: claim } = await supabaseAdmin
        .from('claim_requests')
        .select('listing_type')
        .eq('id', claimId)
        .single();

      if (!claim) {
        throw new Error('Claim not found');
      }

      const rpcName = claim.listing_type === 'center'
        ? 'deny_claim_center'
        : 'deny_claim';

      const { error } = await supabaseAdmin.rpc(rpcName, {
        p_claim_id: claimId,
        p_notes: notes || null,
      });

      if (error) throw error;

      // Delete the document from storage
      const { data: claimReq } = await supabaseAdmin
        .from('claim_requests')
        .select('document_url')
        .eq('id', claimId)
        .single();

      if (claimReq?.document_url) {
        await supabaseAdmin.storage
          .from('claim-documents')
          .remove([claimReq.document_url]);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-pending-claims'] });
    },
  });
}

// ── Get claim details ───────────────────────────────────────────────────────

export function useClaimDetails(claimId: string) {
  return useQuery({
    queryKey: ['admin-claim-detail', claimId],
    queryFn: async (): Promise<ClaimRequest> => {
      if (!supabaseAdmin) {
        throw new Error('Admin access not available');
      }

      const { data, error } = await supabaseAdmin
        .from('claim_requests')
        .select('*')
        .eq('id', claimId)
        .single();

      if (error) throw error;
      if (!data) throw new Error('Claim not found');

      // Enrich with listing name
      let listing_name = '';
      if (data.listing_type === 'practitioner' && data.practitioner_id) {
        const { data: prac } = await supabaseAdmin
          .from('practitioners')
          .select('name')
          .eq('id', data.practitioner_id)
          .single();
        listing_name = prac?.name || 'Unknown';
      } else if (data.listing_type === 'center' && data.center_id) {
        const { data: center } = await supabaseAdmin
          .from('centers')
          .select('name')
          .eq('id', data.center_id)
          .single();
        listing_name = center?.name || 'Unknown';
      }

      return { ...data, listing_name };
    },
    enabled: !!supabaseAdmin && !!claimId,
  });
}

// ── Get document signed URL for preview ──────────────────────────────────────

export function useClaimDocumentUrl(claimId: string) {
  return useQuery({
    queryKey: ['claim-document-url', claimId],
    queryFn: async (): Promise<{ url: string; name: string } | null> => {
      if (!supabaseAdmin) {
        throw new Error('Admin access not available');
      }

      const { data: claim } = await supabaseAdmin
        .from('claim_requests')
        .select('document_url, document_name')
        .eq('id', claimId)
        .single();

      if (!claim?.document_url) return null;

      // Generate a signed URL valid for 1 hour
      const { data, error } = await supabaseAdmin.storage
        .from('claim-documents')
        .createSignedUrl(claim.document_url, 3600);

      if (error) throw error;

      return {
        url: data.signedUrl,
        name: claim.document_name || 'document',
      };
    },
    enabled: !!supabaseAdmin && !!claimId,
  });
}

// ── Convenience wrapper ─────────────────────────────────────────────────────

export function useAdminClaims() {
  return {
    pendingClaims: usePendingClaims(),
    approveClaim: useApproveClaim(),
    rejectClaim: useRejectClaim(),
  };
}
