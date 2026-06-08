import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { AUTH_STORAGE_KEY } from './lib/supabase/storageKey';

const intlMiddleware = createMiddleware(routing);

// Next.js 16: "middleware" renamed to "proxy". Both names are still supported
// during the deprecation period but proxy.ts is the new convention.
export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Root → dashboard if a session cookie is present, else login.
  // This is a fast cookie-presence check (no network call). The dashboard layout
  // still validates the session server-side and bounces to login if it's
  // expired/invalid — so a stale cookie can't grant real access, it just means
  // we optimistically route returning users to their feed instead of the login
  // wall when they type the bare app URL.
  if (pathname === '/' || pathname === '/en' || pathname === '/es') {
    const locale = pathname === '/' ? 'en' : pathname.replace('/', '');
    // supabase-js chunks large session cookies into `${KEY}.0`, `${KEY}.1`, … so
    // match by prefix rather than the exact base name.
    const hasSession = request.cookies
      .getAll()
      .some((c) => c.name === AUTH_STORAGE_KEY || c.name.startsWith(`${AUTH_STORAGE_KEY}.`));
    const dest = hasSession ? `/${locale}/dashboard/recommendations` : `/${locale}/login`;
    return NextResponse.redirect(new URL(dest, request.url));
  }

  // i18n routing response.
  const response = intlMiddleware(request);

  // Refresh the Supabase auth session so server components see a valid user.
  // Wrap in try/catch — if auth/network hiccups here, the page must still load
  // (otherwise a transient Supabase blip would 500 every dashboard request).
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url && key) {
    try {
      const supabase = createServerClient(url, key, {
        cookieOptions: { name: AUTH_STORAGE_KEY },
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              request.cookies.set(name, value);
              response.cookies.set(name, value, options);
            });
          },
        },
      });
      await supabase.auth.getUser();
    } catch (e) {
      console.warn('[proxy] supabase.auth.getUser failed:', e instanceof Error ? e.message : e);
    }
  }

  return response;
}

export const config = {
  matcher: ['/', '/(en|es)/:path*'],
};
