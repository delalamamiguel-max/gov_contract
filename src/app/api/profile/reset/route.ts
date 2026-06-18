export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  readProfile, saveProfileToSupabase, getProfileKey,
  PROFILE_COOKIE, PROFILE_KEY_COOKIE, profileCookieOptions,
  RESET_PROFILE_FIELDS
} from '@/lib/profile';

/** POST /api/profile/reset — Purge core agency data but retain keywords/preferences */
export async function POST() {
  const profile = await readProfile();

  // Clear all onboarding-related fields
  for (const field of RESET_PROFILE_FIELDS) {
    delete profile[field];
  }

  const store = await cookies();
  const profileKey =
    (await getProfileKey()) || store.get(PROFILE_KEY_COOKIE)?.value || globalThis.crypto.randomUUID();

  const persisted = await saveProfileToSupabase(profileKey, profile);

  const res = NextResponse.json({ success: true, profile, persisted });
  res.cookies.set(PROFILE_KEY_COOKIE, profileKey, profileCookieOptions());
  res.cookies.set(PROFILE_COOKIE, JSON.stringify(profile), profileCookieOptions());
  
  return res;
}
