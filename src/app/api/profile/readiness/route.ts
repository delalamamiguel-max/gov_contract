export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  readProfile, saveProfileToSupabase, getProfileKey,
  PROFILE_COOKIE, PROFILE_KEY_COOKIE, profileCookieOptions,
} from '@/lib/profile';

/**
 * POST /api/profile/readiness — add one or more proposal-readiness items to the
 * saved profile (de-duped, case-insensitive), then persist. This is a *merge*
 * endpoint so the client can fill a single gap (e.g. "References") without
 * shipping the whole profile back, unlike POST /api/profile which replaces it.
 *
 * Body: { items: string[] }  (or { item: string })
 */
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const incoming: string[] = Array.isArray(body.items)
    ? (body.items as unknown[]).filter((x): x is string => typeof x === 'string')
    : typeof body.item === 'string'
    ? [body.item]
    : [];
  const cleaned = incoming.map((s) => s.trim()).filter(Boolean);
  if (cleaned.length === 0) {
    return NextResponse.json({ error: 'No readiness items provided' }, { status: 400 });
  }

  const profile = await readProfile();
  const existing = profile.proposalReadiness ?? [];
  const lowerExisting = new Set(existing.map((s) => s.toLowerCase()));
  const merged = [...existing];
  for (const item of cleaned) {
    if (!lowerExisting.has(item.toLowerCase())) {
      merged.push(item);
      lowerExisting.add(item.toLowerCase());
    }
  }
  const updated = { ...profile, proposalReadiness: merged };

  const store = await cookies();
  const profileKey =
    (await getProfileKey()) || store.get(PROFILE_KEY_COOKIE)?.value || globalThis.crypto.randomUUID();

  const persisted = await saveProfileToSupabase(profileKey, updated);

  const res = NextResponse.json({ success: true, proposalReadiness: merged, persisted });
  res.cookies.set(PROFILE_KEY_COOKIE, profileKey, profileCookieOptions());
  res.cookies.set(PROFILE_COOKIE, JSON.stringify(updated), profileCookieOptions());
  return res;
}

/**
 * DELETE /api/profile/readiness — remove one or more proposal-readiness items
 * from the saved profile (case-insensitive), then persist. This enables the
 * toggle-off behaviour in the ReadinessEditor.
 *
 * Body: { items: string[] }  (or { item: string })
 */
export async function DELETE(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const incoming: string[] = Array.isArray(body.items)
    ? (body.items as unknown[]).filter((x): x is string => typeof x === 'string')
    : typeof body.item === 'string'
    ? [body.item]
    : [];
  const cleaned = incoming.map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (cleaned.length === 0) {
    return NextResponse.json({ error: 'No readiness items provided' }, { status: 400 });
  }

  const profile = await readProfile();
  const existing = profile.proposalReadiness ?? [];
  const toRemove = new Set(cleaned);
  const filtered = existing.filter((s) => !toRemove.has(s.toLowerCase()));
  const updated = { ...profile, proposalReadiness: filtered };

  const store = await cookies();
  const profileKey =
    (await getProfileKey()) || store.get(PROFILE_KEY_COOKIE)?.value || globalThis.crypto.randomUUID();

  const persisted = await saveProfileToSupabase(profileKey, updated);

  const res = NextResponse.json({ success: true, proposalReadiness: filtered, persisted });
  res.cookies.set(PROFILE_KEY_COOKIE, profileKey, profileCookieOptions());
  res.cookies.set(PROFILE_COOKIE, JSON.stringify(updated), profileCookieOptions());
  return res;
}
