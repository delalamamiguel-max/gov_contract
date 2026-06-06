'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { Check, ChevronLeft, ChevronRight, X } from 'lucide-react';
import {
  AGENCY_TYPES, SERVICES, INDUSTRIES, TARGET_OPPORTUNITY_TYPES, DELIVERY_CAPACITY,
  TEAM_SIZES, CERTIFICATIONS, INSURANCE, PRIOR_GOV_EXPERIENCE, PROPOSAL_READINESS,
  DIFFERENTIATORS, ROLES, REMOTE_PREFERENCE, ALERT_PREFERENCES,
} from './options';

interface ProfileState {
  agencyName: string;
  location: string;
  citiesServed: string[];
  countiesServed: string[];
  serviceRadiusMiles: number;
  remotePreference: string;
  agencyType: string;
  services: string[];
  role: string;
  industries: string[];
  targetOpportunityTypes: string[];
  teamSize: string;
  deliveryCapacity: string;
  largestProjectSize: number | '';
  minContract: number | '';
  maxContract: number | '';
  monthlyMediaSpend: number | '';
  certifications: string[];
  insurance: string[];
  priorGovExperience: string;
  proposalReadiness: string[];
  differentiators: string[];
  keywords: string[];
  excludeKeywords: string[];
  alertPreferences: string[];
}

const initialState: ProfileState = {
  agencyName: '', location: '', citiesServed: [], countiesServed: [], serviceRadiusMiles: 50,
  remotePreference: '', agencyType: '', services: [], role: '', industries: [],
  targetOpportunityTypes: [], teamSize: '', deliveryCapacity: '', largestProjectSize: '',
  minContract: '', maxContract: '', monthlyMediaSpend: '', certifications: [], insurance: [],
  priorGovExperience: '', proposalReadiness: [], differentiators: [], keywords: [],
  excludeKeywords: [], alertPreferences: [],
};

// ---- Reusable UI bits ----

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '0.5rem 0.9rem',
        borderRadius: '999px',
        fontSize: '0.875rem',
        cursor: 'pointer',
        border: active ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
        background: active ? 'rgba(59,130,246,0.15)' : 'rgba(42, 51, 61,0.03)',
        color: active ? 'var(--accent-primary)' : 'var(--text-secondary)',
        display: 'flex', alignItems: 'center', gap: '0.35rem', transition: 'all 0.15s ease',
      }}
    >
      {active && <Check size={13} />}
      {label}
    </button>
  );
}

function ChipGroup({
  options, selected, onToggle, multi = true,
}: {
  options: (string | { value: string; label: string })[];
  selected: string[] | string;
  onToggle: (v: string) => void;
  multi?: boolean;
}) {
  const isSel = (v: string) => (multi ? (selected as string[]).includes(v) : selected === v);
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
      {options.map((o) => {
        const value = typeof o === 'string' ? o : o.value;
        const label = typeof o === 'string' ? o : o.label;
        return <Chip key={value} label={label} active={isSel(value)} onClick={() => onToggle(value)} />;
      })}
    </div>
  );
}

function TagInput({
  values, onChange, placeholder,
}: { values: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const v = draft.trim();
    if (v && !values.includes(v)) onChange([...values, v]);
    setDraft('');
  };
  return (
    <div>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <input
          className="form-input"
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); }
          }}
        />
        <button type="button" className="btn btn-secondary" onClick={add} style={{ padding: '0 1rem' }}>Add</button>
      </div>
      {values.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.6rem' }}>
          {values.map((v) => (
            <span key={v} style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.3rem 0.6rem',
              borderRadius: '999px', background: 'rgba(59,130,246,0.12)', color: 'var(--accent-primary)', fontSize: '0.8rem',
            }}>
              {v}
              <X size={12} style={{ cursor: 'pointer' }} onClick={() => onChange(values.filter((x) => x !== v))} />
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <label style={{ fontWeight: 600, fontSize: '0.9rem' }}>{label}</label>
      {hint && <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>{hint}</p>}
      {children}
    </div>
  );
}

const STEPS = ['Agency', 'Service area', 'Services', 'Focus', 'Capacity', 'Credentials', 'Readiness', 'Alerts'];

export default function OnboardingWizard() {
  const router = useRouter();
  const locale = useLocale();
  const [step, setStep] = useState(0);
  const [p, setP] = useState<ProfileState>(initialState);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = <K extends keyof ProfileState>(key: K, value: ProfileState[K]) =>
    setP((prev) => ({ ...prev, [key]: value }));

  const toggleArr = (key: keyof ProfileState, v: string) =>
    setP((prev) => {
      const arr = prev[key] as string[];
      return { ...prev, [key]: arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v] };
    });

  const submit = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...p, onboardingCompletedAt: new Date().toISOString() }),
      });
      if (!res.ok) throw new Error('Could not save your profile. Please try again.');
      router.push(`/${locale}/dashboard/recommendations`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
      setSaving(false);
    }
  };

  const next = () => setStep((s) => Math.min(STEPS.length - 1, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));
  const isLast = step === STEPS.length - 1;
  const canContinue = step === 0 ? p.agencyName.trim().length > 0 : true;

  return (
    <div style={{ maxWidth: 720, width: '100%' }}>
      {/* Progress */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
          <span>Step {step + 1} of {STEPS.length} · {STEPS[step]}</span>
          <span>{Math.round(((step + 1) / STEPS.length) * 100)}%</span>
        </div>
        <div style={{ height: 6, background: 'rgba(42, 51, 61,0.08)', borderRadius: 999 }}>
          <div style={{
            height: '100%', width: `${((step + 1) / STEPS.length) * 100}%`,
            background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))',
            borderRadius: 999, transition: 'width 0.3s ease',
          }} />
        </div>
      </div>

      <div className="glass-panel animate-fade-in" style={{ padding: '2.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* STEP 0 — Agency */}
        {step === 0 && (
          <>
            <h2 style={{ fontSize: '1.5rem' }}>Tell us about your agency</h2>
            <Field label="Agency name">
              <input className="form-input" value={p.agencyName} placeholder="e.g. Acme Creative"
                onChange={(e) => set('agencyName', e.target.value)} />
            </Field>
            <Field label="Agency type">
              <ChipGroup options={AGENCY_TYPES} selected={p.agencyType} multi={false}
                onToggle={(v) => set('agencyType', p.agencyType === v ? '' : v)} />
            </Field>
            <Field label="Primary business location" hint="City, State">
              <input className="form-input" value={p.location} placeholder="e.g. Austin, TX"
                onChange={(e) => set('location', e.target.value)} />
            </Field>
          </>
        )}

        {/* STEP 1 — Service area */}
        {step === 1 && (
          <>
            <h2 style={{ fontSize: '1.5rem' }}>Where do you work?</h2>
            <Field label="Cities served" hint="Press Enter to add each city">
              <TagInput values={p.citiesServed} onChange={(v) => set('citiesServed', v)} placeholder="Add a city" />
            </Field>
            <Field label="Counties served">
              <TagInput values={p.countiesServed} onChange={(v) => set('countiesServed', v)} placeholder="Add a county" />
            </Field>
            <Field label={`Service radius — ${p.serviceRadiusMiles} miles`} hint="How far you'll travel for on-site work">
              <input type="range" min={0} max={100} value={p.serviceRadiusMiles}
                onChange={(e) => set('serviceRadiusMiles', Number(e.target.value))}
                style={{ width: '100%' }} />
            </Field>
            <Field label="Work preference">
              <ChipGroup options={REMOTE_PREFERENCE} selected={p.remotePreference} multi={false}
                onToggle={(v) => set('remotePreference', p.remotePreference === v ? '' : v)} />
            </Field>
          </>
        )}

        {/* STEP 2 — Services */}
        {step === 2 && (
          <>
            <h2 style={{ fontSize: '1.5rem' }}>What services do you offer?</h2>
            <Field label="Services" hint="Select all that apply">
              <ChipGroup options={SERVICES} selected={p.services} onToggle={(v) => toggleArr('services', v)} />
            </Field>
            <Field label="How do you typically work?">
              <ChipGroup options={ROLES} selected={p.role} multi={false}
                onToggle={(v) => set('role', p.role === v ? '' : v)} />
            </Field>
          </>
        )}

        {/* STEP 3 — Focus */}
        {step === 3 && (
          <>
            <h2 style={{ fontSize: '1.5rem' }}>Who and what do you target?</h2>
            <Field label="Industries served">
              <ChipGroup options={INDUSTRIES} selected={p.industries} onToggle={(v) => toggleArr('industries', v)} />
            </Field>
            <Field label="Target opportunity types">
              <ChipGroup options={TARGET_OPPORTUNITY_TYPES} selected={p.targetOpportunityTypes}
                onToggle={(v) => toggleArr('targetOpportunityTypes', v)} />
            </Field>
          </>
        )}

        {/* STEP 4 — Capacity */}
        {step === 4 && (
          <>
            <h2 style={{ fontSize: '1.5rem' }}>Your capacity</h2>
            <Field label="Team size">
              <ChipGroup options={TEAM_SIZES} selected={p.teamSize} multi={false}
                onToggle={(v) => set('teamSize', p.teamSize === v ? '' : v)} />
            </Field>
            <Field label="Delivery capacity">
              <ChipGroup options={DELIVERY_CAPACITY} selected={p.deliveryCapacity} multi={false}
                onToggle={(v) => set('deliveryCapacity', p.deliveryCapacity === v ? '' : v)} />
            </Field>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <Field label="Preferred contract — min ($)">
                <input className="form-input" type="number" value={p.minContract}
                  onChange={(e) => set('minContract', e.target.value === '' ? '' : Number(e.target.value))} placeholder="50000" />
              </Field>
              <Field label="Preferred contract — max ($)">
                <input className="form-input" type="number" value={p.maxContract}
                  onChange={(e) => set('maxContract', e.target.value === '' ? '' : Number(e.target.value))} placeholder="500000" />
              </Field>
            </div>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <Field label="Largest project you can deliver ($)">
                <input className="form-input" type="number" value={p.largestProjectSize}
                  onChange={(e) => set('largestProjectSize', e.target.value === '' ? '' : Number(e.target.value))} placeholder="1000000" />
              </Field>
              <Field label="Monthly media spend capacity ($)" hint="If applicable">
                <input className="form-input" type="number" value={p.monthlyMediaSpend}
                  onChange={(e) => set('monthlyMediaSpend', e.target.value === '' ? '' : Number(e.target.value))} placeholder="100000" />
              </Field>
            </div>
          </>
        )}

        {/* STEP 5 — Credentials */}
        {step === 5 && (
          <>
            <h2 style={{ fontSize: '1.5rem' }}>Certifications & coverage</h2>
            <Field label="Certifications">
              <ChipGroup options={CERTIFICATIONS} selected={p.certifications} onToggle={(v) => toggleArr('certifications', v)} />
            </Field>
            <Field label="Insurance coverage">
              <ChipGroup options={INSURANCE} selected={p.insurance} onToggle={(v) => toggleArr('insurance', v)} />
            </Field>
            <Field label="Prior government / public-sector experience">
              <ChipGroup options={PRIOR_GOV_EXPERIENCE} selected={p.priorGovExperience} multi={false}
                onToggle={(v) => set('priorGovExperience', p.priorGovExperience === v ? '' : v)} />
            </Field>
          </>
        )}

        {/* STEP 6 — Readiness */}
        {step === 6 && (
          <>
            <h2 style={{ fontSize: '1.5rem' }}>Proposal readiness & edge</h2>
            <Field label="What do you already have?" hint="We'll build per-opportunity checklists from this">
              <ChipGroup options={PROPOSAL_READINESS} selected={p.proposalReadiness} onToggle={(v) => toggleArr('proposalReadiness', v)} />
            </Field>
            <Field label="Your differentiators">
              <ChipGroup options={DIFFERENTIATORS} selected={p.differentiators} onToggle={(v) => toggleArr('differentiators', v)} />
            </Field>
          </>
        )}

        {/* STEP 7 — Alerts & keywords */}
        {step === 7 && (
          <>
            <h2 style={{ fontSize: '1.5rem' }}>Tune your results</h2>
            <Field label="Keywords to prioritize" hint="Opportunities matching these rank higher">
              <TagInput values={p.keywords} onChange={(v) => set('keywords', v)} placeholder="e.g. branding" />
            </Field>
            <Field label="Keywords to exclude" hint="Opportunities matching these are pushed down">
              <TagInput values={p.excludeKeywords} onChange={(v) => set('excludeKeywords', v)} placeholder="e.g. construction" />
            </Field>
            <Field label="Alert preferences">
              <ChipGroup options={ALERT_PREFERENCES} selected={p.alertPreferences} onToggle={(v) => toggleArr('alertPreferences', v)} />
            </Field>
          </>
        )}

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', padding: '0.75rem', borderRadius: 8, fontSize: '0.875rem' }}>
            {error}
          </div>
        )}

        {/* Nav */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
          <button type="button" className="btn btn-secondary" onClick={back} disabled={step === 0}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', opacity: step === 0 ? 0.4 : 1 }}>
            <ChevronLeft size={16} /> Back
          </button>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            {!isLast && (
              <button type="button" className="btn btn-secondary" onClick={submit} disabled={saving}>
                Skip for now
              </button>
            )}
            {isLast ? (
              <button type="button" className="btn btn-primary" onClick={submit} disabled={saving}>
                {saving ? 'Saving…' : 'Finish & see opportunities'}
              </button>
            ) : (
              <button type="button" className="btn btn-primary" onClick={next} disabled={!canContinue}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', opacity: canContinue ? 1 : 0.5 }}>
                Continue <ChevronRight size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
