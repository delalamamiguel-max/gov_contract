import { NextResponse } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { getSupabaseServer } from '@/lib/supabase/server';

/**
 * Email confirmation handler. Supabase's confirmation/magic links land here.
 *
 * Supports both link styles so it works no matter how the email template is set:
 *  - token_hash + type  → verifyOtp (works cross-browser, no PKCE cookie needed)
 *  - code               → exchangeCodeForSession (PKCE, same-browser)
 *
 * On success we set the auth cookies and redirect to `next`.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const code = searchParams.get('code');
  const next = searchParams.get('next') || '/en/onboarding';

  const supabase = await getSupabaseServer();

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(`${origin}/en/login?error=confirm_failed`);
}
