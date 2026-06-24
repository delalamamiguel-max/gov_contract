export const dynamic = 'force-dynamic';
export const maxDuration = 300;
import { NextResponse } from 'next/server';
import { runOpportunityEmbedding } from '@/lib/embeddings';

/**
 * GET /api/cron/embed — Phase 3 opportunity embeddings.
 *
 * Embeds marketing opportunities that have Phase 2 intel but no vector yet
 * (all with ?recheck=1), via the actor's local embed mode. Stores the 384-dim
 * vector on opportunity_intel.embedding.
 *
 * Auth: `Authorization: Bearer ${CRON_SECRET}`.
 * Query: ?recheck=1 (re-embed all), ?limit=N.
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

  const summary = await runOpportunityEmbedding({ recheck, limit });
  const ok = summary.status !== 'error';
  return NextResponse.json({ success: ok, summary }, { status: ok ? 200 : 502 });
}
