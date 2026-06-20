import type { AgencyProfile } from '@/lib/profile';
import { computeAssessment, type AssessmentOpportunity } from '@/lib/assessment';
import { computeChecklist } from '@/lib/checklist';
import { aiJson } from '@/lib/ai';

// ---------------------------------------------------------------------------
// RFP Assessment workflow. Combines deterministic facts (eligibility, required
// docs, advantages, deadline, effort, gated recommendation) with AI-written
// narrative (summary, scope, evaluation criteria, risks, buyer questions).
// Falls back to deterministic text when AI is unavailable.
// ---------------------------------------------------------------------------

export type RfpRecommendation = 'Pursue' | 'Pursue if gaps are resolved' | 'Save for later' | 'Pass';

export interface RfpOpportunity extends AssessmentOpportunity {
  agency?: string | null;
}

export interface RfpAssessment {
  what_this_is: string;
  why_it_fits: string[];
  why_it_may_not_fit: string[];
  what_is_required_to_respond: string[];
  checklist_before_you_apply: string[];
  deadline: string;
  amount_or_value: string;
  important_watchouts: string[];
  recommended_supporting_materials: string[];
  source_documents_used: string[];
  recommendation: RfpRecommendation;
  recommendationRationale: string;
  matchScore: number;
  source: 'ai' | 'fallback';
}

function deadlineUrgency(deadline?: string | null): string {
  if (!deadline) return 'No deadline captured — verify the closing date on SAM.gov.';
  const days = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return 'Closed — the response deadline has passed.';
  if (days <= 7) return `High urgency — due in ${days} day${days === 1 ? '' : 's'}.`;
  if (days <= 21) return `Moderate urgency — due in ${days} days.`;
  return `Low urgency — due in ${days} days.`;
}

function estimateEffort(opp: RfpOpportunity, missingCount: number): string {
  const hay = `${opp.title} ${opp.description || ''}`.toLowerCase();
  let score = missingCount;
  if (['website', 'web', 'digital', 'data', 'analytics'].some((d) => hay.includes(d))) score += 2;
  if (['media buy', 'media planning', 'paid media'].some((d) => hay.includes(d))) score += 2;
  if (['translation', 'localization', 'multilingual'].some((d) => hay.includes(d))) score += 1;
  if (opp.estimatedValue && opp.estimatedValue >= 500_000) score += 2;
  if (score <= 3) return 'Low — roughly 8–15 hours to assemble a competitive response.';
  if (score <= 6) return 'Medium — roughly 20–35 hours; plan for a technical narrative and tailored samples.';
  return 'High — roughly 40–60+ hours; treat as a major pursuit with a dedicated proposal lead.';
}

export async function generateRfpAssessment(
  opp: RfpOpportunity,
  profile: AgencyProfile,
  radius = 50
): Promise<RfpAssessment> {
  const assessment = computeAssessment(opp, profile, radius);
  const checklist = computeChecklist(opp, profile);

  // --- Deterministic facts ---
  const requiredDocuments = Array.from(
    new Set([...checklist.requiredDocuments, 'Capability statement', 'Pricing / rate card', 'References'])
  );
  const eligibilityRequirements = [
    opp.setAsideType && opp.setAsideType.toLowerCase() !== 'no set aside used'
      ? `Set-aside: ${opp.setAsideType}`
      : 'Open competition (no set-aside)',
    'Active SAM.gov registration',
    'Required insurance (general liability; E&O/cyber for digital work)',
    ...assessment.missingRequirements,
  ];
  const competitiveAdvantages = assessment.competitiveAdvantages.length
    ? assessment.competitiveAdvantages
    : ['Tailor your strongest relevant work to this buyer to build an edge.'];
  const urgency = deadlineUrgency(opp.responseDeadline ?? null);
  const effort = estimateEffort(opp, checklist.summary.missing + checklist.summary.required);

  // Gated recommendation — never "Pursue" with a hard gap.
  const score = assessment.matchScore;
  let recommendation: RfpRecommendation;
  if (assessment.hardRequirementMissing) recommendation = 'Pass';
  else if (score >= 78) recommendation = 'Pursue';
  else if (score >= 58) recommendation = 'Pursue if gaps are resolved';
  else if (score >= 42) recommendation = 'Save for later';
  else recommendation = 'Pass';

  const recommendationRationale = assessment.hardRequirementMissing
    ? `A hard requirement is unmet (${assessment.missingRequirements[0] || 'eligibility gap'}), so this is not pursuable as-is.`
    : `Match score ${score}% (Eligibility ${assessment.eligibility.score}%, Fit ${assessment.fit.score}%, Edge ${assessment.edge.score}%). ${assessment.whyFits[0] || ''}`.trim();

  // --- AI narrative (with deterministic fallback) ---
  const hay = `${opp.title} ${opp.description || ''}`.toLowerCase();
    const fallback = {
    what_this_is: `${opp.agency || 'The buyer'} is seeking ${opp.title}. Based on the available details, this is a ${assessment.label.toLowerCase()} for your agency (${score}%).`,
    why_it_fits: assessment.whyFits.length ? assessment.whyFits : ['Strong alignment with your core capabilities.'],
    why_it_may_not_fit: assessment.whyMayNotFit.length ? assessment.whyMayNotFit : ['Limited details available.'],
    what_is_required_to_respond: [
      opp.title,
      ...(hay.includes('website') || hay.includes('web') ? ['Website design/development'] : []),
      ...(hay.includes('seo') ? ['Search engine optimization'] : []),
      ...(hay.includes('social') ? ['Social media management'] : []),
      ...(hay.includes('brand') ? ['Branding/creative'] : []),
      ...(hay.includes('media') ? ['Media planning/buying'] : []),
    ].slice(0, 6),
    checklist_before_you_apply: requiredDocuments,
    deadline: urgency,
    amount_or_value: opp.estimatedValue ? `${opp.estimatedValue.toLocaleString()}` : 'Not specified',
    important_watchouts: ['Verify all requirements on the official solicitation portal before committing resources.'],
    recommended_supporting_materials: ['Capability statement', 'Relevant case studies'],
    source_documents_used: ['Original solicitation listing'],
  };

    const prompt = `You are BidFlare’s Opportunity Intelligence Engine. You are advising a MARKETING AGENCY on a public-sector RFP. Write specific, highly actionable, plain-English content. Avoid generic contractor jargon unless the opportunity explicitly requires it.

OPPORTUNITY:
- Title: ${opp.title}
- Buyer: ${opp.agency || 'unknown'}
- Set-aside: ${opp.setAsideType || 'none'}
- Estimated value: ${opp.estimatedValue ?? 'unknown'}
- Description: ${opp.description || '(limited — infer from title)'}

AGENCY PROFILE:
- Services: ${(profile.services || []).join(', ') || 'n/a'}
- Industries: ${(profile.industries || []).join(', ') || 'n/a'}
- Certifications: ${(profile.certifications || []).join(', ') || 'none'}

Return STRICT JSON exactly matching this schema:
{
  "what_this_is": "<2-3 sentence plain-English overview of the project and scope>",
  "why_it_fits": ["<reason it matches agency>", ...],
  "why_it_may_not_fit": ["<potential gap or risk>", ...],
  "what_is_required_to_respond": ["<specific requirement>", ...],
  "checklist_before_you_apply": ["<action item>", ...],
  "deadline": "<deadline urgency assessment>",
  "amount_or_value": "<estimated value or 'Unknown'>",
  "important_watchouts": ["<critical warning or watchout>", ...],
  "recommended_supporting_materials": ["<material to include in proposal>", ...],
  "source_documents_used": ["<document name if mentioned in description>", ...]
}`;

  const { data, source } = await aiJson(prompt, fallback);

    return {
    what_this_is: data.what_this_is || fallback.what_this_is,
    why_it_fits: data.why_it_fits?.length ? data.why_it_fits : fallback.why_it_fits,
    why_it_may_not_fit: data.why_it_may_not_fit?.length ? data.why_it_may_not_fit : fallback.why_it_may_not_fit,
    what_is_required_to_respond: data.what_is_required_to_respond?.length ? data.what_is_required_to_respond : fallback.what_is_required_to_respond,
    checklist_before_you_apply: data.checklist_before_you_apply?.length ? data.checklist_before_you_apply : fallback.checklist_before_you_apply,
    deadline: data.deadline || fallback.deadline,
    amount_or_value: data.amount_or_value || fallback.amount_or_value,
    important_watchouts: data.important_watchouts?.length ? data.important_watchouts : fallback.important_watchouts,
    recommended_supporting_materials: data.recommended_supporting_materials?.length ? data.recommended_supporting_materials : fallback.recommended_supporting_materials,
    source_documents_used: data.source_documents_used?.length ? data.source_documents_used : fallback.source_documents_used,
    recommendation,
    recommendationRationale,
    matchScore: score,
    source,
  };
}
