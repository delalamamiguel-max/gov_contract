'use client';

import React from 'react';
import { Clock, Gauge, Award, AlertTriangle, FileText, HelpCircle, Target } from 'lucide-react';
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
  return (
    <ul style={{ margin: 0, paddingLeft: '1.1rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
      {items.map((s, i) => <li key={i} style={{ fontSize: '0.86rem', lineHeight: 1.45 }}>{s}</li>)}
    </ul>
  );
}

export default function RfpAssessmentView({ a }: { a: RfpAssessment }) {
  const rc = recColor[a.recommendation];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Recommendation banner */}
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

      <Section icon={<FileText size={14} />} title="Opportunity summary">
        <p style={{ fontSize: '0.88rem', lineHeight: 1.5 }}>{a.summary}</p>
      </Section>

      <Section icon={<Target size={14} />} title="Scope requirements"><List items={a.scopeRequirements} /></Section>

      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <Section icon={<FileText size={14} />} title="Required documents"><List items={a.requiredDocuments} /></Section>
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <Section icon={<AlertTriangle size={14} />} title="Eligibility requirements"><List items={a.eligibilityRequirements} /></Section>
        </div>
      </div>

      <Section icon={<Gauge size={14} />} title="Evaluation criteria"><List items={a.evaluationCriteria} /></Section>

      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Clock size={15} color="#fbbf24" />
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Deadline</div>
            <div style={{ fontSize: '0.86rem' }}>{a.deadlineUrgency}</div>
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 220, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Gauge size={15} color="#60a5fa" />
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Estimated effort</div>
            <div style={{ fontSize: '0.86rem' }}>{a.estimatedEffort}</div>
          </div>
        </div>
      </div>

      <Section icon={<AlertTriangle size={14} />} title="Risks / blockers"><List items={a.risks} /></Section>
      <Section icon={<Award size={14} />} title="Competitive advantages"><List items={a.competitiveAdvantages} /></Section>
      <Section icon={<HelpCircle size={14} />} title="Questions to ask the buyer"><List items={a.questionsForBuyer} /></Section>

      {a.source === 'fallback' && (
        <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Narrative generated from a rules-based template (AI unavailable).</p>
      )}
    </div>
  );
}
