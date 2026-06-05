export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { fetchSamGovDescription } from '@/lib/samgov';
import { cacheDescription } from '@/lib/opportunities';

/**
 * POST /api/opportunity/description
 * Body: { descriptionUrl: string, sourceId?: string }
 * Returns: { description: string | null }
 *
 * Resolves SAM.gov's noticedesc URL into real text for a single opportunity
 * detail view (NOT a search). The result is cached back to Supabase so repeat
 * views never re-hit SAM. Returns null (not an error) when unavailable so the
 * UI can fall back to its synthesized summary.
 */
export async function POST(req: Request) {
  try {
    const { descriptionUrl, sourceId } = await req.json();
    if (!descriptionUrl || typeof descriptionUrl !== 'string') {
      return NextResponse.json({ description: null }, { status: 200 });
    }
    const description = await fetchSamGovDescription(descriptionUrl);
    if (description && typeof sourceId === 'string' && sourceId) {
      await cacheDescription(sourceId, description); // best-effort write-back
    }
    return NextResponse.json({ description });
  } catch (e) {
    console.error('[Description API] error:', e);
    return NextResponse.json({ description: null }, { status: 200 });
  }
}
