'use client';

// ---------------------------------------------------------------------------
// OnboardingWizard — new value-first 6-question flow (unauthenticated).
//
// Flow: Bridge (0) → Agency type (1) → Size & revenue (2) → Primary
// capability (3) → Gov experience (4) → Certifications (5) → CA presence (6)
// → /en/onboarding/payoff
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
} from './options';
import {
  saveSession, loadSession, type OnboardingAnswers,
} from '@/lib/onboardingSession';

const TOTAL_QUESTIONS = 6;

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

type Step = 0 | 1 | 2 | 3 | 4 | 5 | 6;

type Answers = Partial<OnboardingAnswers>;

const DEFAULT_ANSWERS: Answers = {
  agencyType: '',
  teamSize: '',
  annualRevenue: '',
  primaryCapability: '',
  priorGovExperience: '',
  certifications: [],
  caPresence: '',
};

export default function OnboardingWizard() {
  const router = useRouter();
  const locale = useLocale();
  const [step, setStep] = useState<Step>(0);
  const [answers, setAnswers] = useState<Answers>(DEFAULT_ANSWERS);
  const autoAdvanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Restore session on mount
  useEffect(() => {
    const session = loadSession();
    if (session) {
      setAnswers((prev) => ({ ...prev, ...session }));
      // Don't restore step — always start from the bridge so the user
      // sees the value prop again; they pick up where they left off quickly.
    }
  }, []);

  const update = (patch: Partial<Answers>) =>
    setAnswers((prev) => ({ ...prev, ...patch }));

  const saveAndAdvance = (patch: Partial<Answers>, targetStep?: Step) => {
    const merged = { ...answers, ...patch };
    setAnswers(merged);
    const next = (targetStep ?? Math.min(step + 1, 6)) as Step;
    if (step === 0 && !merged.startedAt) {
      merged.startedAt = new Date().toISOString();
    }
    saveSession(merged as Partial<OnboardingAnswers>);
    setStep(next);
  };

  // Auto-advance with a brief delay after single-select (so the user sees the
  // selection register before the screen transitions)
  const autoAdvance = (patch: Partial<Answers>) => {
    if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
    const merged = { ...answers, ...patch };
    setAnswers(merged);
    autoAdvanceTimer.current = setTimeout(() => {
      const next = Math.min(step + 1, 6) as Step;
      if (step === 0 && !merged.startedAt) merged.startedAt = new Date().toISOString();
      saveSession(merged as Partial<OnboardingAnswers>);
      setStep(next);
    }, 180);
  };

  const back = () => setStep((s) => Math.max(0, s - 1) as Step);

  const goToPayoff = () => {
    const final = { ...answers, completedAt: new Date().toISOString() };
    saveSession(final as Partial<OnboardingAnswers>);
    router.push(`/${locale}/onboarding/payoff`);
  };

  const toggleCert = (v: string) => {
    const current = answers.certifications ?? [];
    if (v === 'None of these') {
      update({ certifications: current.includes('None of these') ? [] : ['None of these'] });
    } else {
      const without = current.filter((c) => c !== 'None of these' && c !== v);
      const next = current.includes(v) ? without : [...without, v];
      update({ certifications: next });
    }
  };

  return (
    <div style={{ maxWidth: 680, width: '100%' }}>
      {/* ── Progress bar (screens 1–6 only) ──────────────────────────── */}
      {step > 0 && <ProgressBar step={step} />}

      <div className="glass-panel animate-fade-in" style={{ padding: '2.5rem 2.75rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        {/* ── Screen 0: Bridge ─────────────────────────────────────────── */}
        {step === 0 && (
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
              Answer 6 quick questions (under 2 minutes) and we&apos;ll show you real, live opportunities scored against your profile. No credit card. No commitment.
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

        {/* ── Screen 4: Gov experience ─────────────────────────────────── */}
        {step === 4 && (
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

        {/* ── Screen 5: Certifications ─────────────────────────────────── */}
        {step === 5 && (
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
                  onClick={() => toggleCert(cert)}
                />
              ))}
            </div>
          </>
        )}

        {/* ── Screen 6: California presence ────────────────────────────── */}
        {step === 6 && (
          <>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>Where are you based in California?</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '-0.75rem' }}>
              Most contracts here are for California agencies.
            </p>
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
          </>
        )}

        {/* ── Navigation (screens 1–6 only) ────────────────────────────── */}
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

            {step < 6 ? (
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
                See my matches <ChevronRight size={18} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
