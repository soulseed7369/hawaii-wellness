/**
 * AdminClaims — manage claim requests (approve/deny provider ownership claims).
 * Extracted from AdminPanel.tsx for maintainability.
 */
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, CheckCircle, XCircle, FileText, ExternalLink } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface ClaimRequest {
  id: string;
  practitioner_id: string;
  center_id?: string;
  user_id: string;
  user_email: string;
  document_url: string | null;
  document_name: string | null;
  status: 'pending' | 'approved' | 'denied';
  admin_notes: string | null;
  created_at: string;
  reviewed_at: string | null;
  practitioners?: { name: string } | null;
  centers?: { name: string } | null;
}

const CLAIM_DOCS_BUCKET = 'claim-documents';

export function AdminClaims() {
  const [claimRequests, setClaimRequests] = useState<ClaimRequest[]>([]);
  const [claimsLoading, setClaimsLoading] = useState(false);
  const [claimStatusFilter, setClaimStatusFilter] = useState<'pending' | 'approved' | 'denied'>('pending');
  const [denyingClaimId, setDenyingClaimId] = useState<string | null>(null);
  const [denyNotes, setDenyNotes] = useState('');
  const [claimActionBusy, setClaimActionBusy] = useState<string | null>(null);

  const fetchClaims = async (status: 'pending' | 'approved' | 'denied') => {
    if (!supabase) return;
    setClaimsLoading(true);
    try {
      const { data, error } = await supabase
        .from('claim_requests')
        .select('*, practitioners(name), centers(name)')
        .eq('status', status)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setClaimRequests((data as ClaimRequest[]) ?? []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load claim requests');
    } finally {
      setClaimsLoading(false);
    }
  };

  const handleApproveClaim = async (claim: ClaimRequest) => {
    if (!supabase) return;
    setClaimActionBusy(claim.id);
    try {
      await supabase.rpc('approve_claim', { p_claim_id: claim.id });
      if (claim.document_url) {
        await supabase.storage.from(CLAIM_DOCS_BUCKET).remove([claim.document_url]);
      }
      toast.success('Claim approved and listing assigned');
      setClaimRequests(prev => prev.filter(c => c.id !== claim.id));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to approve claim');
    } finally {
      setClaimActionBusy(null);
    }
  };

  const handleDenyClaim = async (claim: ClaimRequest) => {
    if (!supabase) return;
    setClaimActionBusy(claim.id);
    try {
      await supabase.rpc('deny_claim', { p_claim_id: claim.id, p_notes: denyNotes || null });
      if (claim.document_url) {
        await supabase.storage.from(CLAIM_DOCS_BUCKET).remove([claim.document_url]);
      }
      toast.success('Claim denied');
      setDenyingClaimId(null);
      setDenyNotes('');
      setClaimRequests(prev => prev.filter(c => c.id !== claim.id));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to deny claim');
    } finally {
      setClaimActionBusy(null);
    }
  };

  const getDocUrl = async (path: string) => {
    if (!supabase) return;
    const { data } = await supabase.storage
      .from(CLAIM_DOCS_BUCKET)
      .createSignedUrl(path, 60 * 5);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
    else toast.error('Could not generate document link');
  };

  // Load claims on mount and when filter changes
  useEffect(() => { fetchClaims(claimStatusFilter); }, [claimStatusFilter]);

  return (
    <>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h2 className="text-xl font-semibold">Claim Requests</h2>
        <div className="flex gap-2">
          {(['pending', 'approved', 'denied'] as const).map(s => (
            <button
              key={s}
              onClick={() => setClaimStatusFilter(s)}
              className={`px-3 py-1 rounded-full text-sm font-medium capitalize transition-colors ${
                claimStatusFilter === s
                  ? 'bg-primary text-white'
                  : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
              }`}
            >
              {s}
            </button>
          ))}
          <Button variant="outline" size="sm" onClick={() => fetchClaims(claimStatusFilter)}>
            Refresh
          </Button>
        </div>
      </div>

      {claimsLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : claimRequests.length === 0 ? (
        <p className="text-center text-gray-500 py-12">No {claimStatusFilter} claim requests.</p>
      ) : (
        <div className="space-y-3">
          {claimRequests.map(claim => (
            <Card key={claim.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">
                      {claim.practitioners?.name ?? claim.centers?.name ?? claim.practitioner_id ?? claim.center_id}
                    </p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Submitted by <span className="font-medium">{claim.user_email}</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(claim.created_at).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                    {claim.document_name && (
                      <button
                        onClick={() => claim.document_url && getDocUrl(claim.document_url)}
                        className="mt-2 inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        {claim.document_name}
                        <ExternalLink className="h-3 w-3" />
                      </button>
                    )}
                    {claim.admin_notes && (
                      <p className="mt-1 text-xs text-muted-foreground italic">Note: {claim.admin_notes}</p>
                    )}
                  </div>

                  {claim.status === 'pending' && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {denyingClaimId === claim.id ? (
                        <div className="flex flex-col gap-2 min-w-48">
                          <Input
                            placeholder="Reason (optional)"
                            value={denyNotes}
                            onChange={e => setDenyNotes(e.target.value)}
                            className="text-sm h-8"
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={claimActionBusy === claim.id}
                              onClick={() => handleDenyClaim(claim)}
                            >
                              {claimActionBusy === claim.id
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : 'Confirm Deny'
                              }
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => { setDenyingClaimId(null); setDenyNotes(''); }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            disabled={!!claimActionBusy}
                            onClick={() => handleApproveClaim(claim)}
                            className="gap-1.5"
                          >
                            {claimActionBusy === claim.id
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              : <CheckCircle className="h-3.5 w-3.5" />
                            }
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!!claimActionBusy}
                            onClick={() => setDenyingClaimId(claim.id)}
                            className="gap-1.5 text-destructive hover:text-destructive"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            Deny
                          </Button>
                        </>
                      )}
                    </div>
                  )}

                  {claim.status !== 'pending' && (
                    <Badge variant={claim.status === 'approved' ? 'default' : 'secondary'} className="capitalize">
                      {claim.status}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
