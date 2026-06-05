export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  readProfile, saveProfileToSupabase, PROFILE_COOKIE, PROFILE_KEY_COOKIE, profileCookieOptions,
} from '@/lib/profile';

/**
 * POST /api/feed/seen — advance the "last feed seen" watermark to now, so the
 * opportunities shown this visit are no longer "new" on the next visit.
 */
export async function POST() {
  const profile = await readProfile();
  profile.lastFeedSeenAt = new Date().toISOString();

  const store = await cookies();
  const pid = store.get(PROFILE_KEY_COOKIE)?.value;

  if (pid) await saveProfileToSupabase(pid, profile); // best-effort

  const res = NextResponse.json({ success: true, lastFeedSeenAt: profile.lastFeedSeenAt });
  // Keep the cookie cache in sync so cookie-only users also track the watermark.
  res.cookies.set(PROFILE_COOKIE, JSON.stringify(profile), profileCookieOptions());
  return res;
}
