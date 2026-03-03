import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase, hasSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, Mail, AlertCircle, Loader2, Upload, FileText, Flag } from 'lucide-react';
import { usePageMeta } from '@/hooks/usePageMeta';

type Tier = 'tier1' | 'tier4';
type Step = 'checking' | 'send-code' | 'enter-code' | 'upload-doc' | 'success' | 'pending-review' | 'error';

interface Listing {
  name: string;
  email: string | null;
  owner_id: string | null;
}

const CLAIM_DOCS_BUCKET = 'claim-documents';

export default function Claim() {
  usePageMeta('Claim Listing', "Claim your practitioner listing on Hawa'i Wellness.");

  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [listing, setListing] = useState<Listing | null>(null);
  const [tier, setTier] = useState<Tier>('tier1');
  const [step, setStep] = useState<Step>('checking');
  const [otp, setOtp] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // Redirect to auth if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      navigate(`/auth?claim=${id}`);
    }
  }, [user, authLoading, id, navigate]);

  // Fetch listing and decide tier
  useEffect(() => {
    if (!id || !supabase || !user) return;
    supabase
      .from('practitioners')
      .select('name, email, owner_id')
      .eq('id', id)
      .single()
      .then(({ data, error: err }) => {
        if (err || !data) { setStep('error'); setError('Listing not found.'); return; }
        if (data.owner_id) { setStep('error'); setError('This listing has already been claimed.'); return; }
        setListing({ name: data.name, email: data.email, owner_id: data.owner_id });

        const emailMatch = data.email && user.email &&
          data.email.toLowerCase() === user.email.toLowerCase();
        if (emailMatch) {
          setTier('tier1');
          setStep('send-code');
        } else {
          setTier('tier4');
          setStep('upload-doc');
        }
      });
  }, [id, user]);

  // ── Tier 1: Send OTP ──────────────────────────────────────────────────────
  const handleSendCode = async () => {
    if (!supabase || !user?.email) return;
    setBusy(true); setError('');
    const { error: err } = await supabase.auth.signInWithOtp({
      email: user.email,
      options: { shouldCreateUser: false },
    });
    setBusy(false);
    if (err) { setError(err.message); return; }
    setStep('enter-code');
  };

  // ── Tier 1: Verify OTP + claim ────────────────────────────────────────────
  const handleVerifyOtp = async () => {
    if (!supabase || !user?.email || !id) return;
    setBusy(true); setError('');
    const { error: verifyErr } = await supabase.auth.verifyOtp({
      email: user.email,
      token: otp,
      type: 'email',
    });
    if (verifyErr) {
      setBusy(false);
      setError('Invalid or expired code. Please request a new one.');
      return;
    }
    const { error: claimErr } = await supabase.rpc('claim_listing', { p_practitioner_id: id });
    setBusy(false);
    if (claimErr) {
      setError("Your email doesn't match this listing. Contact support if you believe this is yours.");
      return;
    }
    setStep('success');
  };

  // ── Tier 4: Upload document + submit review request ───────────────────────
  const handleDocSubmit = async () => {
    if (!supabase || !user || !id || !file) return;
    setUploading(true); setError('');

    const ext = file.name.split('.').pop();
    const path = `${id}/${user.id}-${Date.now()}.${ext}`;

    // Upload to private bucket
    const { error: uploadErr } = await supabase.storage
      .from(CLAIM_DOCS_BUCKET)
      .upload(path, file, { upsert: false });

    if (uploadErr) {
      setUploading(false);
      setError(`Upload failed: ${uploadErr.message}`);
      return;
    }

    // Create claim_request row
    const { error: reqErr } = await supabase.from('claim_requests').insert({
      practitioner_id: id,
      user_id: user.id,
      user_email: user.email ?? '',
      document_url: path,
      document_name: file.name,
      status: 'pending',
    });

    setUploading(false);
    if (reqErr) {
      // Clean up uploaded file on insert failure
      await supabase.storage.from(CLAIM_DOCS_BUCKET).remove([path]);
      setError(`Could not submit request: ${reqErr.message}`);
      return;
    }
    setStep('pending-review');
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  const maskedEmail = listing?.email
    ? listing.email.replace(/^(.)(.*)(@.*)$/, (_, a, b, c) => a + '*'.repeat(b.length) + c)
    : null;

  if (authLoading || step === 'checking') {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-secondary/30 px-4 py-12">
      <Link to="/" className="mb-8 font-display text-xl font-bold text-primary">
        Hawa'i Wellness
      </Link>

      <Card className="w-full max-w-md shadow-lg">
        {/* ── Success ────────────────────────────────────────────────────── */}
        {step === 'success' && (
          <>
            <CardHeader className="text-center">
              <CheckCircle className="mx-auto mb-2 h-12 w-12 text-green-500" />
              <CardTitle className="font-display text-2xl">Listing Claimed!</CardTitle>
              <CardDescription>
                You now own <strong>{listing?.name}</strong>. Head to your dashboard to manage it.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" onClick={() => navigate('/dashboard')}>
                Go to Dashboard
              </Button>
            </CardContent>
          </>
        )}

        {/* ── Pending review ────────────────────────────────────────────── */}
        {step === 'pending-review' && (
          <>
            <CardHeader className="text-center">
              <FileText className="mx-auto mb-2 h-12 w-12 text-primary" />
              <CardTitle className="font-display text-2xl">Request Submitted</CardTitle>
              <CardDescription>
                Our team will review your document and approve or deny your claim within
                1–2 business days. You'll receive an email at <strong>{user?.email}</strong>.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full" onClick={() => navigate('/')}>
                Back to Directory
              </Button>
            </CardContent>
          </>
        )}

        {/* ── Error ─────────────────────────────────────────────────────── */}
        {step === 'error' && (
          <>
            <CardHeader className="text-center">
              <AlertCircle className="mx-auto mb-2 h-12 w-12 text-destructive" />
              <CardTitle className="font-display text-2xl">Cannot Claim</CardTitle>
              <CardDescription>{error}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full" asChild>
                <Link to={`/profile/${id}`}>Back to Listing</Link>
              </Button>
            </CardContent>
          </>
        )}

        {/* ── Tier 1: Send code ──────────────────────────────────────────── */}
        {step === 'send-code' && (
          <>
            <CardHeader>
              <div className="mb-1 flex items-center gap-2 text-sm text-primary font-medium">
                <CheckCircle className="h-4 w-4" /> Email matches listing
              </div>
              <CardTitle className="font-display text-2xl">Verify your identity</CardTitle>
              <CardDescription>
                Claiming <strong>{listing?.name}</strong>. We'll send a one-time code to{' '}
                <strong>{user?.email}</strong> to confirm you own this email address.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <Button className="w-full" onClick={handleSendCode} disabled={busy || !hasSupabase}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                Send verification code
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                <Link to={`/profile/${id}`} className="hover:underline">← Back to listing</Link>
              </p>
            </CardContent>
          </>
        )}

        {/* ── Tier 1: Enter code ─────────────────────────────────────────── */}
        {step === 'enter-code' && (
          <>
            <CardHeader className="text-center">
              <Mail className="mx-auto mb-2 h-10 w-10 text-primary" />
              <CardTitle className="font-display text-2xl">Enter your code</CardTitle>
              <CardDescription>
                Check your inbox at <strong>{user?.email}</strong> for a 6-digit code.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <Input
                placeholder="123456"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                maxLength={6}
                className="text-center text-2xl tracking-[0.4em]"
              />
              <Button
                className="w-full"
                onClick={handleVerifyOtp}
                disabled={busy || otp.length !== 6}
              >
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Verify &amp; Claim Listing
              </Button>
              <button
                onClick={() => { setStep('send-code'); setOtp(''); setError(''); }}
                className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
              >
                ← Resend code
              </button>
            </CardContent>
          </>
        )}

        {/* ── Tier 4: Upload document ────────────────────────────────────── */}
        {step === 'upload-doc' && (
          <>
            <CardHeader>
              <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                <Flag className="h-3.5 w-3.5" /> Email on listing: {maskedEmail ?? 'not on file'}
              </div>
              <CardTitle className="font-display text-2xl">Claim this listing</CardTitle>
              <CardDescription>
                Your account email doesn't match the listing. Upload a document proving you own
                or operate <strong>{listing?.name}</strong> — a business license, certification,
                or official ID. Our team will review within 1–2 business days.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div
                onClick={() => fileRef.current?.click()}
                className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/30 p-6 text-center transition-colors hover:border-primary/50 hover:bg-primary/5"
              >
                <Upload className="h-8 w-8 text-muted-foreground" />
                {file ? (
                  <p className="text-sm font-medium text-foreground">{file.name}</p>
                ) : (
                  <>
                    <p className="text-sm font-medium">Click to upload a document</p>
                    <p className="text-xs text-muted-foreground">PDF, JPG, or PNG — max 5 MB</p>
                  </>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f && f.size > 5 * 1024 * 1024) {
                    setError('File must be under 5 MB.');
                  } else if (f) {
                    setFile(f); setError('');
                  }
                }}
              />

              <Button
                className="w-full"
                onClick={handleDocSubmit}
                disabled={!file || uploading}
              >
                {uploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Submit for Review
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Your document is stored securely and deleted once the review is complete.
              </p>
              <p className="text-center text-xs text-muted-foreground">
                <Link to={`/profile/${id}`} className="hover:underline">← Back to listing</Link>
              </p>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}
