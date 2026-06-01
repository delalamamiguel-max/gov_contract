'use client';

import React, { useState } from 'react';
import NAICSAutocomplete from '@/components/NAICSAutocomplete';
import CurrencyInput from '@/components/CurrencyInput';

import { useRouter } from 'next/navigation';

export default function OnboardingPage() {
  const router = useRouter();
  const [selectedNAICS, setSelectedNAICS] = useState<string[]>([]);
  const [minContract, setMinContract] = useState<number | ''>('');
  const [maxContract, setMaxContract] = useState<number | ''>('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          naicsCodes: selectedNAICS,
          setAsideTypes: [], // Expand later with set-aside selection in onboarding
          minCapacity: minContract,
          maxCapacity: maxContract
        })
      });
      router.push('/en/dashboard/search');
    } catch (e) {
      console.error(e);
      setIsSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div className="glass-panel animate-fade-in" style={{ maxWidth: '600px', width: '100%', padding: '3rem' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Set up your Business Profile</h1>
        <p style={{ marginBottom: '2rem', color: 'var(--text-secondary)' }}>
          Tell us about your business so we can find federal contracts that match your capabilities.
        </p>

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <NAICSAutocomplete 
            selectedCodes={selectedNAICS} 
            onChange={setSelectedNAICS} 
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontWeight: 500, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              Set-Aside Eligibility
            </label>
            <select className="form-input">
              <option value="none">None (Full & Open)</option>
              <option value="sba">Small Business (SBA)</option>
              <option value="8a">8(a) Business Development</option>
              <option value="hubzone">HUBZone</option>
              <option value="wosb">Women-Owned (WOSB)</option>
              <option value="sdvosb">Service-Disabled Veteran (SDVOSB)</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <CurrencyInput 
              label="Min Contract Size ($)"
              placeholder="e.g. $50,000"
              value={minContract}
              onChange={setMinContract}
            />
            <CurrencyInput 
              label="Max Contract Size ($)"
              placeholder="e.g. $5,000,000"
              value={maxContract}
              onChange={setMaxContract}
            />
          </div>

          <button type="submit" disabled={isSaving} className="btn btn-primary" style={{ marginTop: '1rem', width: '100%' }}>
            {isSaving ? 'Saving Profile...' : 'Save Profile & Continue'}
          </button>
        </form>
      </div>
    </div>
  );
}
