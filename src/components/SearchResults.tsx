'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Layers } from 'lucide-react';
import ContractRow from '@/components/ContractRow';
import type { OpportunityAssessment } from '@/lib/assessment';
import type { ProposalChecklist } from '@/lib/checklist';

// ---------------------------------------------------------------------------
// SearchResults — client component that renders the split top/other sections
// and manages the "Show all" toggle state. The server page passes two
// pre-sorted arrays (highest score first within each group); this component
// only handles show/hide — no re-sorting, no data fetching.
// ---------------------------------------------------------------------------

export interface SearchResult {
  id: string | number;
  source?: string | null;
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
  checklist: ProposalChecklist;
}

interface SearchResultsProps {
  topResults: SearchResult[];    // matchScore ≥ 60, sorted highest-first
  otherResults: SearchResult[];  // matchScore < 60, sorted highest-first
  radius: number;
}

export default function SearchResults({ topResults, otherResults, radius }: SearchResultsProps) {
  const [showOther, setShowOther] = useState(false);

  if (topResults.length === 0 && otherResults.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* ── Top matches ─────────────────────────────────────────────────── */}
      {topResults.length > 0 && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Top matches</h2>
            <span style={{
              fontSize: '0.72rem', fontWeight: 600,
              color: 'var(--accent-primary)',
              background: 'rgba(26,169,201,0.15)',
              padding: '0.15rem 0.5rem', borderRadius: 999,
            }}>
              {topResults.length}
            </span>
          </div>
          <div style={{ display: 'grid', gap: '1rem' }}>
            {topResults.map((opp) => (
              <ContractRow key={opp.id} opp={opp} radius={radius} />
            ))}
          </div>
        </section>
      )}

      {/* ── Show all / Other matches ─────────────────────────────────────── */}
      {otherResults.length > 0 && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {!showOther ? (
            <button
              onClick={() => setShowOther(true)}
              className="btn btn-secondary"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: '0.5rem', padding: '0.65rem 1.25rem',
                fontSize: '0.88rem', width: '100%',
              }}
            >
              <ChevronDown size={15} />
              Show all {otherResults.length} more {otherResults.length === 1 ? 'opportunity' : 'opportunities'}
            </button>
          ) : (
            <>
              <div style={{
                paddingTop: '1rem',
                borderTop: '1px dashed var(--border-color)',
                display: 'flex', flexDirection: 'column', gap: '1rem',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Layers size={16} color="var(--text-muted)" />
                  <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Other opportunities
                  </h2>
                  <span style={{
                    fontSize: '0.72rem', fontWeight: 600,
                    color: 'var(--text-muted)',
                    background: 'var(--border-color)',
                    padding: '0.15rem 0.5rem', borderRadius: 999,
                  }}>
                    {otherResults.length}
                  </span>
                </div>
                <p style={{ fontSize: '0.83rem', color: 'var(--text-muted)', marginTop: '-0.5rem' }}>
                  Lower match scores — worth a look if you want to broaden your pipeline.
                </p>
                <div style={{ display: 'grid', gap: '1rem', opacity: 0.85 }}>
                  {otherResults.map((opp) => (
                    <ContractRow key={opp.id} opp={opp} radius={radius} />
                  ))}
                </div>
                <button
                  onClick={() => setShowOther(false)}
                  className="btn btn-secondary"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    gap: '0.5rem', padding: '0.5rem 1rem',
                    fontSize: '0.83rem', alignSelf: 'center',
                  }}
                >
                  <ChevronUp size={14} /> Collapse
                </button>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}
