export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { readProfile } from '@/lib/profile';
import { generateRfpAssessment, type RfpOpportunity } from '@/lib/rfp';

/**
 * POST /api/rfp-assessment
 * Body: { opportunity: RfpOpportunity, radius?: number }
 * Uses the saved agency profile (server-side) + the opportunity to produce a
 * full RFP assessment. Never throws — the generator falls back deterministically.
 */
export async function POST(req: Request) {
  let opportunity: RfpOpportunity | null = null;
  let radius = 50;
  try {
    const body = await req.json();
    opportunity = body.opportunity as RfpOpportunity;
    if (typeof body.radius === 'number') radius = body.radius;
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  if (!opportunity || !opportunity.title) {
    return NextResponse.json({ error: 'Missing opportunity title' }, { status: 400 });
  }

  const profile = await readProfile();
  const assessment = await generateRfpAssessment(opportunity, profile, radius);
  return NextResponse.json(assessment);
}
