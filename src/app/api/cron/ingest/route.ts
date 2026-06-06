export const dynamic = 'force-dynamic';
export const maxDuration = 300; // allow a longer-running sync
import { NextResponse } from 'next/server';
import { syncOpportunities, shouldRunSync, getSyncConfig } from '@/lib/ingest';
import { syncDgsNcb } from '@/lib/sources/dgs';

/**
 * GET /api/cron/ingest — scheduled opportunity ingestion into Supabase.
 *
 * Sources:
 *   - sam.gov  (live opportunities)        — throttled by SYNC_MIN_INTERVAL_HOURS
 *   - dgs-ncb  (CA DGS non-competitive bids)
 *
 * Auth: requires `Authorization: Bearer ${CRON_SECRET}` (Vercel Cron sends this
 * automatically when CRON_SECRET is set).
 * Query: `?force=1` bypasses the throttle; `?source=sam|dgs` runs just one source.
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

  const params = new URL(request.url).searchParams;
  const force = params.get('force') === '1';
  const source = params.get('source'); // 'sam' | 'dgs' | null (= all)
  const cfg = getSyncConfig();

  const results: Record<string, unknown> = {};
  let anyError = false;

  // SAM.gov (throttled)
  if (!source || source === 'sam') {
    if (!force) {
      const gate = await shouldRunSync(cfg.minIntervalHours);
      if (!gate.ok) {
        results.sam = { status: 'skipped', reason: gate.reason };
      }
    }
    if (!results.sam) {
      const sam = await syncOpportunities();
      results.sam = sam;
      if (sam.status === 'error') anyError = true;
    }
  }

  // California DGS non-competitive bids (idempotent; runs each time)
  if (!source || source === 'dgs') {
    const dgs = await syncDgsNcb();
    results.dgs = dgs;
    if (dgs.status === 'error') anyError = true;
  }

  return NextResponse.json({ success: !anyError, results }, { status: anyError ? 502 : 200 });
}
