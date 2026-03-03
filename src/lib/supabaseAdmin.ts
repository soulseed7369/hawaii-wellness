import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

/**
 * Admin Supabase client using the service role key.
 * Bypasses Row Level Security — for use in the admin panel ONLY.
 * Never expose this key to end users.
 */
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const serviceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY as string | undefined;

export const supabaseAdmin =
  supabaseUrl && serviceRoleKey
    ? createClient<Database>(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false },
      })
    : null;
