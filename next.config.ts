import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

const nextConfig: NextConfig = {
  // Proxy Supabase auth/REST through our own domain. Many DNS-level
  // ad-blockers (NextDNS, AdGuard DNS, corporate DNS) block `*.supabase.co`,
  // which surfaces as `net::ERR_NAME_NOT_RESOLVED` + "Failed to fetch" on
  // login. By rewriting `/sb/*` → `https://<project>.supabase.co/*`, the
  // browser only ever resolves the Vercel domain (already cached); the
  // upstream call happens server-side on Vercel where DNS works fine.
  async rewrites() {
    if (!SUPABASE_URL) return [];
    return [
      {
        source: '/sb/:path*',
        destination: `${SUPABASE_URL}/:path*`,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
