import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getProfileKey } from '@/lib/profile';

// ---------------------------------------------------------------------------
// Post-RFP feedback. Stored (Supabase primary, cookie fallback) and distilled
// into lightweight signals that nudge future recommendations.
// ---------------------------------------------------------------------------

export const FEEDBACK_COOKIE = 'agency_feedback';
const FEEDBACK_TABLE = 'rfp_feedback';
const MAX_COOKIE_FEEDBACK = 40;

export interface FeedbackAnswers {
  relevant?: 'yes' | 'no';
  sizeFit?: 'too small' | 'right size' | 'too large';
  distanceOk?: 'yes' | 'no';
  scopeAligned?: 'yes' | 'partly' | 'no';
  requirementsRealistic?: 'yes' | 'no';
  decision?: 'bid' | 'pass' | 'save';
  attractiveness?: string;
  prioritizeServices?: string[];
}

export interface Feedback {
  id: string;
  noticeId?: string | null;
  opportunityTitle?: string | null;
  answers: FeedbackAnswers;
  createdAt: string;
}

export interface FeedbackSignals {
  prioritizeServices: string[];   // services the user wants surfaced more
  sizeBias: 'smaller' | 'larger' | 'neutral';
  total: number;
}

async function profileKey(): Promise<string | null> {
  return getProfileKey();
}

export async function readFeedback(): Promise<Feedback[]> {
  const pid = await profileKey();
  if (pid) {
    try {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        const { data, error } = await supabase
          .from(FEEDBACK_TABLE)
          .select('*')
          .eq('profile_key', pid)
          .order('created_at', { ascending: false })
          .limit(100);
        if (!error && data && data.length) {
          return data.map((r: Record<string, any>) => ({
            id: r.id,
            noticeId: r.notice_id,
            opportunityTitle: r.opportunity_title,
            answers: r.answers || {},
            createdAt: r.created_at,
          }));
        }
      }
    } catch {
      /* fall through */
    }
  }
  const store = await cookies();
  try {
    const raw = store.get(FEEDBACK_COOKIE)?.value;
    if (raw) return JSON.parse(raw) as Feedback[];
  } catch {
    /* ignore */
  }
  return [];
}

/** Append feedback to the cookie cache (returns the new array to set on a response). */
export async function appendFeedbackCookie(fb: Feedback): Promise<Feedback[]> {
  const current = await readFeedback();
  return [fb, ...current].slice(0, MAX_COOKIE_FEEDBACK);
}

/** Best-effort persist to Supabase (no-op without service role). */
export async function saveFeedbackToSupabase(pid: string, fb: Feedback): Promise<boolean> {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) return false;
    const { error } = await supabase.from(FEEDBACK_TABLE).insert({
      id: fb.id,
      profile_key: pid,
      notice_id: fb.noticeId ?? null,
      opportunity_title: fb.opportunityTitle ?? null,
      answers: fb.answers,
    });
    return !error;
  } catch {
    return false;
  }
}

/** Distill stored feedback into signals that nudge ranking. */
export function computeFeedbackSignals(feedbacks: Feedback[]): FeedbackSignals {
  const serviceCounts = new Map<string, number>();
  let smaller = 0;
  let larger = 0;
  for (const f of feedbacks) {
    for (const s of f.answers.prioritizeServices || []) {
      serviceCounts.set(s, (serviceCounts.get(s) || 0) + 1);
    }
    if (f.answers.sizeFit === 'too large') smaller++;
    if (f.answers.sizeFit === 'too small') larger++;
  }
  const prioritizeServices = [...serviceCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([s]) => s);
  const sizeBias = smaller > larger + 1 ? 'smaller' : larger > smaller + 1 ? 'larger' : 'neutral';
  return { prioritizeServices, sizeBias, total: feedbacks.length };
}

/** Convenience for server components: read + distill in one call. */
export async function readFeedbackSignals(): Promise<FeedbackSignals> {
  return computeFeedbackSignals(await readFeedback());
}
