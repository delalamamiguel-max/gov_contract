'use client';

import React, { useState } from 'react';
import { MessageSquare, Check } from 'lucide-react';
import { SERVICES } from '@/components/onboarding/options';
import type { FeedbackAnswers } from '@/lib/feedback';

function Choice<T extends string>({ label, options, value, onChange }: { label: string; options: T[]; value?: T; onChange: (v: T) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
      <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{label}</span>
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
        {options.map((o) => {
          const active = value === o;
          return (
            <button key={o} type="button" onClick={() => onChange(o)} style={{
              padding: '0.3rem 0.7rem', borderRadius: 999, fontSize: '0.8rem', cursor: 'pointer', textTransform: 'capitalize',
              border: active ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
              background: active ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.03)',
              color: active ? 'var(--accent-primary)' : 'var(--text-secondary)',
            }}>{o}</button>
          );
        })}
      </div>
    </div>
  );
}

export default function FeedbackQuestionnaire({ noticeId, opportunityTitle }: { noticeId?: string; opportunityTitle?: string }) {
  const [open, setOpen] = useState(false);
  const [a, setA] = useState<FeedbackAnswers>({ prioritizeServices: [] });
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const set = <K extends keyof FeedbackAnswers>(k: K, v: FeedbackAnswers[K]) => setA((p) => ({ ...p, [k]: v }));
  const togglePrio = (s: string) =>
    setA((p) => { const arr = p.prioritizeServices || []; return { ...p, prioritizeServices: arr.includes(s) ? arr.filter((x) => x !== s) : [...arr, s] }; });

  const submit = async () => {
    setSaving(true);
    try {
      await fetch('/api/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ noticeId, opportunityTitle, answers: a }) });
      setDone(true);
    } catch {
      setDone(true); // feedback is best-effort; don't block the user
    } finally {
      setSaving(false);
    }
  };

  if (done) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.86rem', color: '#34d399', padding: '0.5rem 0' }}>
        <Check size={15} /> Thanks — we’ll use this to tune your future results.
      </div>
    );
  }

  if (!open) {
    return (
      <button className="btn btn-secondary" onClick={() => setOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', alignSelf: 'flex-start' }}>
        <MessageSquare size={14} /> Give feedback to improve future matches
      </button>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid var(--border-color)' }}>
      <p style={{ fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}><MessageSquare size={15} /> Quick feedback</p>
      <Choice label="Is this opportunity relevant?" options={['yes', 'no']} value={a.relevant} onChange={(v) => set('relevant', v)} />
      <Choice label="Contract size" options={['too small', 'right size', 'too large']} value={a.sizeFit} onChange={(v) => set('sizeFit', v)} />
      <Choice label="Is the distance acceptable?" options={['yes', 'no']} value={a.distanceOk} onChange={(v) => set('distanceOk', v)} />
      <Choice label="Is the scope aligned with your services?" options={['yes', 'partly', 'no']} value={a.scopeAligned} onChange={(v) => set('scopeAligned', v)} />
      <Choice label="Are the requirements realistic?" options={['yes', 'no']} value={a.requirementsRealistic} onChange={(v) => set('requirementsRealistic', v)} />
      <Choice label="Would you…" options={['bid', 'pass', 'save']} value={a.decision} onChange={(v) => set('decision', v)} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>What made it attractive or unattractive?</span>
        <textarea className="form-input" rows={2} value={a.attractiveness || ''} onChange={(e) => set('attractiveness', e.target.value)} placeholder="Optional notes" />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Which services should we prioritize more?</span>
        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', maxHeight: 110, overflowY: 'auto' }}>
          {SERVICES.filter((s) => s !== 'Other').map((s) => {
            const active = (a.prioritizeServices || []).includes(s);
            return (
              <button key={s} type="button" onClick={() => togglePrio(s)} style={{
                padding: '0.25rem 0.55rem', borderRadius: 999, fontSize: '0.75rem', cursor: 'pointer',
                border: active ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
                background: active ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.03)',
                color: active ? 'var(--accent-primary)' : 'var(--text-secondary)',
              }}>{s}</button>
            );
          })}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end' }}>
        <button className="btn btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
        <button className="btn btn-primary" onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Submit feedback'}</button>
      </div>
    </div>
  );
}
