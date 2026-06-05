export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  normalizeProfile, readProfile, saveProfileToSupabase,
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

  // Stable per-browser key (becomes the Supabase row key; maps to auth uid later).
  const store = await cookies();
  const profileKey = store.get(PROFILE_KEY_COOKIE)?.value || globalThis.crypto.randomUUID();

  const persisted = await saveProfileToSupabase(profileKey, profile);

  const res = NextResponse.json({ success: true, profile, persisted });
  res.cookies.set(PROFILE_KEY_COOKIE, profileKey, profileCookieOptions());
  // Always keep the cookie cache too, so reads work even if Supabase is down.
  res.cookies.set(PROFILE_COOKIE, JSON.stringify(profile), profileCookieOptions());
  return res;
}
