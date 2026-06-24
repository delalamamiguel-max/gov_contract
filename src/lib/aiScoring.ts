import crypto from 'crypto';
import OpenAI from 'openai';
import { getSupabaseAdmin } from '@/lib/supabase';
import type { AgencyProfile } from '@/lib/profile';
import { labelFor, type OpportunityAssessment } from '@/lib/assessment';

// ---------------------------------------------------------------------------
// AI nuance layer — GLM 5.2 (via Ollama Cloud, OpenAI-compatible).
//
// The deterministic engine (assessment.ts) scores on keyword overlap and field
// values. It cannot read intent, industry context, or implicit on-site/staffing
// requirements from natural-language descriptions. This module asks GLM 5.2 for
// a BOUNDED adjustment (-50..+25) to the deterministic score — never a re-score
// — and caches the result in Supabase keyed by (source_id, profile_hash).
//
// Guarantees:
//  - Hard gates are immutable: if hardRequirementMissing, GLM cannot push the
//    score above the 39 cap.
//  - Always safe: any error / timeout / missing config returns adjustment 0.
//  - Selective + cached: callers send only the top N candidates; repeats hit
//    the cache (no model call).
//
// Config (env): OLLAMA_API_KEY (or GLM_API_KEY), GLM_BASE_URL, GLM_MODEL,
// GLM_MAX_TOKENS. GLM 5.2 is a reasoning model — keep max_tokens bounded.
// ---------------------------------------------------------------------------

const GLM_API_KEY = process.env.OLLAMA_API_KEY || process.env.GLM_API_KEY || process.env.KIMI_API_KEY || '';
const GLM_BASE_URL = process.env.GLM_BASE_URL || process.env.KIMI_BASE_URL || process.env.AI_BASE_URL || 'https://ollama.com/v1';
const GLM_MODEL = process.env.GLM_MODEL || process.env.KIMI_MODEL || 'glm-5.2:cloud';
const GLM_MAX_TOKENS = Number(process.env.GLM_MAX_TOKENS || process.env.KIMI_MAX_TOKENS || 3000);
const GLM_TIMEOUT_MS = 30_000;
const CACHE_TTL_DAYS = 7;

export const glmEnabled = Boolean(GLM_API_KEY);
/** @deprecated use glmEnabled */
export const kimiEnabled = glmEnabled;

const client = new OpenAI({
  apiKey: GLM_API_KEY || 'dummy_key',
  baseURL: GLM_BASE_URL,
  timeout: GLM_TIMEOUT_MS + 5_000,
});

const TABLE = 'opportunity_ai_scores';

export interface GlmAdjustment {
  adjustment: number; // -50..+25
  reason: string;
  confidence: 'high' | 'medium' | 'low';
  source: 'glm' | 'cache' | 'skipped';
}
/** @deprecated use GlmAdjustment */
export type KimiAdjustment = GlmAdjustment;

const ZERO: GlmAdjustment = { adjustment: 0, reason: '', confidence: 'low', source: 'skipped' };

/** Minimal opportunity shape this module reads. */
export interface OppForScoring {
  noticeId?: string;
  id?: string | number;
  title: string;
  description?: string | null;
  agency?: string | null;
  setAsideType?: string | null;
  placeOfPerformance?: string | null;
  estimatedValue?: number | null;
  /** Phase 2 scope summary distilled from the solicitation attachments. */
  contentSummary?: string | null;
}

function oppId(o: OppForScoring): string {
  return String(o.noticeId ?? o.id ?? '');
}

/** Stable short hash of the profile fields that influence AI scoring. */
export function buildProfileHash(profile: AgencyProfile): string {
  const sig = JSON.stringify({
    s: (profile.services || []).map((x) => x.toLowerCase()).sort(),
    i: (profile.industries || []).map((x) => x.toLowerCase()).sort(),
    c: (profile.certifications || []).map((x) => x.toLowerCase()).sort(),
    l: (profile.location || '').toLowerCase(),
    r: profile.serviceRadiusMiles || 0,
    p: profile.remotePreference || '',
  });
  return crypto.createHash('sha256').update(sig).digest('hex').slice(0, 16);
}

function clampAdj(n: unknown): number {
  const v = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.max(-50, Math.min(25, Math.round(v)));
}

function normConfidence(c: unknown): 'high' | 'medium' | 'low' {
  const s = String(c || '').toLowerCase();
  return s === 'high' || s === 'medium' || s === 'low' ? s : 'low';
}

// --------------------------- cache ---------------------------

async function readCache(ids: string[], profileHash: string): Promise<Map<string, GlmAdjustment>> {
  const out = new Map<string, GlmAdjustment>();
  const supabase = getSupabaseAdmin();
  if (!supabase || ids.length === 0) return out;
  const cutoff = new Date(Date.now() - CACHE_TTL_DAYS * 86_400_000).toISOString();
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select('source_id, adjustment, reason, confidence')
      .eq('profile_hash', profileHash)
      .gte('created_at', cutoff)
      .in('source_id', ids);
    if (error) {
      console.warn('[aiScoring] cache read failed:', error.message);
      return out;
    }
    for (const r of data || []) {
      out.set(String(r.source_id), {
        adjustment: clampAdj(r.adjustment),
        reason: r.reason || '',
        confidence: normConfidence(r.confidence),
        source: 'cache',
      });
    }
  } catch (e) {
    console.warn('[aiScoring] cache read threw:', e instanceof Error ? e.message : e);
  }
  return out;
}

async function writeCache(
  sourceId: string,
  profileHash: string,
  adj: GlmAdjustment
): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;
  try {
    await supabase.from(TABLE).upsert(
      {
        source_id: sourceId,
        profile_hash: profileHash,
        adjustment: clampAdj(adj.adjustment),
        reason: adj.reason.slice(0, 500),
        confidence: adj.confidence,
        model: GLM_MODEL,
        created_at: new Date().toISOString(),
      },
      { onConflict: 'source_id,profile_hash' }
    );
  } catch (e) {
    console.warn('[aiScoring] cache write threw:', e instanceof Error ? e.message : e);
  }
}

// --------------------------- model call ---------------------------

function buildPrompt(o: OppForScoring, profile: AgencyProfile, det: OpportunityAssessment): string {
  return `You review a deterministic match score for a MARKETING / COMMUNICATIONS agency deciding whether to pursue a public-sector contract. The keyword-based engine cannot read intent, industry context, implicit on-site requirements, or staffing scale from prose — your job is to catch what it missed and propose a bounded adjustment.

AGENCY PROFILE:
- Services: ${(profile.services || []).join(', ') || 'unspecified'}
- Industries: ${(profile.industries || []).join(', ') || 'unspecified'}
- Certifications: ${(profile.certifications || []).join(', ') || 'none'}
- Location: ${profile.location || 'unspecified'} | radius ${profile.serviceRadiusMiles ?? 'n/a'} mi | preference ${profile.remotePreference || 'n/a'}
- Team size: ${profile.teamSize || 'unspecified'}
- Annual revenue: ${(profile as any).annualRevenue || 'unspecified'}

OPPORTUNITY:
- Title: ${o.title}
- Buyer: ${o.agency || 'unknown'}
- Set-aside: ${o.setAsideType || 'none'}
- Place of performance: ${o.placeOfPerformance || 'n/a'}
- Estimated value: ${o.estimatedValue ?? 'unknown'}
- ${o.contentSummary
    ? `Scope (from solicitation documents): ${o.contentSummary.slice(0, 3000)}`
    : `Description: ${(o.description || '(no description available)').slice(0, 2000)}`}

DETERMINISTIC BREAKDOWN (already computed):
- Eligibility ${det.eligibility.score}% | Fit ${det.fit.score}% | Edge ${det.edge.score}% | TOTAL ${det.matchScore}% (${det.label})
- Hard requirement missing: ${det.hardRequirementMissing ? 'YES (score is capped at 39)' : 'no'}

RULES:
- Output an integer adjustment from -50 to +25 to apply to the TOTAL.
- Return 0 if the deterministic score is already appropriate (this is the common case — do not invent adjustments).
- Use NEGATIVE when the prose reveals a mismatch the keywords missed (wrong industry, implicit on-site requirement, staffing scale far beyond the agency, specialized non-marketing expertise required).
- Use a SEVERE NEGATIVE penalty (e.g. -40 to -50) if the opportunity is blatantly not marketing/communications work (e.g., equipment maintenance, physical security, construction) but was falsely matched due to generic keywords.
- Use POSITIVE only when the prose reveals genuine fit the keywords under-counted.
- If a hard requirement is missing, do NOT propose a positive adjustment.
- Evaluate CONTEXTUAL FIT: read the description for industry alignment, scope complexity, staffing scale, and whether the work genuinely matches the agency's capabilities — do not just confirm keyword presence.
- Consider team size and revenue when assessing scale appropriateness. A 1-2 person agency should not be matched to contracts requiring large dedicated teams.

Return STRICT JSON ONLY, no markdown:
{"adjustment": <int -50..25>, "reason": "<one concise sentence>", "confidence": "high|medium|low"}`;
}

async function callGlm(
  o: OppForScoring,
  profile: AgencyProfile,
  det: OpportunityAssessment
): Promise<GlmAdjustment> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GLM_TIMEOUT_MS);
  try {
    const res = await client.chat.completions.create(
      {
        model: GLM_MODEL,
        messages: [{ role: 'user', content: buildPrompt(o, profile, det) }],
        temperature: 0.2,
        max_tokens: GLM_MAX_TOKENS,
      },
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);
    const raw = res.choices?.[0]?.message?.content || '';
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start < 0 || end <= start) return ZERO;
    const parsed = JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
    return {
      adjustment: clampAdj(parsed.adjustment),
      reason: typeof parsed.reason === 'string' ? parsed.reason : '',
      confidence: normConfidence(parsed.confidence),
      source: 'glm',
    };
  } catch (e) {
    clearTimeout(timeoutId);
    const name = e instanceof Error ? e.name : '';
    if (name === 'AbortError') console.warn('[aiScoring] GLM timed out; adjustment 0.');
    else console.warn('[aiScoring] GLM error; adjustment 0:', e instanceof Error ? e.message : e);
    return ZERO;
  }
}

// --------------------------- public API ---------------------------

/** Is an opportunity worth an AI review? (selectivity guard) */
function eligibleForGlm(o: OppForScoring, det: OpportunityAssessment): boolean {
  const textLen = (o.contentSummary?.trim().length ?? 0) || (o.description?.trim().length ?? 0);
  return det.matchScore >= 30 && textLen >= 100;
}

/**
 * Apply GLM 5.2 nuance adjustments IN PLACE to the top `topN` items (already
 * sorted by deterministic score, highest first). Mutates each item's assessment:
 * matchScore, label, glmAdjustment, glmReason. Cache-first; only uncached,
 * eligible items hit the model. Hard gates are never overridden.
 *
 * Returns the same array reference (caller should re-sort afterwards).
 */
export async function applyGlmAdjustments<T extends { o: OppForScoring; a: OpportunityAssessment }>(
  items: T[],
  profile: AgencyProfile,
  topN: number
): Promise<T[]> {
  if (!glmEnabled || items.length === 0) return items;

  const candidates = items.slice(0, topN).filter((it) => eligibleForGlm(it.o, it.a));
  if (candidates.length === 0) return items;

  const profileHash = buildProfileHash(profile);
  const ids = candidates.map((c) => oppId(c.o)).filter(Boolean);
  const cache = await readCache(ids, profileHash);

  await Promise.all(
    candidates.map(async (it) => {
      const id = oppId(it.o);
      let adj = id ? cache.get(id) : undefined;
      if (!adj) {
        adj = await callGlm(it.o, profile, it.a);
        if (id && adj.source === 'glm') void writeCache(id, profileHash, adj);
      }
      if (!adj || adj.adjustment === 0) return;
      const a = it.a;
      let next = a.matchScore + adj.adjustment;
      // Hard gates are immutable — AI cannot lift a capped score.
      if (a.hardRequirementMissing) next = Math.min(next, 39);
      next = Math.max(0, Math.min(100, next));
      a.matchScore = next;
      a.label = labelFor(next);
      a.glmAdjustment = adj.adjustment;
      a.glmReason = adj.reason;
    })
  );

  return items;
}

/** @deprecated use applyGlmAdjustments */
export const applyKimiAdjustments = applyGlmAdjustments;

/** Single-opportunity helper (used where only one assessment is adjusted). */
export async function getGlmAdjustment(
  o: OppForScoring,
  profile: AgencyProfile,
  det: OpportunityAssessment
): Promise<GlmAdjustment> {
  if (!glmEnabled || !eligibleForGlm(o, det)) return ZERO;
  const profileHash = buildProfileHash(profile);
  const id = oppId(o);
  if (id) {
    const cache = await readCache([id], profileHash);
    const hit = cache.get(id);
    if (hit) return hit;
  }
  const adj = await callGlm(o, profile, det);
  if (id && adj.source === 'glm') void writeCache(id, profileHash, adj);
  return adj;
}

/** @deprecated use getGlmAdjustment */
export const getKimiAdjustment = getGlmAdjustment;
