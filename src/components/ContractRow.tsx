'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Plus, Globe, MapPin } from 'lucide-react';
import type { OpportunityAssessment, MatchLabel } from '@/lib/assessment';
import OpportunityAssessmentCard from '@/components/OpportunityAssessmentCard';

interface ContractRowProps {
  opp: {
    id: string | number;
    title: string;
    agency: string;
    description?: string;
    descriptionUrl?: string | null;
    value: string;
    estimatedValue?: number | null;
    naicsCode?: string;
    pscCode?: string;
    setAsideType?: string;
    placeOfPerformance?: string;
    responseDeadline?: string | number | Date;
    sourceUrl?: string;
    assessment: OpportunityAssessment;
  };
}

const labelChip: Record<MatchLabel, { bg: string; fg: string }> = {
  'Strong Match': { bg: 'rgba(16,185,129,0.2)', fg: '#34d399' },
  'Good Match': { bg: 'rgba(59,130,246,0.2)', fg: '#60a5fa' },
  'Possible Match': { bg: 'rgba(245,158,11,0.2)', fg: '#fbbf24' },
  'Weak Match': { bg: 'rgba(239,68,68,0.2)', fg: '#f87171' },
};

export default function ContractRow({ opp }: ContractRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [added, setAdded] = useState(false);
  const [fullDescription, setFullDescription] = useState<string | null>(null);
  const [descLoading, setDescLoading] = useState(false);

  const a = opp.assessment;
  const chip = labelChip[a.label];

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    setAdded(true);
  };

  const loadFullDescription = async () => {
    if (!opp.descriptionUrl || fullDescription) return;
    setDescLoading(true);
    try {
      const res = await fetch('/api/opportunity/description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ descriptionUrl: opp.descriptionUrl }),
      });
      const data = await res.json();
      if (data?.description) setFullDescription(data.description as string);
    } catch {
      /* keep synthesized summary */
    } finally {
      setDescLoading(false);
    }
  };

  const toggleExpand = () => {
    const isExpanding = !expanded;
    setExpanded(isExpanding);
    if (isExpanding) void loadFullDescription();
  };

  return (
    <div
      className="glass-panel"
      style={{
        padding: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        border: expanded ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
        background: expanded ? 'rgba(59, 130, 246, 0.05)' : 'rgba(255, 255, 255, 0.03)',
      }}
      onClick={toggleExpand}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            <h3 style={{ fontSize: '1.25rem' }}>{opp.title}</h3>
            {/* Always-visible match score + label */}
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.95rem', fontWeight: 700, color: chip.fg }}>{a.matchScore}%</span>
              <span style={{ padding: '0.2rem 0.5rem', borderRadius: 999, fontSize: '0.7rem', fontWeight: 600, background: chip.bg, color: chip.fg }}>
                {a.label}
              </span>
            </span>
          </div>
          <p style={{ color: 'var(--text-secondary)' }}>
            {opp.agency} &bull; Est. Value: {opp.value}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.15rem' }}>
            {a.remoteEligible && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.7rem', fontWeight: 600, padding: '0.15rem 0.45rem', borderRadius: 4, background: 'rgba(16,185,129,0.15)', color: '#34d399' }}>
                <Globe size={11} /> Remote eligible
              </span>
            )}
            {typeof a.distanceMiles === 'number' && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.7rem', padding: '0.15rem 0.45rem', borderRadius: 4, background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)' }}>
                <MapPin size={11} /> ~{a.distanceMiles} mi
              </span>
            )}
            {a.whyFits.slice(0, 2).map((r) => (
              <span key={r} style={{ fontSize: '0.7rem', padding: '0.15rem 0.45rem', borderRadius: 4, background: 'rgba(59,130,246,0.12)', color: 'var(--accent-primary)' }}>
                {r.length > 40 ? r.slice(0, 38) + '…' : r}
              </span>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexShrink: 0 }}>
          <button
            className={`btn ${added ? 'btn-secondary' : 'btn-primary'}`}
            onClick={handleAdd}
            disabled={added}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem' }}
          >
            {added ? 'In Pipeline' : <><Plus size={16} /> Add to Pipeline</>}
          </button>
          <div style={{ color: 'var(--text-muted)' }}>
            {expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </div>
        </div>
      </div>

      {expanded && (
        <div
          style={{
            marginTop: '1.5rem',
            paddingTop: '1.5rem',
            borderTop: '1px solid rgba(255,255,255,0.1)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            animation: 'fadeIn 0.3s ease',
          }}
        >
          {/* Full deterministic assessment */}
          <OpportunityAssessmentCard a={a} />

          {/* Description */}
          <div>
            <h4 style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
              Description {descLoading && <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>· loading full text…</span>}
            </h4>
            <p style={{ fontSize: '0.95rem', lineHeight: '1.5', whiteSpace: 'pre-line' }}>
              {fullDescription || opp.description || 'No description text was available for this opportunity.'}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
            <div>
              <h4 style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>NAICS Code</h4>
              <p style={{ fontSize: '0.95rem' }}>{opp.naicsCode || 'N/A'}</p>
            </div>
            <div>
              <h4 style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Set-Aside</h4>
              <p style={{ fontSize: '0.95rem' }}>{opp.setAsideType || 'None'}</p>
            </div>
            {opp.placeOfPerformance && (
              <div>
                <h4 style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Location</h4>
                <p style={{ fontSize: '0.95rem' }}>{opp.placeOfPerformance}</p>
              </div>
            )}
            <div>
              <h4 style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Due Date</h4>
              <p style={{ fontSize: '0.95rem' }}>
                {opp.responseDeadline ? new Date(opp.responseDeadline).toLocaleDateString() : 'TBD'}
              </p>
            </div>
          </div>

          {opp.sourceUrl && (
            <a href={opp.sourceUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
              style={{ fontSize: '0.85rem', color: 'var(--accent-primary)' }}>
              View full solicitation on SAM.gov →
            </a>
          )}
        </div>
      )}
    </div>
  );
}
