export const dynamic = 'force-dynamic';
export const maxDuration = 300;
import { NextResponse } from 'next/server';
import { runIntelExtraction } from '@/lib/intel';

/**
 * GET /api/cron/intel — Phase 2 structured intelligence extraction.
 *
 * Derives scope_summary + entities from each opportunity's extracted document
 * text into opportunity_intel. Idempotent: skips opps whose document set is
 * unchanged (content_hash) unless ?recheck=1.
 *
 * Auth: `Authorization: Bearer ${CRON_SECRET}`.
 * Query: ?recheck=1 (re-derive all), ?limit=N (cap opportunities).
 */
export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }
  if (request.headers.get('authorization') !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const recheck = params.get('recheck') === '1';
  const limitParam = params.get('limit');
  const limit = limitParam ? Math.max(1, parseInt(limitParam, 10)) : undefined;

  const summary = await runIntelExtraction({ recheck, limit });
  const ok = summary.status !== 'error';
  return NextResponse.json({ success: ok, summary }, { status: ok ? 200 : 502 });
}
