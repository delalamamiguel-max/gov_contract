export const dynamic = 'force-dynamic';
import '@/lib/firebase';
import { NextResponse } from 'next/server';
import { generateMatchAssessment, fallbackAssessment, type AgencyProfile, type OpportunityInput } from '@/lib/ai';

const DEMO_TENANT_ID = '123e4567-e89b-12d3-a456-426614174000';

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

  // --- Optional token gating: best-effort, must NEVER block the assessment ---
  try {
    const { getTenant, updateTenantTokens } = await import('@/lib/dataconnect');
    const tenantRes = await getTenant({ id: DEMO_TENANT_ID });
    const tenant = tenantRes?.data?.tenant;
    if (tenant && !tenant.isPro) {
      if (tenant.tokensRemaining <= 0) {
        return NextResponse.json(
          { error: 'Out of AI credits. Please upgrade to Pro.' },
          { status: 403 }
        );
      }
      // Deduct one token; ignore failures.
      updateTenantTokens({ id: DEMO_TENANT_ID, tokensRemaining: tenant.tokensRemaining - 1 }).catch(() => {});
    }
  } catch (e) {
    // Data Connect not reachable server-side — log and continue with the assessment.
    console.warn('[Score] Token ledger unavailable; proceeding without gating.');
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
