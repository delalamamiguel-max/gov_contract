'use client';

// ---------------------------------------------------------------------------
// OnboardingWizard — expanded 12-question flow.
//
// Flow: Bridge (0) → Agency type (1) → Size & revenue (2) → Primary
// capability (3) → Services (4) → Industries (5) → Target opp types (6)
// → Location & remote pref (7) → Contract size (8) → Gov experience (9)
// → Certifications (10) → Insurance + Readiness + Differentiators (11)
// → /en/onboarding/payoff  (or onComplete callback for re-onboard)
//
// All answers are saved to localStorage after every advance so the user can
// refresh or close and resume within 24 hours.
// ---------------------------------------------------------------------------

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { ChevronLeft, ChevronRight, Zap, Check } from 'lucide-react';
import {
  AGENCY_TYPES, TEAM_SIZES, ANNUAL_REVENUE_RANGES, PRIMARY_CAPABILITIES,
  GOV_EXPERIENCE_OPTIONS, CERTIFICATIONS, CA_PRESENCE_OPTIONS,
  SERVICES, INDUSTRIES, TARGET_OPPORTUNITY_TYPES,
  REMOTE_PREFERENCE, INSURANCE, PROPOSAL_READINESS, DIFFERENTIATORS,
  CONTRACT_SIZE_RANGES,
} from './options';
import {
  saveSession, loadSession, type OnboardingAnswers,
} from '@/lib/onboardingSession';

const TOTAL_QUESTIONS = 11;

// ---------------------------------------------------------------------------
// Tiny UI primitives
// ---------------------------------------------------------------------------

function ProgressBar({ step }: { step: number }) {
  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.4rem',
      }}>
        <span>Step {step} of {TOTAL_QUESTIONS}</span>
        <span>{Math.round((step / TOTAL_QUESTIONS) * 100)}%</span>
      </div>
      <div style={{ height: 5, background: 'rgba(42,51,61,0.1)', borderRadius: 999 }}>
        <div style={{
          height: '100%',
          width: `${(step / TOTAL_QUESTIONS) * 100}%`,
          background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))',
          borderRadius: 999,
          transition: 'width 0.35s ease',
        }} />
      </div>
    </div>
  );
}

/** Large tap-target card for single-select questions. */
function OptionCard({
  label, description, selected, onClick,
}: {
  label: string;
  description?: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%', textAlign: 'left',
        padding: '0.85rem 1.1rem',
        borderRadius: 10,
        border: selected ? '1.5px solid var(--accent-primary)' : '1px solid var(--border-color)',
        background: selected ? 'rgba(26,169,201,0.08)' : 'transparent',
        cursor: 'pointer', transition: 'all 0.15s ease',
        display: 'flex', alignItems: 'center', gap: '0.75rem',
      }}
    >
      <span style={{
        width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
        border: selected ? '2px solid var(--accent-primary)' : '2px solid var(--border-color)',
        background: selected ? 'var(--accent-primary)' : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.15s ease',
      }}>
        {selected && <Check size={10} color="#fff" strokeWidth={3} />}
      </span>
      <span>
        <span style={{ fontWeight: 600, fontSize: '0.92rem', display: 'block' }}>{label}</span>
        {description && (
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginTop: 2 }}>
            {description}
          </span>
        )}
      </span>
    </button>
  );
}

/** Chip for multi-select questions. */
function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '0.5rem 0.9rem', borderRadius: '999px', fontSize: '0.875rem',
        cursor: 'pointer',
        border: active ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
        background: active ? 'rgba(26,169,201,0.12)' : 'transparent',
        color: active ? 'var(--accent-primary)' : 'var(--text-secondary)',
        display: 'flex', alignItems: 'center', gap: '0.35rem',
        transition: 'all 0.15s ease',
      }}
    >
      {active && <Check size={12} />}
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main wizard component
// ---------------------------------------------------------------------------

type Step = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;

type Answers = Partial<OnboardingAnswers>;

const DEFAULT_ANSWERS: Answers = {
  agencyType: '',
  teamSize: '',
  annualRevenue: '',
  primaryCapability: '',
  services: [],
  industries: [],
  targetOpportunityTypes: [],
  location: '',
  remotePreference: '',
  serviceRadiusMiles: '',
  minContractRange: '',
  maxContractRange: '',
  priorGovExperience: '',
  certifications: [],
  insurance: [],
  proposalReadiness: [],
  differentiators: [],
  caPresence: '',
};

export default function OnboardingWizard({
  mode = 'signup',
  initialAnswers,
  onComplete,
}: {
  mode?: 'signup' | 're-onboard';
  initialAnswers?: Partial<OnboardingAnswers>;
  onComplete?: (finalAnswers: Partial<OnboardingAnswers>) => void;
} = {}) {
  const router = useRouter();
  const locale = useLocale();
  const [step, setStep] = useState<Step>(0);
  const [answers, setAnswers] = useState<Answers>({ ...DEFAULT_ANSWERS, ...initialAnswers });
  const autoAdvanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Restore session on mount
  useEffect(() => {
    const session = loadSession();
    if (session) {
      setAnswers((prev) => ({ ...prev, ...session }));
    }
  }, []);

  const update = (patch: Partial<Answers>) =>
    setAnswers((prev) => ({ ...prev, ...patch }));

  const saveAndAdvance = (patch: Partial<Answers>, targetStep?: Step) => {
    const merged = { ...answers, ...patch };
    setAnswers(merged);
    const next = (targetStep ?? Math.min(step + 1, TOTAL_QUESTIONS)) as Step;
    if (step === 0 && !merged.startedAt) {
      merged.startedAt = new Date().toISOString();
    }
    saveSession(merged as Partial<OnboardingAnswers>);
    setStep(next);
  };

  const autoAdvance = (patch: Partial<Answers>) => {
    if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
    const merged = { ...answers, ...patch };
    setAnswers(merged);
    autoAdvanceTimer.current = setTimeout(() => {
      const next = Math.min(step + 1, TOTAL_QUESTIONS) as Step;
      if (step === 0 && !merged.startedAt) merged.startedAt = new Date().toISOString();
      saveSession(merged as Partial<OnboardingAnswers>);
      setStep(next);
    }, 180);
  };

  const back = () => setStep((s) => Math.max(0, s - 1) as Step);

  const goToPayoff = () => {
    const final = { ...answers, completedAt: new Date().toISOString() };
    saveSession(final as Partial<OnboardingAnswers>);
    if (onComplete) {
      onComplete(final);
    } else {
      router.push(`/${locale}/onboarding/payoff`);
    }
  };

  const toggleArr = (key: keyof Answers, v: string, exclusive?: string) => {
    const current = (answers[key] as string[]) ?? [];
    if (exclusive && v === exclusive) {
      update({ [key]: current.includes(exclusive) ? [] : [exclusive] });
    } else {
      const without = current.filter((c) => c !== (exclusive || '') && c !== v);
      const next = current.includes(v) ? without : [...without, v];
      update({ [key]: next });
    }
  };

  return (
    <div style={{ maxWidth: 680, width: '100%' }}>
      {step > 0 && <ProgressBar step={step} />}

      <div className="glass-panel animate-fade-in" style={{ padding: '2.5rem 2.75rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        {/* ── Screen 0: Bridge ─────────────────────────────────────────── */}
        {step === 0 && mode === 'signup' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '-0.5rem' }}>
              <Zap size={22} color="var(--accent-primary)" />
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Free match preview
              </span>
            </div>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 700, lineHeight: 1.25 }}>
              See which California government contracts fit your agency — before you sign up.
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6 }}>
              Answer a few quick questions (under 3 minutes) and we&apos;ll show you real, live opportunities scored against your profile. No credit card. No commitment.
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {['Personalized to your services and capabilities', 'Live California public-sector opportunities', 'See your match score instantly'].map((item) => (
                <li key={item} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  <Check size={15} color="var(--accent-primary)" />
                  {item}
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => saveAndAdvance({ startedAt: new Date().toISOString() }, 1)}
              style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.85rem 1.75rem', fontSize: '1rem' }}
            >
              Show me my matches <ChevronRight size={18} />
            </button>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '-0.5rem' }}>
              No account required yet. Signup happens after you see your results.
            </p>
          </>
        )}

        {step === 0 && mode === 're-onboard' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '-0.5rem' }}>
              <Zap size={22} color="var(--accent-primary)" />
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Rebuild Profile
              </span>
            </div>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 700, lineHeight: 1.25 }}>
              Let&apos;s get your business profile back on track.
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6 }}>
              We&apos;ll walk you through a few quick questions to reset your core details and recalibrate your contract recommendations.
            </p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => saveAndAdvance({ startedAt: new Date().toISOString() }, 1)}
              style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.85rem 1.75rem', fontSize: '1rem' }}
            >
              Let&apos;s go <ChevronRight size={18} />
            </button>
          </>
        )}

        {/* ── Screen 1: Agency type ─────────────────────────────────────── */}
        {step === 1 && (
          <>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>What type of agency are you?</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '-0.75rem' }}>
              Pick the one that fits best.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {AGENCY_TYPES.map((type) => (
                <OptionCard
                  key={type}
                  label={type}
                  selected={answers.agencyType === type}
                  onClick={() => autoAdvance({ agencyType: type })}
                />
              ))}
            </div>
          </>
        )}

        {/* ── Screen 2: Size & Revenue ─────────────────────────────────── */}
        {step === 2 && (
          <>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>Tell us about your team</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-secondary)' }}>Team size</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {TEAM_SIZES.map((s) => (
                  <Chip key={s} label={s} active={answers.teamSize === s} onClick={() => update({ teamSize: s })} />
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-secondary)' }}>Annual revenue (approx.)</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {ANNUAL_REVENUE_RANGES.map((r) => (
                  <Chip key={r} label={r} active={answers.annualRevenue === r} onClick={() => update({ annualRevenue: r })} />
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── Screen 3: Primary capability ─────────────────────────────── */}
        {step === 3 && (
          <>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>What is your primary capability?</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '-0.75rem' }}>
              The service you&apos;re best known for.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {PRIMARY_CAPABILITIES.map((cap) => (
                <OptionCard
                  key={cap}
                  label={cap}
                  selected={answers.primaryCapability === cap}
                  onClick={() => autoAdvance({ primaryCapability: cap })}
                />
              ))}
            </div>
          </>
        )}

        {/* ── Screen 4: Services (multi-select) ───────────────────────── */}
        {step === 4 && (
          <>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>Which services do you offer?</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '-0.75rem' }}>
              Select all that apply. This directly improves your match accuracy.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {SERVICES.map((svc) => (
                <Chip
                  key={svc}
                  label={svc}
                  active={(answers.services ?? []).includes(svc)}
                  onClick={() => toggleArr('services', svc)}
                />
              ))}
            </div>
          </>
        )}

        {/* ── Screen 5: Industries (multi-select) ─────────────────────── */}
        {step === 5 && (
          <>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>What industries do you serve?</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '-0.75rem' }}>
              Select all that apply.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {INDUSTRIES.map((ind) => (
                <Chip
                  key={ind}
                  label={ind}
                  active={(answers.industries ?? []).includes(ind)}
                  onClick={() => toggleArr('industries', ind)}
                />
              ))}
            </div>
          </>
        )}

        {/* ── Screen 6: Target opportunity types (multi-select) ────────── */}
        {step === 6 && (
          <>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>What types of work are you looking for?</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '-0.75rem' }}>
              Select all that apply.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {TARGET_OPPORTUNITY_TYPES.map((t) => (
                <Chip
                  key={t}
                  label={t}
                  active={(answers.targetOpportunityTypes ?? []).includes(t)}
                  onClick={() => toggleArr('targetOpportunityTypes', t)}
                />
              ))}
            </div>
          </>
        )}

        {/* ── Screen 7: Location & remote preference ──────────────────── */}
        {step === 7 && (
          <>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>Where are you based?</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '-0.75rem' }}>
              This helps us match you with contracts in your service area.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-secondary)' }}>California presence</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {CA_PRESENCE_OPTIONS.map((opt) => (
                  <OptionCard
                    key={opt}
                    label={opt}
                    selected={answers.caPresence === opt}
                    onClick={() => update({ caPresence: opt })}
                  />
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.5rem' }}>
              <label style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-secondary)' }}>Work preference</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {REMOTE_PREFERENCE.map((rp) => (
                  <Chip key={rp.value} label={rp.label} active={answers.remotePreference === rp.value} onClick={() => update({ remotePreference: rp.value })} />
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── Screen 8: Contract size ─────────────────────────────────── */}
        {step === 8 && (
          <>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>What&apos;s your preferred contract size?</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '-0.75rem' }}>
              We&apos;ll prioritize opportunities that fit your capacity.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-secondary)' }}>Minimum</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {CONTRACT_SIZE_RANGES.map((r) => (
                  <Chip key={r} label={r} active={answers.minContractRange === r} onClick={() => update({ minContractRange: r })} />
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-secondary)' }}>Maximum</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {CONTRACT_SIZE_RANGES.map((r) => (
                  <Chip key={r} label={r} active={answers.maxContractRange === r} onClick={() => update({ maxContractRange: r })} />
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── Screen 9: Gov experience ─────────────────────────────────── */}
        {step === 9 && (
          <>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>Have you done government work before?</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '-0.75rem' }}>
              This helps us surface contracts at the right complexity level.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {GOV_EXPERIENCE_OPTIONS.map((opt) => (
                <OptionCard
                  key={opt.value}
                  label={opt.label}
                  description={opt.description}
                  selected={answers.priorGovExperience === opt.value}
                  onClick={() => autoAdvance({ priorGovExperience: opt.value })}
                />
              ))}
            </div>
          </>
        )}

        {/* ── Screen 10: Certifications ────────────────────────────────── */}
        {step === 10 && (
          <>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>Do you hold any certifications?</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '-0.75rem' }}>
              Many public contracts have set-aside preferences. Select all that apply.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {[...CERTIFICATIONS, 'None of these'].map((cert) => (
                <Chip
                  key={cert}
                  label={cert}
                  active={(answers.certifications ?? []).includes(cert)}
                  onClick={() => toggleArr('certifications', cert, 'None of these')}
                />
              ))}
            </div>
          </>
        )}

        {/* ── Screen 11: Insurance + Readiness + Differentiators ────────── */}
        {step === 11 && (
          <>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>Almost done — a few more details</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '-0.75rem' }}>
              These help us score your competitiveness on each contract.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-secondary)' }}>Insurance coverage</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {INSURANCE.map((ins) => (
                  <Chip
                    key={ins}
                    label={ins}
                    active={(answers.insurance ?? []).includes(ins)}
                    onClick={() => toggleArr('insurance', ins)}
                  />
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-secondary)' }}>Proposal materials on hand</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {PROPOSAL_READINESS.map((pr) => (
                  <Chip
                    key={pr}
                    label={pr}
                    active={(answers.proposalReadiness ?? []).includes(pr)}
                    onClick={() => toggleArr('proposalReadiness', pr)}
                  />
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-secondary)' }}>What makes you stand out?</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {DIFFERENTIATORS.map((d) => (
                  <Chip
                    key={d}
                    label={d}
                    active={(answers.differentiators ?? []).includes(d)}
                    onClick={() => toggleArr('differentiators', d)}
                  />
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── Navigation (screens 1–11 only) ───────────────────────────── */}
        {step > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={back}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.6rem 1.1rem', fontSize: '0.88rem' }}
            >
              <ChevronLeft size={16} /> Back
            </button>

            {step < TOTAL_QUESTIONS ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => saveAndAdvance({})}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.6rem 1.25rem', fontSize: '0.88rem' }}
              >
                Continue <ChevronRight size={16} />
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                onClick={goToPayoff}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.7rem 1.4rem', fontSize: '0.92rem' }}
              >
                {mode === 're-onboard' ? 'Save & finish' : 'See my matches'} <ChevronRight size={18} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
