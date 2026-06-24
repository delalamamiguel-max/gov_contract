import OpenAI from 'openai';
import { getSupabaseAdmin } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// Phase 0 — Marketing relevance gate.
//
// BidFlare only serves MARKETING / ADVERTISING / COMMUNICATIONS / PR / CREATIVE
// / BRANDING / WEB-DESIGN / CONTENT / MEDIA-BUYING / DIGITAL-MARKETING agencies,
// but California's open-bid feed is overwhelmingly construction, janitorial, IT,
// engineering, and leasing. This module classifies each opportunity as marketing-
// relevant or not, cheapest-signal-first, so the expensive document pipeline (and
// AI scoring, and the feed) only ever touches the ~5% that matter.
//
// Tiers:
//   1. UNSPSC families  — authoritative structured signal (include / exclude).
//   2. Word-boundary marketing phrases + title hard-excludes — free.
//   3. LLM classifier    — only for the genuinely ambiguous remainder, with a
//      UNSPSC/title cross-check that overrides the model's systematic mistake
//      (gov "advertisement"/"invitation for bid" = a public notice, NOT ad work).
//
// Pure + deterministic except the optional LLM tier; safe to run server-side on
// every opportunity. The opportunity row itself is the cache (relevance_checked_at).
// ---------------------------------------------------------------------------

const AI_API_KEY = process.env.OLLAMA_API_KEY || process.env.KIMI_API_KEY || '';
const AI_BASE_URL = process.env.AI_BASE_URL || 'https://ollama.com/v1';
const AI_MODEL = process.env.AI_MODEL || 'glm-5.2:cloud';
const AI_TIMEOUT_MS = 90_000;

export const aiClassifierEnabled = Boolean(AI_API_KEY);

const client = new OpenAI({ apiKey: AI_API_KEY || 'dummy_key', baseURL: AI_BASE_URL, timeout: AI_TIMEOUT_MS + 5_000 });

export type RelevanceSignal = 'unspsc' | 'keyword' | 'exclude' | 'llm' | 'llm-crosscheck' | 'default';
export type RelevanceConfidence = 'high' | 'medium' | 'low';

export interface RelevanceInput {
  sourceId: string;
  title: string;
  description?: string | null;
  unspscCodes?: string[];
}

export interface RelevanceVerdict {
  isMarketing: boolean;
  category: string; // one marketing category, or 'none'
  confidence: RelevanceConfidence;
  signal: RelevanceSignal;
  model: string | null; // model id when the LLM tier decided, else null
}

// --------------------------- UNSPSC taxonomy ---------------------------
// Marketing/creative/communications families (segment 82 = Editorial, Design,
// Graphic & Fine Art Services; 8014 = Marketing & market research under segment 80).
const UNSPSC_INCLUDE_4: Record<string, string> = {
  '8014': 'market_research',
  '8210': 'advertising',
  '8211': 'content',          // writing & translations
  '8212': 'content',          // reproduction / printing
  '8213': 'creative',
  '8214': 'graphic_design',
  '8215': 'video_multimedia', // audio / visual production
  '8216': 'creative',
  '8217': 'creative',
};
// Clearly non-marketing UNSPSC segments (2-digit) and specific families (4-digit).
const UNSPSC_EXCLUDE_SEG = new Set([
  '11', '12', '15', '20', '24', '25', '26', '30', '40', '41', '42', '43', '46',
  '47', '48', '49', '50', '51', '52', '53', '55', '56', '70', '71', '72', '73',
  '76', '77', '78', '95',
]);
const UNSPSC_EXCLUDE_4 = new Set([
  '8011', '8012', '8013', '8016', '8017',        // HR / legal / real-estate / admin / procurement
  '8110', '8111', '8112', '8113', '8114', '8115', '8116', // engineering / IT / biomed
]);

// --------------------------- keyword signals ---------------------------
const MARKETING_PHRASES: Array<[RegExp, string]> = (
  [
    ['marketing', 'marketing'],
    ['advertising', 'advertising'],
    ['public relations', 'public_relations'],
    ['media relations', 'public_relations'],
    ['communications strateg', 'communications'],
    ['public outreach', 'communications'],
    ['public information', 'communications'],
    ['branding', 'branding'],
    ['graphic design', 'graphic_design'],
    ['web design', 'web_design'],
    ['website design', 'web_design'],
    ['web development', 'web_development'],
    ['social media', 'social_media'],
    ['digital marketing', 'digital_marketing'],
    ['media buying', 'media_buying'],
    ['media planning', 'media_planning'],
    ['creative services', 'creative'],
    ['content marketing', 'content'],
    ['copywriting', 'copywriting'],
    ['video production', 'video_multimedia'],
    ['videography', 'video_multimedia'],
    ['market research', 'market_research'],
    ['search engine optimization', 'seo'],
    ['outreach campaign', 'communications'],
  ] as Array<[string, string]>
).map(([p, c]) => [new RegExp(`\\b${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'), c]);

// Language services (translation / interpretation / captioning / transcription)
// are explicitly OUT of scope — they're language work, not marketing. When the
// TITLE is about language services we exclude outright, even if the writing-and-
// translations UNSPSC family (8211) would otherwise read as "content". Genuine
// marketing opps that merely mention translation as a sub-task (e.g. a multilingual
// campaign) don't carry these words in their title, so they're unaffected.
const LANGUAGE_SERVICES_TITLE = /\b(translation|translating|interpretation|interpreting|interpreter|captioning|transcription|sign language|localization)\b/i;

// Title terms that, absent any marketing signal, mark the bid as out-of-domain.
const TITLE_EXCLUDE = new RegExp(
  '\\b(construction|janitorial|custodial|plumbing|electrical|hvac|roofing|paving|pavement|asphalt|' +
    'bridge|guardrail|culvert|landscap|chiller|boiler|elevator|fire alarm|security alarm|drug testing|' +
    'laborator|fuel|towing|moving services|escrow|pest control|snow removal|generator|forklift|uniform|' +
    'linen|waste|recycling|demolition|excavation|hazardous material|inspection|maintenance and repair)\\b',
  'i'
);

// --------------------------- deterministic tier ---------------------------

interface DetSignals {
  unspscInclude: string | null; // category if a marketing family present
  unspscExclude: boolean;
  keyword: string | null;       // category from a phrase hit
  titleExclude: boolean;
}

function detectSignals(o: RelevanceInput): DetSignals {
  const codes = (o.unspscCodes || []).map(String);
  let unspscInclude: string | null = null;
  let unspscExclude = false;
  for (const c of codes) {
    const f4 = c.slice(0, 4);
    const seg = c.slice(0, 2);
    if (UNSPSC_INCLUDE_4[f4]) unspscInclude = unspscInclude || UNSPSC_INCLUDE_4[f4];
    else if (UNSPSC_EXCLUDE_4.has(f4) || UNSPSC_EXCLUDE_SEG.has(seg)) unspscExclude = true;
  }
  const text = `${o.title} ${o.description || ''}`;
  let keyword: string | null = null;
  for (const [re, cat] of MARKETING_PHRASES) {
    if (re.test(text)) { keyword = cat; break; }
  }
  return { unspscInclude, unspscExclude, keyword, titleExclude: TITLE_EXCLUDE.test(o.title) };
}

/**
 * Resolve from deterministic signals alone. Returns a verdict when confident, or
 * null when the opportunity is ambiguous and should go to the LLM tier.
 */
export function classifyDeterministic(o: RelevanceInput): RelevanceVerdict | null {
  // Language-services titles are out of scope outright (overrides UNSPSC 8211).
  if (LANGUAGE_SERVICES_TITLE.test(o.title)) {
    return { isMarketing: false, category: 'none', confidence: 'high', signal: 'exclude', model: null };
  }
  const s = detectSignals(o);
  const include = s.unspscInclude || s.keyword;
  const exclude = s.unspscExclude || s.titleExclude;

  // Authoritative marketing UNSPSC wins outright.
  if (s.unspscInclude && !s.unspscExclude) {
    return { isMarketing: true, category: s.unspscInclude, confidence: 'high', signal: 'unspsc', model: null };
  }
  // Clear non-marketing with no competing include signal.
  if (exclude && !include) {
    return { isMarketing: false, category: 'none', confidence: 'high', signal: 'exclude', model: null };
  }
  // Keyword include with no exclude conflict.
  if (s.keyword && !exclude) {
    return { isMarketing: true, category: s.keyword, confidence: 'medium', signal: 'keyword', model: null };
  }
  // Ambiguous: conflicting signals, or no signal at all → LLM tier decides.
  return null;
}

// --------------------------- LLM tier ---------------------------

const CATEGORIES =
  'marketing, advertising, public_relations, communications, creative, branding, graphic_design, web_design, web_development, content, copywriting, media_buying, media_planning, digital_marketing, seo, social_media, market_research, video_multimedia, photography, full_service_agency';

function buildBatchPrompt(batch: RelevanceInput[]): string {
  return `You are a STRICT classifier for a platform that ONLY serves MARKETING / ADVERTISING / COMMUNICATIONS / PR / CREATIVE / BRANDING / WEB-DESIGN / CONTENT / MEDIA-BUYING / DIGITAL-MARKETING agencies.

For each government bid, decide if such an agency could bid on it as CORE work (scope is marketing/advertising/PR/creative/branding/web/content/media/digital/market-research/translation/video/graphic-design). Everything else (construction, janitorial, IT systems, engineering, equipment, maintenance, leasing, records digitization, drug testing, escrow, food, security, medical, legal, audit, transportation, lab) is NOT marketing.

CRITICAL RULES (the common mistakes):
- Translation, interpretation, ASL, captioning, and transcription are LANGUAGE services, NOT marketing — classify them as marketing=false.
- The words "ADVERTISEMENT", "ADVERTISEMENT FOR BID", "INVITATION FOR BID", "NOTICE" are the government's PUBLIC BID NOTICE — they do NOT make the work advertising. Judge by the actual SCOPE.
  e.g. "BLANKET ADVERTISEMENT FOR ... CONSTRUCTION PROJECTS" = construction (NOT marketing).
  e.g. "Blanket Advertisement for Fair-Time Services" = county-fair operations (NOT marketing).
- "Digitization of records" / "scanning" = IT/records work, NOT market research.
- Titles are often opaque ("RFP 26-039") — rely on the description. If genuinely unsure, confidence "low".

Return STRICT JSON ONLY — an array, one object per item, no markdown:
[{"id":"<id>","marketing":true|false,"category":"<one of: ${CATEGORIES}, or none>","confidence":"high|medium|low"}]

ITEMS:
${batch.map((o) => `- id=${o.sourceId} | title: ${o.title} | desc: ${(o.description || '').slice(0, 300)}`).join('\n')}`;
}

function parseArray(raw: string): Array<Record<string, unknown>> | null {
  const c = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const s = c.indexOf('[');
  const e = c.lastIndexOf(']');
  if (s < 0 || e <= s) return null;
  try {
    const v = JSON.parse(c.slice(s, e + 1));
    return Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

const normConf = (c: unknown): RelevanceConfidence => {
  const v = String(c || '').toLowerCase();
  return v === 'high' || v === 'medium' || v === 'low' ? v : 'low';
};

/** Classify one ambiguous batch via the LLM, applying the deterministic cross-check. */
async function classifyBatchLLM(batch: RelevanceInput[]): Promise<Map<string, RelevanceVerdict>> {
  const out = new Map<string, RelevanceVerdict>();
  if (!aiClassifierEnabled || batch.length === 0) {
    // No model available — fail safe to "marketing unknown→true" so we never hide a
    // real opportunity in shadow mode; mark low confidence for review.
    for (const o of batch) out.set(o.sourceId, { isMarketing: true, category: 'none', confidence: 'low', signal: 'default', model: null });
    return out;
  }

  let arr: Array<Record<string, unknown>> | null = null;
  for (let attempt = 0; attempt < 2 && !arr; attempt++) {
    try {
      const res = await client.chat.completions.create({
        model: AI_MODEL,
        messages: [{ role: 'user', content: buildBatchPrompt(batch) }],
        temperature: 0,
        max_tokens: 6000,
      });
      arr = parseArray(res.choices?.[0]?.message?.content || '');
    } catch (e) {
      console.warn('[relevance] LLM batch error:', e instanceof Error ? e.message : e);
    }
  }

  const byId = new Map<string, Record<string, unknown>>();
  for (const r of arr || []) byId.set(String(r.id), r);

  for (const o of batch) {
    const r = byId.get(o.sourceId);
    if (!r) {
      // Unparsed / missing — fail safe to keep (low confidence) in shadow mode.
      out.set(o.sourceId, { isMarketing: true, category: 'none', confidence: 'low', signal: 'default', model: AI_MODEL });
      continue;
    }
    let isMarketing = r.marketing === true;
    const category = typeof r.category === 'string' ? r.category : 'none';
    let signal: RelevanceSignal = 'llm';
    // Cross-check: the model's systematic false positives all carry a hard
    // non-marketing signal — let UNSPSC/title override an LLM "marketing".
    if (isMarketing) {
      const s = detectSignals(o);
      if (s.unspscExclude || (s.titleExclude && !s.keyword && !s.unspscInclude)) {
        isMarketing = false;
        signal = 'llm-crosscheck';
      }
    }
    out.set(o.sourceId, {
      isMarketing,
      category: isMarketing ? category : 'none',
      confidence: normConf(r.confidence),
      signal,
      model: AI_MODEL,
    });
  }
  return out;
}

// --------------------------- public API ---------------------------

export interface ClassifyOptions {
  /** Use the LLM tier for ambiguous items (default true). */
  useLlm?: boolean;
  /** Items per LLM call. */
  batchSize?: number;
}

/**
 * Classify a set of opportunities. Deterministic tiers resolve most items for
 * free; only the ambiguous remainder hits the (batched) LLM. Returns a verdict
 * for every input id.
 */
export async function classifyOpportunities(
  opps: RelevanceInput[],
  opts: ClassifyOptions = {}
): Promise<Map<string, RelevanceVerdict>> {
  const useLlm = opts.useLlm ?? true;
  const batchSize = opts.batchSize ?? 30;
  const out = new Map<string, RelevanceVerdict>();
  const ambiguous: RelevanceInput[] = [];

  for (const o of opps) {
    const det = classifyDeterministic(o);
    if (det) out.set(o.sourceId, det);
    else ambiguous.push(o);
  }

  if (ambiguous.length) {
    if (useLlm) {
      for (let i = 0; i < ambiguous.length; i += batchSize) {
        const verdicts = await classifyBatchLLM(ambiguous.slice(i, i + batchSize));
        for (const [id, v] of verdicts) out.set(id, v);
      }
    } else {
      // LLM disabled — keep ambiguous items (shadow-safe) at low confidence.
      for (const o of ambiguous) out.set(o.sourceId, { isMarketing: true, category: 'none', confidence: 'low', signal: 'default', model: null });
    }
  }
  return out;
}

// --------------------------- DB orchestration ---------------------------

export interface RelevanceSyncSummary {
  status: 'success' | 'partial' | 'error';
  checked: number;
  marketing: number;
  nonMarketing: number;
  bySignal: Record<string, number>;
  error?: string;
}

/**
 * Classify stored Cal eProcure opportunities and persist the verdict onto each
 * row (is_marketing, marketing_category, relevance_*). SHADOW MODE: this only
 * writes the gate columns — no read path filters on them yet.
 *
 * By default only classifies active rows not yet checked; pass { recheck: true }
 * to re-classify everything (e.g. after tuning the gate).
 */
export async function runRelevanceClassification(opts: {
  recheck?: boolean;
  limit?: number;
  useLlm?: boolean;
} = {}): Promise<RelevanceSyncSummary> {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return { status: 'error', checked: 0, marketing: 0, nonMarketing: 0, bySignal: {}, error: 'Supabase not configured.' };
  }

  let query = supabase
    .from('opportunities')
    .select('source_id, title, description, raw')
    .eq('source', 'caleprocure')
    .eq('status', 'active');
  if (!opts.recheck) query = query.is('relevance_checked_at', null);

  const { data, error } = await query.limit(opts.limit ?? 1000);
  if (error) {
    return { status: 'error', checked: 0, marketing: 0, nonMarketing: 0, bySignal: {}, error: error.message };
  }

  const inputs: RelevanceInput[] = (data || []).map((r: Record<string, any>) => ({
    sourceId: r.source_id,
    title: r.title,
    description: r.description,
    unspscCodes: Array.isArray(r.raw?.unspscCodes) ? r.raw.unspscCodes : [],
  }));
  if (inputs.length === 0) {
    return { status: 'success', checked: 0, marketing: 0, nonMarketing: 0, bySignal: {} };
  }

  const verdicts = await classifyOpportunities(inputs, { useLlm: opts.useLlm });
  const now = new Date().toISOString();
  const bySignal: Record<string, number> = {};
  let marketing = 0;
  const rows: Record<string, unknown>[] = [];
  for (const inp of inputs) {
    const v = verdicts.get(inp.sourceId);
    if (!v) continue;
    if (v.isMarketing) marketing++;
    bySignal[v.signal] = (bySignal[v.signal] || 0) + 1;
    rows.push({
      source: 'caleprocure',
      source_id: inp.sourceId,
      is_marketing: v.isMarketing,
      marketing_category: v.category,
      relevance_confidence: v.confidence,
      relevance_model: v.model,
      relevance_checked_at: now,
    });
  }

  let failed = 0;
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200);
    const { error: upErr } = await supabase.from('opportunities').upsert(chunk, { onConflict: 'source,source_id' });
    if (upErr) {
      failed += chunk.length;
      console.error('[relevance] upsert chunk failed:', upErr.message);
    }
  }

  return {
    status: failed > 0 ? 'partial' : 'success',
    checked: rows.length,
    marketing,
    nonMarketing: rows.length - marketing,
    bySignal,
    error: failed > 0 ? `${failed} rows failed to persist` : undefined,
  };
}
