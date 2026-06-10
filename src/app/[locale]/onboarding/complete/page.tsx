'use client';

// ---------------------------------------------------------------------------
// /en/onboarding/complete — post-signup profile hydration page.
//
// Auth REQUIRED (user just signed up). Reads the onboarding session from
// localStorage, POSTs it to /api/profile to hydrate the new account, clears
// the session, then redirects to the dashboard.
//
// This page has one job: hydrate → redirect. It shows a loading state; the
// user never lingers here.
// ---------------------------------------------------------------------------

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { loadSession, clearSession, answersToProfile, isCompleteSession } from '@/lib/onboardingSession';
import BidFlareLogo from '@/components/BidFlareLogo';

export default function OnboardingCompletePage() {
  const router = useRouter();
  const locale = useLocale();
  const [status, setStatus] = useState<'hydrating' | 'done' | 'error'>('hydrating');

  useEffect(() => {
    const hydrate = async () => {
      try {
        const session = loadSession();
        if (session && isCompleteSession(session)) {
          const profile = answersToProfile(session);
          profile.onboardingCompletedAt = new Date().toISOString();

          const res = await fetch('/api/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(profile),
          });

          if (!res.ok) {
            console.warn('[onboarding/complete] profile save failed:', res.status);
            // Don't block — redirect anyway; dashboard will show an empty profile
          }

          clearSession();
        }
        // Whether or not there was a session, redirect to the dashboard.
        setStatus('done');
        router.replace(`/${locale}/dashboard/recommendations`);
      } catch (err) {
        console.error('[onboarding/complete]', err);
        setStatus('error');
        // Still redirect — don't strand the user here.
        setTimeout(() => router.replace(`/${locale}/dashboard/recommendations`), 2000);
      }
    };

    void hydrate();
  }, [locale, router]);

  return (
    <div style={{
      display: 'flex', minHeight: '100vh', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: '2rem',
      padding: '2rem',
    }}>
      <BidFlareLogo height={36} />

      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        {status === 'error' ? (
          <>
            <p style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>Something went wrong — redirecting you to your dashboard.</p>
          </>
        ) : (
          <>
            <p style={{ fontSize: '1.15rem', fontWeight: 600 }}>Setting up your dashboard…</p>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>Applying your profile and finding your matches.</p>
          </>
        )}
      </div>

      {/* Spinner */}
      <div style={{
        width: 36, height: 36, borderRadius: '50%',
        border: '3px solid var(--border-color)',
        borderTop: '3px solid var(--accent-primary)',
        animation: 'spin 0.8s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
