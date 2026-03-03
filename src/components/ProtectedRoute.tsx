import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { hasSupabase } from '@/lib/supabase';

/**
 * Wraps dashboard routes. Redirects to /auth if:
 * - Supabase is configured and user is not logged in.
 *
 * When Supabase is NOT configured (dev mode), allows access so
 * the dashboard UI can be previewed without a live backend.
 */
export function ProtectedRoute() {
  const { user, loading } = useAuth();

  // If Supabase is not configured, pass through (dev preview mode)
  if (!hasSupabase) return <Outlet />;

  // Still resolving session
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  return <Outlet />;
}
