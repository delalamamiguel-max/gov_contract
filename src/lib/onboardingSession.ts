// ---------------------------------------------------------------------------
// onboardingSession.ts — localStorage-backed session for the unauthenticated
// onboarding flow. Users can close mid-flow and resume within 24 hours.
// CLIENT-SIDE ONLY — never import from server components or route handlers.
// ---------------------------------------------------------------------------

import type { AgencyProfile } from '@/lib/profile';

export interface OnboardingAnswers {
  agencyType: string;
  teamSize: string;
  annualRevenue: string;
  primaryCapability: string;
  priorGovExperience: string;   // 'Yes, won contracts' | 'Yes, as subcontractor' | 'No, but ready' | ''
  certifications: string[];
  caPresence: string;
  startedAt: string;            // ISO — set when bridge screen is dismissed
  completedAt?: string;         // ISO — set on payoff screen
}

export const ONBOARDING_KEY = 'bidflare_onboarding';
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

export function loadSession(): Partial<OnboardingAnswers> | null {
  try {
    const raw = localStorage.getItem(ONBOARDING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<OnboardingAnswers> & { startedAt?: string };
    // Expired?
    if (parsed.startedAt && Date.now() - new Date(parsed.startedAt).getTime() > TTL_MS) {
      localStorage.removeItem(ONBOARDING_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveSession(answers: Partial<OnboardingAnswers>): void {
  try {
    const existing = loadSession() ?? {};
    const merged = { ...existing, ...answers };
    if (!merged.startedAt) merged.startedAt = new Date().toISOString();
    localStorage.setItem(ONBOARDING_KEY, JSON.stringify(merged));
  } catch {
    // Silently ignore — storage might be disabled (private mode, etc.)
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(ONBOARDING_KEY);
  } catch {
    /* ignore */
  }
}

/** True when the session contains all required answers for profile hydration. */
export function isCompleteSession(s: Partial<OnboardingAnswers>): s is OnboardingAnswers {
  return Boolean(s.startedAt);  // startedAt is the minimum gate; answers can be partial
}

// ---------------------------------------------------------------------------
// Answers → AgencyProfile mapper
// Single source of truth for how onboarding question answers map to profile fields.
// ---------------------------------------------------------------------------

// Mapping: gov experience label → priorGovExperience enum value
const GOV_EXP_MAP: Record<string, AgencyProfile['priorGovExperience']> = {
  'Yes, won contracts': 'yes',
  'Yes, as subcontractor': 'limited',
  'No, but ready': 'no',
};

// Mapping: primaryCapability → services array (kept simple; set to the
// capability itself so the scoring engine can match it)
function capabilityToServices(cap: string): string[] {
  if (!cap) return [];
  return [cap];
}

export function answersToProfile(a: Partial<OnboardingAnswers>): Partial<AgencyProfile> {
  const profile: Partial<AgencyProfile> = {};

  if (a.agencyType) profile.agencyType = a.agencyType;

  if (a.teamSize) profile.teamSize = a.teamSize;
  if (a.annualRevenue) profile.annualRevenue = a.annualRevenue;

  if (a.primaryCapability) {
    profile.primaryCapability = a.primaryCapability;
    profile.services = capabilityToServices(a.primaryCapability);
  }

  if (a.priorGovExperience) {
    profile.priorGovExperience = GOV_EXP_MAP[a.priorGovExperience] ?? null;
  }

  if (a.certifications && a.certifications.length > 0) {
    // Filter out "None of these" sentinel before saving to the profile
    profile.certifications = a.certifications.filter((c) => c !== 'None of these');
  }

  if (a.caPresence) profile.caPresence = a.caPresence;

  return profile;
}
