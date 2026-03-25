import { createContext, useContext, useEffect, useState, useRef, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  // Debounce timer for null session — prevents brief flicker during session
  // transitions (e.g. SIGNED_OUT → SIGNED_IN during magic link / OAuth flow).
  const nullTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    // Get initial session
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (nullTimer.current) {
        clearTimeout(nullTimer.current);
        nullTimer.current = null;
      }

      if (newSession) {
        // New session available — apply immediately
        setSession(newSession);
        setLoading(false);
      } else {
        // Session cleared — debounce by 200ms to avoid brief null flash during
        // SIGNED_OUT → SIGNED_IN transitions (magic link / Google OAuth flow).
        nullTimer.current = setTimeout(() => {
          setSession(null);
          setLoading(false);
          nullTimer.current = null;
        }, 200);
      }
    });

    return () => {
      subscription.unsubscribe();
      if (nullTimer.current) clearTimeout(nullTimer.current);
    };
  }, []);

  const signOut = async () => {
    if (!supabase) return;
    // Clear debounce timer before signing out to avoid race condition
    if (nullTimer.current) {
      clearTimeout(nullTimer.current);
      nullTimer.current = null;
    }
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
