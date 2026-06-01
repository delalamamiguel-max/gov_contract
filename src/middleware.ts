import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import { NextRequest, NextResponse } from 'next/server';
 
const intlMiddleware = createMiddleware(routing);

export default function middleware(request: NextRequest) {
  // 1. Run the i18n middleware to handle localization
  const response = intlMiddleware(request);

  // 2. Redirect Root to Login
  const pathname = request.nextUrl.pathname;
  if (pathname === '/en' || pathname === '/es' || pathname === '/') {
    const locale = pathname === '/' ? 'en' : pathname.replace('/', '');
    return NextResponse.redirect(new URL(`/${locale}/login`, request.url));
  }

  // 3. Perform RBAC Checks
  const adminOnlyPaths = [
    '/dashboard/settings',
    '/dashboard/billing',
    '/onboarding'
  ];

  // Check if the current path requires Admin access
  const requiresAdmin = adminOnlyPaths.some(p => pathname.includes(p));

  if (requiresAdmin) {
    // In a real application, we would decode the Firebase Auth JWT here
    // using request.cookies.get('session') and verify the `role` custom claim.
    
    // For MVP Phase 2 wiring, we'll simulate the check using a cookie or header.
    // Let's assume the user's role is stored in a cookie called 'user_role'.
    const userRole = request.cookies.get('user_role')?.value || 'admin'; // default to admin for local testing

    if (userRole === 'worker') {
      // Workers are not allowed here. Redirect to the main dashboard search.
      // We extract the locale to safely redirect (e.g., /en/dashboard/search)
      const locale = pathname.split('/')[1] || 'en';
      return NextResponse.redirect(new URL(`/${locale}/dashboard/search`, request.url));
    }
  }

  return response;
}
 
export const config = {
  matcher: ['/', '/(en|es)/:path*']
};
