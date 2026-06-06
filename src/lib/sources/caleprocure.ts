import { getSupabaseAdmin } from '@/lib/supabase';
import {
  openSyncRun, closeSyncRun, upsertOpportunityRows, type SourceSyncSummary,
} from '@/lib/sources/ckan';

// ---------------------------------------------------------------------------
// California Cal eProcure (California State Contracts Register) — OPEN bid
// opportunities. California exposes no official API, so this pulls via OUR OWN
// Apify actor ("Migs_atx/caleprocure-listings") — a Playwright scraper that
// drives the InFlight/PeopleSoft public event search and extracts every distinct
// open ("Posted") bid. Stored with status='active' so they appear in search /
// recommendations like SAM.gov opportunities.
//
// The APIFY_TOKEN is server-side only and never exposed to the browser.
// Cost-controlled: not run on the daily auto-cron unless CALEPROCURE_AUTO=true;
// otherwise trigger on demand via /api/cron/ingest?source=caleprocure.
// ---------------------------------------------------------------------------

const SOURCE = 'caleprocure';
const ACTOR = process.env.CALEPROCURE_ACTOR || 'Migs_atx~caleprocure-listings';
const APIFY_BASE = 'https://api.apify.com/v2';
const RUN_TIMEOUT_MS = 290_000; // run-sync upper bound
const RUN_MEMORY_MB = 4096;     // Playwright/Chromium needs headroom

interface CaleprocureItem {
  eventId?: string;
  name?: string;
  department?: string;
  endRaw?: string;
  endDate?: string; // ISO (already parsed by the actor)
  status?: string;
  url?: string;
  [k: string]: unknown;
}

const CALEPROCURE_SEARCH = 'https://caleprocure.ca.gov/pages/Events-BS3/event-search.aspx';

/**
 * Best-effort solicitation URL for a Cal eProcure event.
 *
 * The canonical per-event detail URL is only reliably available when the Apify
 * actor captures it (`item.url`). Cal eProcure's guest event-detail route is a
 * PeopleSoft endpoint that requires the department business-unit code we don't
 * have at listing level, so a constructed detail link would 404. Until the actor
 * emits real per-event URLs (tracked follow-up), fall back to the public event
 * search pre-seeded with the event id so the user lands one click from the event
 * instead of an empty search page.
 */
function caleprocureEventUrl(eventId: string, actorUrl?: string): string {
  if (actorUrl && /^https?:\/\//i.test(actorUrl)) return actorUrl;
  return eventId ? `${CALEPROCURE_SEARCH}?searchText=${encodeURIComponent(eventId)}` : CALEPROCURE_SEARCH;
}

function parseDeadline(endDate?: string, endRaw?: string): string | null {
  for (const v of [endDate, endRaw]) {
    if (!v) continue;
    const d = new Date(v);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  return null;
}

/** Map one actor record into an opportunities row. */
export function mapCaleprocureRecord(item: CaleprocureItem): Record<string, unknown> | null {
  const eventId = String(item.eventId || '').trim();
  if (!eventId) return null;

  const title = String(item.name || 'California State bid opportunity').trim();
  const dept = String(item.department || 'State of California').trim();
  const statusRaw = String(item.status || '').toLowerCase();
  // Cal eProcure marks live solicitations as "Posted" (also "Open"/"Active").
  const isOpen = ['posted', 'open', 'active'].some((s) => statusRaw.includes(s)) || statusRaw === '';
  const deadline = parseDeadline(item.endDate, item.endRaw);

  return {
    source: SOURCE,
    source_id: eventId,
    source_url: caleprocureEventUrl(eventId, item.url),
    title,
    description:
      `California State bid opportunity from ${dept}.` +
      (deadline ? ` Closes ${new Date(deadline).toLocaleDateString()}.` : '') +
      ` Search event "${eventId}" on Cal eProcure to view full details and respond.`,
    description_url: null,
    agency: dept,
    naics_code: null,
    psc_code: null,
    set_aside_type: null,
    place_of_performance: 'California',
    posted_date: null,
    response_deadline: deadline,
    estimated_value: null, // not provided at listing level
    status: isOpen ? 'active' : 'closed',
    raw: item,
    last_synced_at: new Date().toISOString(),
  };
}

/** Run our Apify actor synchronously and return its dataset items. */
async function runActor(token: string, input: Record<string, unknown>): Promise<CaleprocureItem[]> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), RUN_TIMEOUT_MS);
  try {
    const res = await fetch(
      `${APIFY_BASE}/acts/${ACTOR}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}&memory=${RUN_MEMORY_MB}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
        signal: controller.signal,
      }
    );
    clearTimeout(t);
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Apify run failed HTTP ${res.status}: ${body.slice(0, 200)}`);
    }
    const data = await res.json();
    return Array.isArray(data) ? (data as CaleprocureItem[]) : [];
  } catch (e) {
    clearTimeout(t);
    throw e instanceof Error ? e : new Error('Apify run failed');
  }
}

/**
 * Sync open California bid opportunities from Cal eProcure (via our Apify actor)
 * into Supabase. Idempotent. Logs the run to sync_runs.
 */
export async function syncCaleprocure(): Promise<SourceSyncSummary> {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return { runId: null, status: 'error', imported: 0, updated: 0, failed: 0, total: 0, error: 'Supabase not configured.' };
  }
  const token = process.env.APIFY_TOKEN;
  if (!token) {
    return { runId: null, status: 'error', imported: 0, updated: 0, failed: 0, total: 0, error: 'APIFY_TOKEN not configured.' };
  }

  const input: Record<string, unknown> = { status: 'P' };
  if (process.env.CALEPROCURE_KEYWORD) input.keyword = process.env.CALEPROCURE_KEYWORD;
  const limitEnv = parseInt(process.env.CALEPROCURE_LIMIT || '0', 10);
  if (Number.isFinite(limitEnv) && limitEnv > 0) input.limit = limitEnv;

  const runId = await openSyncRun(supabase, SOURCE, { actor: ACTOR, ...input });
  let imported = 0, updated = 0, failed = 0, total = 0;
  let errorMsg: string | undefined;

  try {
    const items = await runActor(token, input);
    const byId = new Map<string, Record<string, unknown>>();
    for (const item of items) {
      const row = mapCaleprocureRecord(item);
      if (row) byId.set(row.source_id as string, row);
    }
    const rows = [...byId.values()];
    total = rows.length;
    ({ imported, updated, failed } = await upsertOpportunityRows(supabase, SOURCE, rows));
  } catch (e) {
    errorMsg = e instanceof Error ? e.message : 'Cal eProcure sync failed';
    console.error('[caleprocure] sync error:', errorMsg);
  }

  const status: SourceSyncSummary['status'] =
    errorMsg && total === 0 ? 'error' : failed > 0 || errorMsg ? 'partial' : 'success';
  await closeSyncRun(supabase, runId, { status, imported, updated, failed, total, error: errorMsg });
  return { runId, status, imported, updated, failed, total, error: errorMsg };
}
