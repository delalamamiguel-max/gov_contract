'use client';

import { createBrowserClient } from '@supabase/ssr';

/**
 * Browser-side Supabase client for auth (login/signup/logout/OAuth).
 * Uses the public anon/publishable key — safe to expose.
 *
 * Throws a clear error if the public env vars weren't baked at build time —
 * otherwise `signInWithPassword` would silently fail with a confusing
 * "Failed to fetch" because the SDK constructs `undefined/auth/v1/token`.
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      'Auth is not configured. NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY were not available at build time.'
    );
  }
  return createBrowserClient(url, key);
}
