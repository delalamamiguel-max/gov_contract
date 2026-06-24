import crypto from 'crypto';
import OpenAI from 'openai';
import { getSupabaseAdmin } from '@/lib/supabase';
import type { AgencyProfile } from '@/lib/profile';
import { labelFor, type OpportunityAssessment } from '@/lib/assessment';

// ---------------------------------------------------------------------------
// AI nuance layer — Kimi (via Ollama Cloud, OpenAI-compatible).
//
// The deterministic engine (assessment.ts) scores on keyword overlap and field
// values. It cannot read intent, industry context, or implicit on-site/staffing
// requirements from natural-language descriptions. This module asks Kimi for a
// BOUNDED adjustment (-25..+25) to the deterministic score — never a re-score —
// and caches the result in Supabase keyed by (source_id, profile_hash).
//
// Guarantees:
//  - Hard gates are immutable: if hardRequirementMissing, Kimi cannot push the
//    score above the 39 cap.
//  - Always safe: any error / timeout / missing config returns adjustment 0.
//  - Selective + cached: callers send only the top N candidates; repeats hit
//    the cache (no model call).
//
// Config (env): OLLAMA_API_KEY (or KIMI_API_KEY), KIMI_BASE_URL, KIMI_MODEL,
// KIMI_MAX_TOKENS. kimi-k2-thinking is a REASONING model — it requires a bounded
// max_tokens or the request 400s ("prompt too long"); reasoning consumes ~1300
// tokens, so keep headroom above that.
// ---------------------------------------------------------------------------

const KIMI_API_KEY = process.env.OLLAMA_API_KEY || process.env.KIMI_API_KEY || '';
const KIMI_BASE_URL = process.env.KIMI_BASE_URL || process.env.AI_BASE_URL || 'https://ollama.com/v1';
const KIMI_MODEL = process.env.KIMI_MODEL || 'glm-5.2:cloud';
const KIMI_MAX_TOKENS = Number(process.env.KIMI_MAX_TOKENS || 3000);
const KIMI_TIMEOUT_MS = 30_000;
const CACHE_TTL_DAYS = 7;

export const kimiEnabled = Boolean(KIMI_API_KEY);

const client = new OpenAI({
  apiKey: KIMI_API_KEY || 'dummy_key',
  baseURL: KIMI_BASE_URL,
  timeout: KIMI_TIMEOUT_MS + 5_000,
});

const TABLE = 'opportunity_ai_scores';

export interface KimiAdjustment {
  adjustment: number; // -50..+25
  reason: string;
  confidence: 'high' | 'medium' | 'low';
  source: 'kimi' | 'cache' | 'skipped';
}

const ZERO: KimiAdjustment = { adjustment: 0, reason: '', confidence: 'low', source: 'skipped' };

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

async function readCache(ids: string[], profileHash: string): Promise<Map<string, KimiAdjustment>> {
  const out = new Map<string, KimiAdjustment>();
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
  adj: KimiAdjustment
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
        model: KIMI_MODEL,
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

async function callKimi(
  o: OppForScoring,
  profile: AgencyProfile,
  det: OpportunityAssessment
): Promise<KimiAdjustment> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), KIMI_TIMEOUT_MS);
  try {
    const res = await client.chat.completions.create(
      {
        model: KIMI_MODEL,
        messages: [{ role: 'user', content: buildPrompt(o, profile, det) }],
        temperature: 0.2,
        max_tokens: KIMI_MAX_TOKENS,
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
      source: 'kimi',
    };
  } catch (e) {
    clearTimeout(timeoutId);
    const name = e instanceof Error ? e.name : '';
    if (name === 'AbortError') console.warn('[aiScoring] Kimi timed out; adjustment 0.');
    else console.warn('[aiScoring] Kimi error; adjustment 0:', e instanceof Error ? e.message : e);
    return ZERO;
  }
}

// --------------------------- public API ---------------------------

/** Is an opportunity worth an AI review? (selectivity guard) */
function eligibleForKimi(o: OppForScoring, det: OpportunityAssessment): boolean {
  const textLen = (o.contentSummary?.trim().length ?? 0) || (o.description?.trim().length ?? 0);
  return det.matchScore >= 30 && textLen >= 100;
}

/**
 * Apply Kimi nuance adjustments IN PLACE to the top `topN` items (already sorted
 * by deterministic score, highest first). Mutates each item's assessment:
 * matchScore, label, kimiAdjustment, kimiReason. Cache-first; only uncached,
 * eligible items hit the model. Hard gates are never overridden.
 *
 * Returns the same array reference (caller should re-sort afterwards, since an
 * adjustment can reorder cards).
 */
export async function applyKimiAdjustments<T extends { o: OppForScoring; a: OpportunityAssessment }>(
  items: T[],
  profile: AgencyProfile,
  topN: number
): Promise<T[]> {
  if (!kimiEnabled || items.length === 0) return items;

  const candidates = items.slice(0, topN).filter((it) => eligibleForKimi(it.o, it.a));
  if (candidates.length === 0) return items;

  const profileHash = buildProfileHash(profile);
  const ids = candidates.map((c) => oppId(c.o)).filter(Boolean);
  const cache = await readCache(ids, profileHash);

  await Promise.all(
    candidates.map(async (it) => {
      const id = oppId(it.o);
      let adj = id ? cache.get(id) : undefined;
      if (!adj) {
        adj = await callKimi(it.o, profile, it.a);
        if (id && adj.source === 'kimi') void writeCache(id, profileHash, adj);
      }
      if (!adj || adj.adjustment === 0) {
        // Record that AI reviewed it and found the score appropriate (no badge).
        return;
      }
      const a = it.a;
      let next = a.matchScore + adj.adjustment;
      // Hard gates are immutable — AI cannot lift a capped score.
      if (a.hardRequirementMissing) next = Math.min(next, 39);
      next = Math.max(0, Math.min(100, next));
      a.matchScore = next;
      a.label = labelFor(next);
      a.kimiAdjustment = adj.adjustment;
      a.kimiReason = adj.reason;
    })
  );

  return items;
}

/** Single-opportunity helper (used where only one assessment is adjusted). */
export async function getKimiAdjustment(
  o: OppForScoring,
  profile: AgencyProfile,
  det: OpportunityAssessment
): Promise<KimiAdjustment> {
  if (!kimiEnabled || !eligibleForKimi(o, det)) return ZERO;
  const profileHash = buildProfileHash(profile);
  const id = oppId(o);
  if (id) {
    const cache = await readCache([id], profileHash);
    const hit = cache.get(id);
    if (hit) return hit;
  }
  const adj = await callKimi(o, profile, det);
  if (id && adj.source === 'kimi') void writeCache(id, profileHash, adj);
  return adj;
}
