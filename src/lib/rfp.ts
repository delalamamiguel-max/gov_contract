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
  summary: string;
  scopeRequirements: string[];
  requiredDocuments: string[];
  eligibilityRequirements: string[];
  evaluationCriteria: string[];
  deadlineUrgency: string;
  risks: string[];
  competitiveAdvantages: string[];
  estimatedEffort: string;
  questionsForBuyer: string[];
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
    summary: `${opp.agency || 'The buyer'} is seeking ${opp.title}. Based on the available details, this is a ${assessment.label.toLowerCase()} for your agency (${score}%).`,
    scopeRequirements: [
      opp.title,
      ...(hay.includes('website') || hay.includes('web') ? ['Website design/development'] : []),
      ...(hay.includes('seo') ? ['Search engine optimization'] : []),
      ...(hay.includes('social') ? ['Social media management'] : []),
      ...(hay.includes('brand') ? ['Branding/creative'] : []),
      ...(hay.includes('media') ? ['Media planning/buying'] : []),
    ].slice(0, 6),
    evaluationCriteria: ['Technical approach', 'Relevant experience & past performance', 'Staffing & capacity', 'Price'],
    risks: assessment.whyMayNotFit.length ? assessment.whyMayNotFit : ['Limited solicitation detail available — verify requirements before committing.'],
    questionsForBuyer: [
      'What is the estimated budget range or not-to-exceed amount?',
      'Is there an incumbent, and is this a recompete?',
      'How are proposals weighted across the evaluation criteria?',
      'What is the expected contract length and renewal structure?',
    ],
  };

  const prompt = `You are advising a MARKETING AGENCY on a public-sector RFP. Write specific, plain-English content. Avoid contractor jargon (no trade, crew, bonding, CSLB, DIR, construction compliance) unless the opportunity requires it.

OPPORTUNITY:
- Title: ${opp.title}
- Buyer: ${opp.agency || 'unknown'}
- Set-aside: ${opp.setAsideType || 'none'}
- Estimated value: ${opp.estimatedValue ?? 'unknown'}
- Description: ${opp.description || '(limited — infer from title)'}

AGENCY: services ${(profile.services || []).join(', ') || 'n/a'}; industries ${(profile.industries || []).join(', ') || 'n/a'}; certs ${(profile.certifications || []).join(', ') || 'none'}.

Return STRICT JSON only with these keys:
{
  "summary": "<2-3 sentence plain-English overview>",
  "scopeRequirements": ["<concrete scope item>", ...],
  "evaluationCriteria": ["<likely evaluation factor>", ...],
  "risks": ["<specific risk or blocker>", ...],
  "questionsForBuyer": ["<smart question to ask>", ...]
}`;

  const { data, source } = await aiJson(prompt, fallback);

  return {
    summary: data.summary || fallback.summary,
    scopeRequirements: data.scopeRequirements?.length ? data.scopeRequirements : fallback.scopeRequirements,
    requiredDocuments,
    eligibilityRequirements,
    evaluationCriteria: data.evaluationCriteria?.length ? data.evaluationCriteria : fallback.evaluationCriteria,
    deadlineUrgency: urgency,
    risks: data.risks?.length ? data.risks : fallback.risks,
    competitiveAdvantages,
    estimatedEffort: effort,
    questionsForBuyer: data.questionsForBuyer?.length ? data.questionsForBuyer : fallback.questionsForBuyer,
    recommendation,
    recommendationRationale,
    matchScore: score,
    source,
  };
}
