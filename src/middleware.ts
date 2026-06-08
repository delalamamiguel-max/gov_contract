import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { AUTH_STORAGE_KEY } from './lib/supabase/storageKey';

const intlMiddleware = createMiddleware(routing);

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Root → login
  if (pathname === '/' || pathname === '/en' || pathname === '/es') {
    const locale = pathname === '/' ? 'en' : pathname.replace('/', '');
    return NextResponse.redirect(new URL(`/${locale}/login`, request.url));
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
      console.warn('[middleware] supabase.auth.getUser failed:', e instanceof Error ? e.message : e);
    }
  }

  return response;
}

export const config = {
  matcher: ['/', '/(en|es)/:path*'],
};
