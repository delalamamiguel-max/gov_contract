export const dynamic = 'force-dynamic';
export const maxDuration = 300; // allow a longer-running sync
import { NextResponse } from 'next/server';
import { syncOpportunities, shouldRunSync, getSyncConfig } from '@/lib/ingest';
import { syncDgsNcb } from '@/lib/sources/dgs';
import { syncCaltrans } from '@/lib/sources/caltrans';
import { syncCaleprocure } from '@/lib/sources/caleprocure';

/**
 * GET /api/cron/ingest — scheduled opportunity ingestion into Supabase.
 *
 * Sources:
 *   - sam.gov     (live federal opportunities)   — throttled by SYNC_MIN_INTERVAL_HOURS
 *   - dgs-ncb     (CA DGS non-competitive bids; market intel)
 *   - caltrans    (CA highway/infra project pipeline; market intel)
 *   - caleprocure (CA open state bids via Apify)  — auto-runs only if CALEPROCURE_AUTO=true
 *                                                   (paid per-result); always on demand via ?source
 *
 * Auth: requires `Authorization: Bearer ${CRON_SECRET}` (Vercel Cron sends this
 * automatically when CRON_SECRET is set).
 * Query: `?force=1` bypasses the throttle; `?source=sam|dgs|caltrans|caleprocure` runs one source.
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

  // SAM.gov (throttled) - TEMPORARILY DISABLED
  if (!source || source === 'sam') {
    results.sam = { status: 'skipped', reason: 'temporarily disabled' };
  }

  // California DGS non-competitive bids - TEMPORARILY DISABLED
  if (!source || source === 'dgs') {
    results.dgs = { status: 'skipped', reason: 'temporarily disabled' };
  }

  // Caltrans project pipeline - TEMPORARILY DISABLED
  if (!source || source === 'caltrans') {
    results.caltrans = { status: 'skipped', reason: 'temporarily disabled' };
  }

  // Cal eProcure open CA bids via Apify (paid). Auto-runs only when opted in;
  // always runs when explicitly requested with ?source=caleprocure.
  const caleAuto = process.env.CALEPROCURE_AUTO === 'true';
  if (source === 'caleprocure' || (!source && caleAuto)) {
    const cale = await syncCaleprocure();
    results.caleprocure = cale;
    if (cale.status === 'error') anyError = true;
  }

  return NextResponse.json({ success: !anyError, results }, { status: anyError ? 502 : 200 });
}
