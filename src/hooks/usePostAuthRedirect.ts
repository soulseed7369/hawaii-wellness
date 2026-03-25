/**
 * usePostAuthRedirect — global fallback for post-authentication redirects.
 *
 * Problem: Supabase OAuth sometimes ignores the `redirectTo` parameter and
 * sends the user to the Site URL (`/`) instead of `/auth/callback`. When that
 * happens, AuthCallback never runs, so `pendingClaimId` and other localStorage
 * intents are never consumed.
 *
 * Solution: This hook runs once per auth-state transition (loading → signed-in)
 * on ANY page. If it finds a pending intent in localStorage AND the user just
 * authenticated (wasn't already signed in), it performs the redirect.
 *
 * This is safe to mount globally — it only fires once per session bootstrap.
 */

import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function usePostAuthRedirect() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const hasRedirected = useRef(false);

  useEffect(() => {
    // Only run once, only after auth has loaded, only if user is signed in
    if (loading || !user || hasRedirected.current) return;

    // Don't interfere if we're already on a page that handles its own redirect logic
    const path = location.pathname;
    if (
      path.startsWith('/auth') ||
      path.startsWith('/claim') ||
      path.startsWith('/dashboard') ||
      path.startsWith('/admin')
    ) {
      return;
    }

    // Check for pending claim
    const pendingClaimId = localStorage.getItem('pendingClaimId');
    if (pendingClaimId && UUID_RE.test(pendingClaimId)) {
      hasRedirected.current = true;
      localStorage.removeItem('pendingClaimId');
      navigate(`/claim/${pendingClaimId}`, { replace: true });
      return;
    }

    // Check for pending redirect
    const pendingRedirect = localStorage.getItem('pendingRedirect');
    if (pendingRedirect && pendingRedirect.startsWith('/')) {
      hasRedirected.current = true;
      localStorage.removeItem('pendingRedirect');
      navigate(pendingRedirect, { replace: true });
      return;
    }

    // Check for pending plan upgrade
    const pendingPlan = localStorage.getItem('pendingPlan');
    if (pendingPlan && pendingPlan.startsWith('price_')) {
      hasRedirected.current = true;
      navigate('/dashboard/billing', { replace: true });
      return;
    }
  }, [loading, user, location.pathname, navigate]);
}
