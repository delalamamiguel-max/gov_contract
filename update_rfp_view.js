const fs = require('fs');
const code = `'use client';

import React from 'react';
import { Target, FileText, CheckCircle, AlertTriangle, ListChecks, Clock, DollarSign, BookOpen, Link } from 'lucide-react';
import type { RfpAssessment, RfpRecommendation } from '@/lib/rfp';

const recColor: Record<RfpRecommendation, { bg: string; fg: string }> = {
  'Pursue': { bg: 'rgba(16,185,129,0.18)', fg: '#34d399' },
  'Pursue if gaps are resolved': { bg: 'rgba(59,130,246,0.18)', fg: '#60a5fa' },
  'Save for later': { bg: 'rgba(245,158,11,0.18)', fg: '#fbbf24' },
  'Pass': { bg: 'rgba(239,68,68,0.18)', fg: '#f87171' },
};

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        {icon} {title}
      </p>
      {children}
    </div>
  );
}

function List({ items }: { items: string[] }) {
  if (!items || items.length === 0) return <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)' }}>None specified</p>;
  return (
    <ul style={{ margin: 0, paddingLeft: '1.1rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
      {items.map((s, i) => <li key={i} style={{ fontSize: '0.86rem', lineHeight: 1.45 }}>{s}</li>)}
    </ul>
  );
}

export default function RfpAssessmentView({ a }: { a: RfpAssessment }) {
  const rc = recColor[a.recommendation] || recColor['Pass'];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Recommendation banner */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', background: rc.bg, borderRadius: 8, padding: '0.75rem 1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Target size={18} color={rc.fg} />
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Recommendation</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 700, color: rc.fg }}>{a.recommendation}</div>
            </div>
          </div>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: rc.fg }}>{a.matchScore}% match</span>
        </div>
        <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{a.recommendationRationale}</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
        <Section icon={<FileText size={14} />} title="What this is">
          <p style={{ fontSize: '0.88rem', lineHeight: 1.5 }}>{a.what_this_is}</p>
        </Section>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
        <Section icon={<CheckCircle size={14} color="#34d399" />} title="Why it fits">
          <List items={a.why_it_fits} />
        </Section>
        <Section icon={<AlertTriangle size={14} color="#f87171" />} title="Why it may not fit">
          <List items={a.why_it_may_not_fit} />
        </Section>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
        <Section icon={<ListChecks size={14} />} title="What is required to respond">
          <List items={a.what_is_required_to_respond} />
        </Section>
        <Section icon={<ListChecks size={14} color="#60a5fa" />} title="Checklist before you apply">
          <List items={a.checklist_before_you_apply} />
        </Section>
      </div>

      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Clock size={15} color="#fbbf24" />
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Deadline</div>
            <div style={{ fontSize: '0.86rem' }}>{a.deadline}</div>
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 220, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <DollarSign size={15} color="#60a5fa" />
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Amount or value</div>
            <div style={{ fontSize: '0.86rem' }}>{a.amount_or_value}</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
        <Section icon={<AlertTriangle size={14} color="#fbbf24" />} title="Important watchouts">
          <List items={a.important_watchouts} />
        </Section>
        <Section icon={<BookOpen size={14} />} title="Recommended supporting materials">
          <List items={a.recommended_supporting_materials} />
        </Section>
      </div>

      <Section icon={<Link size={14} />} title="Source documents used">
        <List items={a.source_documents_used} />
      </Section>

      {a.source === 'fallback' && (
        <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Narrative generated from a rules-based template (AI unavailable).</p>
      )}
    </div>
  );
}
`;
fs.writeFileSync('src/components/RfpAssessmentView.tsx', code);
