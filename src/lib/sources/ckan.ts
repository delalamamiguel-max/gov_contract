import { getSupabaseAdmin } from '@/lib/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Shared CKAN (data.ca.gov) ingestion core. Used by every California Open Data
// source (DGS, Caltrans, …) so each source file only defines its mapping.
// ---------------------------------------------------------------------------

const CKAN_BASE = 'https://data.ca.gov/api/3/action';
export const OPPS_TABLE = 'opportunities';
export const RUNS_TABLE = 'sync_runs';
const REQUEST_TIMEOUT_MS = 20_000;

export interface SourceSyncSummary {
  runId: string | null;
  status: 'success' | 'partial' | 'error';
  imported: number;
  updated: number;
  failed: number;
  total: number;
  error?: string;
}

async function ckanGetOnce(path: string): Promise<any> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${CKAN_BASE}/${path}`, { headers: { Accept: 'application/json' }, signal: controller.signal });
    clearTimeout(t);
    if (!res.ok) throw new Error(`CKAN HTTP ${res.status}`);
    const json = await res.json();
    if (!json?.success) throw new Error(json?.error?.message || 'CKAN response not successful');
    return json.result;
  } catch (e) {
    clearTimeout(t);
    throw e instanceof Error ? e : new Error('CKAN fetch failed');
  }
}

/** GET a CKAN action with retry + backoff. */
export async function ckanGet(path: string, attempts = 3): Promise<any> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await ckanGetOnce(path);
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 600 * (i + 1)));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('CKAN fetch failed after retries');
}

/** Resolve a DataStore-active resource within a dataset package by predicate. */
export async function resolvePackageResource(
  slug: string,
  prefer: (r: Record<string, any>) => boolean
): Promise<{ resourceId: string; datasetUrl: string }> {
  const result = await ckanGet(`package_show?id=${encodeURIComponent(slug)}`);
  const resources: Array<Record<string, any>> = result?.resources || [];
  const target =
    resources.find((r) => r.datastore_active && prefer(r)) ||
    resources.find((r) => r.datastore_active);
  if (!target?.id) throw new Error(`No DataStore-active resource found in package '${slug}'.`);
  return { resourceId: target.id, datasetUrl: `https://data.ca.gov/dataset/${slug}` };
}

/** Page through all DataStore records for a resource. */
export async function fetchAllDatastoreRecords(resourceId: string, pageSize = 100): Promise<Record<string, any>[]> {
  const all: Record<string, any>[] = [];
  let offset = 0;
  for (let guard = 0; guard < 500; guard++) {
    const result = await ckanGet(`datastore_search?resource_id=${resourceId}&limit=${pageSize}&offset=${offset}`);
    const records: Record<string, any>[] = result?.records || [];
    all.push(...records);
    const total = Number(result?.total) || all.length;
    offset += pageSize;
    if (records.length === 0 || all.length >= total) break;
  }
  return all;
}

/** Open a sync_runs row (best-effort). */
export async function openSyncRun(supabase: SupabaseClient, source: string, params: Record<string, unknown>): Promise<string | null> {
  try {
    const { data } = await supabase.from(RUNS_TABLE).insert({ source, status: 'running', params }).select('id').single();
    return data?.id ?? null;
  } catch {
    return null;
  }
}

/** Close a sync_runs row (best-effort). */
export async function closeSyncRun(supabase: SupabaseClient, runId: string | null, s: Omit<SourceSyncSummary, 'runId'>): Promise<void> {
  if (!runId) return;
  try {
    await supabase.from(RUNS_TABLE).update({
      finished_at: new Date().toISOString(),
      status: s.status,
      imported_count: s.imported,
      updated_count: s.updated,
      failed_count: s.failed,
      error: s.error ?? null,
    }).eq('id', runId);
  } catch {
    /* best-effort */
  }
}

/** Upsert opportunity rows for one source, returning accurate new/updated counts. */
export async function upsertOpportunityRows(
  supabase: SupabaseClient,
  source: string,
  rows: Record<string, unknown>[]
): Promise<{ imported: number; updated: number; failed: number }> {
  let imported = 0;
  let updated = 0;
  let failed = 0;
  if (rows.length === 0) return { imported, updated, failed };

  const ids = rows.map((r) => r.source_id as string);
  let existing = new Set<string>();
  try {
    const { data } = await supabase.from(OPPS_TABLE).select('source_id').eq('source', source).in('source_id', ids);
    existing = new Set((data || []).map((d: { source_id: string }) => d.source_id));
  } catch {
    /* counts approximate */
  }

  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const { error } = await supabase.from(OPPS_TABLE).upsert(chunk, { onConflict: 'source,source_id' });
    if (error) {
      failed += chunk.length;
      console.error(`[${source}] upsert chunk failed:`, error.message);
    } else {
      for (const r of chunk) (existing.has(r.source_id as string) ? updated++ : imported++);
    }
  }
  return { imported, updated, failed };
}

/**
 * Run a CKAN source end-to-end: resolve resource, fetch all records, map+dedupe,
 * upsert, and log to sync_runs. `mapRow` returns a row or null to skip.
 */
export async function runCkanSource(opts: {
  source: string;
  slug: string;
  prefer: (r: Record<string, any>) => boolean;
  pageSize?: number;
  mapRow: (rec: Record<string, any>, datasetUrl: string) => Record<string, unknown> | null;
}): Promise<SourceSyncSummary> {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return { runId: null, status: 'error', imported: 0, updated: 0, failed: 0, total: 0, error: 'Supabase not configured (missing service role key).' };
  }

  const runId = await openSyncRun(supabase, opts.source, { slug: opts.slug });
  let imported = 0, updated = 0, failed = 0, total = 0;
  let errorMsg: string | undefined;

  try {
    const { resourceId, datasetUrl } = await resolvePackageResource(opts.slug, opts.prefer);
    const records = await fetchAllDatastoreRecords(resourceId, opts.pageSize ?? 100);

    const byId = new Map<string, Record<string, unknown>>();
    for (const rec of records) {
      const row = opts.mapRow(rec, datasetUrl);
      if (row && row.source_id) byId.set(row.source_id as string, row);
    }
    const rows = [...byId.values()];
    total = rows.length;
    ({ imported, updated, failed } = await upsertOpportunityRows(supabase, opts.source, rows));
  } catch (e) {
    errorMsg = e instanceof Error ? e.message : 'Sync failed';
    console.error(`[${opts.source}] sync error:`, errorMsg);
  }

  const status: SourceSyncSummary['status'] =
    errorMsg && total === 0 ? 'error' : failed > 0 || errorMsg ? 'partial' : 'success';

  await closeSyncRun(supabase, runId, { status, imported, updated, failed, total, error: errorMsg });
  return { runId, status, imported, updated, failed, total, error: errorMsg };
}
