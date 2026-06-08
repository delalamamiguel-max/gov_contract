import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { AUTH_STORAGE_KEY } from '@/lib/supabase/storageKey';

/**
 * Email confirmation handler (OTP token_hash and PKCE code flows).
 *
 * Same pattern as /auth/callback: we wire the Supabase client directly to
 * request.cookies / response.cookies so that the session Set-Cookie headers
 * are included in the redirect response we return to the browser.
 *
 * Using getSupabaseServer() here would write cookies via Next.js's cookies()
 * store — a separate object from the NextResponse — so those Set-Cookie
 * headers would never reach the browser. This inline client avoids that bug.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const code = searchParams.get('code');
  const next = searchParams.get('next') || '/en/onboarding';

  const successUrl = `${origin}${next}`;
  const errorUrl = `${origin}/en/login?error=confirm_failed`;

  const makeClient = (response: NextResponse) =>
    createServerClient(
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

  if (tokenHash && type) {
    const response = NextResponse.redirect(successUrl);
    const { error } = await makeClient(response).auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return response;
  } else if (code) {
    const response = NextResponse.redirect(successUrl);
    const { error } = await makeClient(response).auth.exchangeCodeForSession(code);
    if (!error) return response;
  }

  return NextResponse.redirect(errorUrl);
}
