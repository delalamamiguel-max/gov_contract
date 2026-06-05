'use client';

import React, { useEffect, useState } from 'react';
import { Bell, Plus, Trash2, Pencil, Play, X, Check, MailWarning } from 'lucide-react';
import type { Alert, AlertCriteria } from '@/lib/alerts';
import { SERVICES, INDUSTRIES, CERTIFICATIONS, TARGET_OPPORTUNITY_TYPES } from '@/components/onboarding/options';
import ContractRow from '@/components/ContractRow';

interface Draft {
  name: string;
  keywords: string[];
  services: string[];
  industries: string[];
  opportunityTypes: string[];
  certifications: string[];
  location: string;
  radiusMiles: number;
  remoteOk: boolean;
  buyer: string;
  minValue: number | '';
  maxValue: number | '';
  deadlineWindowDays: number | '';
}

const emptyDraft: Draft = {
  name: '', keywords: [], services: [], industries: [], opportunityTypes: [], certifications: [],
  location: '', radiusMiles: 50, remoteOk: true, buyer: '', minValue: '', maxValue: '', deadlineWindowDays: '',
};

function chip(active: boolean) {
  return {
    padding: '0.35rem 0.7rem', borderRadius: 999, fontSize: '0.8rem', cursor: 'pointer',
    border: active ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
    background: active ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.03)',
    color: active ? 'var(--accent-primary)' : 'var(--text-secondary)',
  } as React.CSSProperties;
}

function Chips({ options, selected, onToggle }: { options: string[]; selected: string[]; onToggle: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
      {options.map((o) => (
        <button key={o} type="button" style={chip(selected.includes(o))} onClick={() => onToggle(o)}>{o}</button>
      ))}
    </div>
  );
}

function Tags({ values, onChange, placeholder }: { values: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [draft, setDraft] = useState('');
  return (
    <div>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <input className="form-input" value={draft} placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); const v = draft.trim(); if (v && !values.includes(v)) onChange([...values, v]); setDraft(''); } }} />
      </div>
      {values.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.4rem' }}>
          {values.map((v) => (
            <span key={v} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.25rem 0.5rem', borderRadius: 999, background: 'rgba(59,130,246,0.12)', color: 'var(--accent-primary)', fontSize: '0.78rem' }}>
              {v}<X size={11} style={{ cursor: 'pointer' }} onClick={() => onChange(values.filter((x) => x !== v))} />
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function toCriteria(d: Draft): AlertCriteria {
  return {
    keywords: d.keywords, services: d.services, industries: d.industries,
    opportunityTypes: d.opportunityTypes, certifications: d.certifications,
    location: d.location || null, radiusMiles: d.location ? d.radiusMiles : null,
    remoteOk: d.remoteOk, buyer: d.buyer || null,
    minValue: d.minValue === '' ? null : Number(d.minValue),
    maxValue: d.maxValue === '' ? null : Number(d.maxValue),
    deadlineWindowDays: d.deadlineWindowDays === '' ? null : Number(d.deadlineWindowDays),
  };
}
function toDraft(a: Alert): Draft {
  const c = a.criteria;
  return {
    name: a.name, keywords: c.keywords || [], services: c.services || [], industries: c.industries || [],
    opportunityTypes: c.opportunityTypes || [], certifications: c.certifications || [],
    location: c.location || '', radiusMiles: c.radiusMiles ?? 50, remoteOk: c.remoteOk ?? true,
    buyer: c.buyer || '', minValue: c.minValue ?? '', maxValue: c.maxValue ?? '', deadlineWindowDays: c.deadlineWindowDays ?? '',
  };
}

export default function AlertsManager() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [matches, setMatches] = useState<Record<string, { items: any[]; count: number; error?: string }>>({});
  const [runningId, setRunningId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/alerts');
      const data = await res.json();
      setAlerts(data.alerts || []);
    } catch {
      setError('Could not load your alerts.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, []);

  const toggleIn = (key: keyof Draft, v: string) =>
    setDraft((p) => { const arr = p[key] as string[]; return { ...p, [key]: arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v] }; });

  const openCreate = () => { setDraft(emptyDraft); setEditingId(null); setShowForm(true); };
  const openEdit = (a: Alert) => { setDraft(toDraft(a)); setEditingId(a.id); setShowForm(true); };

  const save = async () => {
    setSaving(true); setError(null);
    try {
      const payload = { name: draft.name || 'Untitled alert', criteria: toCriteria(draft) };
      const res = editingId
        ? await fetch('/api/alerts', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editingId, patch: payload }) })
        : await fetch('/api/alerts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setAlerts(data.alerts || []);
      setShowForm(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = async (a: Alert) => {
    const res = await fetch('/api/alerts', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: a.id, patch: { enabled: !a.enabled } }) });
    const data = await res.json();
    if (res.ok) setAlerts(data.alerts || []);
  };
  const remove = async (a: Alert) => {
    const res = await fetch('/api/alerts', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: a.id }) });
    const data = await res.json();
    if (res.ok) setAlerts(data.alerts || []);
  };
  const run = async (a: Alert) => {
    setRunningId(a.id);
    try {
      const res = await fetch('/api/alerts/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: a.id }) });
      const data = await res.json();
      setMatches((m) => ({ ...m, [a.id]: { items: data.matches || [], count: data.count || 0, error: data.error } }));
      void load();
    } catch {
      setMatches((m) => ({ ...m, [a.id]: { items: [], count: 0, error: 'Could not run this alert.' } }));
    } finally {
      setRunningId(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Coming-soon delivery banner */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 8, padding: '0.75rem 1rem', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
        <MailWarning size={16} color="#fbbf24" />
        Email & push delivery is <strong style={{ color: '#fbbf24', margin: '0 0.25rem' }}>coming soon</strong>. For now, save alerts and run them on demand to see matches here.
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Bell size={18} /> Your alerts</h2>
        <button className="btn btn-primary" onClick={openCreate} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Plus size={16} /> New alert
        </button>
      </div>

      {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', padding: '0.75rem', borderRadius: 8, fontSize: '0.88rem' }}>{error}</div>}

      {/* Create / edit form */}
      {showForm && (
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1.05rem' }}>{editingId ? 'Edit alert' : 'New alert'}</h3>
            <X size={18} style={{ cursor: 'pointer' }} onClick={() => setShowForm(false)} />
          </div>
          <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Alert name</label>
          <input className="form-input" value={draft.name} placeholder="e.g. Texas tourism branding" onChange={(e) => setDraft({ ...draft, name: e.target.value })} />

          <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Keywords</label>
          <Tags values={draft.keywords} onChange={(v) => setDraft({ ...draft, keywords: v })} placeholder="Press Enter to add a keyword" />

          <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Services</label>
          <Chips options={SERVICES} selected={draft.services} onToggle={(v) => toggleIn('services', v)} />

          <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Industries</label>
          <Chips options={INDUSTRIES} selected={draft.industries} onToggle={(v) => toggleIn('industries', v)} />

          <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Opportunity types</label>
          <Chips options={TARGET_OPPORTUNITY_TYPES} selected={draft.opportunityTypes} onToggle={(v) => toggleIn('opportunityTypes', v)} />

          <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Certifications</label>
          <Chips options={CERTIFICATIONS} selected={draft.certifications} onToggle={(v) => toggleIn('certifications', v)} />

          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Location</label>
              <input className="form-input" value={draft.location} placeholder="City, ST" onChange={(e) => setDraft({ ...draft, location: e.target.value })} />
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Buyer / agency</label>
              <input className="form-input" value={draft.buyer} placeholder="e.g. Department of Tourism" onChange={(e) => setDraft({ ...draft, buyer: e.target.value })} />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Radius — {draft.radiusMiles} mi</label>
            <input type="range" min={0} max={100} step={5} value={draft.radiusMiles} onChange={(e) => setDraft({ ...draft, radiusMiles: Number(e.target.value) })} style={{ width: '100%', accentColor: 'var(--accent-primary)' }} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.88rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={draft.remoteOk} onChange={(e) => setDraft({ ...draft, remoteOk: e.target.checked })} /> Include remote-eligible opportunities
          </label>

          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 150 }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Min value ($)</label>
              <input className="form-input" type="number" value={draft.minValue} onChange={(e) => setDraft({ ...draft, minValue: e.target.value === '' ? '' : Number(e.target.value) })} />
            </div>
            <div style={{ flex: 1, minWidth: 150 }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Max value ($)</label>
              <input className="form-input" type="number" value={draft.maxValue} onChange={(e) => setDraft({ ...draft, maxValue: e.target.value === '' ? '' : Number(e.target.value) })} />
            </div>
            <div style={{ flex: 1, minWidth: 150 }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Deadline within (days)</label>
              <input className="form-input" type="number" value={draft.deadlineWindowDays} placeholder="e.g. 30" onChange={(e) => setDraft({ ...draft, deadlineWindowDays: e.target.value === '' ? '' : Number(e.target.value) })} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : editingId ? 'Save changes' : 'Create alert'}</button>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <p style={{ color: 'var(--text-secondary)' }}>Loading alerts…</p>
      ) : alerts.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-secondary)' }}>
          <p style={{ fontSize: '1.05rem', marginBottom: '0.4rem' }}>No alerts yet.</p>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Create an alert to track matching marketing opportunities.</p>
        </div>
      ) : (
        alerts.map((a) => (
          <div key={a.id} className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <h3 style={{ fontSize: '1.1rem' }}>{a.name}</h3>
                  <span style={{ fontSize: '0.7rem', fontWeight: 600, padding: '0.15rem 0.5rem', borderRadius: 999, background: a.enabled ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.06)', color: a.enabled ? '#34d399' : 'var(--text-muted)' }}>
                    {a.enabled ? 'On' : 'Off'}
                  </span>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  {[a.criteria.keywords?.length && `${a.criteria.keywords.length} keywords`, a.criteria.services?.length && `${a.criteria.services.length} services`, a.criteria.location && `near ${a.criteria.location}`, a.criteria.deadlineWindowDays && `≤${a.criteria.deadlineWindowDays}d`].filter(Boolean).join(' · ') || 'No criteria set'}
                  {a.lastMatchCount != null && ` · ${a.lastMatchCount} matches last run`}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button className="btn btn-secondary" onClick={() => run(a)} disabled={runningId === a.id} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.45rem 0.8rem' }}>
                  <Play size={14} /> {runningId === a.id ? 'Running…' : 'Run now'}
                </button>
                <button className="btn btn-secondary" onClick={() => toggleEnabled(a)} title={a.enabled ? 'Turn off' : 'Turn on'} style={{ padding: '0.45rem 0.7rem' }}>
                  {a.enabled ? <X size={14} /> : <Check size={14} />}
                </button>
                <button className="btn btn-secondary" onClick={() => openEdit(a)} style={{ padding: '0.45rem 0.7rem' }}><Pencil size={14} /></button>
                <button className="btn btn-secondary" onClick={() => remove(a)} style={{ padding: '0.45rem 0.7rem', color: '#f87171' }}><Trash2 size={14} /></button>
              </div>
            </div>

            {/* Matches */}
            {matches[a.id] && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '0.75rem' }}>
                {matches[a.id].error ? (
                  <p style={{ fontSize: '0.85rem', color: '#fbbf24' }}>{matches[a.id].error}</p>
                ) : matches[a.id].count === 0 ? (
                  <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>No current matches for this alert. Try widening the criteria.</p>
                ) : (
                  <>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{matches[a.id].count} match{matches[a.id].count === 1 ? '' : 'es'}:</p>
                    {matches[a.id].items.slice(0, 5).map((opp) => (
                      <ContractRow key={opp.id} opp={opp} radius={a.criteria.radiusMiles ?? 50} />
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
