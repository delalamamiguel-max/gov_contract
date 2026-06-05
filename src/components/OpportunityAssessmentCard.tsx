'use client';

import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Award, ListChecks } from 'lucide-react';
import type { OpportunityAssessment, GroupScore, MatchLabel } from '@/lib/assessment';

const labelColors: Record<MatchLabel, { bg: string; fg: string }> = {
  'Strong Match': { bg: 'rgba(16,185,129,0.18)', fg: '#34d399' },
  'Good Match': { bg: 'rgba(59,130,246,0.18)', fg: '#60a5fa' },
  'Possible Match': { bg: 'rgba(245,158,11,0.18)', fg: '#fbbf24' },
  'Weak Match': { bg: 'rgba(239,68,68,0.18)', fg: '#f87171' },
};

function barColor(score: number) {
  if (score >= 80) return '#34d399';
  if (score >= 60) return '#60a5fa';
  if (score >= 40) return '#fbbf24';
  return '#f87171';
}

function GroupBar({ name, group }: { name: string; group: GroupScore }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
        <span style={{ color: 'var(--text-secondary)' }}>
          {name} <span style={{ color: 'var(--text-muted)' }}>· {Math.round(group.weight * 100)}%</span>
        </span>
        <span style={{ fontWeight: 600, color: barColor(group.score) }}>{group.score}%</span>
      </div>
      <div style={{ height: 5, background: 'rgba(255,255,255,0.08)', borderRadius: 999 }}>
        <div style={{ height: '100%', width: `${group.score}%`, background: barColor(group.score), borderRadius: 999 }} />
      </div>
    </div>
  );
}

function Bullets({ title, items, icon, color }: { title: string; items: string[]; icon: React.ReactNode; color: string }) {
  if (!items.length) return null;
  return (
    <div>
      <p style={{ fontSize: '0.78rem', color, fontWeight: 600, marginBottom: '0.25rem' }}>{title}</p>
      {items.map((r, i) => (
        <div key={i} style={{ display: 'flex', gap: '0.4rem', alignItems: 'flex-start', fontSize: '0.88rem', marginBottom: 2 }}>
          <span style={{ marginTop: 3, flexShrink: 0 }}>{icon}</span>
          <span>{r}</span>
        </div>
      ))}
    </div>
  );
}

export default function OpportunityAssessmentCard({ a }: { a: OpportunityAssessment }) {
  const c = labelColors[a.label];
  return (
    <div
      style={{
        padding: '1rem',
        background: 'rgba(59, 130, 246, 0.05)',
        borderRadius: '8px',
        borderLeft: `3px solid ${c.fg}`,
        display: 'flex',
        flexDirection: 'column',
        gap: '0.9rem',
      }}
    >
      {/* Header: score + label */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
        <h4 style={{ fontSize: '0.9rem', color: 'var(--accent-primary)', fontWeight: 600 }}>Opportunity Assessment</h4>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1.4rem', fontWeight: 700, color: c.fg }}>{a.matchScore}%</span>
          <span style={{ padding: '0.2rem 0.6rem', borderRadius: 999, fontSize: '0.75rem', fontWeight: 600, background: c.bg, color: c.fg }}>
            {a.label}
          </span>
        </div>
      </div>

      {a.hardRequirementMissing && (
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', fontSize: '0.82rem', color: '#f87171', background: 'rgba(239,68,68,0.08)', padding: '0.5rem 0.6rem', borderRadius: 6 }}>
          <AlertTriangle size={14} /> Score capped — a hard requirement is unmet.
        </div>
      )}

      <p style={{ fontSize: '0.9rem', lineHeight: 1.5, color: 'var(--text-secondary)' }}>{a.scoreExplanation}</p>

      {/* Group bars */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <GroupBar name="Eligibility" group={a.eligibility} />
        <GroupBar name="Fit" group={a.fit} />
        <GroupBar name="Edge" group={a.edge} />
      </div>

      <Bullets title="Why it fits" items={a.whyFits} icon={<CheckCircle2 size={14} color="#34d399" />} color="#34d399" />
      <Bullets title="Why it may not" items={a.whyMayNotFit} icon={<AlertTriangle size={14} color="#fbbf24" />} color="#fbbf24" />
      <Bullets title="Missing / hard requirements" items={a.missingRequirements} icon={<XCircle size={14} color="#f87171" />} color="#f87171" />
      <Bullets title="Competitive advantages" items={a.competitiveAdvantages} icon={<Award size={14} color="#60a5fa" />} color="#60a5fa" />

      {/* Proposal readiness */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <ListChecks size={14} /> Proposal readiness
          </span>
          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: barColor(a.proposalReadiness.percent) }}>{a.proposalReadiness.percent}%</span>
        </div>
        {a.proposalReadiness.missing.length > 0 && (
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Still need: {a.proposalReadiness.missing.join(', ')}.
          </p>
        )}
      </div>

      {/* Recommended action */}
      <div style={{ paddingTop: '0.4rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '0.2rem' }}>Recommended next action</p>
        <p style={{ fontSize: '0.9rem', lineHeight: 1.5 }}>{a.recommendedAction}</p>
      </div>
    </div>
  );
}
