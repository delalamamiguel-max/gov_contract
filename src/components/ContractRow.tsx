'use client';

import React, { useState } from 'react';
import { Zap, ChevronDown, ChevronUp, Plus, AlertTriangle, CheckCircle2, XCircle, Globe, MapPin } from 'lucide-react';

interface AgencyProfile {
  services?: string[];
  industries?: string[];
  certifications?: string[];
  location?: string | null;
  serviceRadiusMiles?: number | null;
  remotePreference?: 'local' | 'remote' | 'hybrid' | null;
  minContract?: number | null;
  maxContract?: number | null;
  keywords?: string[];
}

interface MatchAssessment {
  fitScore: number;
  label: 'Strong match' | 'Good match' | 'Possible match' | 'Weak match';
  matchSummary: string;
  whyFits: string[];
  whyMayNotFit: string[];
  missingRequirements: string[];
  recommendedAction: string;
  source: 'ai' | 'fallback';
}

interface ContractRowProps {
  opp: {
    id: string | number;
    title: string;
    agency: string;
    description?: string;
    descriptionUrl?: string | null;
    value: string;
    estimatedValue?: number | null;
    fit: number;
    match: string;
    naicsCode?: string;
    pscCode?: string;
    setAsideType?: string;
    placeOfPerformance?: string;
    responseDeadline?: string | number | Date;
    remoteEligible?: boolean;
    distanceMiles?: number | null;
    matchReasons?: string[];
  };
  agencyProfile?: AgencyProfile;
}

const labelColor = (label: string) =>
  label === 'Strong match'
    ? { bg: 'rgba(16,185,129,0.2)', fg: '#34d399' }
    : label === 'Good match'
    ? { bg: 'rgba(59,130,246,0.2)', fg: '#60a5fa' }
    : label === 'Possible match'
    ? { bg: 'rgba(245,158,11,0.2)', fg: '#fbbf24' }
    : { bg: 'rgba(239,68,68,0.2)', fg: '#f87171' };

export default function ContractRow({ opp, agencyProfile = {} }: ContractRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [added, setAdded] = useState(false);
  const [assessment, setAssessment] = useState<MatchAssessment | null>(null);
  const [isScoring, setIsScoring] = useState(false);
  const [scoreError, setScoreError] = useState<string | null>(null);
  const [fullDescription, setFullDescription] = useState<string | null>(null);
  const [descLoading, setDescLoading] = useState(false);

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
      // Silent — we already show the synthesized summary as a fallback.
    } finally {
      setDescLoading(false);
    }
  };

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    setAdded(true);
  };

  const runAssessment = async () => {
    setIsScoring(true);
    setScoreError(null);
    try {
      const res = await fetch('/api/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opportunity: {
            title: opp.title,
            description: opp.description || null,
            agency: opp.agency,
            naicsCode: opp.naicsCode || null,
            pscCode: opp.pscCode || null,
            setAsideType: opp.setAsideType || null,
            placeOfPerformance: opp.placeOfPerformance || null,
            estimatedValue: opp.estimatedValue ?? null,
          },
          agencyProfile,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to evaluate this opportunity.');
      setAssessment(data as MatchAssessment);
    } catch (err: unknown) {
      console.error(err);
      setScoreError(err instanceof Error ? err.message : 'Assessment failed.');
    } finally {
      setIsScoring(false);
    }
  };

  const toggleExpand = () => {
    const isExpanding = !expanded;
    setExpanded(isExpanding);
    if (isExpanding && !assessment && !isScoring) {
      void runAssessment();
      void loadFullDescription();
    }
  };

  const colors = assessment ? labelColor(assessment.label) : null;

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <h3 style={{ fontSize: '1.25rem' }}>{opp.title}</h3>
            {isScoring ? (
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Assessing fit…
              </span>
            ) : assessment && colors ? (
              <span
                style={{
                  padding: '0.25rem 0.5rem',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  background: colors.bg,
                  color: colors.fg,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                }}
              >
                <Zap size={12} /> {assessment.fitScore}% · {assessment.label}
              </span>
            ) : null}
          </div>
          <p style={{ color: 'var(--text-secondary)' }}>
            {opp.agency} &bull; Est. Value: {opp.value}
          </p>
          {/* Relevance badges */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.15rem' }}>
            {opp.remoteEligible && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.7rem', fontWeight: 600, padding: '0.15rem 0.45rem', borderRadius: 4, background: 'rgba(16,185,129,0.15)', color: '#34d399' }}>
                <Globe size={11} /> Remote eligible
              </span>
            )}
            {typeof opp.distanceMiles === 'number' && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.7rem', padding: '0.15rem 0.45rem', borderRadius: 4, background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)' }}>
                <MapPin size={11} /> ~{opp.distanceMiles} mi
              </span>
            )}
            {(opp.matchReasons || []).filter((r) => r !== 'Remote eligible').slice(0, 3).map((r) => (
              <span key={r} style={{ fontSize: '0.7rem', padding: '0.15rem 0.45rem', borderRadius: 4, background: 'rgba(59,130,246,0.12)', color: 'var(--accent-primary)' }}>
                {r}
              </span>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
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
          {/* ---- Opportunity Assessment: loading / error / result ---- */}
          {isScoring ? (
            <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                Generating your agency-specific opportunity assessment…
              </p>
            </div>
          ) : scoreError ? (
            <div
              style={{
                padding: '1rem',
                background: 'rgba(239,68,68,0.08)',
                borderRadius: '8px',
                borderLeft: '3px solid #f87171',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f87171' }}>
                <AlertTriangle size={16} />
                <strong style={{ fontSize: '0.875rem' }}>Couldn&apos;t generate the assessment</strong>
              </div>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{scoreError}</p>
              <button
                className="btn btn-secondary"
                style={{ alignSelf: 'flex-start', padding: '0.4rem 0.8rem' }}
                onClick={(e) => {
                  e.stopPropagation();
                  void runAssessment();
                }}
              >
                Retry
              </button>
            </div>
          ) : assessment ? (
            <div
              style={{
                padding: '1rem',
                background: 'rgba(59, 130, 246, 0.05)',
                borderRadius: '8px',
                borderLeft: '3px solid var(--accent-primary)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                <h4 style={{ fontSize: '0.875rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
                  Opportunity Assessment
                </h4>
                {assessment.source === 'fallback' && (
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    Quick estimate (AI unavailable)
                  </span>
                )}
              </div>
              <p style={{ fontSize: '0.95rem', lineHeight: '1.5' }}>{assessment.matchSummary}</p>

              {assessment.whyFits.length > 0 && (
                <div>
                  <p style={{ fontSize: '0.8rem', color: '#34d399', fontWeight: 600, marginBottom: '0.25rem' }}>
                    Why it fits
                  </p>
                  {assessment.whyFits.map((r, i) => (
                    <div key={i} style={{ display: 'flex', gap: '0.4rem', alignItems: 'flex-start', fontSize: '0.9rem' }}>
                      <CheckCircle2 size={14} color="#34d399" style={{ marginTop: 3, flexShrink: 0 }} />
                      <span>{r}</span>
                    </div>
                  ))}
                </div>
              )}

              {assessment.whyMayNotFit.length > 0 && (
                <div>
                  <p style={{ fontSize: '0.8rem', color: '#fbbf24', fontWeight: 600, marginBottom: '0.25rem' }}>
                    Why it may not
                  </p>
                  {assessment.whyMayNotFit.map((r, i) => (
                    <div key={i} style={{ display: 'flex', gap: '0.4rem', alignItems: 'flex-start', fontSize: '0.9rem' }}>
                      <AlertTriangle size={14} color="#fbbf24" style={{ marginTop: 3, flexShrink: 0 }} />
                      <span>{r}</span>
                    </div>
                  ))}
                </div>
              )}

              {assessment.missingRequirements.length > 0 && (
                <div>
                  <p style={{ fontSize: '0.8rem', color: '#f87171', fontWeight: 600, marginBottom: '0.25rem' }}>
                    Missing / to verify
                  </p>
                  {assessment.missingRequirements.map((r, i) => (
                    <div key={i} style={{ display: 'flex', gap: '0.4rem', alignItems: 'flex-start', fontSize: '0.9rem' }}>
                      <XCircle size={14} color="#f87171" style={{ marginTop: 3, flexShrink: 0 }} />
                      <span>{r}</span>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ paddingTop: '0.25rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '0.2rem' }}>
                  Recommended next action
                </p>
                <p style={{ fontSize: '0.9rem', lineHeight: '1.5' }}>{assessment.recommendedAction}</p>
              </div>
            </div>
          ) : null}

          {/* ---- Description ---- */}
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
            <div>
              <h4 style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Due Date</h4>
              <p style={{ fontSize: '0.95rem' }}>
                {opp.responseDeadline ? new Date(opp.responseDeadline).toLocaleDateString() : 'TBD'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
