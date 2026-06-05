import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getProfileKey, profileCookieOptions } from '@/lib/profile';
import { estimateDistanceMiles, isRemoteEligible } from '@/lib/geo';

// ---------------------------------------------------------------------------
// Alerts store. Same resilient pattern as the profile: Supabase primary,
// httpOnly cookie fallback so it works before the service-role key is set.
// ---------------------------------------------------------------------------

export const ALERTS_COOKIE = 'agency_alerts';
const ALERTS_TABLE = 'alerts';

export interface AlertCriteria {
  services?: string[];
  keywords?: string[];
  location?: string | null;
  radiusMiles?: number | null;
  remoteOk?: boolean;
  minValue?: number | null;
  maxValue?: number | null;
  buyer?: string | null;
  industries?: string[];
  opportunityTypes?: string[];
  certifications?: string[];
  deadlineWindowDays?: number | null;
}

export interface Alert {
  id: string;
  name: string;
  enabled: boolean;
  criteria: AlertCriteria;
  lastRunAt?: string | null;
  lastMatchCount?: number | null;
}

export interface AlertOpportunity {
  title: string;
  description?: string | null;
  agency?: string | null;
  setAsideType?: string | null;
  estimatedValue?: number | null;
  responseDeadline?: string | null;
  placeOfPerformance?: string | null;
}

const lc = (s: string) => s.toLowerCase();

/** Does an opportunity satisfy every provided criterion (AND; empty = ignored)? */
export function alertMatches(criteria: AlertCriteria, opp: AlertOpportunity): boolean {
  const hay = `${opp.title} ${opp.description || ''} ${opp.setAsideType || ''}`.toLowerCase();

  if (criteria.services?.length && !criteria.services.some((s) => hay.includes(lc(s)))) return false;
  if (criteria.keywords?.length && !criteria.keywords.some((k) => hay.includes(lc(k)))) return false;
  if (criteria.industries?.length && !criteria.industries.some((i) => hay.includes(lc(i.split('/')[0].trim())))) return false;
  if (criteria.opportunityTypes?.length && !criteria.opportunityTypes.some((t) => hay.includes(lc(t.split(' ')[0])))) return false;

  if (criteria.buyer && !(opp.agency || '').toLowerCase().includes(lc(criteria.buyer))) return false;

  if (criteria.certifications?.length) {
    const sa = (opp.setAsideType || '').toLowerCase();
    if (!criteria.certifications.some((c) => sa.includes(lc(c.split(' ')[0])))) return false;
  }

  // Contract value (only filter when the opportunity actually has a value)
  if (opp.estimatedValue != null) {
    if (criteria.minValue != null && opp.estimatedValue < criteria.minValue) return false;
    if (criteria.maxValue != null && opp.estimatedValue > criteria.maxValue) return false;
  }

  // Location / radius / remote
  const remoteElig = isRemoteEligible(hay, opp.placeOfPerformance);
  if (criteria.location && criteria.radiusMiles != null) {
    const passesRemote = criteria.remoteOk && remoteElig;
    if (!passesRemote) {
      const dist = estimateDistanceMiles(criteria.location, opp.placeOfPerformance);
      if (dist != null && dist > criteria.radiusMiles) return false;
    }
  } else if (criteria.remoteOk && !remoteElig) {
    // remote-only alert but opp isn't remote-eligible
    return false;
  }

  // Deadline window
  if (criteria.deadlineWindowDays != null && opp.responseDeadline) {
    const days = (new Date(opp.responseDeadline).getTime() - Date.now()) / 86_400_000;
    if (days < 0 || days > criteria.deadlineWindowDays) return false;
  }

  return true;
}

// ---- Storage ----

async function profileKey(): Promise<string | null> {
  return getProfileKey();
}

function fromRow(r: Record<string, any>): Alert {
  return {
    id: r.id,
    name: r.name,
    enabled: r.enabled,
    criteria: r.criteria || {},
    lastRunAt: r.last_run_at ?? null,
    lastMatchCount: r.last_match_count ?? null,
  };
}

/** Read alerts: Supabase rows if available, else the cookie array. */
export async function readAlerts(): Promise<Alert[]> {
  const pid = await profileKey();
  if (pid) {
    try {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        const { data, error } = await supabase.from(ALERTS_TABLE).select('*').eq('profile_key', pid).order('created_at');
        if (!error && data && data.length) return data.map(fromRow);
      }
    } catch {
      /* fall through */
    }
  }
  const store = await cookies();
  try {
    const raw = store.get(ALERTS_COOKIE)?.value;
    if (raw) return JSON.parse(raw) as Alert[];
  } catch {
    /* ignore */
  }
  return [];
}

/** Best-effort mirror of the full alert set to Supabase (no-op without service role). */
export async function syncAlertsToSupabase(pid: string, alerts: Alert[]): Promise<boolean> {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) return false;
    // Replace the set for this profile.
    await supabase.from(ALERTS_TABLE).delete().eq('profile_key', pid);
    if (alerts.length) {
      const rows = alerts.map((a) => ({
        id: a.id,
        profile_key: pid,
        name: a.name,
        enabled: a.enabled,
        criteria: a.criteria,
        last_run_at: a.lastRunAt ?? null,
        last_match_count: a.lastMatchCount ?? null,
      }));
      const { error } = await supabase.from(ALERTS_TABLE).upsert(rows);
      if (error) return false;
    }
    return true;
  } catch {
    return false;
  }
}

export { profileCookieOptions };
