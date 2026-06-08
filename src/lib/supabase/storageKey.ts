/**
 * The auth cookie/storage key MUST be identical across the browser and server
 * Supabase clients, otherwise the session (and the PKCE code-verifier) written
 * by one is invisible to the other.
 *
 * supabase-js derives this key from the first label of the URL hostname
 * (`sb-<label>-auth-token`). Our browser client talks to the same-origin `/sb`
 * proxy (to dodge DNS ad-blockers on *.supabase.co), so it would otherwise
 * derive `sb-<vercel-subdomain>-auth-token`, while the server client — which
 * uses the real Supabase URL — derives `sb-<project-ref>-auth-token`. That
 * mismatch broke Google OAuth (verifier cookie not found on callback) and SSR
 * sessions. We pin the key to the real project ref everywhere.
 */
function deriveAuthStorageKey(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return 'sb-auth-token';
  try {
    return `sb-${new URL(url).hostname.split('.')[0]}-auth-token`;
  } catch {
    return 'sb-auth-token';
  }
}

export const AUTH_STORAGE_KEY = deriveAuthStorageKey();
