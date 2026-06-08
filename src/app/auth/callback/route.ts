import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { AUTH_STORAGE_KEY } from '@/lib/supabase/storageKey';

/**
 * OAuth callback — exchanges the PKCE auth code for a session and sets the
 * session cookies directly on the redirect response.
 *
 * IMPORTANT: we do NOT use getSupabaseServer() here because that helper writes
 * cookies via Next.js's cookies() store, which is a separate object from the
 * NextResponse we return. If we used it, the Set-Cookie headers from
 * exchangeCodeForSession would never reach the browser and every Google OAuth
 * attempt would silently fail (no session = bounce back to login).
 *
 * Instead we wire the Supabase client to read from request.cookies and write
 * directly to the response we return, guaranteeing the session cookies are
 * included in the redirect.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') || '/en/dashboard/recommendations';

  if (code) {
    const response = NextResponse.redirect(`${origin}${next}`);

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookieOptions: { name: AUTH_STORAGE_KEY },
        cookies: {
          getAll() {
            return (request as any).cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              (request as any).cookies.set(name, value);
              response.cookies.set(name, value, options);
            });
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return response;
  }

  return NextResponse.redirect(`${origin}/en/login?error=auth_callback`);
}
