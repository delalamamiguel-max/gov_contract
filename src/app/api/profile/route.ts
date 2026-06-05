export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  normalizeProfile, readProfile, saveProfileToSupabase, getProfileKey,
  PROFILE_COOKIE, PROFILE_KEY_COOKIE, profileCookieOptions,
} from '@/lib/profile';

/** GET /api/profile — return the saved agency profile. */
export async function GET() {
  const profile = await readProfile();
  return NextResponse.json({ profile });
}

/** POST /api/profile — persist the agency profile (Supabase primary, cookie fallback). */
export async function POST(request: Request) {
  let profile;
  try {
    const body = await request.json();
    profile = normalizeProfile(body);
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  // Key the row by the authenticated user id; fall back to a cookie id only for
  // anonymous/legacy sessions during the transition.
  const store = await cookies();
  const profileKey =
    (await getProfileKey()) || store.get(PROFILE_KEY_COOKIE)?.value || globalThis.crypto.randomUUID();

  const persisted = await saveProfileToSupabase(profileKey, profile);

  const res = NextResponse.json({ success: true, profile, persisted });
  res.cookies.set(PROFILE_KEY_COOKIE, profileKey, profileCookieOptions());
  // Always keep the cookie cache too, so reads work even if Supabase is down.
  res.cookies.set(PROFILE_COOKIE, JSON.stringify(profile), profileCookieOptions());
  return res;
}
