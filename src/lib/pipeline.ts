import { getSupabaseAdmin } from '@/lib/supabase';
import { getProfileKey } from '@/lib/profile';

// ---------------------------------------------------------------------------
// Pipeline (saved opportunities) data-access layer.
//
// Persists the opportunities a user adds to their pipeline into the
// `saved_opportunities` table, keyed by the same profile key used for the
// agency profile (authenticated Supabase user id, else legacy cookie id).
// Reads/writes go through the server with the service-role client, consistent
// with `opportunities.ts` / `profile.ts`.
// ---------------------------------------------------------------------------

const TABLE = 'saved_opportunities';

/** Kanban columns. Keep in sync with KanbanBoard column ids. */
export const PIPELINE_STATUSES = ['saved', 'evaluating', 'bidding', 'submitted'] as const;
export type PipelineStatus = (typeof PIPELINE_STATUSES)[number];

export interface SavedOpportunity {
  noticeId: string;
  title: string;
  agency: string;
  status: PipelineStatus;
  /** Display value string (e.g. "$1.2M") + any extra fields carried from the card. */
  value: string | null;
  source: string | null;
  createdAt: string | null;
}

/** Minimal payload the UI sends when adding an opportunity to the pipeline. */
export interface SaveOpportunityInput {
  noticeId: string;
  title?: string | null;
  agency?: string | null;
  value?: string | null;
  source?: string | null;
  [k: string]: unknown;
}

function isStatus(s: unknown): s is PipelineStatus {
  return typeof s === 'string' && (PIPELINE_STATUSES as readonly string[]).includes(s);
}

function rowToSaved(r: Record<string, any>): SavedOpportunity {
  const data = (r.data && typeof r.data === 'object' ? r.data : {}) as Record<string, unknown>;
  return {
    noticeId: r.notice_id,
    title: r.title ?? (data.title as string) ?? 'Untitled opportunity',
    agency: r.agency ?? (data.agency as string) ?? '',
    status: isStatus(r.status) ? r.status : 'saved',
    value: (data.value as string) ?? null,
    source: (data.source as string) ?? null,
    createdAt: r.created_at ?? null,
  };
}

/** Add (or re-save) an opportunity to the current user's pipeline. */
export async function saveOpportunity(
  item: SaveOpportunityInput,
  status: PipelineStatus = 'saved'
): Promise<{ ok: boolean; unavailable?: boolean; error?: string }> {
  const noticeId = String(item.noticeId || '').trim();
  if (!noticeId) return { ok: false, error: 'Missing opportunity id.' };

  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, unavailable: true, error: 'Pipeline storage is not configured.' };

  const profileKey = await getProfileKey();
  if (!profileKey) return { ok: false, error: 'No profile to attach this opportunity to.' };

  try {
    const { error } = await supabase
      .from(TABLE)
      .upsert(
        {
          profile_key: profileKey,
          notice_id: noticeId,
          title: item.title ?? null,
          agency: item.agency ?? null,
          status,
          data: item,
        },
        { onConflict: 'profile_key,notice_id', ignoreDuplicates: false }
      );
    if (error) {
      console.error('[Pipeline] save failed:', error.message);
      return { ok: false, error: 'Could not add to pipeline.' };
    }
    return { ok: true };
  } catch (e) {
    console.error('[Pipeline] save threw:', e instanceof Error ? e.message : e);
    return { ok: false, error: 'Could not add to pipeline.' };
  }
}

/** List the current user's saved opportunities (newest first). */
export async function listSavedOpportunities(): Promise<{ items: SavedOpportunity[]; unavailable?: boolean }> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { items: [], unavailable: true };

  const profileKey = await getProfileKey();
  if (!profileKey) return { items: [] };

  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('profile_key', profileKey)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('[Pipeline] list failed:', error.message);
      return { items: [] };
    }
    return { items: (data || []).map(rowToSaved) };
  } catch (e) {
    console.error('[Pipeline] list threw:', e instanceof Error ? e.message : e);
    return { items: [] };
  }
}

/** Move a saved opportunity to a different Kanban column. */
export async function updateSavedStatus(
  noticeId: string,
  status: PipelineStatus
): Promise<{ ok: boolean; error?: string }> {
  if (!isStatus(status)) return { ok: false, error: 'Invalid status.' };

  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, error: 'Pipeline storage is not configured.' };

  const profileKey = await getProfileKey();
  if (!profileKey) return { ok: false, error: 'No profile.' };

  try {
    const { error } = await supabase
      .from(TABLE)
      .update({ status })
      .eq('profile_key', profileKey)
      .eq('notice_id', noticeId);
    if (error) {
      console.error('[Pipeline] status update failed:', error.message);
      return { ok: false, error: 'Could not update pipeline.' };
    }
    return { ok: true };
  } catch (e) {
    console.error('[Pipeline] status update threw:', e instanceof Error ? e.message : e);
    return { ok: false, error: 'Could not update pipeline.' };
  }
}

/** Remove an opportunity from the pipeline. */
export async function removeSaved(noticeId: string): Promise<{ ok: boolean }> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false };
  const profileKey = await getProfileKey();
  if (!profileKey) return { ok: false };
  try {
    await supabase.from(TABLE).delete().eq('profile_key', profileKey).eq('notice_id', noticeId);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
