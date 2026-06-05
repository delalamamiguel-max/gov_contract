import { getSupabaseAdmin } from '@/lib/supabase';
import { fetchSamGovPage, mapSamRecord } from '@/lib/samgov';
import { recordToRow } from '@/lib/opportunities';

// ---------------------------------------------------------------------------
// Centralized ingestion service. The ONLY place that calls SAM.gov for bulk
// data. Normalizes + upserts into Supabase and logs each run to sync_runs.
// All config is env-driven.
// ---------------------------------------------------------------------------

const OPPS_TABLE = 'opportunities';
const RUNS_TABLE = 'sync_runs';

// Default keyword set tuned for a marketing-agency platform. Override via env.
const DEFAULT_QUERIES = [
  'marketing', 'advertising', 'public relations', 'branding', 'website design',
  'social media', 'communications', 'creative services', 'media buying', 'graphic design',
];

export interface SyncConfig {
  months: number;
  limit: number;
  queries: string[];
  minIntervalHours: number;
}

export function getSyncConfig(): SyncConfig {
  const months = Math.min(11, Math.max(1, parseInt(process.env.SAM_SYNC_MONTHS || '6', 10) || 6));
  const limit = Math.min(100, Math.max(1, parseInt(process.env.SAM_SYNC_LIMIT || '50', 10) || 50));
  const queriesEnv = (process.env.SAM_SYNC_QUERIES || '').split(',').map((s) => s.trim()).filter(Boolean);
  const queries = queriesEnv.length ? queriesEnv : DEFAULT_QUERIES;
  const minIntervalHours = Math.max(0, parseInt(process.env.SYNC_MIN_INTERVAL_HOURS || '20', 10) || 20);
  return { months, limit, queries, minIntervalHours };
}

export interface SyncSummary {
  runId: string | null;
  status: 'success' | 'partial' | 'error' | 'skipped';
  imported: number;
  updated: number;
  failed: number;
  total: number;
  queriesRun: number;
  error?: string;
  skippedReason?: string;
}

/** Throttle: should we run, given the last successful run and the configured interval? */
export async function shouldRunSync(minIntervalHours: number): Promise<{ ok: boolean; reason?: string }> {
  if (minIntervalHours <= 0) return { ok: true };
  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: true }; // can't check — allow
  try {
    const { data } = await supabase
      .from(RUNS_TABLE)
      .select('finished_at')
      .eq('status', 'success')
      .order('finished_at', { ascending: false })
      .limit(1);
    const last = data?.[0]?.finished_at;
    if (!last) return { ok: true };
    const hours = (Date.now() - new Date(last).getTime()) / 3_600_000;
    if (hours < minIntervalHours) {
      return { ok: false, reason: `Last sync ${hours.toFixed(1)}h ago (< ${minIntervalHours}h interval).` };
    }
    return { ok: true };
  } catch {
    return { ok: true };
  }
}

async function fetchWithRetry(title: string, months: number, limit: number, attempts = 2) {
  let lastErr = '';
  for (let i = 0; i < attempts; i++) {
    const res = await fetchSamGovPage({ title, months, limit });
    if (!res.error) return res;
    lastErr = res.error;
    // Don't retry on 429 (rate limit) — back off the whole sync instead.
    if (res.status === 429) return res;
    await new Promise((r) => setTimeout(r, 800 * (i + 1)));
  }
  return { records: [], totalRecords: 0, error: lastErr };
}

/**
 * Run a full ingestion: fetch SAM (per configured query), normalize, dedupe,
 * upsert into Supabase, and log the run. One failed query never aborts the run.
 */
export async function syncOpportunities(override?: Partial<SyncConfig>): Promise<SyncSummary> {
  const cfg = { ...getSyncConfig(), ...override };
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return { runId: null, status: 'error', imported: 0, updated: 0, failed: 0, total: 0, queriesRun: 0, error: 'Supabase not configured (missing service role key).' };
  }

  // Open a sync_runs row.
  let runId: string | null = null;
  try {
    const { data } = await supabase.from(RUNS_TABLE).insert({ source: 'sam.gov', status: 'running', params: cfg }).select('id').single();
    runId = data?.id ?? null;
  } catch {
    /* logging is best-effort; continue */
  }

  const byId = new Map<string, { row: Record<string, unknown> }>();
  let failedQueries = 0;
  let rateLimited = false;

  for (const title of cfg.queries) {
    try {
      const res = await fetchWithRetry(title, cfg.months, cfg.limit);
      if (res.error) {
        failedQueries++;
        if (res.status === 429) { rateLimited = true; break; }
        continue;
      }
      for (const raw of res.records) {
        const mapped = mapSamRecord(raw);
        if (!mapped.noticeId) continue;
        byId.set(mapped.noticeId, { row: recordToRow(mapped, raw) });
      }
    } catch (e) {
      failedQueries++;
      console.error(`[Ingest] query "${title}" failed:`, e instanceof Error ? e.message : e);
    }
  }

  const rows = [...byId.values()].map((v) => v.row);
  const total = rows.length;
  let imported = 0;
  let updated = 0;
  let failedRecords = 0;

  if (total > 0) {
    // Determine new vs existing for accurate counts.
    const ids = rows.map((r) => r.source_id as string);
    let existing = new Set<string>();
    try {
      const { data } = await supabase.from(OPPS_TABLE).select('source_id').eq('source', 'sam.gov').in('source_id', ids);
      existing = new Set((data || []).map((d: { source_id: string }) => d.source_id));
    } catch {
      /* counts will be approximate */
    }

    // Upsert in chunks of 500.
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      const { error } = await supabase.from(OPPS_TABLE).upsert(chunk, { onConflict: 'source,source_id' });
      if (error) {
        failedRecords += chunk.length;
        console.error('[Ingest] upsert chunk failed:', error.message);
      } else {
        for (const r of chunk) (existing.has(r.source_id as string) ? (updated++) : (imported++));
      }
    }
  }

  const status: SyncSummary['status'] =
    failedRecords > 0 || (failedQueries > 0 && total === 0) || rateLimited
      ? (total > 0 ? 'partial' : 'error')
      : 'success';
  const errorMsg = rateLimited ? 'SAM.gov rate limit hit during sync.' : failedQueries > 0 ? `${failedQueries} query(ies) failed.` : undefined;

  if (runId) {
    try {
      await supabase.from(RUNS_TABLE).update({
        finished_at: new Date().toISOString(),
        status,
        imported_count: imported,
        updated_count: updated,
        failed_count: failedRecords,
        error: errorMsg ?? null,
      }).eq('id', runId);
    } catch {
      /* best-effort */
    }
  }

  return { runId, status, imported, updated, failed: failedRecords, total, queriesRun: cfg.queries.length - failedQueries, error: errorMsg };
}
