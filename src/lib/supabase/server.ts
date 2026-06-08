import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { AUTH_STORAGE_KEY } from './storageKey';

/**
 * Server-side Supabase client bound to the request's auth cookies. Use in
 * server components and route handlers to read the authenticated user.
 */
export async function getSupabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: { name: AUTH_STORAGE_KEY },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Called from a Server Component — safe to ignore; middleware refreshes the session.
          }
        },
      },
    }
  );
}

/** The authenticated user (or null). */
export async function getCurrentUser() {
  const supabase = await getSupabaseServer();
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}
