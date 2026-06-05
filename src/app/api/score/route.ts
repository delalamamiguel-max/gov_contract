export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { generateMatchAssessment, fallbackAssessment, type AgencyProfile, type OpportunityInput } from '@/lib/ai';

/**
 * POST /api/score
 * Body: { opportunity: OpportunityInput, agencyProfile?: AgencyProfile }
 * (Legacy body { contractTitle, contractDescription, businessNaics, businessCapacities } still accepted.)
 *
 * Returns a marketing-agency MatchAssessment. NEVER returns an empty body and
 * never 500s just because the database / token ledger is unavailable.
 */
export async function POST(req: Request) {
  let opportunity: OpportunityInput | null = null;
  let agencyProfile: AgencyProfile = {};

  try {
    const body = await req.json();

    if (body.opportunity) {
      opportunity = body.opportunity as OpportunityInput;
      agencyProfile = (body.agencyProfile as AgencyProfile) || {};
    } else if (body.contractTitle) {
      // Legacy shape
      opportunity = {
        title: body.contractTitle,
        description: body.contractDescription || null,
        naicsCode: Array.isArray(body.businessNaics) ? body.businessNaics[0] : null,
      };
      agencyProfile = { deliveryCapacity: body.businessCapacities };
    }

    if (!opportunity || !opportunity.title) {
      return NextResponse.json({ error: 'Missing opportunity title' }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  // --- Generate the assessment (has its own internal fallback) ---
  try {
    const assessment = await generateMatchAssessment(opportunity, agencyProfile);
    return NextResponse.json(assessment);
  } catch (err) {
    // Absolute last-resort safety net — should not happen since the generator
    // already falls back internally, but we still never return nothing.
    console.error('[Score] Unexpected assessment error; returning fallback:', err);
    return NextResponse.json(fallbackAssessment(opportunity, agencyProfile));
  }
}
