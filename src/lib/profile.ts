import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/supabase/server';

// ---------------------------------------------------------------------------
// Agency profile store.
//
// Firebase Data Connect is not reliable when called from server components /
// route handlers (browser SDK, no initialized app / auth in that context), so
// the profile is persisted in an httpOnly cookie as the source of truth. This
// is serverless-safe (works on Vercel) and requires no extra infrastructure.
// Data Connect can still be written best-effort elsewhere without blocking.
// ---------------------------------------------------------------------------

export const PROFILE_COOKIE = 'agency_profile';   // JSON cache / offline fallback
export const PROFILE_KEY_COOKIE = 'agency_pid';   // opaque key mapping browser -> Supabase row
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year
const PROFILES_TABLE = 'agency_profiles';

export interface AgencyProfile {
  agencyName?: string | null;
  // Location & service area
  location?: string | null;
  citiesServed?: string[];
  countiesServed?: string[];
  serviceRadiusMiles?: number | null;
  remotePreference?: 'local' | 'remote' | 'hybrid' | null;
  // Agency identity
  agencyType?: string | null;
  // Capabilities
  services?: string[];
  industries?: string[];
  targetOpportunityTypes?: string[];
  certifications?: string[];
  role?: 'prime' | 'subcontractor' | 'both' | null;
  teamSize?: string | null;
  deliveryCapacity?: string | null;
  largestProjectSize?: number | null;
  monthlyMediaSpend?: number | null;
  // Contract preferences
  minContract?: number | null;
  maxContract?: number | null;
  // Readiness & credentials
  insurance?: string[];
  priorGovExperience?: 'yes' | 'no' | 'limited' | null;
  proposalReadiness?: string[];
  differentiators?: string[];
  // Search tuning
  keywords?: string[];
  excludeKeywords?: string[];
  // Alerts
  alertPreferences?: string[];
  // Onboarding answers (new value-first flow)
  annualRevenue?: string | null;
  primaryCapability?: string | null;
  caPresence?: string | null;
  // Legacy / federal fields (kept for backward compatibility)
  naicsCodes?: string[];
  setAsideTypes?: string[];
  // Match Scoring Override
  scoringPreferences?: {
    eligibilityWeight: number;
    fitWeight: number;
    edgeWeight: number;
  };
  // Bookkeeping
  onboardingCompletedAt?: string | null;
  /** Watermark: opportunities ingested after this are "new since last visit". */
  lastFeedSeenAt?: string | null;
}

export const EMPTY_PROFILE: AgencyProfile = {
  citiesServed: [],
  countiesServed: [],
  services: [],
  industries: [],
  targetOpportunityTypes: [],
  certifications: [],
  insurance: [],
  proposalReadiness: [],
  differentiators: [],
  keywords: [],
  excludeKeywords: [],
  alertPreferences: [],
  naicsCodes: [],
  setAsideTypes: [],
};

/**
 * Fields cleared during a "Rebuild business profile" reset.
 * Keywords, exclude keywords, alert preferences, and bookkeeping fields
 * (lastFeedSeenAt) are PRESERVED — they are user-curated tuning settings,
 * not onboarding answers.
 */
export const RESET_PROFILE_FIELDS: (keyof AgencyProfile)[] = [
  'agencyName',
  'location',
  'citiesServed',
  'countiesServed',
  'serviceRadiusMiles',
  'remotePreference',
  'agencyType',
  'services',
  'industries',
  'targetOpportunityTypes',
  'certifications',
  'role',
  'teamSize',
  'deliveryCapacity',
  'largestProjectSize',
  'monthlyMediaSpend',
  'minContract',
  'maxContract',
  'insurance',
  'priorGovExperience',
  'proposalReadiness',
  'differentiators',
  'annualRevenue',
  'primaryCapability',
  'caPresence',
  'naicsCodes',
  'setAsideTypes',
  'onboardingCompletedAt',
];

/** Coerce arbitrary input into a clean AgencyProfile (defensive against bad bodies). */
export function normalizeProfile(input: unknown): AgencyProfile {
  const b = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const arr = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()).map((x) => (x as string).trim()) : [];
  const num = (v: unknown): number | null => {
    if (v === null || v === undefined || v === '') return null;
    const n = typeof v === 'number' ? v : parseInt(String(v).replace(/[^0-9.-]/g, ''), 10);
    return Number.isFinite(n) ? n : null;
  };
  const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

  let scoringPreferences: AgencyProfile['scoringPreferences'] = undefined;
  if (b.scoringPreferences && typeof b.scoringPreferences === 'object') {
    const sp = b.scoringPreferences as Record<string, unknown>;
    const ew = num(sp.eligibilityWeight);
    const fw = num(sp.fitWeight);
    const edw = num(sp.edgeWeight);
    if (ew !== null && fw !== null && edw !== null) {
      scoringPreferences = { eligibilityWeight: ew, fitWeight: fw, edgeWeight: edw };
    }
  }

  return {
    agencyName: str(b.agencyName),
    location: str(b.location),
    citiesServed: arr(b.citiesServed),
    countiesServed: arr(b.countiesServed),
    serviceRadiusMiles: num(b.serviceRadiusMiles),
    remotePreference: (['local', 'remote', 'hybrid'].includes(String(b.remotePreference))
      ? b.remotePreference
      : null) as AgencyProfile['remotePreference'],
    agencyType: str(b.agencyType),
    services: arr(b.services),
    industries: arr(b.industries),
    targetOpportunityTypes: arr(b.targetOpportunityTypes),
    certifications: arr(b.certifications),
    role: (['prime', 'subcontractor', 'both'].includes(String(b.role))
      ? b.role
      : null) as AgencyProfile['role'],
    teamSize: str(b.teamSize),
    deliveryCapacity: str(b.deliveryCapacity),
    largestProjectSize: num(b.largestProjectSize),
    monthlyMediaSpend: num(b.monthlyMediaSpend),
    minContract: num(b.minContract ?? b.minCapacity),
    maxContract: num(b.maxContract ?? b.maxCapacity),
    insurance: arr(b.insurance),
    priorGovExperience: (['yes', 'no', 'limited'].includes(String(b.priorGovExperience))
      ? b.priorGovExperience
      : null) as AgencyProfile['priorGovExperience'],
    proposalReadiness: arr(b.proposalReadiness),
    differentiators: arr(b.differentiators),
    keywords: arr(b.keywords),
    excludeKeywords: arr(b.excludeKeywords),
    alertPreferences: arr(b.alertPreferences),
    annualRevenue: str(b.annualRevenue),
    primaryCapability: str(b.primaryCapability),
    caPresence: str(b.caPresence),
    naicsCodes: arr(b.naicsCodes),
    setAsideTypes: arr(b.setAsideTypes),
    scoringPreferences,
    onboardingCompletedAt: str(b.onboardingCompletedAt),
    lastFeedSeenAt: str(b.lastFeedSeenAt),
  };
}

/**
 * The key under which a user's data is stored. Primary = authenticated Supabase
 * user id (ties data to the real account); fallback = legacy agency_pid cookie
 * (pre-auth rows / anonymous) so nothing breaks during the transition.
 */
export async function getProfileKey(): Promise<string | null> {
  const user = await getCurrentUser();
  if (user) return user.id;
  const store = await cookies();
  return store.get(PROFILE_KEY_COOKIE)?.value ?? null;
}

/**
 * Read the saved profile (server-side). Tries Supabase (keyed by the user id /
 * agency_pid) first, then falls back to the cached cookie JSON, then EMPTY_PROFILE.
 */
export async function readProfile(): Promise<AgencyProfile> {
  const store = await cookies();

  // 1) Supabase by profile key (authenticated user id, else legacy cookie)
  const pid = await getProfileKey();
  if (pid) {
    try {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        const { data, error } = await supabase
          .from(PROFILES_TABLE)
          .select('data')
          .eq('profile_key', pid)
          .maybeSingle();
        if (!error && data?.data) return normalizeProfile(data.data);
      }
    } catch {
      // fall through to cookie cache
    }
  }

  // 2) Cookie cache / offline fallback
  try {
    const raw = store.get(PROFILE_COOKIE)?.value;
    if (raw) return normalizeProfile(JSON.parse(raw));
  } catch {
    /* ignore */
  }

  return { ...EMPTY_PROFILE };
}

/** Map a normalized profile to the agency_profiles table columns (+ jsonb mirror). */
export function profileToRow(profileKey: string, p: AgencyProfile): Record<string, unknown> {
  return {
    profile_key: profileKey,
    agency_name: p.agencyName ?? null,
    agency_type: p.agencyType ?? null,
    location: p.location ?? null,
    cities_served: p.citiesServed ?? [],
    counties_served: p.countiesServed ?? [],
    service_radius_miles: p.serviceRadiusMiles ?? null,
    remote_preference: p.remotePreference ?? null,
    services: p.services ?? [],
    industries: p.industries ?? [],
    target_opportunity_types: p.targetOpportunityTypes ?? [],
    certifications: p.certifications ?? [],
    insurance: p.insurance ?? [],
    proposal_readiness: p.proposalReadiness ?? [],
    differentiators: p.differentiators ?? [],
    keywords: p.keywords ?? [],
    exclude_keywords: p.excludeKeywords ?? [],
    alert_preferences: p.alertPreferences ?? [],
    naics_codes: p.naicsCodes ?? [],
    set_aside_types: p.setAsideTypes ?? [],
    role: p.role ?? null,
    team_size: p.teamSize ?? null,
    delivery_capacity: p.deliveryCapacity ?? null,
    prior_gov_experience: p.priorGovExperience ?? null,
    min_contract: p.minContract ?? null,
    max_contract: p.maxContract ?? null,
    largest_project_size: p.largestProjectSize ?? null,
    monthly_media_spend: p.monthlyMediaSpend ?? null,
    annual_revenue: p.annualRevenue ?? null,
    primary_capability: p.primaryCapability ?? null,
    ca_presence: p.caPresence ?? null,
    data: p,
    onboarding_completed_at: p.onboardingCompletedAt ?? null,
    last_feed_seen_at: p.lastFeedSeenAt ?? null,
  };
}

/**
 * Upsert the profile to Supabase. Returns true on success, false if Supabase is
 * unavailable/unconfigured (caller should still persist the cookie fallback).
 */
export async function saveProfileToSupabase(profileKey: string, p: AgencyProfile): Promise<boolean> {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) return false;
    const { error } = await supabase
      .from(PROFILES_TABLE)
      .upsert(profileToRow(profileKey, p), { onConflict: 'profile_key' });
    if (error) {
      console.warn('[Profile] Supabase upsert failed:', error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.warn('[Profile] Supabase upsert threw:', e instanceof Error ? e.message : e);
    return false;
  }
}

/** True when the user has actually completed onboarding with meaningful data. */
export function hasProfile(p: AgencyProfile): boolean {
  return Boolean(
    (p.services && p.services.length) ||
      (p.keywords && p.keywords.length) ||
      (p.naicsCodes && p.naicsCodes.length) ||
      p.location
  );
}

/**
 * True once the user has been through onboarding (even if they skipped most of
 * it). Gates the dashboard without causing a redirect loop for "Skip for now".
 */
export function isOnboarded(p: AgencyProfile): boolean {
  return Boolean(p.onboardingCompletedAt) || hasProfile(p);
}

export function profileCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  };
}
