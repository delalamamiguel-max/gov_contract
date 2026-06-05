export const dynamic = 'force-dynamic';
export const maxDuration = 300; // allow a longer-running sync
import { NextResponse } from 'next/server';
import { syncOpportunities, shouldRunSync, getSyncConfig } from '@/lib/ingest';

/**
 * GET /api/cron/ingest — scheduled SAM.gov → Supabase ingestion.
 *
 * Auth: requires `Authorization: Bearer ${CRON_SECRET}` (Vercel Cron sends this
 * automatically when CRON_SECRET is set). Pass `?force=1` to bypass the
 * SYNC_MIN_INTERVAL_HOURS throttle (manual runs).
 */
export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const force = new URL(request.url).searchParams.get('force') === '1';
  const cfg = getSyncConfig();

  if (!force) {
    const gate = await shouldRunSync(cfg.minIntervalHours);
    if (!gate.ok) {
      return NextResponse.json({ success: true, status: 'skipped', reason: gate.reason });
    }
  }

  const summary = await syncOpportunities();
  const httpStatus = summary.status === 'error' ? 502 : 200;
  return NextResponse.json({ success: summary.status !== 'error', ...summary }, { status: httpStatus });
}
