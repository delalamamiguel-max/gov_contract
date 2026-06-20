'use client';

// ---------------------------------------------------------------------------
// OnboardingWizard — consolidated flow.
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
  INSURANCE_COVERAGE, GENERAL_LIABILITY_LIMITS, PROPOSAL_READINESS, DIFFERENTIATORS,
  CONTRACT_SIZE_RANGES,
} from './options';
import {
  saveSession, loadSession, type OnboardingAnswers,
} from '@/lib/onboardingSession';

const TOTAL_QUESTIONS = 9;

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

type Step = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

type Answers = Partial<OnboardingAnswers>;

const DEFAULT_ANSWERS: Answers = {
  agencyType: '',
  teamSize: '',
  annualRevenue: '',
  primaryCapability: '',
  services: [],
  minContractRange: '',
  maxContractRange: '',
  priorGovExperience: '',
  certifications: [],
  insurance: [],
  generalLiabilityLimit: '',
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
            <h2 style={{ fontSize: '2rem', fontWeight: 700, lineHeight: 1.25 }}>
              Let's find your matches.
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', lineHeight: 1.6 }}>
              Quick questions. Then we show you the RFPs worth your time.
            </p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => saveAndAdvance({ startedAt: new Date().toISOString() }, 1)}
              style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.85rem 1.75rem', fontSize: '1rem' }}
            >
              Let's go <ChevronRight size={18} />
            </button>
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
              Let's get your business profile back on track.
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6 }}>
              We'll walk you through a few quick questions to reset your core details and recalibrate your contract recommendations.
            </p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => saveAndAdvance({ startedAt: new Date().toISOString() }, 1)}
              style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.85rem 1.75rem', fontSize: '1rem' }}
            >
              Let's go <ChevronRight size={18} />
            </button>
          </>
        )}

        {/* ── Screen 1: Agency type ─────────────────────────────────────── */}
        {step === 1 && (
          <>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>What kind of agency are you?</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '-0.75rem' }}>
              Pick the one that best describes how you go to market.
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
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>How big is your agency?</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '-0.75rem' }}>
              This helps us filter out contracts your team can't staff.
            </p>
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
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>What does your agency lead with?</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '-0.75rem' }}>
              Pick one. This is how we match you to scope.
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

        {/* ── Screen 4: CA Presence ──────────────────── */}
        {step === 4 && (
          <>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>Is your agency registered to do business in California?</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '-0.75rem' }}>
              Some RFPs require a California-registered entity. This filters out opportunities you can't legally pursue.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {CA_PRESENCE_OPTIONS.map((opt) => (
                <OptionCard
                  key={opt}
                  label={opt}
                  selected={answers.caPresence === opt}
                  onClick={() => autoAdvance({ caPresence: opt })}
                />
              ))}
            </div>
          </>
        )}

        {/* ── Screen 5: Contract size ─────────────────────────────────── */}
        {step === 5 && (
          <>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>What's your preferred contract size?</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '-0.75rem' }}>
              We'll prioritize opportunities that fit your capacity.
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

        {/* ── Screen 6: Gov experience ─────────────────────────────────── */}
        {step === 6 && (
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

        {/* ── Screen 7: Certifications ────────────────────────────────── */}
        {step === 7 && (
          <>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>Do you hold any of these certifications?</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '-0.75rem' }}>
              Many RFPs require these. Checking now saves you time later.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {CERTIFICATIONS.map((cert) => (
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

        {/* ── Screen 8: Insurance ────────── */}
        {step === 8 && (
          <>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>What insurance does your agency carry?</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '-0.75rem' }}>
              Most government RFPs require proof of coverage before you can submit. This filters out opportunities you don't qualify for yet.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-secondary)' }}>Coverage types</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {INSURANCE_COVERAGE.map((ins) => (
                  <Chip
                    key={ins}
                    label={ins}
                    active={(answers.insurance ?? []).includes(ins)}
                    onClick={() => {
                      toggleArr('insurance', ins, 'None of these yet');
                      if (ins === 'Commercial General Liability' && (answers.insurance ?? []).includes(ins)) {
                        update({ generalLiabilityLimit: '' }); // Clear limit if unchecking CGL
                      }
                    }}
                  />
                ))}
              </div>
            </div>

            {(answers.insurance ?? []).includes('Commercial General Liability') && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.5rem' }}>
                <label style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-secondary)' }}>General Liability limit</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {GENERAL_LIABILITY_LIMITS.map((limit) => (
                    <OptionCard
                      key={limit}
                      label={limit}
                      selected={answers.generalLiabilityLimit === limit}
                      onClick={() => update({ generalLiabilityLimit: limit })}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Screen 9: Readiness & Differentiators ────────── */}
        {step === 9 && (
          <>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>Almost done — a few more details</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '-0.75rem' }}>
              These help us score your competitiveness on each contract.
            </p>

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

        {/* ── Navigation (screens 1–9 only) ───────────────────────────── */}
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
