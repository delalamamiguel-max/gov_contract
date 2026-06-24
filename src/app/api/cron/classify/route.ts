export const dynamic = 'force-dynamic';
export const maxDuration = 300;
import { NextResponse } from 'next/server';
import { runRelevanceClassification } from '@/lib/relevance';

/**
 * GET /api/cron/classify — Phase 0 marketing relevance gate (SHADOW MODE).
 *
 * Classifies stored Cal eProcure opportunities and writes the gate columns
 * (is_marketing, marketing_category, relevance_*). It does NOT filter any read
 * path yet — this only populates the classification for review.
 *
 * Auth: `Authorization: Bearer ${CRON_SECRET}`.
 * Query:
 *   ?recheck=1   re-classify every active row (default: only unchecked rows)
 *   ?nollm=1     deterministic tiers only (skip the LLM tier)
 *   ?limit=N     cap rows processed
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
  const useLlm = params.get('nollm') !== '1';
  const limitParam = params.get('limit');
  const limit = limitParam ? Math.max(1, parseInt(limitParam, 10)) : undefined;

  const summary = await runRelevanceClassification({ recheck, useLlm, limit });
  const ok = summary.status !== 'error';
  return NextResponse.json({ success: ok, mode: 'shadow', summary }, { status: ok ? 200 : 502 });
}
