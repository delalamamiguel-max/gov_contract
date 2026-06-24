export const dynamic = 'force-dynamic';
export const maxDuration = 300;
import { NextResponse } from 'next/server';
import { runDocumentExtraction } from '@/lib/documents';

/**
 * GET /api/cron/extract — Phase 1 attachment text extraction (gated to the
 * marketing set). Drives the Apify actor's extract mode and persists extracted
 * text into opportunity_documents. Idempotent: skips already-extracted opps.
 *
 * Auth: `Authorization: Bearer ${CRON_SECRET}`.
 * Query:
 *   ?recheck=1   re-extract even opps that already have document rows
 *   ?limit=N     cap opportunities processed this run
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

  const summary = await runDocumentExtraction({ recheck, limit });
  const ok = summary.status !== 'error';
  return NextResponse.json({ success: ok, summary }, { status: ok ? 200 : 502 });
}
