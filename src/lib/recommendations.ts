import type { AgencyProfile } from '@/lib/profile';
import { queryOpportunities, type OpportunityRecord } from '@/lib/opportunities';
import { computeAssessment, type OpportunityAssessment, type FeedbackSignalInput } from '@/lib/assessment';
import { computeChecklist, type ProposalChecklist } from '@/lib/checklist';
import { applyKimiAdjustments } from '@/lib/aiScoring';

/** How many top candidates (by deterministic score) get an AI nuance review. */
const KIMI_TOP_N = 20;

// ---------------------------------------------------------------------------
// Recommendations / personalized feed. Backend data-access layer that scores
// stored opportunities against the agency profile, writes a plain-English
// explanation, and splits results into "new since last visit" vs older matches.
// Reuses computeAssessment — no scoring logic in the UI.
// ---------------------------------------------------------------------------

export interface RecommendationItem {
  // Shape consumed by ContractRow (same as search results) + feed extras.
  id: string;
  source: string | null;
  title: string;
  agency: string;
  description: string;
  descriptionUrl: string | null;
  value: string;
  estimatedValue: number | null;
  naicsCode: string | null;
  pscCode: string | null;
  setAsideType: string | null;
  placeOfPerformance: string | null;
  responseDeadline: string | null;
  sourceUrl: string;
  assessment: OpportunityAssessment;
  checklist: ProposalChecklist;
  // Feed-specific:
  explanation: string;
  isNew: boolean;
  ingestedAt: string | null;
}

export interface RecommendationsResult {
  isFirstVisit: boolean;
  newItems: RecommendationItem[];
  olderItems: RecommendationItem[];
  /** Lower-confidence matches (Possible Match, 40–59) shown as a secondary block. */
  otherItems: RecommendationItem[];
  totalConsidered: number;
  unavailable: boolean;
  error?: string;
}

function fmtValue(v: number | null | undefined): string {
  if (!v) return 'TBD';
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toLocaleString()}`;
}

/** Holds a qualifying certification for the opportunity's set-aside? (mirror of assessment logic). */
function holdsSetAsideCert(setAside: string, certs: string[]): boolean {
  const sa = setAside.toLowerCase();
  const c = certs.map((x) => x.toLowerCase());
  if (/wosb|women/.test(sa)) return c.some((x) => x.includes('women'));
  if (/sdvosb|vosb|veteran/.test(sa)) return c.some((x) => x.includes('veteran'));
  if (/hubzone/.test(sa)) return c.some((x) => x.includes('hubzone'));
  if (/8\(a\)|minority/.test(sa)) return c.some((x) => x.includes('minority') || x.includes('8(a)') || x.includes('mbe'));
  if (/\bdbe\b/.test(sa)) return c.some((x) => x.includes('dbe'));
  if (/small business|sba/.test(sa)) return c.some((x) => x.includes('small business'));
  return false;
}

/**
 * Build a specific, plain-English reason this opportunity fits — referencing the
 * actual contract + profile attributes (not "matches your profile").
 */
export function buildExplanation(o: OpportunityRecord, profile: AgencyProfile, a: OpportunityAssessment): string {
  const hay = `${o.title} ${o.description || ''}`.toLowerCase();
  const clauses: string[] = [];

  // Location / distance
  if (a.remoteEligible) {
    clauses.push('it can be delivered remotely');
  } else if (typeof a.distanceMiles === 'number' && a.withinRadius) {
    clauses.push(`it's within ${a.distanceMiles} mi of you`);
  }

  // Service match
  const serviceHits = (profile.services || []).filter((s) => s && hay.includes(s.toLowerCase()));
  if (serviceHits.length) {
    clauses.push(`it matches your ${serviceHits.slice(0, 2).join(' & ').toLowerCase()} services`);
  }

  // Set-aside eligibility
  const sa = (o.setAsideType || '').toLowerCase();
  if (sa && sa !== 'no set aside used' && sa !== 'none') {
    if (holdsSetAsideCert(sa, profile.certifications || [])) {
      clauses.push(`you're eligible for its ${o.setAsideType} set-aside`);
    }
  } else {
    clauses.push('it’s open competition (no set-aside barrier)');
  }

  // Industry
  const indHit = (profile.industries || []).find((i) => i && hay.includes(i.split('/')[0].trim().toLowerCase()));
  if (indHit && clauses.length < 3) clauses.push(`it’s in ${indHit.toLowerCase()}, an industry you serve`);

  // Contract size
  if (o.estimatedValue && (profile.minContract || profile.maxContract)) {
    const min = profile.minContract ?? 0;
    const max = profile.maxContract ?? Number.MAX_SAFE_INTEGER;
    if (o.estimatedValue >= min && o.estimatedValue <= max && clauses.length < 3) {
      clauses.push('its size fits your preferred contract range');
    }
  }

  const lead = a.label.replace(' Match', ' fit');
  if (!clauses.length) return `${lead} based on your profile.`;
  // Join: "A, B, and C."
  const body = clauses.length === 1
    ? clauses[0]
    : `${clauses.slice(0, -1).join(', ')}, and ${clauses[clauses.length - 1]}`;
  return `${lead} because ${body}.`;
}

/** Secondary sort: soonest future deadline first; past/none last. */
function deadlineRank(iso: string | null): number {
  if (!iso) return Number.MAX_SAFE_INTEGER;
  const t = new Date(iso).getTime() - Date.now();
  return t < 0 ? Number.MAX_SAFE_INTEGER - 1 : t;
}

export interface RecommendationOptions {
  radius?: number;
  signals?: FeedbackSignalInput;
  /** Minimum match score for the primary ("recommended") feed. */
  minScore?: number;
  /** Lower bound for the secondary "other matches" block. */
  otherFloor?: number;
  /** Max items to score/return per block. */
  limit?: number;
}

/**
 * Get personalized recommendations from the stored opportunity DB.
 * Splits into "new since last visit" vs older matches.
 */
export async function getRecommendations(
  profile: AgencyProfile,
  opts: RecommendationOptions = {}
): Promise<RecommendationsResult> {
  const radius = opts.radius ?? profile.serviceRadiusMiles ?? 50;
  // Curated feed: surface Good Match+ (>=60) as "Recommended for you". Possible
  // Matches (40–59) are still shown, but in a visually separate, lower-priority
  // "Other opportunities" block so the user can see how many more exist without
  // diluting the top picks. Weak matches (<40) are not surfaced.
  const minScore = opts.minScore ?? 60;
  const otherFloor = opts.otherFloor ?? 40;
  const limit = opts.limit ?? 50;
  const newSince = profile.lastFeedSeenAt ? new Date(profile.lastFeedSeenAt).getTime() : null;
  const isFirstVisit = newSince === null;

  // Pull a broad set of stored opportunities (Supabase only — never SAM live).
  // 500 comfortably covers the full CA opportunity set, so every opportunity is
  // scored for recommendations — closing the gap where a high-scoring older
  // opportunity showed in search (keyword-filtered) but not here (recency-
  // windowed).
  const { results, unavailable, error } = await queryOpportunities({ limit: 500 });
  if (unavailable) return { isFirstVisit, newItems: [], olderItems: [], otherItems: [], totalConsidered: 0, unavailable: true, error };

  // Score everything that is at least location-serviceable and clears the lower
  // "other" floor. We split into primary (>=minScore) and other (floor..minScore)
  // below.
  const allScored = results
    .map((o) => {
      const a = computeAssessment(o, profile, radius, opts.signals);
      return { o, a };
    })
    .filter(({ a }) => a.matchScore >= otherFloor && (a.withinRadius || a.remoteEligible));

  // AI nuance pass (Kimi): adjust the top candidates by deterministic score so
  // the primary feed reflects nuances keyword-matching can't see. Sort first so
  // the "top N" are the right ones; the adjustment can reorder, so we rely on the
  // per-block sortBlock() below to re-order. Hard gates remain immutable. Safe
  // no-op when AI is unconfigured or unreachable. Lower-confidence "other"
  // matches are intentionally not AI-reviewed (saves budget).
  allScored.sort((x, y) => y.a.matchScore - x.a.matchScore);
  await applyKimiAdjustments(allScored, profile, KIMI_TOP_N);

  const scored = allScored.filter(({ a }) => a.matchScore >= minScore);
  const otherScored = allScored.filter(({ a }) => a.matchScore < minScore);

  const toItem = (o: OpportunityRecord, a: OpportunityAssessment, isNew: boolean): RecommendationItem => ({
    id: o.noticeId,
    source: o.source ?? null,
    title: o.title,
    agency: o.agency,
    description: o.description || 'No description text was available for this opportunity.',
    descriptionUrl: o.descriptionUrl ?? null,
    value: fmtValue(o.estimatedValue),
    estimatedValue: o.estimatedValue ?? null,
    naicsCode: o.naicsCode ?? null,
    pscCode: o.pscCode ?? null,
    setAsideType: o.setAsideType ?? null,
    placeOfPerformance: o.placeOfPerformance ?? null,
    responseDeadline: o.responseDeadline ?? null,
    sourceUrl: o.sourceUrl,
    assessment: a,
    checklist: computeChecklist(o, profile),
    explanation: buildExplanation(o, profile, a),
    isNew,
    ingestedAt: o.ingestedAt ?? null,
  });

  const sortBlock = (arr: { o: OpportunityRecord; a: OpportunityAssessment }[]) =>
    arr.sort((x, y) => y.a.matchScore - x.a.matchScore || deadlineRank(x.o.responseDeadline ?? null) - deadlineRank(y.o.responseDeadline ?? null));

  // Secondary block of lower-confidence matches, shared across first/return
  // visits. Sorted by score; capped so it never overwhelms the page.
  const otherBlock = sortBlock(otherScored).slice(0, limit).map(({ o, a }) => toItem(o, a, false));

  if (isFirstVisit) {
    // First feed: everything qualifying is "your top matches" (no new/old split).
    const all = sortBlock(scored).slice(0, limit).map(({ o, a }) => toItem(o, a, false));
    return {
      isFirstVisit: true,
      newItems: all,
      olderItems: [],
      otherItems: otherBlock,
      totalConsidered: allScored.length,
      unavailable: false,
    };
  }

  const isNewOpp = (o: OpportunityRecord) => {
    const t = o.ingestedAt ? new Date(o.ingestedAt).getTime() : 0;
    return t > (newSince as number);
  };

  const newBlock = sortBlock(scored.filter(({ o }) => isNewOpp(o))).slice(0, limit).map(({ o, a }) => toItem(o, a, true));
  const olderBlock = sortBlock(scored.filter(({ o }) => !isNewOpp(o))).slice(0, limit).map(({ o, a }) => toItem(o, a, false));

  return {
    isFirstVisit: false,
    newItems: newBlock,
    olderItems: olderBlock,
    otherItems: otherBlock,
    totalConsidered: allScored.length,
    unavailable: false,
  };
}
