'use client';

import React, { useEffect, useState } from 'react';
import { Check, X, Loader2 } from 'lucide-react';
import {
  AGENCY_TYPES, SERVICES, INDUSTRIES, TARGET_OPPORTUNITY_TYPES, DELIVERY_CAPACITY,
  TEAM_SIZES, CERTIFICATIONS, INSURANCE, PRIOR_GOV_EXPERIENCE, PROPOSAL_READINESS,
  DIFFERENTIATORS, ROLES, REMOTE_PREFERENCE, ALERT_PREFERENCES,
  ANNUAL_REVENUE_RANGES, PRIMARY_CAPABILITIES, CA_PRESENCE_OPTIONS,
} from '@/components/onboarding/options';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';

// Shape kept in sync with AgencyProfile in src/lib/profile.ts. Empty strings/
// arrays make controlled inputs happy until the GET arrives.
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
  annualRevenue: string;
  primaryCapability: string;
  caPresence: string;
  scoringPreferences?: {
    eligibilityWeight: number;
    fitWeight: number;
    edgeWeight: number;
  };
}

const EMPTY: ProfileState = {
  agencyName: '', location: '', citiesServed: [], countiesServed: [], serviceRadiusMiles: 50,
  remotePreference: '', agencyType: '', services: [], role: '', industries: [],
  targetOpportunityTypes: [], teamSize: '', deliveryCapacity: '', largestProjectSize: '',
  minContract: '', maxContract: '', monthlyMediaSpend: '', certifications: [], insurance: [],
  priorGovExperience: '', proposalReadiness: [], differentiators: [], keywords: [],
  excludeKeywords: [], alertPreferences: [], annualRevenue: '', primaryCapability: '', caPresence: '',
};

// ---- Reusable UI bits (mirrors OnboardingWizard) ----

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
        background: active ? 'rgba(26,169,201,0.12)' : 'rgba(42, 51, 61,0.03)',
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
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); } }}
        />
        <button type="button" className="btn btn-secondary" onClick={add} style={{ padding: '0 1rem' }}>Add</button>
      </div>
      {values.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.6rem' }}>
          {values.map((v) => (
            <span key={v} style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.3rem 0.6rem',
              borderRadius: '999px', background: 'rgba(26,169,201,0.12)', color: 'var(--accent-primary)', fontSize: '0.8rem',
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

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingBottom: '1.5rem', borderBottom: '1px solid rgba(42, 51, 61,0.08)' }}>
      <div>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.15rem' }}>{title}</h2>
        {hint && <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      <label style={{ fontWeight: 600, fontSize: '0.85rem' }}>{label}</label>
      {hint && <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>{hint}</p>}
      {children}
    </div>
  );
}

/** Coerce server response (may be null-y) into the controlled-input state. */
function fromServer(p: any): ProfileState {
  const s = (v: unknown, d = '') => (typeof v === 'string' && v ? v : d);
  const a = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);
  const n = (v: unknown): number | '' => (typeof v === 'number' && Number.isFinite(v) ? v : '');
  return {
    agencyName: s(p?.agencyName),
    location: s(p?.location),
    citiesServed: a(p?.citiesServed),
    countiesServed: a(p?.countiesServed),
    serviceRadiusMiles: typeof p?.serviceRadiusMiles === 'number' ? p.serviceRadiusMiles : 50,
    remotePreference: s(p?.remotePreference),
    agencyType: s(p?.agencyType),
    services: a(p?.services),
    role: s(p?.role),
    industries: a(p?.industries),
    targetOpportunityTypes: a(p?.targetOpportunityTypes),
    teamSize: s(p?.teamSize),
    deliveryCapacity: s(p?.deliveryCapacity),
    largestProjectSize: n(p?.largestProjectSize),
    minContract: n(p?.minContract),
    maxContract: n(p?.maxContract),
    monthlyMediaSpend: n(p?.monthlyMediaSpend),
    certifications: a(p?.certifications),
    insurance: a(p?.insurance),
    priorGovExperience: s(p?.priorGovExperience),
    proposalReadiness: a(p?.proposalReadiness),
    differentiators: a(p?.differentiators),
    keywords: a(p?.keywords),
    excludeKeywords: a(p?.excludeKeywords),
    alertPreferences: a(p?.alertPreferences),
    annualRevenue: s(p?.annualRevenue),
    primaryCapability: s(p?.primaryCapability),
    caPresence: s(p?.caPresence),
    scoringPreferences: p?.scoringPreferences,
  };
}

export default function SettingsPage() {
  const router = useRouter();
  const locale = useLocale();
  const [p, setP] = useState<ProfileState>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Load existing profile so the form reflects what the user answered at signup.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/profile', { cache: 'no-store' });
        const data = await res.json();
        if (!cancelled) setP(fromServer(data?.profile));
      } catch {
        // fall back to empty state — user can re-enter
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const set = <K extends keyof ProfileState>(key: K, value: ProfileState[K]) =>
    setP((prev) => ({ ...prev, [key]: value }));

  const toggleArr = (key: keyof ProfileState, v: string) =>
    setP((prev) => {
      const arr = prev[key] as string[];
      return { ...prev, [key]: arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v] };
    });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatus('idle');
    setErrorMsg('');
    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(p),
      });
      if (!res.ok) throw new Error('Could not save your profile. Please try again.');
      setStatus('saved');
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Could not save your profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setResetting(true);
    try {
      await fetch('/api/profile/reset', { method: 'POST' });
      router.refresh();
      router.push(`/${locale}/dashboard/settings/re-onboard`);
    } catch (err) {
      console.error(err);
      setResetting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '2rem', color: 'var(--text-secondary)' }}>
        <Loader2 size={18} className="spin" /> Loading your profile…
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: 860 }}>
      <header>
        <h1 style={{ fontSize: '2.25rem', marginBottom: '0.4rem' }}>Profile Settings</h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Update the answers you gave at signup. Changes immediately tune the matching engine.
        </p>
      </header>

      {status === 'saved' && (
        <div style={{ background: 'rgba(54,242,166,0.15)', border: '1px solid rgba(54,242,166,0.35)', color: '#0a7d52', padding: '0.75rem 1rem', borderRadius: 8, fontSize: '0.9rem' }}>
          ✓ Settings saved.
        </div>
      )}
      {status === 'error' && (
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#b91c1c', padding: '0.75rem 1rem', borderRadius: 8, fontSize: '0.9rem' }}>
          {errorMsg || 'Could not save your profile.'}
        </div>
      )}

      <form onSubmit={handleSave} className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>

        <Section title="Agency">
          <Field label="Agency name">
            <input className="form-input" value={p.agencyName} onChange={(e) => set('agencyName', e.target.value)} placeholder="e.g. Acme Creative" />
          </Field>
          <Field label="What type of agency are you?">
            <ChipGroup options={AGENCY_TYPES} selected={p.agencyType} multi={false}
              onToggle={(v) => set('agencyType', p.agencyType === v ? '' : v)} />
          </Field>
          <Field label="What is your primary capability?">
            <ChipGroup options={PRIMARY_CAPABILITIES} selected={p.primaryCapability} multi={false}
              onToggle={(v) => set('primaryCapability', p.primaryCapability === v ? '' : v)} />
          </Field>
          <Field label="Where are you based in California?">
            <ChipGroup options={CA_PRESENCE_OPTIONS} selected={p.caPresence} multi={false}
              onToggle={(v) => set('caPresence', p.caPresence === v ? '' : v)} />
          </Field>
          <Field label="Primary business location" hint="City, State">
            <input className="form-input" value={p.location} onChange={(e) => set('location', e.target.value)} placeholder="e.g. Los Angeles, CA" />
          </Field>
        </Section>

        <Section title="Service area" hint="Where you work and how far you'll travel.">
          <Field label="Cities served" hint="Press Enter to add each city">
            <TagInput values={p.citiesServed} onChange={(v) => set('citiesServed', v)} placeholder="Add a city" />
          </Field>
          <Field label="Counties served">
            <TagInput values={p.countiesServed} onChange={(v) => set('countiesServed', v)} placeholder="Add a county" />
          </Field>
          <Field label={`Service radius — ${p.serviceRadiusMiles} miles`} hint="How far you'll travel for on-site work">
            <input type="range" min={0} max={100} value={p.serviceRadiusMiles}
              onChange={(e) => set('serviceRadiusMiles', Number(e.target.value))} style={{ width: '100%' }} />
          </Field>
          <Field label="Work preference">
            <ChipGroup options={REMOTE_PREFERENCE} selected={p.remotePreference} multi={false}
              onToggle={(v) => set('remotePreference', p.remotePreference === v ? '' : v)} />
          </Field>
        </Section>

        <Section title="Services & role">
          <Field label="Services" hint="Select all that apply">
            <ChipGroup options={SERVICES} selected={p.services} onToggle={(v) => toggleArr('services', v)} />
          </Field>
          <Field label="How do you typically work?">
            <ChipGroup options={ROLES} selected={p.role} multi={false}
              onToggle={(v) => set('role', p.role === v ? '' : v)} />
          </Field>
        </Section>

        <Section title="Focus">
          <Field label="Industries served">
            <ChipGroup options={INDUSTRIES} selected={p.industries} onToggle={(v) => toggleArr('industries', v)} />
          </Field>
          <Field label="Target opportunity types">
            <ChipGroup options={TARGET_OPPORTUNITY_TYPES} selected={p.targetOpportunityTypes}
              onToggle={(v) => toggleArr('targetOpportunityTypes', v)} />
          </Field>
        </Section>

        <Section title="Capacity">
          <Field label="Team size">
            <ChipGroup options={TEAM_SIZES} selected={p.teamSize} multi={false}
              onToggle={(v) => set('teamSize', p.teamSize === v ? '' : v)} />
          </Field>
          <Field label="Annual revenue (approx.)">
            <ChipGroup options={ANNUAL_REVENUE_RANGES} selected={p.annualRevenue} multi={false}
              onToggle={(v) => set('annualRevenue', p.annualRevenue === v ? '' : v)} />
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
        </Section>

        <Section title="Credentials">
          <Field label="Certifications">
            <ChipGroup options={CERTIFICATIONS} selected={p.certifications} onToggle={(v) => toggleArr('certifications', v)} />
          </Field>
          <Field label="Insurance coverage">
            <ChipGroup options={INSURANCE} selected={p.insurance} onToggle={(v) => toggleArr('insurance', v)} />
          </Field>
          <Field label="Have you done government work before?">
            <ChipGroup options={PRIOR_GOV_EXPERIENCE} selected={p.priorGovExperience} multi={false}
              onToggle={(v) => set('priorGovExperience', p.priorGovExperience === v ? '' : v)} />
          </Field>
        </Section>

        <Section title="Readiness & edge">
          <Field label="What do you already have?" hint="Drives the per-opportunity readiness checklist">
            <ChipGroup options={PROPOSAL_READINESS} selected={p.proposalReadiness} onToggle={(v) => toggleArr('proposalReadiness', v)} />
          </Field>
          <Field label="Your differentiators">
            <ChipGroup options={DIFFERENTIATORS} selected={p.differentiators} onToggle={(v) => toggleArr('differentiators', v)} />
          </Field>
        </Section>

        <Section title="Search tuning & alerts">
          <Field label="Keywords to prioritize" hint="Opportunities matching these rank higher">
            <TagInput values={p.keywords} onChange={(v) => set('keywords', v)} placeholder="e.g. branding" />
          </Field>
          <Field label="Keywords to exclude" hint="Opportunities matching these are pushed down">
            <TagInput values={p.excludeKeywords} onChange={(v) => set('excludeKeywords', v)} placeholder="e.g. construction" />
          </Field>
          <Field label="Alert preferences">
            <ChipGroup options={ALERT_PREFERENCES} selected={p.alertPreferences} onToggle={(v) => toggleArr('alertPreferences', v)} />
          </Field>
        </Section>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', paddingTop: '0.25rem' }}>
          <button type="submit" className="btn btn-primary" disabled={saving} style={{ padding: '0.75rem 1.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {saving && <Loader2 size={16} className="spin" />}
            {saving ? 'Saving…' : 'Save settings'}
          </button>
        </div>
      </form>

      {/* Advanced Match Preferences */}
      <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', border: '1px solid var(--border)' }}>
        <div>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.25rem', color: 'var(--text-primary)' }}>Advanced Match Preferences</h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: 0 }}>
            Customize the scoring weights used to rank your "For You" recommendations. 
            The system evaluates Qualifications & Compliance (hard requirements like certs/location), Contract Profile Fit (contract size/industry alignment), and Competitive Edge (your unique differentiators and keywords).
          </p>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', background: 'var(--bg-inset)', padding: '1.5rem', borderRadius: '8px' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
              <label style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>Qualifications &amp; Compliance</label>
              <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{p.scoringPreferences?.eligibilityWeight ?? 40}</span>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 0.75rem 0' }}>Hard requirements, certifications, and location.</p>
            <input 
              type="range" min="0" max="100"
              style={{ width: '100%', cursor: 'pointer' }}
              value={p.scoringPreferences?.eligibilityWeight ?? 40} 
              onChange={(e) => set('scoringPreferences', { ...(p.scoringPreferences || { eligibilityWeight: 40, fitWeight: 35, edgeWeight: 25 }), eligibilityWeight: parseInt(e.target.value) || 0 })}
            />
          </div>
          
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
              <label style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>Contract Profile Fit</label>
              <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{p.scoringPreferences?.fitWeight ?? 35}</span>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 0.75rem 0' }}>Industry alignment, contract size, and service match.</p>
            <input 
              type="range" min="0" max="100"
              style={{ width: '100%', cursor: 'pointer' }}
              value={p.scoringPreferences?.fitWeight ?? 35} 
              onChange={(e) => set('scoringPreferences', { ...(p.scoringPreferences || { eligibilityWeight: 40, fitWeight: 35, edgeWeight: 25 }), fitWeight: parseInt(e.target.value) || 0 })}
            />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
              <label style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>Competitive Edge</label>
              <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{p.scoringPreferences?.edgeWeight ?? 25}</span>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 0.75rem 0' }}>Differentiators, proposal readiness, and priority keywords.</p>
            <input 
              type="range" min="0" max="100"
              style={{ width: '100%', cursor: 'pointer' }}
              value={p.scoringPreferences?.edgeWeight ?? 25} 
              onChange={(e) => set('scoringPreferences', { ...(p.scoringPreferences || { eligibilityWeight: 40, fitWeight: 35, edgeWeight: 25 }), edgeWeight: parseInt(e.target.value) || 0 })}
            />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Total weight: {((p.scoringPreferences?.eligibilityWeight ?? 40) + (p.scoringPreferences?.fitWeight ?? 35) + (p.scoringPreferences?.edgeWeight ?? 25))} (Normalized automatically to 100%)
          </span>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button 
              type="button" 
              onClick={() => {
                set('scoringPreferences', { eligibilityWeight: 40, fitWeight: 35, edgeWeight: 25 });
                setTimeout(() => document.getElementById('settings-form')?.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true })), 10);
              }}
              style={{
                background: 'transparent', border: '1px solid #d1d5db', color: '#374151',
                padding: '0.6rem 1.25rem', borderRadius: 8, fontSize: '0.88rem', fontWeight: 500, cursor: 'pointer'
              }}
            >
              Reset to Recommended Scoring
            </button>
            <button 
              type="button" 
              onClick={() => document.getElementById('settings-form')?.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }))}
              className="btn btn-primary"
              style={{ padding: '0.6rem 1.25rem' }}
            >
              Save Preferences
            </button>
          </div>
        </div>
      </div>

      {/* Reset & Rebuild Section */}
      <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem', border: '1px solid rgba(239,68,68,0.2)' }}>
        <div>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.15rem', color: '#b91c1c' }}>Rebuild business profile</h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: 0 }}>
            Start over with the core profile questions. This will clear your current answers and run you through the initial setup again. Your saved opportunities and custom search keywords will not be affected.
          </p>
        </div>
        <div>
          {!showResetModal ? (
            <button type="button" onClick={() => setShowResetModal(true)} style={{
              background: 'transparent', border: '1px solid #b91c1c', color: '#b91c1c',
              padding: '0.6rem 1.25rem', borderRadius: 8, fontSize: '0.88rem', fontWeight: 500, cursor: 'pointer'
            }}>
              Restart setup
            </button>
          ) : (
            <div style={{
              background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', 
              borderRadius: 8, padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem',
              marginTop: '0.5rem'
            }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 600, margin: '0 0 0.25rem 0', color: '#b91c1c' }}>Restart business profile?</h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
                  This clears your current business profile and removes personalized recommendations until you rebuild it. Your account, login, saved contracts, and billing information will not be deleted.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <button type="button" onClick={() => setShowResetModal(false)} disabled={resetting} style={{
                  background: 'transparent', border: '1px solid #d1d5db', color: '#374151',
                  padding: '0.5rem 1rem', borderRadius: 6, fontSize: '0.85rem', cursor: 'pointer', fontWeight: 500,
                  opacity: resetting ? 0.5 : 1
                }}>
                  Cancel
                </button>
                <button type="button" onClick={handleReset} disabled={resetting} style={{
                  background: '#dc2626', border: 'none', color: '#fff',
                  padding: '0.5rem 1rem', borderRadius: 6, fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: resetting ? 0.7 : 1
                }}>
                  {resetting ? <><Loader2 size={14} className="spin" /> Rebuilding...</> : 'Restart and rebuild profile'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
