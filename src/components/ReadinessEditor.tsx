'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Loader, Check } from 'lucide-react';

/**
 * Renders the proposal-readiness gaps ("Still need: …") as clickable chips.
 * Clicking one adds it to the agency profile (POST /api/profile/readiness) and
 * refreshes the route so the server re-runs computeAssessment — the readiness %
 * and the overall match score adjust in place.
 */
export default function ReadinessEditor({ missing }: { missing: string[] }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [done, setDone] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  if (!missing.length) return null;

  const add = async (item: string) => {
    if (pending) return;
    setPending(item);
    setError(null);
    try {
      const res = await fetch('/api/profile/readiness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Could not save.');
      }
      setDone((d) => [...d, item]);
      // Re-run server assessment so the score reflects the new readiness item.
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setPending(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
        Add what you have on file — your score updates and it&apos;s saved to your profile:
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
        {missing.map((item) => {
          const isDone = done.includes(item);
          const isPending = pending === item;
          return (
            <button
              key={item}
              onClick={() => add(item)}
              disabled={isDone || isPending}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                fontSize: '0.78rem',
                fontWeight: 600,
                padding: '0.25rem 0.6rem',
                borderRadius: 999,
                cursor: isDone ? 'default' : 'pointer',
                border: isDone ? '1px solid var(--accent-secondary)' : '1px dashed var(--border-color)',
                background: isDone ? 'var(--accent-secondary-soft, rgba(54,242,166,0.15))' : 'transparent',
                color: isDone ? 'var(--accent-secondary)' : 'var(--text-secondary)',
              }}
            >
              {isDone ? <Check size={12} /> : isPending ? <Loader size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Plus size={12} />}
              {item}
            </button>
          );
        })}
      </div>
      {error && <span style={{ fontSize: '0.78rem', color: '#ef4444' }}>{error}</span>}
    </div>
  );
}
