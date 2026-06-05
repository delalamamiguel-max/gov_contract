import { getSupabaseAdmin } from '@/lib/supabase';
import type { SamGovOpportunity } from '@/lib/samgov';

// ---------------------------------------------------------------------------
// Opportunities data-access layer. ALL user-facing reads go through here and
// hit Supabase only — never SAM.gov live. Keeps search fast and resilient even
// when SAM is down (serves last-synced data).
// ---------------------------------------------------------------------------

const TABLE = 'opportunities';

/** The shape the UI/assessment layer expects (same as live SAM mapping). */
export type OpportunityRecord = SamGovOpportunity & {
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

export interface QueryResult {
  results: OpportunityRecord[];
  error?: string;
  /** True when Supabase isn't configured (so callers can show a clear message). */
  unavailable?: boolean;
}

/** Map a DB row to the UI/assessment record shape. */
function rowToRecord(r: Record<string, any>): OpportunityRecord {
  return {
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
    sourceUrl: r.source_url,
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

  try {
    let q = supabase.from(TABLE).select('*').eq('status', 'active');

    if (opts.keyword && opts.keyword.trim()) {
      // Postgres full-text websearch over the generated tsvector column.
      q = q.textSearch('search_tsv', opts.keyword.trim(), { type: 'websearch', config: 'english' });
    }
    if (opts.naicsCode) q = q.eq('naics_code', opts.naicsCode);
    if (opts.setAsideType) q = q.ilike('set_aside_type', `%${opts.setAsideType}%`);
    if (opts.postedSince) q = q.gte('posted_date', opts.postedSince);

    q = q.order('posted_date', { ascending: false }).limit(opts.limit ?? 100);

    const { data, error } = await q;
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
    const { count } = await supabase.from(TABLE).select('id', { count: 'exact', head: true }).eq('status', 'active');
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
