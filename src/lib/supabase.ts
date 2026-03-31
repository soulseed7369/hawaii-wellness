import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

// Universal env access: Vite replaces import.meta.env.* at build time;
// Next.js doesn't, so we fall back to NEXT_PUBLIC_* process.env vars.
const supabaseUrl =
  ((import.meta as any).env?.VITE_SUPABASE_URL as string | undefined)
  ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey =
  ((import.meta as any).env?.VITE_SUPABASE_ANON_KEY as string | undefined)
  ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Supabase client singleton.
 * Will be `null` when env vars are not configured (dev without Supabase).
 * In that case, hooks fall back to mock data automatically.
 */
export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient<Database>(supabaseUrl, supabaseAnonKey)
    : null;

export const hasSupabase = !!supabase;
