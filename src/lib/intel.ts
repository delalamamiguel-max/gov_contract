import crypto from 'crypto';
import OpenAI from 'openai';
import { getSupabaseAdmin } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// Phase 2 — structured opportunity intelligence.
//
// Distills the extracted attachment text (opportunity_documents) into a compact,
// high-signal structured record per opportunity: a plain-English scope summary
// plus entities the scorer can reason on (required services, deliverables,
// evaluation criteria, mandatory qualifications, geo constraints, domain terms,
// complexity, buyer intent) — and a CONTENT-based marketing re-confirmation that
// corrects metadata-only mistakes from the Phase 0 gate.
//
// One LLM call per opportunity over a budgeted slice of its documents. Cached by
// content_hash (hash of the contributing doc hashes) so intel is only re-derived
// when the underlying documents change.
// ---------------------------------------------------------------------------

const AI_API_KEY = process.env.OLLAMA_API_KEY || process.env.KIMI_API_KEY || '';
const AI_BASE_URL = process.env.AI_BASE_URL || 'https://ollama.com/v1';
const AI_MODEL = process.env.AI_MODEL || 'glm-5.2:cloud';
const AI_TIMEOUT_MS = 60_000;

export const intelEnabled = Boolean(AI_API_KEY);

const client = new OpenAI({ apiKey: AI_API_KEY || 'dummy_key', baseURL: AI_BASE_URL, timeout: AI_TIMEOUT_MS + 5_000 });

const SOURCE = 'caleprocure';
const DOCS_TABLE = 'opportunity_documents';
const INTEL_TABLE = 'opportunity_intel';
const OPPS_TABLE = 'opportunities';

// Input budgeting: keep the LLM call cheap and within context.
const PER_DOC_CHAR_CAP = 30_000;
const TOTAL_CHAR_BUDGET = 60_000;

export interface OpportunityEntities {
  is_marketing_work?: boolean;
  primary_category?: string;
  required_services?: string[];
  deliverables?: string[];
  evaluation_criteria?: Array<{ criterion: string; weight?: string }>;
  mandatory_qualifications?: string[];
  set_aside?: string;
  geographic_constraints?: string;
  domain_terms?: string[];
  complexity?: 'low' | 'medium' | 'high' | string;
  buyer_intent?: string;
}

export interface IntelRecord {
  scopeSummary: string;
  entities: OpportunityEntities;
  model: string;
}

interface DocRow {
  file_name: string;
  text: string | null;
  char_count: number | null;
  content_hash: string | null;
}

/** Hash of the contributing document hashes — stable id for the doc set. */
function contentHashOf(docs: DocRow[]): string {
  const sig = docs
    .map((d) => `${d.file_name}:${d.content_hash || ''}`)
    .sort()
    .join('|');
  return crypto.createHash('sha256').update(sig).digest('hex');
}

/** Assemble a budgeted text block from an opportunity's documents. */
function buildInput(docs: DocRow[]): string {
  const sorted = [...docs].sort((a, b) => (b.char_count || 0) - (a.char_count || 0));
  const parts: string[] = [];
  let total = 0;
  for (const d of sorted) {
    if (total >= TOTAL_CHAR_BUDGET) break;
    const remaining = TOTAL_CHAR_BUDGET - total;
    const slice = (d.text || '').slice(0, Math.min(PER_DOC_CHAR_CAP, remaining)).trim();
    if (!slice) continue;
    parts.push(`## DOCUMENT: ${d.file_name}\n${slice}`);
    total += slice.length;
  }
  return parts.join('\n\n');
}

function buildPrompt(title: string, agency: string, inputText: string): string {
  return `You are an analyst for a platform serving MARKETING / ADVERTISING / COMMUNICATIONS / PR / CREATIVE / BRANDING / WEB / CONTENT / MEDIA / DIGITAL agencies. Read the government solicitation documents below and extract a structured profile an agency would use to decide whether to bid.

Judge "is_marketing_work" by the ACTUAL SCOPE, not the title. Construction, janitorial, IT systems, engineering, food service/concessions, equipment, maintenance, leasing, lab/testing, records digitization = NOT marketing.

OPPORTUNITY: ${title} — ${agency}

DOCUMENTS:
${inputText}

Return STRICT JSON ONLY (no markdown), exactly these keys:
{
  "scope_summary": "<3-5 plain-English sentences: what the buyer needs and why>",
  "is_marketing_work": <true|false>,
  "primary_category": "<marketing|advertising|public_relations|communications|creative|branding|graphic_design|web_design|web_development|content|copywriting|media_buying|media_planning|digital_marketing|seo|social_media|market_research|video_multimedia|translation_multilingual|photography|full_service_agency|none>",
  "required_services": ["<service the agency must provide>", ...],
  "deliverables": ["<concrete deliverable>", ...],
  "evaluation_criteria": [{"criterion": "<how proposals are scored>", "weight": "<e.g. 30% or unspecified>"}],
  "mandatory_qualifications": ["<hard requirement: cert, experience, staffing, license>", ...],
  "set_aside": "<SB|DVBE|small business|none|...>",
  "geographic_constraints": "<on-site location, remote allowed, or none>",
  "domain_terms": ["<5-15 salient terms/skills an agency would match on>"],
  "complexity": "low|medium|high",
  "buyer_intent": "<1 sentence: what success looks like for the buyer>"
}`;
}

function parseJsonObject(raw: string): Record<string, unknown> | null {
  const c = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const s = c.indexOf('{');
  const e = c.lastIndexOf('}');
  if (s < 0 || e <= s) return null;
  try {
    return JSON.parse(c.slice(s, e + 1));
  } catch {
    return null;
  }
}

const asStrArr = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()).map((x) => (x as string).trim()) : [];

/** Run the structured extraction for one opportunity's document set. */
async function extractIntel(title: string, agency: string, docs: DocRow[]): Promise<IntelRecord | null> {
  if (!intelEnabled) return null;
  const input = buildInput(docs);
  if (!input) return null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
  try {
    const res = await client.chat.completions.create(
      { model: AI_MODEL, messages: [{ role: 'user', content: buildPrompt(title, agency, input) }], temperature: 0.1, max_tokens: 4000 },
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);
    const parsed = parseJsonObject(res.choices?.[0]?.message?.content || '');
    if (!parsed) return null;

    const entities: OpportunityEntities = {
      is_marketing_work: parsed.is_marketing_work === true,
      primary_category: typeof parsed.primary_category === 'string' ? parsed.primary_category : 'none',
      required_services: asStrArr(parsed.required_services),
      deliverables: asStrArr(parsed.deliverables),
      evaluation_criteria: Array.isArray(parsed.evaluation_criteria)
        ? (parsed.evaluation_criteria as unknown[])
            .filter((x) => x && typeof x === 'object')
            .map((x) => {
              const o = x as Record<string, unknown>;
              return { criterion: String(o.criterion ?? '').trim(), weight: o.weight ? String(o.weight) : undefined };
            })
            .filter((x) => x.criterion)
        : [],
      mandatory_qualifications: asStrArr(parsed.mandatory_qualifications),
      set_aside: typeof parsed.set_aside === 'string' ? parsed.set_aside : undefined,
      geographic_constraints: typeof parsed.geographic_constraints === 'string' ? parsed.geographic_constraints : undefined,
      domain_terms: asStrArr(parsed.domain_terms),
      complexity: typeof parsed.complexity === 'string' ? parsed.complexity : undefined,
      buyer_intent: typeof parsed.buyer_intent === 'string' ? parsed.buyer_intent : undefined,
    };
    return {
      scopeSummary: typeof parsed.scope_summary === 'string' ? parsed.scope_summary.trim() : '',
      entities,
      model: AI_MODEL,
    };
  } catch (e) {
    clearTimeout(timeoutId);
    console.warn('[intel] extract failed:', e instanceof Error ? e.message : e);
    return null;
  }
}

// --------------------------- public helpers ---------------------------

/**
 * Compact, high-signal text built from intel for the deterministic scorer's
 * keyword haystack — structured entities only (no raw doc text), to add signal
 * without the noise of boilerplate.
 */
export function intelToContentText(scopeSummary: string | null, entities: OpportunityEntities | null): string {
  if (!entities && !scopeSummary) return '';
  const e = entities || {};
  return [
    scopeSummary || '',
    ...(e.required_services || []),
    ...(e.deliverables || []),
    ...(e.domain_terms || []),
    e.buyer_intent || '',
  ]
    .filter(Boolean)
    .join('. ');
}

export interface IntelSyncSummary {
  status: 'success' | 'partial' | 'error';
  considered: number;
  extracted: number;
  skipped: number;
  nonMarketingByContent: number;
  error?: string;
}

/**
 * Derive structured intel for marketing opportunities that have extracted
 * documents. Idempotent: skips opps whose content_hash is unchanged unless
 * { recheck: true }.
 */
export async function runIntelExtraction(opts: { limit?: number; recheck?: boolean } = {}): Promise<IntelSyncSummary> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { status: 'error', considered: 0, extracted: 0, skipped: 0, nonMarketingByContent: 0, error: 'Supabase not configured.' };
  if (!intelEnabled) return { status: 'error', considered: 0, extracted: 0, skipped: 0, nonMarketingByContent: 0, error: 'AI not configured.' };

  // Opportunities that have at least one extracted document.
  const { data: docOpps, error: docErr } = await supabase
    .from(DOCS_TABLE)
    .select('source_id')
    .eq('source', SOURCE)
    .eq('status', 'extracted');
  if (docErr) return { status: 'error', considered: 0, extracted: 0, skipped: 0, nonMarketingByContent: 0, error: docErr.message };
  const oppIds = [...new Set((docOpps || []).map((d: { source_id: string }) => d.source_id))].slice(0, opts.limit ?? 200);
  if (oppIds.length === 0) return { status: 'success', considered: 0, extracted: 0, skipped: 0, nonMarketingByContent: 0 };

  // Existing intel (for change detection) + opportunity titles.
  const [{ data: existingIntel }, { data: opps }] = await Promise.all([
    supabase.from(INTEL_TABLE).select('source_id, content_hash').eq('source', SOURCE).in('source_id', oppIds),
    supabase.from(OPPS_TABLE).select('source_id, title, agency').eq('source', SOURCE).in('source_id', oppIds),
  ]);
  const existingHash = new Map((existingIntel || []).map((r: { source_id: string; content_hash: string }) => [r.source_id, r.content_hash]));
  const meta = new Map((opps || []).map((o: { source_id: string; title: string; agency: string }) => [o.source_id, o]));

  let extracted = 0;
  let skipped = 0;
  let nonMarketingByContent = 0;
  let failed = 0;

  // Small concurrency pool to keep the run snappy without hammering the model.
  const POOL = 3;
  let cursor = 0;
  const worker = async () => {
    while (cursor < oppIds.length) {
      const sourceId = oppIds[cursor++];
      const { data: docs } = await supabase
        .from(DOCS_TABLE)
        .select('file_name, text, char_count, content_hash')
        .eq('source', SOURCE)
        .eq('source_id', sourceId)
        .eq('status', 'extracted');
      const docRows = (docs || []) as DocRow[];
      if (docRows.length === 0) { skipped++; continue; }

      const hash = contentHashOf(docRows);
      if (!opts.recheck && existingHash.get(sourceId) === hash) { skipped++; continue; }

      const m = meta.get(sourceId) as { title?: string; agency?: string } | undefined;
      const intel = await extractIntel(m?.title || 'Opportunity', m?.agency || 'State of California', docRows);
      if (!intel) { failed++; continue; }
      if (intel.entities.is_marketing_work === false) nonMarketingByContent++;

      const now = new Date().toISOString();
      const { error: upErr } = await supabase.from(INTEL_TABLE).upsert(
        {
          source: SOURCE,
          source_id: sourceId,
          scope_summary: intel.scopeSummary,
          entities: intel.entities,
          content_hash: hash,
          model: intel.model,
          doc_count: docRows.length,
          updated_at: now,
        },
        { onConflict: 'source,source_id' }
      );
      if (upErr) { failed++; console.error('[intel] upsert failed:', upErr.message); continue; }
      extracted++;
    }
  };
  await Promise.all(Array.from({ length: POOL }, worker));

  return {
    status: failed > 0 ? 'partial' : 'success',
    considered: oppIds.length,
    extracted,
    skipped,
    nonMarketingByContent,
    error: failed > 0 ? `${failed} opportunities failed to extract` : undefined,
  };
}
