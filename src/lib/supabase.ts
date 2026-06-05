import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Server-side Supabase client.
//
// Prefers the service-role key (bypasses RLS for trusted server code). Falls
// back to the anon/publishable key if the service role isn't configured yet, so
// development isn't blocked — but writes to RLS-protected tables will only
// succeed once SUPABASE_SERVICE_ROLE_KEY is set.
//
// Returns null when Supabase isn't configured at all, so callers can degrade
// gracefully (e.g. fall back to the cookie profile store).
// ---------------------------------------------------------------------------

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

let cached: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient | null {
  if (cached) return cached;
  const key = serviceKey || anonKey;
  if (!url || !key) return null;
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

/** True when a privileged (service-role) client is available for RLS-bypassing writes. */
export function hasServiceRole(): boolean {
  return Boolean(url && serviceKey);
}
