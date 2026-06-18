// ---------------------------------------------------------------------------
// onboardingSession.ts — localStorage-backed session for the unauthenticated
// onboarding flow. Users can close mid-flow and resume within 24 hours.
// CLIENT-SIDE ONLY — never import from server components or route handlers.
// ---------------------------------------------------------------------------

import type { AgencyProfile } from '@/lib/profile';
import { CAPABILITY_KEYWORDS } from '@/lib/assessment';

export interface OnboardingAnswers {
  agencyType: string;
  teamSize: string;
  annualRevenue: string;
  primaryCapability: string;
  services: string[];
  industries: string[];
  targetOpportunityTypes: string[];
  location: string;
  remotePreference: string;
  serviceRadiusMiles: string;
  minContractRange: string;          // e.g. "Under $25K", "$25K – $100K"
  maxContractRange: string;
  priorGovExperience: string;
  certifications: string[];
  insurance: string[];
  proposalReadiness: string[];
  differentiators: string[];
  caPresence: string;
  startedAt: string;                 // ISO — set when bridge screen is dismissed
  completedAt?: string;              // ISO — set on payoff screen
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
  // Also handle the raw value form (from autoAdvance which stores the value)
  'yes': 'yes',
  'limited': 'limited',
  'no': 'no',
};

// Mapping: primaryCapability → services array using the CAPABILITY_KEYWORDS
// expansion map so the profile gets richer keyword coverage.
function capabilityToServices(cap: string, existingServices: string[]): string[] {
  if (!cap) return existingServices;
  // Start with the capability itself
  const derived = new Set<string>(existingServices);
  derived.add(cap);
  // Add expanded keywords from the assessment engine's map
  const expanded = CAPABILITY_KEYWORDS[cap];
  if (expanded) {
    for (const kw of expanded) {
      derived.add(kw);
    }
  }
  return Array.from(derived);
}

// Parse contract size range strings into numeric values
function parseContractRange(range: string): number | null {
  if (!range) return null;
  if (range.includes('Under')) return 25_000;
  if (range.includes('$25K')) return range.includes('$100K') ? 100_000 : 25_000;
  if (range.includes('$100K')) return range.includes('$500K') ? 500_000 : 100_000;
  if (range.includes('$500K')) return range.includes('$1M') ? 1_000_000 : 500_000;
  if (range.includes('$1M')) return 1_000_000;
  return null;
}

// Map CA presence to a default location + radius when location is not set
function deriveLocationFromCaPresence(caPresence: string): { location?: string; serviceRadiusMiles?: number; remotePreference?: AgencyProfile['remotePreference'] } {
  switch (caPresence) {
    case 'HQ in California':
      return { location: 'California', serviceRadiusMiles: 100 };
    case 'Remote — we work anywhere in CA':
      return { location: 'California', serviceRadiusMiles: 500, remotePreference: 'remote' };
    case 'Regional office in California':
      return { location: 'California', serviceRadiusMiles: 150, remotePreference: 'hybrid' };
    case 'No California presence yet':
      return { remotePreference: 'remote' };
    default:
      return {};
  }
}

export function answersToProfile(a: Partial<OnboardingAnswers>): Partial<AgencyProfile> {
  const profile: Partial<AgencyProfile> = {};

  if (a.agencyType) profile.agencyType = a.agencyType;

  if (a.teamSize) profile.teamSize = a.teamSize;
  if (a.annualRevenue) profile.annualRevenue = a.annualRevenue;

  if (a.primaryCapability) {
    profile.primaryCapability = a.primaryCapability;
  }

  // Services: merge user-selected services with capability-derived keywords
  const userServices = a.services && a.services.length > 0 ? a.services : [];
  if (a.primaryCapability || userServices.length > 0) {
    profile.services = capabilityToServices(a.primaryCapability || '', userServices);
  }

  // Industries
  if (a.industries && a.industries.length > 0) {
    profile.industries = a.industries;
  }

  // Target opportunity types
  if (a.targetOpportunityTypes && a.targetOpportunityTypes.length > 0) {
    profile.targetOpportunityTypes = a.targetOpportunityTypes;
  }

  // Location: prefer explicit location, fallback to CA presence derivation
  if (a.location) {
    profile.location = a.location;
  }
  if (a.remotePreference) {
    profile.remotePreference = a.remotePreference as AgencyProfile['remotePreference'];
  }
  if (a.serviceRadiusMiles) {
    profile.serviceRadiusMiles = parseInt(a.serviceRadiusMiles, 10) || null;
  }

  // CA presence fallback: derive location signals if not explicitly set
  if (a.caPresence) {
    profile.caPresence = a.caPresence;
    const derived = deriveLocationFromCaPresence(a.caPresence);
    if (!profile.location && derived.location) profile.location = derived.location;
    if (!profile.serviceRadiusMiles && derived.serviceRadiusMiles) profile.serviceRadiusMiles = derived.serviceRadiusMiles;
    if (!profile.remotePreference && derived.remotePreference) profile.remotePreference = derived.remotePreference;
  }

  // Contract size
  if (a.minContractRange) {
    profile.minContract = parseContractRange(a.minContractRange);
  }
  if (a.maxContractRange) {
    profile.maxContract = parseContractRange(a.maxContractRange);
  }

  // Gov experience
  if (a.priorGovExperience) {
    profile.priorGovExperience = GOV_EXP_MAP[a.priorGovExperience] ?? null;
  }

  // Certifications
  if (a.certifications && a.certifications.length > 0) {
    profile.certifications = a.certifications.filter((c) => c !== 'None of these');
  }

  // Insurance
  if (a.insurance && a.insurance.length > 0) {
    profile.insurance = a.insurance;
  }

  // Proposal readiness
  if (a.proposalReadiness && a.proposalReadiness.length > 0) {
    profile.proposalReadiness = a.proposalReadiness;
  }

  // Differentiators
  if (a.differentiators && a.differentiators.length > 0) {
    profile.differentiators = a.differentiators;
  }

  return profile;
}
