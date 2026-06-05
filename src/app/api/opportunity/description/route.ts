export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { fetchSamGovDescription } from '@/lib/samgov';

/**
 * POST /api/opportunity/description
 * Body: { descriptionUrl: string }
 * Returns: { description: string | null }
 *
 * Lazily resolves SAM.gov's noticedesc URL into real text. Returns null (not an
 * error) when unavailable so the UI can fall back to its synthesized summary.
 */
export async function POST(req: Request) {
  try {
    const { descriptionUrl } = await req.json();
    if (!descriptionUrl || typeof descriptionUrl !== 'string') {
      return NextResponse.json({ description: null }, { status: 200 });
    }
    const description = await fetchSamGovDescription(descriptionUrl);
    return NextResponse.json({ description });
  } catch (e) {
    console.error('[Description API] error:', e);
    return NextResponse.json({ description: null }, { status: 200 });
  }
}
