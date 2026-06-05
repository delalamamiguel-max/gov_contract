export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import {
  readProfile, saveProfileToSupabase, getProfileKey, PROFILE_COOKIE, profileCookieOptions,
} from '@/lib/profile';

/**
 * POST /api/feed/seen — advance the "last feed seen" watermark to now, so the
 * opportunities shown this visit are no longer "new" on the next visit.
 */
export async function POST() {
  const profile = await readProfile();
  profile.lastFeedSeenAt = new Date().toISOString();

  const pid = await getProfileKey();

  if (pid) await saveProfileToSupabase(pid, profile); // best-effort

  const res = NextResponse.json({ success: true, lastFeedSeenAt: profile.lastFeedSeenAt });
  // Keep the cookie cache in sync so cookie-only users also track the watermark.
  res.cookies.set(PROFILE_COOKIE, JSON.stringify(profile), profileCookieOptions());
  return res;
}
