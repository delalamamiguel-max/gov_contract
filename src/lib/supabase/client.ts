'use client';

import { createBrowserClient } from '@supabase/ssr';

/**
 * Browser-side Supabase client for auth (login/signup/logout/OAuth).
 * Uses the public anon/publishable key — safe to expose.
 *
 * Routes through a same-origin `/sb` proxy (see `next.config.ts` rewrites)
 * so the browser only ever resolves the Vercel domain. Many DNS-level
 * ad-blockers block `*.supabase.co`, which manifested as `Failed to fetch`
 * on login. Server-side clients (`createServerClient`) keep using the real
 * Supabase URL directly — Vercel's DNS is fine.
 */
export function createClient() {
  const realUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!realUrl || !key) {
    throw new Error(
      'Auth is not configured. NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY were not available at build time.'
    );
  }
  // Same-origin proxy URL in the browser; real Supabase URL during SSR fallback.
  const url =
    typeof window !== 'undefined' ? `${window.location.origin}/sb` : realUrl;
  return createBrowserClient(url, key);
}
