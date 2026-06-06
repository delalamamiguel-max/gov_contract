'use client';

import React from 'react';
import { CheckCircle2, AlertTriangle, Circle, HelpCircle } from 'lucide-react';
import type { ProposalChecklist as Checklist, ItemStatus } from '@/lib/checklist';

const statusMeta: Record<ItemStatus, { color: string; icon: React.ReactNode; label: string }> = {
  have: { color: '#34d399', icon: <CheckCircle2 size={15} color="#34d399" />, label: 'Have' },
  required: { color: '#f87171', icon: <AlertTriangle size={15} color="#f87171" />, label: 'Required' },
  missing: { color: '#fbbf24', icon: <Circle size={15} color="#fbbf24" />, label: 'Missing' },
  verify: { color: '#60a5fa', icon: <HelpCircle size={15} color="#60a5fa" />, label: 'Verify' },
};

export default function ProposalChecklist({ checklist }: { checklist: Checklist }) {
  const { summary } = checklist;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Readiness header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h4 style={{ fontSize: '0.95rem', fontWeight: 600 }}>Proposal Readiness Checklist</h4>
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          <Tag color="#34d399" text={`${summary.have} have`} />
          <Tag color="#fbbf24" text={`${summary.missing} missing`} />
          <Tag color="#f87171" text={`${summary.required} required`} />
          <Tag color="#60a5fa" text={`${summary.verify} verify`} />
        </div>
      </div>

      {/* Readiness bar */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
          <span>Ready</span><span>{summary.percentReady}%</span>
        </div>
        <div style={{ height: 6, background: 'rgba(42, 51, 61,0.08)', borderRadius: 999 }}>
          <div style={{ height: '100%', width: `${summary.percentReady}%`, background: '#34d399', borderRadius: 999 }} />
        </div>
      </div>

      {/* Groups */}
      {checklist.groups.map((g) => (
        <div key={g.name}>
          <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>{g.name}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {g.items.map((item, i) => {
              const m = statusMeta[item.status];
              return (
                <div key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                  <span style={{ marginTop: 2, flexShrink: 0 }}>{m.icon}</span>
                  <div style={{ minWidth: 0 }}>
                    <span style={{ fontSize: '0.88rem' }}>{item.label}</span>
                    <span style={{ fontSize: '0.72rem', color: m.color, marginLeft: '0.4rem', fontWeight: 600 }}>{m.label}</span>
                    {item.detail && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{item.detail}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Recommended steps */}
      {checklist.recommendedSteps.length > 0 && (
        <div style={{ paddingTop: '0.5rem', borderTop: '1px solid rgba(42, 51, 61,0.08)' }}>
          <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>Recommended next steps</p>
          <ol style={{ margin: 0, paddingLeft: '1.1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {checklist.recommendedSteps.map((s, i) => (
              <li key={i} style={{ fontSize: '0.85rem', lineHeight: 1.45 }}>{s}</li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function Tag({ color, text }: { color: string; text: string }) {
  return (
    <span style={{ fontSize: '0.7rem', fontWeight: 600, color, background: `${color}22`, padding: '0.15rem 0.45rem', borderRadius: 999 }}>
      {text}
    </span>
  );
}
