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
  'translation', 'localization', 'market research', 'graphic design', 'video production', 'videography', 'multimedia',
  'content', 'copywrit', 'email marketing', 'photography', 'multicultural',
];

const STANDARD_READINESS = [
  'Capability statement', 'Case studies', 'Portfolio', 'References',
  'W-9', 'Insurance certificates', 'Rate card', 'Proposal template',
];

// ---------------------------------------------------------------------------
// Keyword expansion maps — translate user-facing profile values into terms
// commonly found in government contract solicitations.
// ---------------------------------------------------------------------------

export const CAPABILITY_KEYWORDS: Record<string, string[]> = {
  'Digital marketing': ['digital', 'marketing', 'seo', 'social media', 'ppc', 'analytics', 'email marketing', 'digital strategy'],
  'Branding & design': ['branding', 'brand', 'graphic design', 'visual identity', 'logo', 'creative', 'design'],
  'Public relations': ['public relations', 'communications', 'pr', 'media relations', 'outreach', 'crisis communications'],
  'Website / web app development': ['website', 'web development', 'web design', 'web application', 'ux', 'ui', 'front-end'],
  'Video production': ['video production', 'videography', 'multimedia', 'motion graphics', 'filming', 'editing'],
  'Print / OOH advertising': ['print', 'out-of-home', 'ooh', 'billboard', 'signage', 'collateral', 'advertising'],
  'Media buying': ['media buy', 'media planning', 'media placement', 'advertising', 'ad buy', 'media'],
  'Market research': ['market research', 'survey', 'focus group', 'analysis', 'data', 'research', 'evaluation'],
  'Translation / multilingual': ['translation', 'localization', 'multilingual', 'bilingual', 'interpreter', 'multicultural'],
  'Full-service': ['marketing', 'communications', 'creative', 'advertising', 'campaign', 'digital', 'branding'],
};

export const SERVICE_KEYWORDS: Record<string, string[]> = {
  'Brand strategy': ['brand strategy', 'branding', 'brand', 'identity', 'positioning'],
  'Graphic design': ['graphic design', 'design', 'visual', 'layout', 'illustration', 'graphics'],
  'Website design / development': ['website', 'web design', 'web development', 'web', 'front-end', 'frontend', 'ui', 'ux'],
  'UX / UI design': ['ux', 'ui', 'user experience', 'user interface', 'usability', 'interaction design'],
  'SEO': ['seo', 'search engine optimization', 'organic search', 'search rankings', 'search visibility'],
  'Paid search': ['paid search', 'ppc', 'pay-per-click', 'google ads', 'sem', 'search advertising'],
  'Paid social': ['paid social', 'social advertising', 'social ads', 'facebook ads', 'instagram ads', 'social media advertising'],
  'Organic social media': ['social media', 'organic social', 'social media management', 'community management'],
  'Content marketing': ['content marketing', 'content strategy', 'content creation', 'content', 'editorial'],
  'Copywriting': ['copywriting', 'copywriter', 'copy', 'writing', 'editorial'],
  'Email marketing': ['email marketing', 'email', 'newsletter', 'email campaign', 'drip campaign'],
  'Video production': ['video production', 'videography', 'filming', 'multimedia', 'motion graphics', 'animation'],
  'Photography': ['photography', 'photo', 'photographer', 'photoshoot', 'imagery'],
  'Public relations': ['public relations', 'pr', 'media relations', 'press', 'communications', 'outreach'],
  'Crisis communications': ['crisis communications', 'crisis management', 'crisis', 'emergency communications'],
  'Media planning / buying': ['media planning', 'media buying', 'media buy', 'ad buy', 'media placement', 'advertising'],
  'Event marketing': ['event', 'event marketing', 'conference', 'trade show', 'experiential'],
  'Market research': ['market research', 'research', 'survey', 'focus group', 'analysis', 'data analysis'],
  'Multicultural marketing': ['multicultural', 'diversity', 'inclusive', 'cultural', 'bilingual'],
  'Translation / localization': ['translation', 'localization', 'multilingual', 'bilingual', 'interpreter', 'language'],
  'Analytics / reporting': ['analytics', 'reporting', 'data', 'metrics', 'insights', 'measurement', 'dashboard'],
};

export const INDUSTRY_KEYWORDS: Record<string, string[]> = {
  'Government / public sector': ['government', 'public sector', 'municipal', 'state', 'federal', 'civic', 'public agency'],
  'Education': ['education', 'school', 'university', 'college', 'academic', 'student', 'k-12', 'higher education'],
  'Healthcare': ['healthcare', 'health', 'medical', 'clinical', 'hospital', 'public health', 'wellness'],
  'Nonprofit': ['nonprofit', 'non-profit', 'ngo', 'foundation', 'charity', 'mission-driven'],
  'Economic development': ['economic development', 'workforce', 'community development', 'economic', 'job training'],
  'Tourism / hospitality': ['tourism', 'hospitality', 'travel', 'destination', 'visitor', 'hotel'],
  'Real estate': ['real estate', 'property', 'housing', 'development', 'construction'],
  'Retail / ecommerce': ['retail', 'ecommerce', 'e-commerce', 'shopping', 'consumer', 'store'],
  'Financial services': ['financial', 'finance', 'banking', 'insurance', 'fintech', 'investment'],
  'Technology': ['technology', 'tech', 'software', 'saas', 'digital', 'it', 'innovation'],
  'Professional services': ['professional services', 'consulting', 'advisory', 'management'],
};

export const AGENCY_TYPE_KEYWORDS: Record<string, string[]> = {
  'Creative agency': ['creative', 'design', 'branding', 'visual', 'graphic', 'campaign'],
  'Digital marketing agency': ['digital', 'marketing', 'seo', 'social media', 'ppc', 'analytics'],
  'Media buying agency': ['media buy', 'media planning', 'ad buy', 'media placement', 'advertising'],
  'Branding agency': ['branding', 'brand', 'identity', 'logo', 'visual identity'],
  'PR / communications agency': ['public relations', 'communications', 'pr', 'outreach', 'media relations'],
  'Web / design agency': ['website', 'web design', 'web development', 'ux', 'ui', 'front-end'],
  'Content agency': ['content', 'copywriting', 'editorial', 'blog', 'content marketing'],
  'Full-service agency': ['marketing', 'communications', 'creative', 'advertising', 'digital', 'branding'],
  'Other': [],
};

export const OPP_TYPE_KEYWORDS: Record<string, string[]> = {
  'One-time campaign': ['campaign', 'one-time', 'project-based', 'launch'],
  'Retainer': ['retainer', 'ongoing', 'annual', 'indefinite', 'continuing'],
  'Website / project-based work': ['website', 'web', 'redesign', 'development', 'project'],
  'Media buying': ['media buy', 'media planning', 'ad buy', 'placement'],
  'Creative production': ['creative', 'production', 'design', 'collateral', 'visual'],
  'Research / strategy': ['research', 'strategy', 'analysis', 'evaluation', 'planning'],
  'Communications / PR': ['communications', 'public relations', 'outreach', 'pr'],
  'Branding project': ['branding', 'brand', 'identity', 'logo', 'rebrand'],
  'Ongoing marketing support': ['marketing support', 'ongoing', 'management', 'maintenance'],
  'Translation / localization support': ['translation', 'localization', 'multilingual', 'bilingual'],
};

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
  // AI nuance layer (Kimi). Present only when the opportunity was AI-reviewed.
  // The deterministic matchScore above is already adjusted by kimiAdjustment when
  // these are set; kimiReason explains what nuance the keyword engine missed.
  kimiAdjustment?: number;
  kimiReason?: string;
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

export function labelFor(score: number): MatchLabel {
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
  // Location gating. Previously ANY `hybrid` (or `remote`) preference made every
  // opportunity serviceable regardless of distance — so a Dallas/hybrid agency
  // saw 1,300-mi California on-site contracts as 80%+ matches. Fixed:
  //  - remote pref or genuinely remote-eligible work → distance irrelevant
  //  - hybrid → real (generous) check at 2× the radius (willing to travel some,
  //    not cross-country)
  //  - local/other → strict radius
  // Unknown distance never hard-fails.
  const locationServiceable =
    remoteEligible || pref === 'remote'
      ? true
      : distanceMiles === null
      ? true // unknown — don't hard-fail
      : pref === 'hybrid'
      ? distanceMiles <= radius * 2
      : distanceMiles <= radius;
  const withinRadius = distanceMiles === null ? true : distanceMiles <= radius;

  let hardRequirementMissing = false;

  // ---------------- ELIGIBILITY (40%) ----------------
  const eMatched: string[] = [];
  const eGaps: string[] = [];
  const eChecks: number[] = [];

  // Service capability present at all
  // Expanded service matching: check both the service name AND its keyword synonyms
  const serviceHits = services.filter((s) => {
    if (!s) return false;
    // Direct match
    if (hay.includes(s)) return true;
    // Expanded keyword match
    const expanded = SERVICE_KEYWORDS[s];
    if (expanded) return expanded.some((kw) => hay.includes(kw));
    return false;
  });
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
  // Expanded industry matching
  const indHit = industries.find((i) => {
    if (!i) return false;
    if (hay.includes(i)) return true;
    const expanded = INDUSTRY_KEYWORDS[i];
    if (expanded) return expanded.some((kw) => hay.includes(kw));
    return false;
  });
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

  // Primary capability (user's core business purpose)
  if (profile.primaryCapability) {
    const capKws = CAPABILITY_KEYWORDS[profile.primaryCapability];
    if (capKws && capKws.length) {
      const capHit = capKws.some((kw) => hay.includes(kw));
      if (capHit) {
        fChecks.push(100);
        fMatched.push(`Aligns with your primary capability (${profile.primaryCapability})`);
      } else {
        fChecks.push(25);
        fGaps.push(`Doesn't align with your primary capability (${profile.primaryCapability})`);
      }
    }
  }

  // Agency type alignment
  if (profile.agencyType && profile.agencyType !== 'Other') {
    const typeKws = AGENCY_TYPE_KEYWORDS[profile.agencyType];
    if (typeKws && typeKws.length) {
      const typeHit = typeKws.some((kw) => hay.includes(kw));
      if (typeHit) {
        fChecks.push(100);
        fMatched.push(`Fits your agency type (${profile.agencyType})`);
      } else {
        fChecks.push(40);
        fGaps.push(`May not align with your agency type (${profile.agencyType})`);
      }
    }
  }

  // Target opportunity type
  const targetTypes = profile.targetOpportunityTypes || [];
  if (targetTypes.length) {
    const allTypeKws = targetTypes.flatMap((t) => OPP_TYPE_KEYWORDS[t] || []);
    if (allTypeKws.length) {
      const typeHit = allTypeKws.some((kw) => hay.includes(kw));
      if (typeHit) {
        fChecks.push(100);
        fMatched.push('Matches your target opportunity type');
      } else {
        fChecks.push(35);
        fGaps.push('Doesn\u2019t match any of your target opportunity types');
      }
    }
  }

  // Team size vs contract scale
  if (profile.teamSize && opp.estimatedValue) {
    const small = ['1-2', '3-5'].includes(profile.teamSize);
    const largeContract = opp.estimatedValue >= 1_000_000;
    if (small && largeContract) {
      fChecks.push(30);
      fGaps.push('Contract scale may exceed your current team capacity');
    } else if (!small && largeContract) {
      fChecks.push(85);
    } else {
      fChecks.push(80);
    }
  }

  // Annual revenue vs contract value (scale appropriateness)
  if ((profile as any).annualRevenue && opp.estimatedValue) {
    const rev = (profile as any).annualRevenue as string;
    const maxRev = rev.includes('Under') ? 250_000
      : rev.includes('500K') ? 500_000
      : rev.includes('$1M') && !rev.includes('$3M') ? 1_000_000
      : rev.includes('$3M') ? 3_000_000
      : 5_000_000;
    if (opp.estimatedValue > maxRev * 10) {
      fChecks.push(25);
      fGaps.push('Contract value significantly exceeds your annual revenue scale');
    } else if (opp.estimatedValue > maxRev * 3) {
      fChecks.push(55);
      fGaps.push('Contract may be large relative to your revenue');
    } else {
      fChecks.push(85);
    }
  }

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
  const prefs = profile.scoringPreferences ?? { eligibilityWeight: 40, fitWeight: 35, edgeWeight: 25 };
  const totalWeight = (prefs.eligibilityWeight + prefs.fitWeight + prefs.edgeWeight) || 100;
  const wE = prefs.eligibilityWeight / totalWeight;
  const wF = prefs.fitWeight / totalWeight;
  const wEd = prefs.edgeWeight / totalWeight;

  let matchScore = Math.round(eligibilityScore * wE + fitScore * wF + edgeScore * wEd);
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
