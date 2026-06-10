'use client';

// ---------------------------------------------------------------------------
// /en/onboarding/payoff — the teaser / payoff screen.
//
// Reads the onboarding session from localStorage, fetches a single top-match
// teaser from /api/onboarding-teaser, and renders a blurred preview card with
// a "Create free account" CTA. No auth required.
// ---------------------------------------------------------------------------

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import Link from 'next/link';
import { Lock, Zap, ChevronRight, Sparkles } from 'lucide-react';
import { loadSession } from '@/lib/onboardingSession';
import BidFlareLogo from '@/components/BidFlareLogo';

interface TeaserData {
  found: boolean;
  title?: string;
  agency?: string;
  matchScore?: number;
  label?: string;
  deadline?: string | null;
  estimatedValue?: string | null;
  totalFound?: number;
  reason?: string;
}

function ScoreChip({ score, label }: { score: number; label: string }) {
  const color =
    score >= 80 ? '#34d399' :
    score >= 60 ? 'var(--accent-primary)' :
    score >= 40 ? '#f59e0b' : '#ef4444';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
      padding: '0.25rem 0.65rem', borderRadius: 999,
      background: `${color}22`, border: `1px solid ${color}44`,
      color, fontWeight: 700, fontSize: '0.8rem',
    }}>
      <Sparkles size={11} />
      {score}% · {label}
    </span>
  );
}

function SkeletonCard() {
  return (
    <div className="glass-panel" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {[180, 120, 80].map((w) => (
        <div key={w} style={{
          height: 16, width: w, borderRadius: 8,
          background: 'linear-gradient(90deg, var(--border-color) 25%, rgba(42,51,61,0.04) 50%, var(--border-color) 75%)',
          backgroundSize: '400% 100%',
          animation: 'shimmer 1.4s ease infinite',
        }} />
      ))}
      <style>{`@keyframes shimmer { 0%{background-position:100% 0} 100%{background-position:-100% 0} }`}</style>
    </div>
  );
}

export default function PayoffPage() {
  const router = useRouter();
  const locale = useLocale();
  const [teaser, setTeaser] = useState<TeaserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const session = loadSession();
    if (!session) {
      // No session → restart the flow
      router.replace(`/${locale}/onboarding`);
      return;
    }

    const encoded = Buffer.from(JSON.stringify(session)).toString('base64url');
    fetch(`/api/onboarding-teaser?data=${encoded}`)
      .then((r) => r.json())
      .then((data: TeaserData) => {
        setTeaser(data);
        setLoading(false);
      })
      .catch(() => {
        setTeaser({ found: false, reason: 'fetch_error' });
        setLoading(false);
      });
  }, [locale, router]);

  return (
    <div style={{
      display: 'flex', minHeight: '100vh', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '3rem 1.5rem 6rem',
    }}>
      {/* Logo */}
      <div style={{ marginBottom: '2.5rem' }}>
        <BidFlareLogo height={34} />
      </div>

      <div style={{ maxWidth: 560, width: '100%', display: 'flex', flexDirection: 'column', gap: '1.75rem', textAlign: 'center' }}>

        {/* Headline */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <Zap size={20} color="var(--accent-primary)" />
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              Your results are ready
            </span>
          </div>
          <h1 style={{ fontSize: '2rem', fontWeight: 700, lineHeight: 1.2, letterSpacing: '-0.02em' }}>
            We found opportunities<br />that fit your agency.
          </h1>
          {!loading && teaser?.found && teaser.totalFound && (
            <p style={{ marginTop: '0.6rem', color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
              <strong style={{ color: 'var(--accent-primary)' }}>{teaser.totalFound} matching {teaser.totalFound === 1 ? 'opportunity' : 'opportunities'}</strong> scored against your profile.
            </p>
          )}
        </div>

        {/* Teaser card */}
        {loading ? (
          <SkeletonCard />
        ) : teaser?.found ? (
          <div className="glass-panel" style={{ padding: '1.75rem', textAlign: 'left', position: 'relative', overflow: 'hidden' }}>
            {/* Visible header */}
            <div style={{ marginBottom: '1rem' }}>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {teaser.agency ?? 'California Agency'}
              </p>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700, lineHeight: 1.3, marginBottom: '0.6rem' }}>
                {teaser.title}
              </h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                <ScoreChip score={teaser.matchScore!} label={teaser.label!} />
                {teaser.deadline && (
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', background: 'var(--border-color)', padding: '0.2rem 0.6rem', borderRadius: 999 }}>
                    {teaser.deadline}
                  </span>
                )}
                {teaser.estimatedValue && (
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', background: 'var(--border-color)', padding: '0.2rem 0.6rem', borderRadius: 999 }}>
                    {teaser.estimatedValue}
                  </span>
                )}
              </div>
            </div>

            {/* Blurred description area */}
            <div style={{ position: 'relative' }}>
              <div style={{
                filter: 'blur(5px)', userSelect: 'none', pointerEvents: 'none',
                fontSize: '0.88rem', lineHeight: 1.6, color: 'var(--text-secondary)',
              }}>
                This opportunity requires demonstrated experience in public communications
                and brand strategy. The selected agency will develop and execute a
                comprehensive outreach campaign targeting underserved communities. Prior
                government experience preferred. Minority and women-owned business
                certifications are a plus.
              </div>
              {/* Lock overlay */}
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexDirection: 'column', gap: '0.4rem',
              }}>
                <div style={{
                  background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(8px)',
                  border: '1px solid var(--border-color)', borderRadius: 10,
                  padding: '0.6rem 1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem',
                  fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)',
                }}>
                  <Lock size={13} /> Create a free account to see your full match list
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <p style={{ fontSize: '1rem' }}>We&apos;re still loading the latest California opportunities.</p>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
              Create your account now — your matches will be ready when you log in.
            </p>
          </div>
        )}

        {/* CTA */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'center' }}>
          <Link
            href={`/${locale}/signup`}
            className="btn btn-primary"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.95rem 2rem', fontSize: '1rem', fontWeight: 700,
              width: '100%', justifyContent: 'center',
            }}
          >
            See my full match list <ChevronRight size={18} />
          </Link>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Free to start. No credit card required.
          </p>
        </div>

        {/* Back link */}
        <Link href={`/${locale}/onboarding`} style={{ fontSize: '0.82rem', color: 'var(--text-muted)', textDecoration: 'none' }}>
          ← Edit my answers
        </Link>
      </div>
    </div>
  );
}
