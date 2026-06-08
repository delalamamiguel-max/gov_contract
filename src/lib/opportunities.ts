import { getSupabaseAdmin } from '@/lib/supabase';
import type { SamGovOpportunity } from '@/lib/samgov';
import { caleprocureEventUrl } from '@/lib/sources/caleprocure';

// ---------------------------------------------------------------------------
// Opportunities data-access layer. ALL user-facing reads go through here and
// hit Supabase only — never SAM.gov live. Keeps search fast and resilient even
// when SAM is down (serves last-synced data).
// ---------------------------------------------------------------------------

const TABLE = 'opportunities';

// California-only (MVP). Keep rows from the CA-native sources, plus any other
// source whose place of performance mentions California. Applied to every
// user-facing read so non-CA / seed rows never surface.
// NOTE: PostgREST `.or()` treats commas as filter separators — values MUST NOT
// contain literal commas (e.g. `%, CA%` here would silently break the parser).
// The `%california%` clause covers ~all CA SAM.gov rows already.
const CA_OR_FILTER =
  'source.in.(caleprocure,dgs-ncb,caltrans),place_of_performance.ilike.%california%';

/** The shape the UI/assessment layer expects (same as live SAM mapping). */
export type OpportunityRecord = SamGovOpportunity & {
  /** Origin source: 'sam.gov' | 'caleprocure' | 'dgs-ncb' | 'caltrans'. Drives the solicitation link label. */
  source?: string | null;
  lastSyncedAt?: string | null;
  /** When this opportunity was first ingested into our DB (drives "new" feed). */
  ingestedAt?: string | null;
};

export interface QueryOptions {
  keyword?: string;
  naicsCode?: string | null;
  setAsideType?: string | null;
  limit?: number;
  /** Only opportunities posted at/after this ISO timestamp. */
  postedSince?: string | null;
}

// ---------------------------------------------------------------------------
// Contextual query expansion. Government solicitations rarely use the same words
// a small agency would search for ("PR" instead of "public relations", or
// "marketing" when the notice says "outreach"/"communications"). We expand a
// user's query into a Postgres `websearch` OR-expression of related concepts so
// search behaves contextually rather than as a literal keyword match.
//
// Keys are matched case-insensitively against the FULL trimmed query (exact) and
// also as whole-word tokens, so "PR services" still expands "PR".
// ---------------------------------------------------------------------------
const CONCEPT_SYNONYMS: Record<string, string[]> = {
  pr: ['public relations', 'communications', 'media relations', 'outreach', 'publicity'],
  'public relations': ['PR', 'communications', 'media relations', 'outreach', 'publicity'],
  marketing: ['advertising', 'outreach', 'communications', 'branding', 'promotion', 'campaign'],
  advertising: ['marketing', 'media buy', 'media planning', 'campaign', 'promotion'],
  communications: ['public relations', 'outreach', 'marketing', 'media relations'],
  branding: ['brand', 'creative', 'design', 'identity'],
  'social media': ['digital', 'content', 'community management', 'marketing'],
  seo: ['search engine optimization', 'digital marketing', 'web'],
  web: ['website', 'web design', 'web development', 'digital'],
  website: ['web', 'web design', 'web development', 'digital'],
  'web design': ['website', 'web development', 'web', 'ux', 'ui'],
  'graphic design': ['creative', 'design', 'branding', 'visual'],
  video: ['multimedia', 'production', 'creative', 'film'],
  translation: ['localization', 'interpretation', 'multilingual', 'language'],
  it: ['information technology', 'technology', 'software', 'systems'],
  'information technology': ['IT', 'technology', 'software', 'systems'],
  software: ['application', 'development', 'IT', 'systems', 'programming'],
  consulting: ['advisory', 'professional services', 'consultant'],
  research: ['market research', 'analysis', 'study', 'survey'],
  training: ['education', 'workshop', 'instruction', 'learning'],
  construction: ['building', 'renovation', 'infrastructure', 'contractor'],
  engineering: ['design', 'technical', 'infrastructure'],
  janitorial: ['cleaning', 'custodial', 'maintenance'],
  landscaping: ['grounds', 'maintenance', 'horticulture'],
  catering: ['food service', 'food', 'meals'],
  security: ['guard', 'protection', 'surveillance'],
};

/** Whitespace/punctuation tokenizer for whole-word concept matching. */
function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^a-z0-9&]+/)
    .filter(Boolean);
}

/**
 * Expand a raw search query into a Postgres `websearch` expression that ORs in
 * related concepts. Returns the expanded string plus whether any expansion was
 * applied (so the UI can tell the user we broadened the search).
 *
 * websearch syntax: space = AND, `OR` = OR, quotes = phrase. We build
 * `("orig phrase") OR (syn1) OR ("syn 2") ...` to keep the user's phrase primary.
 */
export function expandQuery(raw: string): { expanded: string; didExpand: boolean } {
  const q = raw.trim();
  if (!q) return { expanded: q, didExpand: false };

  const lower = q.toLowerCase();
  const matched = new Set<string>();

  // Exact full-query match (e.g. "public relations").
  if (CONCEPT_SYNONYMS[lower]) {
    CONCEPT_SYNONYMS[lower].forEach((s) => matched.add(s));
  }

  // Whole-word token matches (e.g. "PR" inside "PR agency"). Also handle
  // two-word concepts present in the query (e.g. "social media").
  const toks = tokens(q);
  for (const [concept, syns] of Object.entries(CONCEPT_SYNONYMS)) {
    if (concept === lower) continue; // already handled
    const conceptToks = concept.split(' ');
    const present =
      conceptToks.length === 1
        ? toks.includes(concept)
        : lower.includes(concept);
    if (present) syns.forEach((s) => matched.add(s));
  }

  if (matched.size === 0) return { expanded: q, didExpand: false };

  // Quote multi-word terms; leave single words bare.
  const quote = (t: string) => (t.includes(' ') ? `"${t}"` : t);
  const origGroup = quote(q);
  const synGroups = [...matched]
    .filter((s) => s.toLowerCase() !== lower)
    .map(quote);

  const expanded = [origGroup, ...synGroups].join(' OR ');
  return { expanded, didExpand: true };
}

export interface QueryResult {
  results: OpportunityRecord[];
  error?: string;
  /** True when Supabase isn't configured (so callers can show a clear message). */
  unavailable?: boolean;
  /** True when the keyword was expanded with related concepts (contextual search). */
  didExpand?: boolean;
  /** True when FTS found nothing and we fell back to a broad substring match. */
  usedFallback?: boolean;
}

/** Map a DB row to the UI/assessment record shape. */
function rowToRecord(r: Record<string, any>): OpportunityRecord {
  // For Cal eProcure rows, regenerate the solicitation URL at read time so
  // existing rows get the resolver-backed deep link without re-running the
  // (paid) Apify actor.
  const stored = r.source_url as string | null;
  const actorUrl = (r.raw && typeof r.raw === 'object' ? (r.raw as any).url : null) ?? null;
  const sourceUrl =
    r.source === 'caleprocure'
      ? caleprocureEventUrl(r.source_id, actorUrl || stored || undefined)
      : stored;

  return {
    source: r.source ?? null,
    noticeId: r.source_id,
    title: r.title,
    agency: r.agency,
    description: r.description ?? null,
    descriptionUrl: r.description_url ?? null,
    solicitationNumber: (r.raw && r.raw.solicitationNumber) || null,
    naicsCode: r.naics_code ?? null,
    pscCode: r.psc_code ?? null,
    setAsideType: r.set_aside_type ?? null,
    placeOfPerformance: r.place_of_performance ?? null,
    postedDate: r.posted_date,
    responseDeadline: r.response_deadline ?? null,
    estimatedValue: r.estimated_value ?? null,
    sourceUrl: sourceUrl ?? '',
    lastSyncedAt: r.last_synced_at ?? null,
    ingestedAt: r.created_at ?? null,
  };
}

/** Map a normalized SAM record to a DB row for upsert. */
export function recordToRow(o: SamGovOpportunity, raw: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    source: 'sam.gov',
    source_id: o.noticeId,
    source_url: o.sourceUrl,
    title: o.title,
    description: o.description,
    description_url: o.descriptionUrl,
    agency: o.agency,
    naics_code: o.naicsCode,
    psc_code: o.pscCode,
    set_aside_type: o.setAsideType,
    place_of_performance: o.placeOfPerformance,
    posted_date: o.postedDate,
    response_deadline: o.responseDeadline,
    estimated_value: o.estimatedValue,
    status: 'active',
    raw,
    last_synced_at: new Date().toISOString(),
  };
}

/**
 * Query stored opportunities with optional keyword (full-text) and filters.
 * Reads Supabase only.
 */
export async function queryOpportunities(opts: QueryOptions = {}): Promise<QueryResult> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { results: [], unavailable: true, error: 'Opportunity database is not configured.' };

  const limit = opts.limit ?? 100;
  const keyword = opts.keyword?.trim();

  // Shared builder so the primary (FTS) and fallback (ilike) queries apply the
  // same non-keyword filters.
  const baseQuery = () => {
    let q = supabase.from(TABLE).select('*').eq('status', 'active').or(CA_OR_FILTER);
    if (opts.naicsCode) q = q.eq('naics_code', opts.naicsCode);
    if (opts.setAsideType) q = q.ilike('set_aside_type', `%${opts.setAsideType}%`);
    if (opts.postedSince) q = q.gte('posted_date', opts.postedSince);
    return q;
  };

  try {
    let didExpand = false;

    if (keyword) {
      // Contextual search: expand the query into related concepts before FTS.
      const { expanded, didExpand: ex } = expandQuery(keyword);
      didExpand = ex;
      const q = baseQuery()
        .textSearch('search_tsv', expanded, { type: 'websearch', config: 'english' })
        .order('posted_date', { ascending: false })
        .limit(limit);

      const { data, error } = await q;
      if (error) {
        console.error('[Opportunities] FTS query failed:', error.message);
        return { results: [], error: 'Could not load opportunities.' };
      }

      const rows = data || [];
      if (rows.length > 0) {
        return { results: rows.map(rowToRecord), didExpand };
      }

      // Fallback: FTS found nothing and the term isn't in our concept dictionary.
      // Do a broad substring match over title + description so the user still
      // gets contextual hits. Guard against very short terms (e.g. 2–3 chars)
      // which match as substrings of unrelated words ("PR" inside "approach")
      // and would flood the results with noise — those are better served by the
      // expansion dictionary, and if they're not in it, an empty result is more
      // honest than 300 irrelevant rows.
      // NOTE: PostgREST `.or()` treats commas/parens as filter syntax, so strip
      // them from the user value before interpolating into the pattern.
      const safeKeyword = keyword.replace(/[,()]/g, ' ').trim();
      if (safeKeyword.length < 4) {
        return { results: [], didExpand };
      }
      const pattern = `%${safeKeyword}%`;
      const fb = baseQuery()
        .or(`title.ilike.${pattern},description.ilike.${pattern}`)
        .order('posted_date', { ascending: false })
        .limit(limit);

      const { data: fbData, error: fbError } = await fb;
      if (fbError) {
        console.error('[Opportunities] ilike fallback failed:', fbError.message);
        // FTS already returned 0 cleanly — surface an empty result, not an error.
        return { results: [], didExpand };
      }
      return { results: (fbData || []).map(rowToRecord), didExpand, usedFallback: true };
    }

    // No keyword — straight listing.
    const { data, error } = await baseQuery()
      .order('posted_date', { ascending: false })
      .limit(limit);
    if (error) {
      console.error('[Opportunities] query failed:', error.message);
      return { results: [], error: 'Could not load opportunities.' };
    }
    return { results: (data || []).map(rowToRecord) };
  } catch (e) {
    console.error('[Opportunities] query threw:', e instanceof Error ? e.message : e);
    return { results: [], error: 'Could not load opportunities.' };
  }
}

/** Count of stored active opportunities (for empty-state messaging). */
export async function countOpportunities(): Promise<number> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return 0;
  try {
    const { count } = await supabase.from(TABLE).select('id', { count: 'exact', head: true }).eq('status', 'active').or(CA_OR_FILTER);
    return count ?? 0;
  } catch {
    return 0;
  }
}

/** Cache full description text back onto a stored opportunity (best-effort). */
export async function cacheDescription(sourceId: string, description: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;
  try {
    await supabase.from(TABLE).update({ description }).eq('source', 'sam.gov').eq('source_id', sourceId);
  } catch {
    /* best-effort */
  }
}
