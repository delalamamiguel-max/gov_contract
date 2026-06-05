import type { AgencyProfile } from '@/lib/profile';
import { estimateDistanceMiles, isRemoteEligible } from '@/lib/geo';

// Marketing scopes we prioritize (per product spec). Matching any of these is a
// strong positive signal that an opportunity is relevant to a marketing agency.
export const MARKETING_SCOPES = [
  'marketing', 'advertis', 'communication', 'public relations', 'branding', 'brand',
  'website', 'web development', 'web design', 'digital strategy', 'digital', 'seo',
  'social media', 'media buy', 'media planning', 'creative', 'outreach', 'campaign',
  'translation', 'localization', 'market research', 'graphic design', 'video',
  'content', 'copywrit', 'email marketing', 'photography', 'multicultural',
];

export interface RankInput {
  title: string;
  description?: string | null;
  setAsideType?: string | null;
  naicsCode?: string | null;
  estimatedValue?: number | null;
  responseDeadline?: string | null;
  placeOfPerformance?: string | null;
}

export interface RankResult {
  total: number;
  marketingScope: boolean;
  remoteEligible: boolean;
  distanceMiles: number | null;
  withinRadius: boolean;
  reasons: string[];
}

const CERT_KEYWORDS: Record<string, string[]> = {
  'small business': ['small business', 'total small business', 'sba'],
  'women-owned': ['women-owned', 'wosb', 'wbe'],
  'veteran': ['veteran', 'sdvosb', 'vosb'],
  'hubzone': ['hubzone'],
  'minority': ['minority', '8(a)', 'mbe', 'disadvantaged'],
  'dbe': ['dbe', 'disadvantaged business'],
};

/**
 * Score one opportunity against the agency profile. Higher = more relevant.
 * `radius` (miles) gates location matching; remote-eligible work ignores distance.
 */
export function scoreOpportunity(
  opp: RankInput,
  profile: AgencyProfile,
  radius: number
): RankResult {
  const hay = `${opp.title} ${opp.description || ''} ${opp.setAsideType || ''}`.toLowerCase();
  const reasons: string[] = [];
  let total = 0;

  // 1) Marketing scope (highest weight — this is a marketing-agency platform)
  const marketingScope = MARKETING_SCOPES.some((s) => hay.includes(s));
  if (marketingScope) { total += 35; reasons.push('Marketing scope'); }

  // 2) Service match
  let serviceHits = 0;
  for (const s of profile.services || []) {
    if (s && hay.includes(s.toLowerCase())) serviceHits++;
  }
  if (serviceHits > 0) { total += Math.min(24, serviceHits * 8); reasons.push('Service match'); }

  // 3) Keyword include / exclude
  for (const k of profile.keywords || []) if (k && hay.includes(k.toLowerCase())) total += 6;
  for (const x of profile.excludeKeywords || []) if (x && hay.includes(x.toLowerCase())) total -= 50;

  // 4) Industry fit
  for (const ind of profile.industries || []) {
    const term = ind.split('/')[0].trim().toLowerCase();
    if (term && hay.includes(term)) { total += 5; reasons.push('Industry fit'); break; }
  }

  // 5) Remote eligibility + location/radius
  const remoteEligible = isRemoteEligible(hay, opp.placeOfPerformance);
  const distanceMiles = estimateDistanceMiles(profile.location, opp.placeOfPerformance);
  const pref = profile.remotePreference;
  let withinRadius = true;
  if (remoteEligible || pref === 'remote' || pref === 'hybrid') {
    if (remoteEligible) { total += 12; reasons.push('Remote eligible'); }
    withinRadius = true;
  } else if (distanceMiles !== null) {
    withinRadius = distanceMiles <= radius;
    if (withinRadius) { total += 14; reasons.push('In your area'); }
    else { total -= 10; }
  }

  // 6) Contract size fit
  if (opp.estimatedValue && (profile.minContract || profile.maxContract)) {
    const min = profile.minContract ?? 0;
    const max = profile.maxContract ?? Number.MAX_SAFE_INTEGER;
    if (opp.estimatedValue >= min && opp.estimatedValue <= max) { total += 8; reasons.push('Right size'); }
    else total -= 4;
  }

  // 7) Certifications vs set-aside
  if (opp.setAsideType && opp.setAsideType.toLowerCase() !== 'no set aside used') {
    const sa = opp.setAsideType.toLowerCase();
    const certs = (profile.certifications || []).map((c) => c.toLowerCase());
    let certMatch = false;
    for (const c of certs) {
      for (const [key, kws] of Object.entries(CERT_KEYWORDS)) {
        if (c.includes(key.split(' ')[0]) && kws.some((kw) => sa.includes(kw))) { certMatch = true; break; }
      }
    }
    if (certMatch) { total += 10; reasons.push('Certification fit'); }
  }

  // 8) Past performance (prior gov experience signal)
  if (profile.priorGovExperience === 'yes') total += 4;
  else if (profile.priorGovExperience === 'limited') total += 2;

  // 9) Proposal readiness — more-ready agencies surface actionable opps a bit higher
  if ((profile.proposalReadiness || []).length >= 4) total += 3;

  // 10) Deadline urgency — soon-but-not-expired ranks slightly higher
  if (opp.responseDeadline) {
    const days = (new Date(opp.responseDeadline).getTime() - Date.now()) / 86_400_000;
    if (days > 0 && days <= 30) { total += 5; reasons.push('Closing soon'); }
    else if (days <= 0) total -= 8;
  }

  return { total, marketingScope, remoteEligible, distanceMiles, withinRadius, reasons };
}
