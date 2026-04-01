/**
 * AdminClaimRequests.tsx
 * Admin panel tab for reviewing and managing Tier 4 (document-based) claim requests.
 * Displays pending claims with document preview and approve/reject controls.
 */

import { useState } from 'react';
import { format } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  CheckCircle,
  XCircle,
  FileText,
  Loader2,
  AlertTriangle,
  Download,
  Calendar,
} from 'lucide-react';
import { useAdminClaims, ClaimRequest } from '@/hooks/useAdminClaims';
import { toast } from 'sonner';

type TabName = 'pending' | 'approved' | 'denied';

export function AdminClaimRequests() {
  const [activeTab, setActiveTab] = useState<TabName>('pending');
  const [selectedClaim, setSelectedClaim] = useState<ClaimRequest | null>(null);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectNotes, setRejectNotes] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);

  const { pendingClaims } = useAdminClaims();
  const { approveClaim } = useAdminClaims().approveClaim;
  const { rejectClaim } = useAdminClaims().rejectClaim;

  const handleApprove = async () => {
    if (!selectedClaim) return;
    try {
      await approveClaim.mutateAsync(selectedClaim.id);
      toast.success(`Claim from ${selectedClaim.user_email} approved`);
      setSelectedClaim(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Approval failed');
    }
  };

  const handleReject = async () => {
    if (!selectedClaim) return;
    try {
      await rejectClaim.mutateAsync({
        claimId: selectedClaim.id,
        notes: rejectNotes,
      });
      toast.success(`Claim from ${selectedClaim.user_email} rejected`);
      setSelectedClaim(null);
      setRejectNotes('');
      setShowRejectDialog(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Rejection failed');
    }
  };

  if (pendingClaims.isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (pendingClaims.isError) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Failed to load claims: {pendingClaims.error instanceof Error ? pendingClaims.error.message : 'Unknown error'}
        </AlertDescription>
      </Alert>
    );
  }

  const claims = pendingClaims.data || [];
  const pendingCount = claims.filter((c) => c.status === 'pending').length;
  const approvedCount = claims.filter((c) => c.status === 'approved').length;
  const deniedCount = claims.filter((c) => c.status === 'denied').length;

  const displayedClaims = claims.filter((c) => c.status === activeTab);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Claim Requests</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Manage document-based listing claims (Tier 4)
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setActiveTab('pending')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'pending'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Pending ({pendingCount})
        </button>
        <button
          onClick={() => setActiveTab('approved')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'approved'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Approved ({approvedCount})
        </button>
        <button
          onClick={() => setActiveTab('denied')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'denied'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Denied ({deniedCount})
        </button>
      </div>

      {/* Empty state */}
      {displayedClaims.length === 0 ? (
        <div className="text-center py-12 border rounded-lg bg-secondary/30">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-30" />
          <p className="text-muted-foreground">
            {activeTab === 'pending' ? 'No pending claims' : `No ${activeTab} claims`}
          </p>
        </div>
      ) : (
        /* Claims table */
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHead>
              <TableRow className="bg-secondary/50">
                <TableCell className="font-semibold">Listing</TableCell>
                <TableCell className="font-semibold">Provider Email</TableCell>
                <TableCell className="font-semibold">Document</TableCell>
                <TableCell className="font-semibold">Submitted</TableCell>
                {(activeTab === 'approved' || activeTab === 'denied') && (
                  <TableCell className="font-semibold">Reviewed</TableCell>
                )}
                <TableCell className="font-semibold text-right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {displayedClaims.map((claim) => (
                <TableRow key={claim.id} className="hover:bg-secondary/50">
                  <TableCell className="font-medium">
                    {claim.listing_name}
                    <div className="text-xs text-muted-foreground mt-1">
                      {claim.listing_type === 'practitioner' ? 'Practitioner' : 'Center'}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{claim.user_email}</TableCell>
                  <TableCell className="text-sm">
                    {claim.document_name ? (
                      <button
                        onClick={() => {
                          setSelectedClaim(claim);
                          setPreviewOpen(true);
                        }}
                        className="text-primary hover:underline inline-flex items-center gap-1"
                      >
                        <Download className="h-3 w-3" />
                        {claim.document_name}
                      </button>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(claim.created_at), 'MMM d, yyyy')}
                    </div>
                  </TableCell>
                  {(activeTab === 'approved' || activeTab === 'denied') && (
                    <TableCell className="text-sm text-muted-foreground">
                      {claim.reviewed_at
                        ? format(new Date(claim.reviewed_at), 'MMM d, yyyy')
                        : '—'}
                    </TableCell>
                  )}
                  <TableCell className="text-right">
                    {activeTab === 'pending' && (
                      <div className="flex gap-2 justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedClaim(claim);
                            setShowRejectDialog(true);
                          }}
                          className="text-destructive hover:text-destructive"
                        >
                          <XCircle className="h-3.5 w-3.5 mr-1" />
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedClaim(claim);
                            handleApprove();
                          }}
                          disabled={approveClaim.isPending}
                          className="gap-1"
                        >
                          {approveClaim.isPending ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <CheckCircle className="h-3.5 w-3.5" />
                          )}
                          Approve
                        </Button>
                      </div>
                    )}
                    {activeTab === 'approved' && (
                      <div className="flex items-center gap-2 text-emerald-600">
                        <CheckCircle className="h-4 w-4" />
                        <span className="text-xs font-medium">Approved</span>
                      </div>
                    )}
                    {activeTab === 'denied' && (
                      <div className="flex items-center gap-2 text-destructive">
                        <XCircle className="h-4 w-4" />
                        <span className="text-xs font-medium">Denied</span>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Document preview sheet */}
      {selectedClaim && (
        <DocumentPreviewSheet
          claim={selectedClaim}
          open={previewOpen}
          onOpenChange={setPreviewOpen}
        />
      )}

      {/* Reject confirmation dialog */}
      {selectedClaim && (
        <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reject Claim</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to reject this claim from {selectedClaim.user_email}?
                The document will be deleted. Optionally, add notes for the provider.
              </AlertDialogDescription>
            </AlertDialogHeader>

            <Textarea
              placeholder="Notes for the provider (optional)..."
              value={rejectNotes}
              onChange={(e) => setRejectNotes(e.target.value)}
              className="min-h-24"
            />

            <div className="flex gap-3 justify-end">
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleReject}
                disabled={rejectClaim.isPending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {rejectClaim.isPending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                    Rejecting...
                  </>
                ) : (
                  'Reject'
                )}
              </AlertDialogAction>
            </div>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}

// ── Document Preview Sheet ──────────────────────────────────────────────────

interface DocumentPreviewSheetProps {
  claim: ClaimRequest;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function DocumentPreviewSheet({
  claim,
  open,
  onOpenChange,
}: DocumentPreviewSheetProps) {
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = async () => {
    if (!claim.document_url) return;

    try {
      // For now, construct the storage URL directly
      // In production, use supabase.storage.from().createSignedUrl()
      const baseUrl = ((import.meta as any).env?.VITE_SUPABASE_URL as string | undefined) ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
      const bucketName = 'claim-documents';
      const signedUrl = `${baseUrl}/storage/v1/object/public/${bucketName}/${claim.document_url}`;

      setDownloadUrl(signedUrl);

      // Also initiate browser download
      const link = document.createElement('a');
      link.href = signedUrl;
      link.download = claim.document_name || 'document';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download');
    }
  };

  const isImage = claim.document_name?.match(/\.(jpg|jpeg|png|gif|webp)$/i);
  const isPdf = claim.document_name?.match(/\.pdf$/i);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Document Preview</SheetTitle>
          <SheetDescription>
            From {claim.user_email} for {claim.listing_name}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 mt-4">
          {/* Document info */}
          <div className="bg-secondary/30 rounded-lg p-4 space-y-2">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Filename</p>
              <p className="text-sm font-medium">{claim.document_name}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Submitted</p>
              <p className="text-sm">
                {format(new Date(claim.created_at), 'PPpp')}
              </p>
            </div>
          </div>

          {/* Preview area */}
          {isImage && claim.document_url && (
            <div className="border rounded-lg overflow-hidden bg-secondary/20">
              <img
                src={`${((import.meta as any).env?.VITE_SUPABASE_URL as string | undefined) ?? process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/claim-documents/${claim.document_url}`}
                alt={claim.document_name || 'Document'}
                className="w-full h-auto"
              />
            </div>
          )}

          {isPdf && (
            <div className="border rounded-lg p-4 bg-secondary/20 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">PDF file</p>
              <p className="text-xs text-muted-foreground mt-1">
                Click download to view the full document
              </p>
            </div>
          )}

          {!isImage && !isPdf && (
            <div className="border rounded-lg p-4 bg-secondary/20 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                {claim.document_name || 'Document'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Click download to view the document
              </p>
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-4 border-t">
            <Button
              onClick={handleDownload}
              className="flex-1 gap-2"
            >
              <Download className="h-4 w-4" />
              Download
            </Button>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
