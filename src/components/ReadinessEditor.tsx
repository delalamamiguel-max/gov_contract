'use client';

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Plus, Loader } from 'lucide-react';

/**
 * Standard readiness items (must match assessment.ts STANDARD_READINESS).
 * Shown as toggleable pills so the user can mark what they have / don't have.
 */
const ALL_ITEMS = [
  'Capability statement',
  'Case studies',
  'Portfolio',
  'References',
  'W-9',
  'Insurance certificates',
  'Rate card',
  'Proposal template',
] as const;

function barColor(score: number) {
  if (score >= 80) return '#0d9488';
  if (score >= 60) return '#1AA9C9';
  if (score >= 40) return '#d97706';
  return '#ef4444';
}

interface ReadinessEditorProps {
  /** Items the user already has (from assessment). */
  have: string[];
  /** Items the user still needs (from assessment). */
  missing: string[];
}

/**
 * Renders ALL proposal-readiness items as toggleable pills.
 * - Checked items can be unchecked (DELETE /api/profile/readiness).
 * - Unchecked items can be checked (POST /api/profile/readiness).
 * - Percentage updates live in local state without waiting for server refresh.
 */
export default function ReadinessEditor({ have, missing }: ReadinessEditorProps) {
  const router = useRouter();
  // Local state: items the user has. Start from server-computed `have` list.
  const [localHave, setLocalHave] = useState<Set<string>>(
    () => new Set(have.map((s) => s.toLowerCase()))
  );
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const totalItems = ALL_ITEMS.length;
  const checkedCount = ALL_ITEMS.filter((item) => localHave.has(item.toLowerCase())).length;
  const pct = Math.round((checkedCount / totalItems) * 100);

  const toggle = useCallback(
    async (item: string) => {
      if (pending) return;
      const lower = item.toLowerCase();
      const isRemoving = localHave.has(lower);

      setPending(item);
      setError(null);

      // Optimistic update
      setLocalHave((prev) => {
        const next = new Set(prev);
        if (isRemoving) next.delete(lower);
        else next.add(lower);
        return next;
      });

      try {
        const res = await fetch('/api/profile/readiness', {
          method: isRemoving ? 'DELETE' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ item }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Could not save.');
        }
        // Refresh so server re-computes scores in the background
        router.refresh();
      } catch (err) {
        // Roll back optimistic update
        setLocalHave((prev) => {
          const next = new Set(prev);
          if (isRemoving) next.add(lower);
          else next.delete(lower);
          return next;
        });
        setError(err instanceof Error ? err.message : 'Could not save.');
      } finally {
        setPending(null);
      }
    },
    [pending, localHave, router]
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {/* Header with live percentage */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
          Toggle what you have on file — your score updates live:
        </p>
        <span
          style={{
            fontSize: '0.85rem',
            fontWeight: 700,
            color: barColor(pct),
            minWidth: '2.5rem',
            textAlign: 'right',
          }}
        >
          {pct}%
        </span>
      </div>

      {/* Progress bar */}
      <div style={{ height: 5, background: 'rgba(42, 51, 61, 0.08)', borderRadius: 999 }}>
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            background: barColor(pct),
            borderRadius: 999,
            transition: 'width 0.3s ease, background 0.3s ease',
          }}
        />
      </div>

      {/* Toggleable pills */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.2rem' }}>
        {ALL_ITEMS.map((item) => {
          const isChecked = localHave.has(item.toLowerCase());
          const isPending = pending === item;

          return (
            <button
              key={item}
              onClick={() => toggle(item)}
              disabled={isPending}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                fontSize: '0.78rem',
                fontWeight: 600,
                padding: '0.3rem 0.65rem',
                borderRadius: 999,
                cursor: isPending ? 'wait' : 'pointer',
                border: isChecked
                  ? '1.5px solid #0d9488'
                  : '1.5px dashed var(--border-color)',
                background: isChecked
                  ? 'rgba(13, 148, 136, 0.12)'
                  : 'transparent',
                color: isChecked ? '#0f766e' : 'var(--text-secondary)',
                transition: 'all 0.2s ease',
              }}
            >
              {isPending ? (
                <Loader size={12} style={{ animation: 'spin 1s linear infinite' }} />
              ) : isChecked ? (
                <Check size={12} strokeWidth={3} />
              ) : (
                <Plus size={12} />
              )}
              {item}
            </button>
          );
        })}
      </div>

      {error && (
        <span style={{ fontSize: '0.78rem', color: '#ef4444' }}>{error}</span>
      )}
    </div>
  );
}
