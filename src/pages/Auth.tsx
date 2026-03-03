import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { supabase, hasSupabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Leaf, AlertCircle } from 'lucide-react';
import { usePageMeta } from "@/hooks/usePageMeta";

export default function Auth() {
  usePageMeta("Sign In", "Sign in to manage your Hawa'i Wellness practitioner or center listing.");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const claimId = searchParams.get('claim');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;

    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (mode === 'signup') {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/dashboard` },
        });
        if (signUpError) throw signUpError;
        setSuccess('Account created! Check your email to confirm your address, then sign in.');
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
        navigate(claimId ? `/claim/${claimId}` : '/dashboard');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-secondary/30 px-4">
      {/* Logo */}
      <Link to="/" className="mb-8 flex items-center gap-2 text-primary">
        <Leaf className="h-6 w-6" />
        <span className="font-display text-xl font-bold">Hawa'i Wellness</span>
      </Link>

      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="font-display text-2xl">
            {mode === 'signin' ? 'Sign in to your account' : 'Create provider account'}
          </CardTitle>
          <CardDescription>
            {mode === 'signin'
              ? 'Access your provider dashboard to manage listings.'
              : 'Create an account to list your practice on the directory.'}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {!hasSupabase && (
            <Alert className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Supabase is not configured. Add <code>VITE_SUPABASE_URL</code> and{' '}
                <code>VITE_SUPABASE_ANON_KEY</code> to your <code>.env.local</code> file.
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="mb-4 border-sage/30 bg-sage/10">
              <AlertDescription className="text-sage">{success}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={!hasSupabase}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                disabled={!hasSupabase}
              />
              {mode === 'signup' && (
                <p className="text-xs text-muted-foreground">Minimum 6 characters.</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={loading || !hasSupabase}>
              {loading ? 'Please wait…' : mode === 'signin' ? 'Sign In' : 'Create Account'}
            </Button>
          </form>

          <div className="mt-4 text-center text-sm">
            {mode === 'signin' ? (
              <p className="text-muted-foreground">
                Don't have an account?{' '}
                <button
                  onClick={() => { setMode('signup'); setError(''); setSuccess(''); }}
                  className="font-medium text-primary hover:underline"
                >
                  Sign up
                </button>
              </p>
            ) : (
              <p className="text-muted-foreground">
                Already have an account?{' '}
                <button
                  onClick={() => { setMode('signin'); setError(''); setSuccess(''); }}
                  className="font-medium text-primary hover:underline"
                >
                  Sign in
                </button>
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        <Link to="/" className="hover:underline">← Back to directory</Link>
      </p>
    </div>
  );
}
