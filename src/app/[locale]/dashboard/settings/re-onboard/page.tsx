'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { Loader2 } from 'lucide-react';
import OnboardingWizard from '@/components/onboarding/OnboardingWizard';
import { type OnboardingAnswers, answersToProfile, clearSession } from '@/lib/onboardingSession';

const RESET_PROFILE_FIELDS = [
  'agencyName', 'location', 'citiesServed', 'countiesServed', 'serviceRadiusMiles',
  'remotePreference', 'agencyType', 'services', 'industries', 'targetOpportunityTypes',
  'certifications', 'role', 'teamSize', 'deliveryCapacity', 'largestProjectSize',
  'monthlyMediaSpend', 'minContract', 'maxContract', 'insurance', 'priorGovExperience',
  'proposalReadiness', 'differentiators', 'annualRevenue', 'primaryCapability',
  'caPresence', 'naicsCodes', 'setAsideTypes', 'onboardingCompletedAt',
];

export default function ReOnboardPage() {
  const router = useRouter();
  const locale = useLocale();
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleComplete = async (finalAnswers: Partial<OnboardingAnswers>) => {
    setSaving(true);
    setErrorMsg('');

    try {
      // 1. Fetch current profile
      const res = await fetch('/api/profile', { cache: 'no-store' });
      const data = await res.json();
      let profile = data?.profile || {};

      // 2. Merge new answers
      const newProfileData = answersToProfile(finalAnswers);
      profile = { ...profile, ...newProfileData };

      // 3. Save updated profile
      const saveRes = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      });

      if (!saveRes.ok) {
        throw new Error('Failed to save the new profile.');
      }

      // 5. Clean up session and redirect
      clearSession();
      router.push(`/${locale}/dashboard/settings`);
      router.refresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'An error occurred while saving.');
      setSaving(false);
    }
  };

  if (saving) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: '1rem', color: 'var(--text-secondary)' }}>
        <Loader2 size={32} className="spin" color="var(--accent-primary)" />
        <p style={{ fontSize: '1.1rem' }}>Rebuilding your profile...</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '2rem', paddingBottom: '4rem' }}>
      {errorMsg && (
        <div style={{ marginBottom: '2rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#b91c1c', padding: '0.75rem 1rem', borderRadius: 8, fontSize: '0.9rem', maxWidth: 680, width: '100%' }}>
          {errorMsg}
        </div>
      )}
      <OnboardingWizard mode="re-onboard" onComplete={handleComplete} />
    </div>
  );
}
