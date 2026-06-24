import { getSupabaseAdmin } from '@/lib/supabase';
import type { AgencyProfile } from '@/lib/profile';
import { buildProfileHash } from '@/lib/aiScoring';
import { intelToContentText, type OpportunityEntities } from '@/lib/intel';
import { labelFor, type OpportunityAssessment } from '@/lib/assessment';

// ---------------------------------------------------------------------------
// Phase 3 — semantic matching via local embeddings.
//
// Embeddings are produced by our Apify actor's `embed` mode (all-MiniLM-L6-v2,
// 384-dim, transformers.js) — no external embedding vendor, no per-call cost.
// Opportunity vectors are derived from Phase 2 intel and cached on
// opportunity_intel.embedding; agency-profile vectors are cached in
// profile_embeddings (keyed by buildProfileHash). Cosine similarity feeds a
// bounded ranking nudge in the read layer.
// ---------------------------------------------------------------------------

const ACTOR = process.env.CALEPROCURE_ACTOR || 'Migs_atx~caleprocure-listings';
const APIFY_BASE = 'https://api.apify.com/v2';
const RUN_TIMEOUT_MS = 280_000;
const EMBED_DIMS = 384;

const INTEL_TABLE = 'opportunity_intel';
const PROFILE_TABLE = 'profile_embeddings';
const SOURCE = 'caleprocure';

/** Call the actor's embed mode synchronously; returns id -> 384-d vector. */
async function embedTexts(texts: Array<{ id: string; text: string }>): Promise<Map<string, number[]>> {
  const out = new Map<string, number[]>();
  const token = process.env.APIFY_TOKEN;
  if (!token || texts.length === 0) return out;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), RUN_TIMEOUT_MS);
  try {
    const res = await fetch(`${APIFY_BASE}/acts/${ACTOR}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}&memory=2048`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'embed', texts }),
      signal: controller.signal,
    });
    clearTimeout(t);
    if (!res.ok) throw new Error(`embed run HTTP ${res.status}`);
    const data = await res.json();
    for (const r of Array.isArray(data) ? data : []) {
      if (r?.id && Array.isArray(r.embedding) && r.embedding.length === EMBED_DIMS) out.set(String(r.id), r.embedding as number[]);
    }
  } catch (e) {
    clearTimeout(t);
    console.warn('[embeddings] embed run failed:', e instanceof Error ? e.message : e);
  }
  return out;
}

/** pgvector literal for a float array. */
const toVectorLiteral = (v: number[]): string => `[${v.join(',')}]`;
/** Parse a pgvector value (PostgREST returns it as a "[...]" string). */
function parseVector(v: unknown): number[] | null {
  if (Array.isArray(v)) return v as number[];
  if (typeof v === 'string') {
    try {
      const a = JSON.parse(v);
      return Array.isArray(a) ? a : null;
    } catch {
      return null;
    }
  }
  return null;
}

export function cosine(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot; // vectors are L2-normalized at source, so dot product == cosine
}

/** Descriptive text representing an agency profile, for embedding. */
function profileText(p: AgencyProfile): string {
  return [
    (p as any).agencyType || '',
    (p.services || []).join(', '),
    (p.industries || []).length ? `Industries: ${(p.industries || []).join(', ')}` : '',
    (p as any).primaryCapability ? `Capability: ${(p as any).primaryCapability}` : '',
    (p.keywords || []).length ? `Keywords: ${(p.keywords || []).join(', ')}` : '',
    (p.differentiators || []).length ? `Differentiators: ${(p.differentiators || []).join(', ')}` : '',
  ]
    .filter(Boolean)
    .join('. ');
}

export interface EmbedSyncSummary {
  status: 'success' | 'partial' | 'error';
  considered: number;
  embedded: number;
  error?: string;
}

/**
 * Embed marketing opportunities that have intel but no vector yet (or all, with
 * recheck). Stores the vector on opportunity_intel.embedding.
 */
export async function runOpportunityEmbedding(opts: { limit?: number; recheck?: boolean } = {}): Promise<EmbedSyncSummary> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { status: 'error', considered: 0, embedded: 0, error: 'Supabase not configured.' };
  if (!process.env.APIFY_TOKEN) return { status: 'error', considered: 0, embedded: 0, error: 'APIFY_TOKEN not configured.' };

  let q = supabase.from(INTEL_TABLE).select('source_id, scope_summary, entities, embedding').eq('source', SOURCE);
  const { data, error } = await q.limit(opts.limit ?? 200);
  if (error) return { status: 'error', considered: 0, embedded: 0, error: error.message };

  const todo = (data || []).filter((r: Record<string, any>) => opts.recheck || !r.embedding);
  if (todo.length === 0) return { status: 'success', considered: 0, embedded: 0 };

  const texts = todo.map((r: Record<string, any>) => ({
    id: r.source_id as string,
    text: intelToContentText(r.scope_summary ?? null, (r.entities as OpportunityEntities) ?? null) || (r.scope_summary ?? ''),
  }));
  const vectors = await embedTexts(texts);

  let embedded = 0;
  let failed = 0;
  for (const [sourceId, vec] of vectors) {
    const { error: upErr } = await supabase
      .from(INTEL_TABLE)
      .update({ embedding: toVectorLiteral(vec) })
      .eq('source', SOURCE)
      .eq('source_id', sourceId);
    if (upErr) { failed++; console.error('[embeddings] update failed:', upErr.message); } else embedded++;
  }
  return { status: failed > 0 ? 'partial' : 'success', considered: todo.length, embedded };
}

/**
 * Get the cached embedding for a profile, computing+caching it on first use.
 * Best-effort: returns null if the embed run fails (caller skips semantic).
 */
export async function getProfileEmbedding(profile: AgencyProfile, opts: { compute?: boolean } = {}): Promise<number[] | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  const hash = buildProfileHash(profile);
  try {
    const { data } = await supabase.from(PROFILE_TABLE).select('embedding').eq('profile_hash', hash).maybeSingle();
    const cached = parseVector(data?.embedding);
    if (cached) return cached;
  } catch {
    /* fall through to compute */
  }
  // Not cached. Only pay the (cold-start) actor embed when explicitly allowed.
  if (opts.compute === false) return null;
  const vectors = await embedTexts([{ id: hash, text: profileText(profile) }]);
  const vec = vectors.get(hash);
  if (!vec) return null;
  try {
    await supabase.from(PROFILE_TABLE).upsert({ profile_hash: hash, embedding: toVectorLiteral(vec), updated_at: new Date().toISOString() }, { onConflict: 'profile_hash' });
  } catch {
    /* cache best-effort */
  }
  return vec;
}

/**
 * Apply a small, bounded semantic re-ranking nudge IN PLACE. Rewards
 * opportunities whose document embedding is closer to the agency profile than
 * the candidate-set average, and penalizes clear mismatches. Best-effort: a
 * no-op when the profile/opportunity vectors aren't available. Hard-gated scores
 * are never lifted. Returns the same array (caller should re-sort).
 */
export async function applySemanticAdjustment<T extends { o: { noticeId?: string; id?: string | number }; a: OpportunityAssessment }>(
  items: T[],
  profile: AgencyProfile,
  opts: { computeProfile?: boolean } = {}
): Promise<T[]> {
  if (items.length === 0) return items;
  const pv = await getProfileEmbedding(profile, { compute: opts.computeProfile ?? true });
  if (!pv) return items;

  const idOf = (it: T) => String(it.o.noticeId ?? it.o.id ?? '');
  const vecs = await getOpportunityEmbeddings(items.map(idOf).filter(Boolean));
  if (vecs.size === 0) return items;

  // Score each, then nudge relative to the mean similarity of those we could score.
  const sims = new Map<string, number>();
  for (const it of items) {
    const v = vecs.get(idOf(it));
    if (v) sims.set(idOf(it), cosine(pv, v));
  }
  if (sims.size === 0) return items;
  const mean = [...sims.values()].reduce((s, x) => s + x, 0) / sims.size;

  for (const it of items) {
    const sim = sims.get(idOf(it));
    if (sim === undefined) continue;
    it.a.semanticScore = Math.round(sim * 1000) / 1000;
    // Bounded nudge: ±8 around the set mean (scaled), never lifts a hard-gated score.
    const delta = Math.max(-8, Math.min(8, Math.round((sim - mean) * 60)));
    if (delta === 0) continue;
    let next = it.a.matchScore + delta;
    if (it.a.hardRequirementMissing) next = Math.min(next, 39);
    next = Math.max(0, Math.min(100, next));
    it.a.matchScore = next;
    it.a.label = labelFor(next);
  }
  return items;
}

/** Fetch opportunity embeddings for a set of source_ids. */
export async function getOpportunityEmbeddings(sourceIds: string[]): Promise<Map<string, number[]>> {
  const out = new Map<string, number[]>();
  const supabase = getSupabaseAdmin();
  if (!supabase || sourceIds.length === 0) return out;
  try {
    const { data } = await supabase.from(INTEL_TABLE).select('source_id, embedding').eq('source', SOURCE).in('source_id', sourceIds);
    for (const r of data || []) {
      const v = parseVector((r as Record<string, any>).embedding);
      if (v) out.set((r as Record<string, any>).source_id, v);
    }
  } catch {
    /* best-effort */
  }
  return out;
}
