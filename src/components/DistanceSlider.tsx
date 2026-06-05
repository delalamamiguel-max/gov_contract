'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { MapPin } from 'lucide-react';

/**
 * Distance/radius filter for opportunity search. Range 0–100 miles, defaults
 * from the agency's onboarding radius. Updating it sets ?radius= in the URL
 * (debounced) so the server re-ranks/filters results.
 */
export default function DistanceSlider({ defaultRadius = 50 }: { defaultRadius?: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const initial = (() => {
    const p = searchParams.get('radius');
    const n = p ? parseInt(p, 10) : defaultRadius;
    return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : defaultRadius;
  })();

  const [radius, setRadius] = useState(initial);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const commit = (value: number) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('radius', String(value));
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }, 350);
  };

  return (
    <div
      className="glass-panel"
      style={{
        padding: '1rem 1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        minWidth: 260,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          <MapPin size={15} /> Distance
        </span>
        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--accent-primary)' }}>
          {radius === 100 ? '100+ mi' : `${radius} mi`}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={radius}
        onChange={(e) => {
          const v = Number(e.target.value);
          setRadius(v);
          commit(v);
        }}
        style={{ width: '100%', accentColor: 'var(--accent-primary)' }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
        <span>On-site only</span>
        <span>Statewide+</span>
      </div>
    </div>
  );
}
