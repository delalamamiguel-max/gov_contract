'use client';

import React, { useState } from 'react';
import { Zap, ChevronDown, ChevronUp, Plus } from 'lucide-react';

interface ContractRowProps {
  opp: {
    id: string | number;
    title: string;
    agency: string;
    value: string;
    fit: number;
    match: string;
  };
}

export default function ContractRow({ opp }: ContractRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [added, setAdded] = useState(false);
  const [fitScore, setFitScore] = useState<number | null>(null);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [isScoring, setIsScoring] = useState(false);

  const handleAdd = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setAdded(true);
    // Real implementation would save to DB
  };

  const toggleExpand = async () => {
    const isExpanding = !expanded;
    setExpanded(isExpanding);

    if (isExpanding && fitScore === null && !isScoring) {
      setIsScoring(true);
      try {
        const res = await fetch('/api/score', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contractTitle: opp.title,
            contractDescription: 'This is a federal contract opportunity requiring specific expertise...',
            businessNaics: ['541511', '541512'],
            businessCapacities: 'Up to $5M'
          })
        });
        const data = await res.json();
        setFitScore(data.fitScore || 0);
        setAiSummary(data.matchSummary || 'Analysis failed.');
      } catch (err) {
        console.error(err);
        setFitScore(0);
        setAiSummary('Failed to evaluate contract fit.');
      } finally {
        setIsScoring(false);
      }
    }
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
        background: expanded ? 'rgba(59, 130, 246, 0.05)' : 'rgba(255, 255, 255, 0.03)'
      }}
      onClick={toggleExpand}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h3 style={{ fontSize: '1.25rem' }}>{opp.title}</h3>
            {isScoring ? (
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Evaluating AI Fit...
              </span>
            ) : fitScore !== null ? (
              <span style={{
                padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600,
                background: fitScore > 80 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                color: fitScore > 80 ? '#34d399' : '#fbbf24',
                display: 'flex', alignItems: 'center', gap: '0.25rem'
              }}>
                <Zap size={12} /> {fitScore}% Fit Score
              </span>
            ) : null}
          </div>
          <p style={{ color: 'var(--text-secondary)' }}>{opp.agency} &bull; Est. Value: {opp.value}</p>
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

      {/* Expanded Content */}
      {expanded && (
        <div style={{ 
          marginTop: '1.5rem', 
          paddingTop: '1.5rem', 
          borderTop: '1px solid rgba(255,255,255,0.1)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          animation: 'fadeIn 0.3s ease'
        }}>
          {isScoring ? (
            <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Generating custom AI match analysis...</p>
            </div>
          ) : aiSummary ? (
            <div style={{ padding: '1rem', background: 'rgba(59, 130, 246, 0.05)', borderRadius: '8px', borderLeft: '3px solid var(--accent-primary)' }}>
              <h4 style={{ fontSize: '0.875rem', color: 'var(--accent-primary)', marginBottom: '0.25rem', fontWeight: 600 }}>AI Match Analysis</h4>
              <p style={{ fontSize: '0.95rem', lineHeight: '1.5' }}>{aiSummary}</p>
            </div>
          ) : null}

          <div>
            <h4 style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Description</h4>
            <p style={{ fontSize: '0.95rem', lineHeight: '1.5' }}>
              This is a mock description of the contract requirements. The vendor will be required to provide comprehensive services adhering to federal standards, maintaining security compliance, and delivering measurable milestones on a quarterly basis.
            </p>
          </div>
          
          <div style={{ display: 'flex', gap: '2rem' }}>
            <div>
              <h4 style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>NAICS Codes</h4>
              <p style={{ fontSize: '0.95rem' }}>{opp.naicsCode || '541511'}</p>
            </div>
            <div>
              <h4 style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Set-Aside</h4>
              <p style={{ fontSize: '0.95rem' }}>{opp.setAsideType || 'Total Small Business'}</p>
            </div>
            <div>
              <h4 style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Due Date</h4>
              <p style={{ fontSize: '0.95rem' }}>{opp.responseDeadline ? new Date(opp.responseDeadline).toLocaleDateString() : 'TBD'}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
