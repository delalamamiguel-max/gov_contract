export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  readAlerts, syncAlertsToSupabase, ALERTS_COOKIE, type Alert, type AlertCriteria,
} from '@/lib/alerts';
import { PROFILE_KEY_COOKIE, profileCookieOptions } from '@/lib/profile';

async function persist(next: Alert[], extra: Record<string, unknown> = {}) {
  const res = NextResponse.json({ alerts: next, ...extra });
  res.cookies.set(ALERTS_COOKIE, JSON.stringify(next), profileCookieOptions());
  const store = await cookies();
  const pid = store.get(PROFILE_KEY_COOKIE)?.value;
  if (pid) await syncAlertsToSupabase(pid, next); // best-effort
  return res;
}

/** GET — list alerts. */
export async function GET() {
  const alerts = await readAlerts();
  return NextResponse.json({ alerts });
}

/** POST — create an alert. Body: { name, criteria, enabled? } */
export async function POST(req: Request) {
  let body: { name?: string; criteria?: AlertCriteria; enabled?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  const current = await readAlerts();
  const alert: Alert = {
    id: globalThis.crypto.randomUUID(),
    name: body.name?.trim() || 'Untitled alert',
    enabled: body.enabled ?? true,
    criteria: body.criteria || {},
    lastRunAt: null,
    lastMatchCount: null,
  };
  return persist([...current, alert], { alert });
}

/** PUT — update/toggle an alert. Body: { id, patch } */
export async function PUT(req: Request) {
  let body: { id?: string; patch?: Partial<Alert> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  if (!body.id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  const current = await readAlerts();
  if (!current.some((a) => a.id === body.id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const next = current.map((a) => (a.id === body.id ? { ...a, ...body.patch, id: a.id } : a));
  return persist(next);
}

/** DELETE — remove an alert. Body: { id } */
export async function DELETE(req: Request) {
  let body: { id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  const current = await readAlerts();
  const next = current.filter((a) => a.id !== body.id);
  return persist(next);
}
