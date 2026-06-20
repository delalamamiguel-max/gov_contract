'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Plus, Globe, MapPin, Wand2 } from 'lucide-react';
import type { OpportunityAssessment, MatchLabel } from '@/lib/assessment';
import type { ProposalChecklist as Checklist } from '@/lib/checklist';
import type { RfpAssessment } from '@/lib/rfp';
import OpportunityAssessmentCard from '@/components/OpportunityAssessmentCard';
import ProposalChecklist from '@/components/ProposalChecklist';
import RfpAssessmentView from '@/components/RfpAssessmentView';
import FeedbackQuestionnaire from '@/components/FeedbackQuestionnaire';

type Tab = 'assessment' | 'readiness' | 'rfp' | 'attachments';

interface ContractRowProps {
  radius?: number;
  opp: {
    id: string | number;
    source?: string | null;
    status?: string | null;
    title: string;
    agency: string;
    description?: string;
    descriptionUrl?: string | null;
    value: string;
    estimatedValue?: number | null;
    naicsCode?: string | null;
    pscCode?: string | null;
    setAsideType?: string | null;
    placeOfPerformance?: string | null;
    responseDeadline?: string | number | Date | null;
    sourceUrl?: string | null;
    assessment: OpportunityAssessment;
    checklist: Checklist;
    raw?: any; // To access unmapped scraper payload like attachments
  };
}

/** Human label for the "view full solicitation" link, by ingestion source. */
const sourceLinkLabel: Record<string, string> = {
  'sam.gov': 'View on SAM.gov',
  caleprocure: 'View on Cal eProcure',
  'dgs-ncb': 'View on CA DGS',
  caltrans: 'View Dataset (data.ca.gov)',
};

const labelChip: Record<MatchLabel, { bg: string; fg: string }> = {
  'Strong Match': { bg: 'rgba(16,185,129,0.2)', fg: '#34d399' },
  'Good Match': { bg: 'rgba(26,169,201,0.18)', fg: '#1AA9C9' },
  'Possible Match': { bg: 'rgba(245,158,11,0.2)', fg: '#fbbf24' },
  'Weak Match': { bg: 'rgba(239,68,68,0.2)', fg: '#f87171' },
};

export default function ContractRow({ opp, radius = 50 }: ContractRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [added, setAdded] = useState(false);
  const [fullDescription, setFullDescription] = useState<string | null>(null);
  const [descLoading, setDescLoading] = useState(false);
  const [tab, setTab] = useState<Tab>('assessment');
  const [rfp, setRfp] = useState<RfpAssessment | null>(null);
  const [rfpLoading, setRfpLoading] = useState(false);
  const [rfpError, setRfpError] = useState<string | null>(null);

  const a = opp.assessment;
  const chip = labelChip[a.label];

  const runRfp = async () => {
    if (rfp || rfpLoading) return;
    setRfpLoading(true);
    setRfpError(null);
    try {
      const res = await fetch('/api/rfp-assessment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          radius,
          opportunity: {
            title: opp.title,
            description: fullDescription || opp.description || null,
            agency: opp.agency,
            setAsideType: opp.setAsideType || null,
            naicsCode: opp.naicsCode || null,
            estimatedValue: opp.estimatedValue ?? null,
            responseDeadline: opp.responseDeadline ? new Date(opp.responseDeadline).toISOString() : null,
            placeOfPerformance: opp.placeOfPerformance || null,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not generate the RFP assessment.');
      setRfp(data as RfpAssessment);
    } catch (err: unknown) {
      setRfpError(err instanceof Error ? err.message : 'RFP assessment failed.');
    } finally {
      setRfpLoading(false);
    }
  };

  const selectTab = (t: Tab) => {
    setTab(t);
    if (t === 'rfp') void runRfp();
  };

  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const handleAdd = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (added || adding) return;
    setAdding(true);
    setAddError(null);
    try {
      const res = await fetch('/api/pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: String(opp.id),
          title: opp.title,
          agency: opp.agency,
          value: opp.value,
          source: opp.source ?? null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Could not add to pipeline.');
      }
      setAdded(true);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Could not add to pipeline.');
    } finally {
      setAdding(false);
    }
  };

  const loadFullDescription = async () => {
    if (!opp.descriptionUrl || fullDescription) return;
    setDescLoading(true);
    try {
      const res = await fetch('/api/opportunity/description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ descriptionUrl: opp.descriptionUrl, sourceId: String(opp.id) }),
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
        border: expanded
          ? '1px solid var(--accent-primary)'
          : a.matchScore < 50
          ? '1px solid rgba(239,68,68,0.35)'
          : '1px solid var(--border-color)',
        borderLeft: !expanded && a.matchScore < 50 ? '3px solid #ef4444' : undefined,
        background: expanded ? 'rgba(26, 169, 201, 0.06)' : 'rgba(42, 51, 61, 0.03)',
      }}
      onClick={toggleExpand}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            <h3 style={{ fontSize: '1.25rem' }}>{opp.title}</h3>
            {/* Always-visible match score + label */}
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              {expanded && <span style={{ fontSize: '0.95rem', fontWeight: 700, color: chip.fg }}>{a.matchScore}%</span>}
              <span style={{ padding: '0.2rem 0.5rem', borderRadius: 999, fontSize: '0.7rem', fontWeight: 600, background: chip.bg, color: chip.fg }}>
                {a.label}
              </span>
              {a.kimiReason && (
                <span
                  title={`AI review: ${a.kimiReason}`}
                  style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--accent-primary)' }}
                >
                  <Wand2 size={13} />
                </span>
              )}
              {opp.status === 'planned' && (
                <span
                  title="Upcoming opportunity — not yet open for bids. Prepare early."
                  style={{ padding: '0.2rem 0.5rem', borderRadius: 999, fontSize: '0.7rem', fontWeight: 600, background: 'rgba(148,163,184,0.18)', color: 'var(--text-muted)' }}
                >
                  Upcoming
                </span>
              )}
            </span>
          </div>
          <p style={{ color: 'var(--text-secondary)' }}>
            {opp.agency} &bull; Est. Value: {opp.value} &bull; Due: {opp.responseDeadline ? new Date(opp.responseDeadline).toLocaleDateString() : 'TBD'}
          </p>
          {/* Brief gist shown on unexpanded card */}
          {!expanded && (a.kimiReason || opp.description) && (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0.3rem 0', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {a.kimiReason ? (
                <span><strong style={{color: 'var(--accent-primary)'}}>AI Note:</strong> {a.kimiReason}</span>
              ) : (
                <span>{opp.description?.substring(0, 150)}...</span>
              )}
            </p>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.15rem' }}>
            {a.remoteEligible && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.7rem', fontWeight: 600, padding: '0.15rem 0.45rem', borderRadius: 4, background: 'rgba(16,185,129,0.15)', color: '#34d399' }}>
                <Globe size={11} /> Remote eligible
              </span>
            )}
            {typeof a.distanceMiles === 'number' && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.7rem', padding: '0.15rem 0.45rem', borderRadius: 4, background: 'rgba(42, 51, 61,0.05)', color: 'var(--text-muted)' }}>
                <MapPin size={11} /> ~{a.distanceMiles} mi
              </span>
            )}
            {a.whyFits.slice(0, 2).map((r) => (
              <span key={r} style={{ fontSize: '0.7rem', padding: '0.15rem 0.45rem', borderRadius: 4, background: 'rgba(26,169,201,0.12)', color: 'var(--accent-primary)' }}>
                {r.length > 40 ? r.slice(0, 38) + '…' : r}
              </span>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexShrink: 0 }}>
          <button
            className={`btn ${added ? 'btn-secondary' : 'btn-primary'}`}
            onClick={handleAdd}
            disabled={added || adding}
            title={addError || undefined}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem' }}
          >
            {added ? 'In Pipeline' : adding ? 'Adding…' : <><Plus size={16} /> Add to Pipeline</>}
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
            borderTop: '1px solid rgba(42, 51, 61,0.1)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            animation: 'fadeIn 0.3s ease',
          }}
        >
          {/* Tabs */}
          <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid rgba(42, 51, 61,0.08)' }} onClick={(e) => e.stopPropagation()}>
            {([['assessment', 'Assessment'], ['readiness', 'Proposal Readiness'], ['rfp', 'RFP Workflow'], ['attachments', 'Attachments']] as [Tab, string][]).map(([key, label]) => (
              <button
                key={key}
                onClick={() => selectTab(key)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  borderBottom: tab === key ? '2px solid var(--accent-primary)' : '2px solid transparent',
                  color: tab === key ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  padding: '0.5rem 0.25rem',
                  cursor: 'pointer',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div onClick={(e) => e.stopPropagation()}>
            {tab === 'assessment' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {a.kimiReason && (
                  <div style={{
                    display: 'flex', alignItems: 'flex-start', gap: '0.5rem',
                    padding: '0.6rem 0.75rem', borderRadius: 8,
                    background: 'rgba(26,169,201,0.08)',
                    border: '1px solid rgba(26,169,201,0.2)',
                    fontSize: '0.82rem', color: 'var(--text-secondary)',
                  }}>
                    <Wand2 size={13} style={{ color: 'var(--accent-primary)', flexShrink: 0, marginTop: 2 }} />
                    <span><strong style={{ color: 'var(--accent-primary)' }}>AI review note:</strong> {a.kimiReason}</span>
                  </div>
                )}
                <OpportunityAssessmentCard a={a} />
              </div>
            )}
            {tab === 'readiness' && <ProposalChecklist checklist={opp.checklist} />}
            {tab === 'rfp' && (
              rfpLoading ? (
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', padding: '0.5rem 0' }}>
                  Generating RFP assessment…
                </p>
              ) : rfpError ? (
                <div style={{ padding: '0.75rem', background: 'rgba(239,68,68,0.08)', borderRadius: 8, borderLeft: '3px solid #f87171', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.88rem', color: '#f87171' }}>{rfpError}</span>
                  <button className="btn btn-secondary" style={{ alignSelf: 'flex-start', padding: '0.4rem 0.8rem' }} onClick={() => { setRfp(null); void runRfp(); }}>Retry</button>
                </div>
              ) : rfp ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <RfpAssessmentView a={rfp} />
                  <FeedbackQuestionnaire noticeId={String(opp.id)} opportunityTitle={opp.title} />
                </div>
              ) : null
            )}
            {tab === 'attachments' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {opp.raw?.attachments && Array.isArray(opp.raw.attachments) && opp.raw.attachments.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {opp.raw.attachments.map((att: any, idx: number) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(26,169,201,0.06)', padding: '0.75rem', borderRadius: 8, border: '1px solid rgba(26,169,201,0.2)' }}>
                        <a href={att.url} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 600, color: 'var(--accent-primary)', textDecoration: 'none', wordBreak: 'break-all' }}>
                          {att.name || 'Attachment'}
                        </a>
                        {att.description && <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>- {att.description}</span>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', padding: '0.5rem 0' }}>
                    No attachments were found for this opportunity. Note: they might take a few hours to sync.
                  </p>
                )}
              </div>
            )}
          </div>

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
              {(opp.source && sourceLinkLabel[opp.source]) || 'View full solicitation'} →
            </a>
          )}
        </div>
      )}
    </div>
  );
}
