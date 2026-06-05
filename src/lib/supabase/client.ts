'use client';

import { createBrowserClient } from '@supabase/ssr';

/**
 * Browser-side Supabase client for auth (login/signup/logout/OAuth).
 * Uses the public anon/publishable key — safe to expose.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
