import { cookies } from 'next/headers';

// ---------------------------------------------------------------------------
// Agency profile store.
//
// Firebase Data Connect is not reliable when called from server components /
// route handlers (browser SDK, no initialized app / auth in that context), so
// the profile is persisted in an httpOnly cookie as the source of truth. This
// is serverless-safe (works on Vercel) and requires no extra infrastructure.
// Data Connect can still be written best-effort elsewhere without blocking.
// ---------------------------------------------------------------------------

export const PROFILE_COOKIE = 'agency_profile';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

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
  // Legacy / federal fields (kept for backward compatibility)
  naicsCodes?: string[];
  setAsideTypes?: string[];
  // Bookkeeping
  onboardingCompletedAt?: string | null;
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
    naicsCodes: arr(b.naicsCodes),
    setAsideTypes: arr(b.setAsideTypes),
    onboardingCompletedAt: str(b.onboardingCompletedAt),
  };
}

/** Read the saved profile (server-side). Returns EMPTY_PROFILE if none/invalid. */
export async function readProfile(): Promise<AgencyProfile> {
  try {
    const store = await cookies();
    const raw = store.get(PROFILE_COOKIE)?.value;
    if (!raw) return { ...EMPTY_PROFILE };
    return normalizeProfile(JSON.parse(raw));
  } catch {
    return { ...EMPTY_PROFILE };
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
