import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

/**
 * Server-side Supabase client for Node.js environment.
 * Used in Next.js SSR, API routes, and Edge Functions.
 *
 * Uses the same anonymous key as the browser client (no service role key).
 * This keeps security consistent — all queries go through RLS policies.
 */
export function createServerSupabaseClient() {
  // Next.js server-side: VITE_ env vars are available via process.env when
  // defined in .env / .env.local (they just aren't exposed to the browser).
  // Also check NEXT_PUBLIC_ variants for forward compatibility.
  const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return createClient<Database>(supabaseUrl, supabaseAnonKey);
}
