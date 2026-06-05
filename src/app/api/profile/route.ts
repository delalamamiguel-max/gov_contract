export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { normalizeProfile, readProfile, PROFILE_COOKIE, profileCookieOptions } from '@/lib/profile';

const DEMO_TENANT_ID = '123e4567-e89b-12d3-a456-426614174000';

/** GET /api/profile — return the saved agency profile. */
export async function GET() {
  const profile = await readProfile();
  return NextResponse.json({ profile });
}

/** POST /api/profile — persist the agency profile (cookie = source of truth). */
export async function POST(request: Request) {
  let profile;
  try {
    const body = await request.json();
    profile = normalizeProfile(body);
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const res = NextResponse.json({ success: true, profile });
  res.cookies.set(PROFILE_COOKIE, JSON.stringify(profile), profileCookieOptions());

  // Best-effort mirror to Data Connect — must never block or fail the request.
  try {
    const { upsertBusinessProfile } = await import('@/lib/dataconnect');
    await upsertBusinessProfile({
      tenantId: DEMO_TENANT_ID,
      naicsCodes: profile.naicsCodes ?? [],
      setAsideTypes: profile.setAsideTypes ?? [],
      minCapacity: profile.minContract ?? null,
      maxCapacity: profile.maxContract ?? null,
    });
  } catch {
    console.warn('[Profile] Data Connect mirror unavailable; saved to cookie only.');
  }

  return res;
}
