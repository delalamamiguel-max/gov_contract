import { getSupabaseAdmin } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// California DGS — Approved Non-Competitive Bids ingestion source.
//
// Source: California Open Data Portal (CKAN) — data.ca.gov.
// These are APPROVED sole-source / non-competitive contracts (awarded, not open
// bids), so they're stored with status='awarded' to keep them out of the active
// bidding feed while remaining queryable as market intelligence.
//
// Uses the CKAN DataStore API (clean JSON) — no XLSX parsing. The resource id is
// resolved at runtime via package_show, because DGS replaces the file monthly.
// ---------------------------------------------------------------------------

const CKAN_BASE = 'https://data.ca.gov/api/3/action';
const OPPS_TABLE = 'opportunities';
const RUNS_TABLE = 'sync_runs';
const SOURCE = 'dgs-ncb';
const DATASET_SLUG = process.env.DGS_DATASET_SLUG || 'dgs-approved-non-competitive-bids';
const PAGE_SIZE = 100;
const REQUEST_TIMEOUT_MS = 20_000;

interface DgsRecord {
  _id?: number | string;
  Number?: string;
  Type?: string;
  'Approved on'?: string;
  'Requesting Organization'?: string;
  'Contractor or Commodity'?: string;
  'Total Original Contract Amount'?: string;
  'Amended Contract Amount'?: string;
  'Acquisition Type'?: string;
  [k: string]: unknown;
}

export interface DgsSyncSummary {
  runId: string | null;
  status: 'success' | 'partial' | 'error';
  imported: number;
  updated: number;
  failed: number;
  total: number;
  error?: string;
}

async function ckanFetch(path: string): Promise<any> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${CKAN_BASE}/${path}`, { headers: { Accept: 'application/json' }, signal: controller.signal });
    clearTimeout(t);
    if (!res.ok) throw new Error(`CKAN HTTP ${res.status}`);
    const json = await res.json();
    if (!json?.success) throw new Error('CKAN response not successful');
    return json.result;
  } catch (e) {
    clearTimeout(t);
    throw e instanceof Error ? e : new Error('CKAN fetch failed');
  }
}

async function ckanFetchWithRetry(path: string, attempts = 3): Promise<any> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await ckanFetch(path);
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 600 * (i + 1)));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('CKAN fetch failed after retries');
}

/** Resolve the active DataStore resource id for the NCB data file. */
async function resolveResourceId(): Promise<{ resourceId: string; datasetUrl: string }> {
  const result = await ckanFetchWithRetry(`package_show?id=${encodeURIComponent(DATASET_SLUG)}`);
  const resources: Array<Record<string, any>> = result?.resources || [];
  const dataFile =
    resources.find((r) => r.datastore_active && String(r.format).toUpperCase() === 'XLSX' && !/dictionary/i.test(r.name || '')) ||
    resources.find((r) => r.datastore_active) ||
    resources.find((r) => String(r.format).toUpperCase() === 'XLSX');
  if (!dataFile?.id) throw new Error('No DataStore-active NCB resource found in the dataset package.');
  return { resourceId: dataFile.id, datasetUrl: `https://data.ca.gov/dataset/${DATASET_SLUG}` };
}

/** Fetch all DataStore records, paginating until exhausted. */
async function fetchAllRecords(resourceId: string): Promise<DgsRecord[]> {
  const all: DgsRecord[] = [];
  let offset = 0;
  // total is reported by CKAN; loop defensively with a hard cap.
  for (let guard = 0; guard < 200; guard++) {
    const result = await ckanFetchWithRetry(
      `datastore_search?resource_id=${resourceId}&limit=${PAGE_SIZE}&offset=${offset}`
    );
    const records: DgsRecord[] = result?.records || [];
    all.push(...records);
    const total = Number(result?.total) || all.length;
    offset += PAGE_SIZE;
    if (records.length === 0 || all.length >= total) break;
  }
  return all;
}

// --- Normalization helpers ---

function parseAmount(...values: (string | undefined)[]): number | null {
  for (const v of values) {
    if (v == null) continue;
    const n = parseInt(String(v).replace(/[^0-9.-]/g, ''), 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0; // present but zero (dataset uses 0 for undisclosed amounts)
}

function parseDate(v?: string): string | null {
  if (!v) return null;
  const d = new Date(v.replace(' ', 'T'));
  return isNaN(d.getTime()) ? null : d.toISOString();
}

const JUSTIFICATION = { NCB: 'Non-Competitive Bid', SCR: 'Special Category Request', LTB: 'Limited to Brand' } as const;

/** Is this a real data row (not the stray header row)? */
function isDataRow(r: DgsRecord): boolean {
  const num = (r.Number || '').trim();
  return Boolean(num) && num.toLowerCase() !== 'number';
}

/** Map a DGS record to an opportunities table row. Returns null to skip. */
export function mapDgsRecord(r: DgsRecord, datasetUrl: string): Record<string, unknown> | null {
  if (!isDataRow(r)) return null;
  const number = (r.Number || '').trim();
  const org = (r['Requesting Organization'] || 'California State Agency').trim();
  const vendor = (r['Contractor or Commodity'] || 'Undisclosed vendor').trim();
  const acqType = (r['Acquisition Type'] || '').trim();
  const justCode = (r.Type || '').trim().toUpperCase();
  const justLabel = JUSTIFICATION[justCode as keyof typeof JUSTIFICATION] || justCode || 'Non-competitive';
  const amount = parseAmount(r['Amended Contract Amount'], r['Total Original Contract Amount']);
  const approved = parseDate(r['Approved on']);

  const title = acqType ? `${vendor} — ${acqType}` : vendor;
  const description =
    `Approved non-competitive bid (${justLabel}${justCode && justLabel !== justCode ? `, ${justCode}` : ''}) by ${org}. ` +
    `Contractor/commodity: ${vendor}.` +
    (acqType ? ` Acquisition type: ${acqType}.` : '') +
    (amount ? ` Contract amount: $${amount.toLocaleString()}.` : '') +
    (approved ? ` Approved ${new Date(approved).toLocaleDateString()}.` : '') +
    ` Source: California DGS via data.ca.gov.`;

  return {
    source: SOURCE,
    source_id: number,
    source_url: datasetUrl,
    title,
    description,
    description_url: null,
    agency: org,
    naics_code: null,
    psc_code: null,
    set_aside_type: null, // non-competitive — no set-aside
    place_of_performance: 'California',
    posted_date: approved,
    response_deadline: null, // already awarded
    estimated_value: amount,
    status: 'awarded',
    raw: r,
    last_synced_at: new Date().toISOString(),
  };
}

/**
 * Full DGS ingestion: fetch all records, normalize, dedupe, upsert into
 * opportunities, and log the run to sync_runs. Idempotent.
 */
export async function syncDgsNcb(): Promise<DgsSyncSummary> {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return { runId: null, status: 'error', imported: 0, updated: 0, failed: 0, total: 0, error: 'Supabase not configured (missing service role key).' };
  }

  let runId: string | null = null;
  try {
    const { data } = await supabase.from(RUNS_TABLE).insert({ source: SOURCE, status: 'running', params: { datasetSlug: DATASET_SLUG } }).select('id').single();
    runId = data?.id ?? null;
  } catch {
    /* best-effort logging */
  }

  let imported = 0;
  let updated = 0;
  let failed = 0;
  let total = 0;
  let errorMsg: string | undefined;

  try {
    const { resourceId, datasetUrl } = await resolveResourceId();
    const records = await fetchAllRecords(resourceId);

    // Normalize + dedupe by source_id.
    const byId = new Map<string, Record<string, unknown>>();
    for (const rec of records) {
      const row = mapDgsRecord(rec, datasetUrl);
      if (row) byId.set(row.source_id as string, row);
    }
    const rows = [...byId.values()];
    total = rows.length;

    if (total > 0) {
      const ids = rows.map((r) => r.source_id as string);
      let existing = new Set<string>();
      try {
        const { data } = await supabase.from(OPPS_TABLE).select('source_id').eq('source', SOURCE).in('source_id', ids);
        existing = new Set((data || []).map((d: { source_id: string }) => d.source_id));
      } catch {
        /* counts approximate */
      }
      for (let i = 0; i < rows.length; i += 500) {
        const chunk = rows.slice(i, i + 500);
        const { error } = await supabase.from(OPPS_TABLE).upsert(chunk, { onConflict: 'source,source_id' });
        if (error) {
          failed += chunk.length;
          console.error('[DGS] upsert chunk failed:', error.message);
        } else {
          for (const r of chunk) (existing.has(r.source_id as string) ? updated++ : imported++);
        }
      }
    }
  } catch (e) {
    errorMsg = e instanceof Error ? e.message : 'DGS sync failed';
    console.error('[DGS] sync error:', errorMsg);
  }

  const status: DgsSyncSummary['status'] = errorMsg && total === 0 ? 'error' : failed > 0 || errorMsg ? 'partial' : 'success';

  if (runId) {
    try {
      await supabase.from(RUNS_TABLE).update({
        finished_at: new Date().toISOString(),
        status,
        imported_count: imported,
        updated_count: updated,
        failed_count: failed,
        error: errorMsg ?? null,
      }).eq('id', runId);
    } catch {
      /* best-effort */
    }
  }

  return { runId, status, imported, updated, failed, total, error: errorMsg };
}
