import OpenAI from 'openai';

// ---------------------------------------------------------------------------
// AI client — Ollama Cloud (OpenAI-compatible) by default.
//
// Configure via env:
//   OLLAMA_API_KEY  — Ollama Cloud API key (preferred)
//   AI_BASE_URL     — default https://ollama.com/v1
//   AI_MODEL        — default gpt-oss:20b
//
// Falls back to KIMI_API_KEY / Moonshot only if explicitly configured that way.
// IMPORTANT: gpt-oss is a reasoning model — do NOT set a small max_tokens or the
// visible answer comes back empty (hidden reasoning eats the budget).
// ---------------------------------------------------------------------------

const AI_API_KEY = process.env.OLLAMA_API_KEY || process.env.KIMI_API_KEY || '';
const AI_BASE_URL = process.env.AI_BASE_URL || 'https://ollama.com/v1';
const AI_MODEL = process.env.AI_MODEL || 'glm-5.2:cloud';
const AI_REQUEST_TIMEOUT_MS = 25_000;

const aiEnabled = Boolean(AI_API_KEY);

const openai = new OpenAI({
  apiKey: AI_API_KEY || 'dummy_key',
  baseURL: AI_BASE_URL,
  timeout: 30_000,
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MatchLabel = 'Strong match' | 'Good match' | 'Possible match' | 'Weak match';

export interface AgencyProfile {
  services?: string[];
  industries?: string[];
  certifications?: string[];
  location?: string | null;
  serviceRadiusMiles?: number | null;
  remotePreference?: 'local' | 'remote' | 'hybrid' | null;
  teamSize?: string | null;
  deliveryCapacity?: string | null;
  minContract?: number | null;
  maxContract?: number | null;
  role?: 'prime' | 'subcontractor' | 'both' | null;
  pastPerformance?: string[];
  keywords?: string[];
}

export interface OpportunityInput {
  title: string;
  description?: string | null;
  agency?: string | null;
  naicsCode?: string | null;
  pscCode?: string | null;
  setAsideType?: string | null;
  placeOfPerformance?: string | null;
  estimatedValue?: number | null;
}

export interface MatchAssessment {
  fitScore: number;            // 0-100 overall
  label: MatchLabel;
  matchSummary: string;        // plain-English overview
  whyFits: string[];
  whyMayNotFit: string[];
  missingRequirements: string[];
  recommendedAction: string;
  source: 'ai' | 'fallback';   // so the UI can be transparent
}

// Backward-compatible shape used by older callers.
export interface FitScoreResult {
  fitScore: number;
  matchSummary: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function scoreToLabel(score: number): MatchLabel {
  if (score >= 80) return 'Strong match';
  if (score >= 60) return 'Good match';
  if (score >= 40) return 'Possible match';
  return 'Weak match';
}

const MARKETING_TERMS = [
  'marketing', 'advertis', 'communication', 'public relations', ' pr ', 'branding', 'brand ',
  'website', 'web design', 'web development', 'digital', 'seo', 'social media', 'media buy',
  'creative', 'campaign', 'outreach', 'graphic design', 'video', 'content', 'copywrit',
  'strategy', 'market research', 'translation', 'localization', 'photography', 'email marketing',
];

/**
 * Deterministic fallback assessment. Runs with zero external calls so the user
 * NEVER sees a blank AI section, even if the model is down or unconfigured.
 * Uses keyword overlap between the opportunity and the agency's services/keywords.
 */
export function fallbackAssessment(
  opp: OpportunityInput,
  profile: AgencyProfile
): MatchAssessment {
  const haystack = `${opp.title} ${opp.description || ''} ${opp.setAsideType || ''}`.toLowerCase();
  const services = (profile.services || []).map((s) => s.toLowerCase());
  const keywords = (profile.keywords || []).map((k) => k.toLowerCase());

  const looksMarketing = MARKETING_TERMS.some((t) => haystack.includes(t.trim()));
  const serviceHits = services.filter((s) => s && haystack.includes(s));
  const keywordHits = keywords.filter((k) => k && haystack.includes(k));

  const whyFits: string[] = [];
  const whyMayNotFit: string[] = [];
  const missingRequirements: string[] = [];

  let score = 35; // neutral baseline

  if (looksMarketing) {
    score += 20;
    whyFits.push('The opportunity involves marketing, communications, or creative work.');
  } else {
    whyMayNotFit.push('The scope may not be a core marketing/communications engagement.');
  }

  if (serviceHits.length > 0) {
    score += Math.min(20, serviceHits.length * 7);
    whyFits.push(`Matches your services: ${serviceHits.slice(0, 4).join(', ')}.`);
  } else if (services.length > 0) {
    whyMayNotFit.push('No direct overlap with your listed services was detected from the text available.');
  }

  if (keywordHits.length > 0) {
    score += Math.min(10, keywordHits.length * 5);
    whyFits.push(`Contains priority keywords: ${keywordHits.slice(0, 4).join(', ')}.`);
  }

  // Contract size fit
  if (opp.estimatedValue && (profile.minContract || profile.maxContract)) {
    const min = profile.minContract ?? 0;
    const max = profile.maxContract ?? Number.MAX_SAFE_INTEGER;
    if (opp.estimatedValue >= min && opp.estimatedValue <= max) {
      score += 10;
      whyFits.push('Estimated value fits your preferred contract size range.');
    } else {
      whyMayNotFit.push('Estimated value is outside your preferred contract size range.');
    }
  }

  // Set-aside eligibility hint
  if (opp.setAsideType && opp.setAsideType.toLowerCase() !== 'no set aside used') {
    const certs = (profile.certifications || []).join(' ').toLowerCase();
    if (!certs) {
      missingRequirements.push(`This opportunity is set aside (${opp.setAsideType}); confirm you hold a qualifying certification.`);
    }
  }

  if (!opp.description) {
    whyMayNotFit.push('Full solicitation text was unavailable, so this is based on title and metadata only.');
  }

  score = Math.max(5, Math.min(95, score));
  const label = scoreToLabel(score);

  const recommendedAction =
    score >= 60
      ? 'Worth a closer look — open the full solicitation and start a proposal-readiness check.'
      : score >= 40
      ? 'Review the full solicitation before committing time; confirm scope and eligibility.'
      : 'Likely a low priority unless it aligns with a strategic goal.';

  return {
    fitScore: score,
    label,
    matchSummary: looksMarketing
      ? `This appears to be a ${label.toLowerCase()} for a marketing agency based on available signals.`
      : `Based on the limited signals available, this is a ${label.toLowerCase()} for your agency.`,
    whyFits: whyFits.length ? whyFits : ['Some general alignment with public-sector opportunity work.'],
    whyMayNotFit,
    missingRequirements,
    recommendedAction,
    source: 'fallback',
  };
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Generate a marketing-agency-specific match assessment for an opportunity.
 * Always resolves with a usable assessment: if the AI service is unavailable,
 * times out, or returns garbage, it returns a deterministic fallback instead of
 * throwing or returning nothing.
 */
export async function generateMatchAssessment(
  opp: OpportunityInput,
  profile: AgencyProfile
): Promise<MatchAssessment> {
  if (!aiEnabled) {
    console.warn('[AI] No AI API key configured (OLLAMA_API_KEY). Using deterministic fallback.');
    return fallbackAssessment(opp, profile);
  }

  const prompt = `You are an expert advisor helping a MARKETING AGENCY decide whether to pursue a public-sector / government / nonprofit / education / healthcare contract opportunity.

Use plain English. Be specific about what matched and what did not. Avoid generic contractor jargon (no "trade", "crew", "bonding", "DIR", "CSLB", construction compliance) unless the opportunity itself requires it.

AGENCY PROFILE:
- Services offered: ${(profile.services || []).join(', ') || 'unspecified'}
- Industries served: ${(profile.industries || []).join(', ') || 'unspecified'}
- Certifications: ${(profile.certifications || []).join(', ') || 'none listed'}
- Location: ${profile.location || 'unspecified'} (radius ${profile.serviceRadiusMiles ?? 'n/a'} mi, preference ${profile.remotePreference || 'n/a'})
- Team size / delivery capacity: ${profile.teamSize || 'n/a'} / ${profile.deliveryCapacity || 'n/a'}
- Preferred contract size: ${profile.minContract ?? '?'} - ${profile.maxContract ?? '?'}
- Role: ${profile.role || 'unspecified'}

OPPORTUNITY:
- Title: ${opp.title}
- Buyer/Agency: ${opp.agency || 'unknown'}
- NAICS: ${opp.naicsCode || 'n/a'} | PSC: ${opp.pscCode || 'n/a'}
- Set-aside: ${opp.setAsideType || 'none'}
- Place of performance: ${opp.placeOfPerformance || 'n/a'}
- Estimated value: ${opp.estimatedValue ?? 'unknown'}
- Description: ${opp.description || '(full text unavailable — assess from title and metadata)'}

Evaluate ELIGIBILITY (is the agency qualified to pursue), FIT (is the work aligned with services and capacity), and EDGE (realistic competitive advantage).

Return STRICT JSON only (no markdown fences) with EXACTLY these keys:
{
  "fitScore": <integer 0-100>,
  "matchSummary": "<2-3 plain-English sentences>",
  "whyFits": ["<short reason>", ...],
  "whyMayNotFit": ["<short reason>", ...],
  "missingRequirements": ["<hard requirement the agency may be missing>", ...],
  "recommendedAction": "<one of: pursue / pursue if gaps resolved / save for later / pass — plus a short why>"
}
Do not give a high score if a hard requirement is clearly missing.`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AI_REQUEST_TIMEOUT_MS);

  try {
    const response = await openai.chat.completions.create(
      {
        model: AI_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        // No max_tokens cap on purpose (reasoning models need headroom).
      },
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);

    const raw = response.choices?.[0]?.message?.content || '';
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

    // Extract the first JSON object if the model added stray prose.
    const jsonStart = cleaned.indexOf('{');
    const jsonEnd = cleaned.lastIndexOf('}');
    const jsonText = jsonStart >= 0 && jsonEnd > jsonStart ? cleaned.slice(jsonStart, jsonEnd + 1) : cleaned;

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      console.error('[AI] Unparseable response; using fallback. Raw:', cleaned.slice(0, 160));
      return fallbackAssessment(opp, profile);
    }

    const fitScore =
      typeof parsed.fitScore === 'number'
        ? Math.max(0, Math.min(100, Math.round(parsed.fitScore)))
        : fallbackAssessment(opp, profile).fitScore;

    const asStringArray = (v: unknown): string[] =>
      Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()).map((x) => x as string) : [];

    return {
      fitScore,
      label: scoreToLabel(fitScore),
      matchSummary:
        typeof parsed.matchSummary === 'string' && parsed.matchSummary.trim()
          ? parsed.matchSummary
          : 'Assessment generated.',
      whyFits: asStringArray(parsed.whyFits),
      whyMayNotFit: asStringArray(parsed.whyMayNotFit),
      missingRequirements: asStringArray(parsed.missingRequirements),
      recommendedAction:
        typeof parsed.recommendedAction === 'string' && parsed.recommendedAction.trim()
          ? parsed.recommendedAction
          : 'Review the full solicitation before deciding.',
      source: 'ai',
    };
  } catch (error: unknown) {
    clearTimeout(timeoutId);
    const status = (error as { status?: number })?.status;
    const name = error instanceof Error ? error.name : '';
    if (name === 'AbortError') console.error('[AI] Timed out; using fallback.');
    else if (status === 401) console.error('[AI] Auth failed (check OLLAMA_API_KEY); using fallback.');
    else if (status === 429) console.error('[AI] Rate limited; using fallback.');
    else console.error('[AI] Error; using fallback:', error instanceof Error ? error.message : error);
    // Never blank — always return a usable assessment.
    return fallbackAssessment(opp, profile);
  }
}

/**
 * Generic AI JSON helper: sends a prompt, parses the first JSON object from the
 * reply, and returns it merged over `fallback`. Never throws — returns
 * { data: fallback, source: 'fallback' } on any failure or if AI is unconfigured.
 */
export async function aiJson<T extends Record<string, unknown>>(
  prompt: string,
  fallback: T
): Promise<{ data: T; source: 'ai' | 'fallback' }> {
  if (!aiEnabled) return { data: fallback, source: 'fallback' };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AI_REQUEST_TIMEOUT_MS);
  try {
    const response = await openai.chat.completions.create(
      { model: AI_MODEL, messages: [{ role: 'user', content: prompt }], temperature: 0.3 },
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);
    const raw = response.choices?.[0]?.message?.content || '';
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    const jsonText = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;
    const parsed = JSON.parse(jsonText) as Partial<T>;
    return { data: { ...fallback, ...parsed }, source: 'ai' };
  } catch (e) {
    clearTimeout(timeoutId);
    console.warn('[AI] aiJson fell back:', e instanceof Error ? e.message : e);
    return { data: fallback, source: 'fallback' };
  }
}

/**
 * Backward-compatible wrapper for older callers expecting { fitScore, matchSummary }.
 */
export async function generateFitScore(
  contractTitle: string,
  contractDescription: string,
  businessNaics: string[],
  businessCapacities: string
): Promise<FitScoreResult> {
  const assessment = await generateMatchAssessment(
    { title: contractTitle, description: contractDescription, naicsCode: businessNaics[0] || null },
    { deliveryCapacity: businessCapacities }
  );
  return { fitScore: assessment.fitScore, matchSummary: assessment.matchSummary };
}
