'use client';

import React, { useState, useEffect } from 'react';

interface CurrencyInputProps {
  label: string;
  placeholder?: string;
  value: number | '';
  onChange: (val: number | '') => void;
}

export default function CurrencyInput({ label, placeholder, value, onChange }: CurrencyInputProps) {
  const [displayValue, setDisplayValue] = useState('');

  useEffect(() => {
    if (value === '') {
      setDisplayValue('');
    } else {
      setDisplayValue('$' + value.toLocaleString('en-US'));
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    // Allow clearing the input
    if (rawVal === '' || rawVal === '$') {
      onChange('');
      return;
    }
    
    // Remove non-numeric characters (except decimals if we wanted them, but we stick to integers)
    const numericStr = rawVal.replace(/[^0-9]/g, '');
    const num = parseInt(numericStr, 10);
    
    if (!isNaN(num)) {
      onChange(num);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
      <label style={{ fontWeight: 500, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
        {label}
      </label>
      <input 
        type="text" 
        value={displayValue} 
        onChange={handleChange}
        placeholder={placeholder}
        className="form-input" 
      />
    </div>
  );
}
