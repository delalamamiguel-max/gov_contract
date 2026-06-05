import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

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
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
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
    }
  );
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: ['/', '/(en|es)/:path*'],
};
