'use client';

import React, { useState } from 'react';
import NAICSAutocomplete from '@/components/NAICSAutocomplete';
import CurrencyInput from '@/components/CurrencyInput';

export default function SettingsPage() {
  const [selectedNAICS, setSelectedNAICS] = useState<string[]>(['541511', '541512']);
  const [minContract, setMinContract] = useState<number | ''>(50000);
  const [maxContract, setMaxContract] = useState<number | ''>(5000000);

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
          setAsideTypes: [], // Add actual set-aside state later
          minCapacity: minContract,
          maxCapacity: maxContract
        })
      });
      alert('Settings Saved Successfully!');
    } catch (error) {
      console.error(error);
      alert('Error saving settings');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '800px' }}>
      <header>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>Profile Settings</h1>
        <p>Update your business capabilities to tune the contract matching engine.</p>
      </header>

      <div className="glass-panel" style={{ padding: '2rem' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '2rem' }}>Business Capabilities</h2>
        
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          <div style={{ borderBottom: '1px solid rgba(42, 51, 61,0.1)', paddingBottom: '2rem' }}>
            <NAICSAutocomplete 
              selectedCodes={selectedNAICS} 
              onChange={setSelectedNAICS} 
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', borderBottom: '1px solid rgba(42, 51, 61,0.1)', paddingBottom: '2rem' }}>
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

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
            <button type="submit" className="btn btn-primary" style={{ padding: '0.75rem 2rem' }}>
              Save Settings
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
