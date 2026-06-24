import { getSupabaseAdmin } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// Phase 1 — attachment text extraction (gated to the marketing set).
//
// Drives our Apify actor in `extract` mode: for each marketing opportunity that
// has attachments, the actor downloads each file's bytes (session-bound links)
// and returns normalized text. We persist one row per file into
// opportunity_documents, keyed by (source, source_id, file_name) with a content
// hash so unchanged files are never reprocessed.
//
// Runs on demand / nightly via /api/cron/extract. APIFY_TOKEN is server-side only.
// ---------------------------------------------------------------------------

const SOURCE = 'caleprocure';
const ACTOR = process.env.CALEPROCURE_ACTOR || 'Migs_atx~caleprocure-listings';
const APIFY_BASE = 'https://api.apify.com/v2';
const RUN_TIMEOUT_MS = 280_000;
const RUN_MEMORY_MB = 4096;

const DOCS_TABLE = 'opportunity_documents';
const OPPS_TABLE = 'opportunities';

interface ExtractItem {
  eventId?: string;
  fileName?: string;
  fileIndex?: number;
  mime?: string | null;
  byteSize?: number;
  contentHash?: string;
  charCount?: number;
  text?: string;
  method?: string;
  status?: string;
  error?: string | null;
}

export interface ExtractionSummary {
  status: 'success' | 'partial' | 'error';
  events: number;
  files: number;
  withText: number;
  error?: string;
}

/** Pull the Business Unit out of a stored /event/{BU}/{eventId} solicitation URL. */
function buFromUrl(url?: string | null): string | null {
  const m = /\/event\/(\d+)\//.exec(url || '');
  return m ? m[1] : null;
}

/** Run the actor in extract mode (synchronous) and return its dataset items. */
async function runExtractActor(
  token: string,
  events: Array<{ eventId: string; bu: string }>,
  concurrency: number
): Promise<ExtractItem[]> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), RUN_TIMEOUT_MS);
  try {
    const res = await fetch(
      `${APIFY_BASE}/acts/${ACTOR}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}&memory=${RUN_MEMORY_MB}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'extract', events, concurrency }),
        signal: controller.signal,
      }
    );
    clearTimeout(t);
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Apify extract run failed HTTP ${res.status}: ${body.slice(0, 200)}`);
    }
    const data = await res.json();
    return Array.isArray(data) ? (data as ExtractItem[]) : [];
  } catch (e) {
    clearTimeout(t);
    throw e instanceof Error ? e : new Error('Apify extract run failed');
  }
}

/**
 * Extract attachment text for marketing opportunities that don't have it yet.
 * Idempotent: by default skips opps that already have document rows; pass
 * { recheck: true } to re-extract (e.g. after addenda).
 */
export async function runDocumentExtraction(opts: { limit?: number; recheck?: boolean } = {}): Promise<ExtractionSummary> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { status: 'error', events: 0, files: 0, withText: 0, error: 'Supabase not configured.' };
  const token = process.env.APIFY_TOKEN;
  if (!token) return { status: 'error', events: 0, files: 0, withText: 0, error: 'APIFY_TOKEN not configured.' };

  // 1. Marketing, biddable opps that carry attachments.
  const { data: opps, error: oppErr } = await supabase
    .from(OPPS_TABLE)
    .select('source_id, source_url, raw')
    .eq('source', SOURCE)
    .eq('status', 'active')
    .eq('is_marketing', true)
    .limit(opts.limit ?? 200);
  if (oppErr) return { status: 'error', events: 0, files: 0, withText: 0, error: oppErr.message };

  const withAttachments = (opps || []).filter(
    (o: Record<string, any>) => Array.isArray(o.raw?.attachments) && o.raw.attachments.length > 0
  );

  // 2. Skip opps already extracted (unless rechecking).
  let already = new Set<string>();
  if (!opts.recheck && withAttachments.length) {
    const ids = withAttachments.map((o: Record<string, any>) => o.source_id as string);
    const { data: existing } = await supabase.from(DOCS_TABLE).select('source_id').eq('source', SOURCE).in('source_id', ids);
    already = new Set((existing || []).map((d: { source_id: string }) => d.source_id));
  }

  // 3. Build the event list (need a BU to deep-link).
  const events = withAttachments
    .filter((o: Record<string, any>) => !already.has(o.source_id))
    .map((o: Record<string, any>) => ({
      eventId: o.source_id as string,
      bu: buFromUrl(o.source_url) || buFromUrl(o.raw?.url) || '',
    }))
    .filter((e: { bu: string }) => e.bu);

  if (events.length === 0) return { status: 'success', events: 0, files: 0, withText: 0 };

  // 4. Run the actor; persist one row per file.
  let items: ExtractItem[];
  try {
    items = await runExtractActor(token, events, 4);
  } catch (e) {
    return { status: 'error', events: events.length, files: 0, withText: 0, error: e instanceof Error ? e.message : 'extract failed' };
  }

  const now = new Date().toISOString();
  const rows = items
    .filter((it) => it.eventId && it.fileName)
    .map((it) => ({
      source: SOURCE,
      source_id: it.eventId,
      file_name: it.fileName,
      file_index: it.fileIndex ?? null,
      mime: it.mime ?? null,
      byte_size: it.byteSize ?? null,
      content_hash: it.contentHash ?? null,
      char_count: it.charCount ?? null,
      text: it.text ?? null,
      extraction_method: it.method ?? null,
      status: it.status ?? 'extracted',
      error: it.error ?? null,
      extracted_at: now,
    }));

  let failed = 0;
  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100);
    const { error: upErr } = await supabase.from(DOCS_TABLE).upsert(chunk, { onConflict: 'source,source_id,file_name' });
    if (upErr) {
      failed += chunk.length;
      console.error('[documents] upsert chunk failed:', upErr.message);
    }
  }

  const withText = rows.filter((r) => r.status === 'extracted').length;
  return {
    status: failed > 0 ? 'partial' : 'success',
    events: events.length,
    files: rows.length,
    withText,
    error: failed > 0 ? `${failed} document rows failed to persist` : undefined,
  };
}
