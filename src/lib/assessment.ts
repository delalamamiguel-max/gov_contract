import type { AgencyProfile } from '@/lib/profile';
import { estimateDistanceMiles, isRemoteEligible } from '@/lib/geo';

// ---------------------------------------------------------------------------
// Deterministic Opportunity Assessment.
//
// Three weighted groups — Eligibility (40%), Fit (35%), Edge (25%) — produce a
// transparent, specific match score. Hard-requirement gaps cap the score so a
// missing hard requirement can never read as a high match. No vague AI language:
// every matched item and gap is concrete.
// ---------------------------------------------------------------------------

export const MARKETING_SCOPES = [
  'marketing', 'advertis', 'communication', 'public relations', 'branding', 'brand',
  'website', 'web development', 'web design', 'digital strategy', 'digital', 'seo',
  'social media', 'media buy', 'media planning', 'creative', 'outreach', 'campaign',
  'translation', 'localization', 'market research', 'graphic design', 'video',
  'content', 'copywrit', 'email marketing', 'photography', 'multicultural',
];

const STANDARD_READINESS = [
  'Capability statement', 'Case studies', 'Portfolio', 'References',
  'W-9', 'Insurance certificates', 'Rate card', 'Proposal template',
];

export type MatchLabel = 'Strong Match' | 'Good Match' | 'Possible Match' | 'Weak Match';

export interface GroupScore {
  score: number;   // 0-100
  weight: number;  // 0-1
  matched: string[];
  gaps: string[];
}

export interface OpportunityAssessment {
  matchScore: number;       // 0-100 weighted, gated
  label: MatchLabel;
  scoreExplanation: string;
  eligibility: GroupScore;
  fit: GroupScore;
  edge: GroupScore;
  whyFits: string[];
  whyMayNotFit: string[];
  missingRequirements: string[];
  competitiveAdvantages: string[];
  proposalReadiness: { ready: string[]; missing: string[]; percent: number };
  recommendedAction: string;
  hardRequirementMissing: boolean;
  // Location context (also used for search filtering)
  remoteEligible: boolean;
  distanceMiles: number | null;
  withinRadius: boolean;
}

export interface AssessmentOpportunity {
  title: string;
  description?: string | null;
  setAsideType?: string | null;
  naicsCode?: string | null;
  estimatedValue?: number | null;
  responseDeadline?: string | null;
  placeOfPerformance?: string | null;
}

function labelFor(score: number): MatchLabel {
  if (score >= 80) return 'Strong Match';
  if (score >= 60) return 'Good Match';
  if (score >= 40) return 'Possible Match';
  return 'Weak Match';
}

const lower = (s: string) => s.toLowerCase();

/**
 * Compute a deterministic Opportunity Assessment for an opportunity against the
 * agency profile. Pure and fast — safe to run for every search result server-side.
 */
export interface FeedbackSignalInput {
  prioritizeServices?: string[];
  sizeBias?: 'smaller' | 'larger' | 'neutral';
}

export function computeAssessment(
  opp: AssessmentOpportunity,
  profile: AgencyProfile,
  radius: number,
  signals?: FeedbackSignalInput
): OpportunityAssessment {
  const hay = `${opp.title} ${opp.description || ''} ${opp.setAsideType || ''}`.toLowerCase();
  const excludeHit = (profile.excludeKeywords || []).find((x) => x && hay.includes(x.toLowerCase()));
  const services = (profile.services || []).map(lower);
  const industries = (profile.industries || []).map((i) => i.split('/')[0].trim().toLowerCase());
  const certs = (profile.certifications || []).map(lower);

  // Shared location signals
  const remoteEligible = isRemoteEligible(hay, opp.placeOfPerformance);
  const distanceMiles = estimateDistanceMiles(profile.location, opp.placeOfPerformance);
  const pref = profile.remotePreference;
  const locationServiceable =
    remoteEligible || pref === 'remote' || pref === 'hybrid'
      ? true
      : distanceMiles === null
      ? true // unknown — don't hard-fail
      : distanceMiles <= radius;
  const withinRadius = distanceMiles === null ? true : distanceMiles <= radius;

  let hardRequirementMissing = false;

  // ---------------- ELIGIBILITY (40%) ----------------
  const eMatched: string[] = [];
  const eGaps: string[] = [];
  const eChecks: number[] = [];

  // Service capability present at all
  const serviceHits = services.filter((s) => s && hay.includes(s));
  if (services.length === 0) {
    eChecks.push(50);
    eGaps.push('No services listed in your profile to qualify against');
  } else if (serviceHits.length > 0) {
    eChecks.push(100);
    eMatched.push(`Offers relevant services: ${serviceHits.slice(0, 3).join(', ')}`);
  } else {
    eChecks.push(35);
    eGaps.push('None of your listed services clearly match this scope');
  }

  // Certification vs set-aside (HARD). Resolve the REQUIRED category with
  // precedence so a specific set-aside (e.g. WOSB) is never satisfied by a
  // generic "Small Business" cert just because the phrase contains it.
  const setAside = (opp.setAsideType || '').toLowerCase();
  const isSetAside = setAside && setAside !== 'no set aside used' && setAside !== 'none';
  if (isSetAside) {
    const required =
      /wosb|women/.test(setAside) ? 'women'
      : /sdvosb|vosb|veteran/.test(setAside) ? 'veteran'
      : /hubzone/.test(setAside) ? 'hubzone'
      : /8\(a\)|minority/.test(setAside) ? 'minority'
      : /\bdbe\b|disadvantaged business/.test(setAside) ? 'dbe'
      : /small business|sba/.test(setAside) ? 'small business'
      : null;
    const reqKeywords: Record<string, string[]> = {
      women: ['women', 'wosb', 'wbe'],
      veteran: ['veteran', 'sdvosb', 'vosb'],
      hubzone: ['hubzone'],
      minority: ['minority', '8(a)', 'mbe'],
      dbe: ['dbe'],
      'small business': ['small business', 'sba'],
    };
    if (!required) {
      eChecks.push(100);
    } else if (certs.some((held) => reqKeywords[required].some((k) => held.includes(k)))) {
      eChecks.push(100);
      eMatched.push(`Holds a ${required} certification matching the ${opp.setAsideType} set-aside`);
    } else {
      eChecks.push(0);
      hardRequirementMissing = true;
      eGaps.push(`Set-aside requires a ${required} certification you haven't listed (${opp.setAsideType})`);
    }
  } else {
    eChecks.push(100); // open competition
  }

  // Location / service area (HARD when strictly local and out of range)
  if (locationServiceable) {
    eChecks.push(100);
    if (remoteEligible) eMatched.push('Remote-eligible or within your service area');
    else if (distanceMiles !== null) eMatched.push(`Within your ${radius}-mile service area (~${distanceMiles} mi)`);
  } else {
    eChecks.push(0);
    hardRequirementMissing = true;
    eGaps.push(`On-site location is ~${distanceMiles} mi away, beyond your ${radius}-mile radius`);
  }

  // Insurance readiness (E&O / cyber expected for digital work)
  const insurance = (profile.insurance || []).map(lower);
  const digitalWork = ['website', 'web', 'data', 'digital', 'seo', 'analytics'].some((d) => hay.includes(d));
  if (insurance.length === 0) {
    eChecks.push(60);
    eGaps.push('No insurance coverage listed (general liability is typically required)');
  } else {
    let insScore = 70;
    if (insurance.some((i) => i.includes('general'))) insScore += 15;
    if (digitalWork && insurance.some((i) => i.includes('e&o') || i.includes('professional') || i.includes('cyber'))) {
      insScore += 15;
      eMatched.push('Carries E&O/cyber coverage suited to digital work');
    } else if (digitalWork) {
      eGaps.push('Digital scope may require E&O / cyber liability you have not listed');
    }
    eChecks.push(Math.min(100, insScore));
  }

  // Submission readiness (capability statement / references)
  const readiness = (profile.proposalReadiness || []);
  const hasCapStmt = readiness.some((r) => /capability/i.test(r));
  const hasRefs = readiness.some((r) => /reference/i.test(r));
  eChecks.push(hasCapStmt && hasRefs ? 100 : hasCapStmt || hasRefs ? 70 : 45);
  if (!hasCapStmt) eGaps.push('No capability statement on file for submission');

  const eligibilityScore = Math.round(eChecks.reduce((a, b) => a + b, 0) / eChecks.length);

  // ---------------- FIT (35%) ----------------
  const fMatched: string[] = [];
  const fGaps: string[] = [];
  const fChecks: number[] = [];

  // Contract size
  if (opp.estimatedValue && (profile.minContract || profile.maxContract)) {
    const min = profile.minContract ?? 0;
    const max = profile.maxContract ?? Number.MAX_SAFE_INTEGER;
    if (opp.estimatedValue >= min && opp.estimatedValue <= max) {
      fChecks.push(100);
      fMatched.push('Estimated value fits your preferred contract size');
    } else if (opp.estimatedValue > max) {
      fChecks.push(35);
      fGaps.push('Likely larger than your preferred contract size');
    } else {
      fChecks.push(55);
      fGaps.push('Smaller than your preferred contract size');
    }
  } else {
    fChecks.push(70);
  }

  // Service match depth
  if (services.length) {
    const depth = Math.min(100, 40 + serviceHits.length * 20);
    fChecks.push(serviceHits.length ? depth : 30);
    if (serviceHits.length >= 2) fMatched.push(`Strong service overlap (${serviceHits.length} services)`);
  } else fChecks.push(50);

  // Industry experience
  const indHit = industries.find((i) => i && hay.includes(i));
  if (indHit) { fChecks.push(100); fMatched.push(`Experience in a matching industry (${indHit})`); }
  else if (industries.length) { fChecks.push(50); fGaps.push('No clear match to your served industries'); }
  else fChecks.push(60);

  // Type of work (marketing scope)
  const scopeHit = MARKETING_SCOPES.some((s) => hay.includes(s));
  fChecks.push(scopeHit ? 100 : 30);
  if (scopeHit) fMatched.push('Work type aligns with marketing/communications');
  else fGaps.push('Scope may not be core marketing/communications work');

  // Availability / capacity
  if (profile.deliveryCapacity) {
    const cap = lower(profile.deliveryCapacity);
    fChecks.push(cap.includes('immediately') ? 100 : cap.includes('2 weeks') ? 85 : cap.includes('30 days') ? 70 : 45);
  } else fChecks.push(60);

  // Remote/local alignment
  fChecks.push(locationServiceable ? 100 : 30);

  const fitScore = Math.round(fChecks.reduce((a, b) => a + b, 0) / fChecks.length);

  // ---------------- EDGE (25%) ----------------
  const edMatched: string[] = [];
  const edGaps: string[] = [];
  const edChecks: number[] = [];

  // Certifications held (competitive advantage)
  if (certs.length) { edChecks.push(100); edMatched.push(`Certifications: ${(profile.certifications || []).slice(0, 3).join(', ')}`); }
  else { edChecks.push(40); edGaps.push('No certifications to differentiate on set-aside work'); }

  // Public-sector / prior gov experience
  if (profile.priorGovExperience === 'yes') { edChecks.push(100); edMatched.push('Prior government / public-sector experience'); }
  else if (profile.priorGovExperience === 'limited') { edChecks.push(65); edMatched.push('Some public-sector subcontracting experience'); }
  else { edChecks.push(35); edGaps.push('No prior public-sector experience'); }

  // Differentiators
  const diffs = profile.differentiators || [];
  if (diffs.length) {
    edChecks.push(Math.min(100, 50 + diffs.length * 12));
    const relevant = diffs.filter((d) => {
      const dl = lower(d);
      if (dl.includes('bilingual') || dl.includes('multicultural')) return hay.includes('multicultural') || hay.includes('translation') || hay.includes('bilingual') || true;
      if (dl.includes('analytics')) return true;
      return true;
    });
    if (relevant.length) edMatched.push(`Differentiators: ${relevant.slice(0, 3).join(', ')}`);
  } else { edChecks.push(45); edGaps.push('No differentiators listed'); }

  // Solicitation keyword match
  const kwHits = (profile.keywords || []).filter((k) => k && hay.includes(lower(k)));
  edChecks.push(kwHits.length ? 100 : 55);
  if (kwHits.length) edMatched.push(`Matches your priority keywords: ${kwHits.slice(0, 3).join(', ')}`);

  // Proposal readiness depth
  const readyCount = readiness.length;
  edChecks.push(Math.min(100, 40 + readyCount * 10));

  let edgeScore = Math.round(edChecks.reduce((a, b) => a + b, 0) / edChecks.length);

  // Feedback learning: boost services the user asked to prioritize.
  if (signals?.prioritizeServices?.length) {
    const boosted = signals.prioritizeServices.filter((s) => s && hay.includes(lower(s)));
    if (boosted.length) {
      edgeScore = Math.min(100, edgeScore + 8);
      edMatched.push(`Prioritized from your feedback: ${boosted.slice(0, 3).join(', ')}`);
    }
  }

  // ---------------- WEIGHTED TOTAL + GATING ----------------
  let matchScore = Math.round(eligibilityScore * 0.4 + fitScore * 0.35 + edgeScore * 0.25);
  // Feedback learning: nudge by the user's observed size preference.
  if (signals?.sizeBias && signals.sizeBias !== 'neutral' && opp.estimatedValue) {
    const big = opp.estimatedValue >= 500_000;
    if (signals.sizeBias === 'smaller' && big) matchScore -= 4;
    if (signals.sizeBias === 'larger' && !big) matchScore -= 3;
  }
  if (hardRequirementMissing) matchScore = Math.min(matchScore, 39); // never a high score with a hard gap
  if (excludeHit) {
    matchScore = Math.min(matchScore, 20); // user explicitly excluded this kind of work
    fGaps.unshift(`Matches your excluded keyword "${excludeHit}"`);
  }
  matchScore = Math.max(0, Math.min(100, matchScore));
  const label = labelFor(matchScore);

  // ---------------- NARRATIVE (specific, deterministic) ----------------
  const proposalReady = readiness.filter((r) => STANDARD_READINESS.some((s) => lower(s) === lower(r)));
  const proposalMissing = STANDARD_READINESS.filter((s) => !readiness.some((r) => lower(r) === lower(s)));
  const proposalPercent = Math.round((proposalReady.length / STANDARD_READINESS.length) * 100);

  const whyFits = [...eMatched, ...fMatched].slice(0, 5);
  const whyMayNotFit = [...fGaps, ...eGaps.filter((g) => !g.includes('Set-aside') && !g.includes('On-site'))].slice(0, 4);
  const missingRequirements = eGaps.filter((g) => g.includes('Set-aside') || g.includes('On-site') || g.includes('capability') || g.includes('insurance') || g.includes('E&O'));
  const competitiveAdvantages = edMatched.slice(0, 4);

  const scoreExplanation = hardRequirementMissing
    ? `Capped at ${matchScore}% — a hard requirement is unmet (${missingRequirements[0] || 'eligibility gap'}). Eligibility ${eligibilityScore}%, Fit ${fitScore}%, Edge ${edgeScore}%.`
    : `${label} (${matchScore}%). Eligibility ${eligibilityScore}%, Fit ${fitScore}%, Edge ${edgeScore}%. ${
        whyFits[0] ? `Strongest signal: ${whyFits[0].toLowerCase()}.` : ''
      }${whyMayNotFit[0] ? ` Watch: ${whyMayNotFit[0].toLowerCase()}.` : ''}`;

  const recommendedAction = hardRequirementMissing
    ? `Pass or resolve the hard gap first — ${missingRequirements[0] || 'eligibility requirement'}.`
    : matchScore >= 80
    ? 'Pursue — strong alignment. Start the proposal-readiness checklist.'
    : matchScore >= 60
    ? 'Pursue if you can close the noted gaps. Review the full solicitation.'
    : matchScore >= 40
    ? 'Save for later — review the solicitation and weigh effort vs. fit.'
    : 'Pass — weak alignment with your profile.';

  return {
    matchScore,
    label,
    scoreExplanation,
    eligibility: { score: eligibilityScore, weight: 0.4, matched: eMatched, gaps: eGaps },
    fit: { score: fitScore, weight: 0.35, matched: fMatched, gaps: fGaps },
    edge: { score: edgeScore, weight: 0.25, matched: edMatched, gaps: edGaps },
    whyFits,
    whyMayNotFit,
    missingRequirements,
    competitiveAdvantages,
    proposalReadiness: { ready: proposalReady, missing: proposalMissing, percent: proposalPercent },
    recommendedAction,
    hardRequirementMissing,
    remoteEligible,
    distanceMiles,
    withinRadius,
  };
}
