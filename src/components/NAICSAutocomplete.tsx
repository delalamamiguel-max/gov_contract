'use client';

import React, { useState, useRef, useEffect } from 'react';
import { X, Search, Info } from 'lucide-react';
import naicsData from '@/data/naics.json';

interface NAICSItem {
  code: string;
  title: string;
}

interface NAICSAutocompleteProps {
  selectedCodes: string[];
  onChange: (codes: string[]) => void;
}

export default function NAICSAutocomplete({ selectedCodes, onChange }: NAICSAutocompleteProps) {
  const [query, setQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [filtered, setFiltered] = useState<NAICSItem[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter logic
  useEffect(() => {
    if (query.trim() === '') {
      setFiltered([]);
      return;
    }
    const lowerQ = query.toLowerCase();
    const results = (naicsData as NAICSItem[]).filter(item => 
      item.code.includes(lowerQ) || item.title.toLowerCase().includes(lowerQ)
    );
    setFiltered(results.slice(0, 10)); // max 10 results
  }, [query]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (code: string) => {
    if (!selectedCodes.includes(code)) {
      onChange([...selectedCodes, code]);
    }
    setQuery('');
    setShowDropdown(false);
  };

  const removeCode = (codeToRemove: string) => {
    onChange(selectedCodes.filter(c => c !== codeToRemove));
  };

  // Find titles for selected chips
  const getTitleForCode = (code: string) => {
    const item = (naicsData as NAICSItem[]).find(i => i.code === code);
    return item ? `${item.code} - ${item.title}` : code;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }} ref={containerRef}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <label style={{ fontWeight: 500, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          Primary NAICS Codes
        </label>
        
        {/* Tooltip implementation */}
        <div className="tooltip-container" style={{ position: 'relative', display: 'inline-block', cursor: 'pointer' }}>
          <Info size={16} color="var(--text-muted)" />
          <div className="tooltip-text" style={{
            visibility: 'hidden', width: '250px', backgroundColor: 'var(--glass-bg)',
            color: '#fff', textAlign: 'center', borderRadius: '6px', padding: '0.75rem',
            position: 'absolute', zIndex: 50, bottom: '150%', left: '50%',
            transform: 'translateX(-50%)', border: '1px solid var(--border-color)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)', fontSize: '0.8rem',
            backdropFilter: 'blur(12px)'
          }}>
            NAICS (North American Industry Classification System) codes classify businesses by their type of economic activity. Federal contracts specify NAICS codes to define the required industry.
          </div>
        </div>
      </div>

      {/* Input container */}
      <div style={{ position: 'relative' }}>
        <div style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
          <Search size={18} color="var(--text-muted)" />
        </div>
        <input 
          type="text" 
          placeholder="Search by code or keyword (e.g. 'Software' or '541511')"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowDropdown(true);
          }}
          onFocus={() => setShowDropdown(true)}
          style={{ paddingLeft: '2.5rem' }}
          className="form-input"
        />

        {/* Dropdown menu */}
        {showDropdown && query.trim() !== '' && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '0.5rem',
            background: 'var(--bg-color)', border: '1px solid var(--border-color)',
            borderRadius: '8px', zIndex: 40, maxHeight: '200px', overflowY: 'auto',
            boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
          }}>
            {filtered.length > 0 ? (
              filtered.map(item => (
                <div 
                  key={item.code}
                  onClick={() => handleSelect(item.code)}
                  style={{
                    padding: '0.75rem 1rem', cursor: 'pointer', display: 'flex', gap: '0.5rem',
                    borderBottom: '1px solid rgba(255,255,255,0.05)'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>{item.code}</span>
                  <span style={{ color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</span>
                </div>
              ))
            ) : (
              <div style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>No NAICS codes found.</div>
            )}
          </div>
        )}
      </div>

      {/* Selected Chips Area */}
      {selectedCodes.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.25rem' }}>
          {selectedCodes.map(code => (
            <div key={code} style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              background: 'rgba(59, 130, 246, 0.15)', border: '1px solid rgba(59, 130, 246, 0.3)',
              padding: '0.4rem 0.75rem', borderRadius: '999px', fontSize: '0.875rem', color: 'var(--text-primary)'
            }}>
              <span>{getTitleForCode(code)}</span>
              <button 
                type="button" 
                onClick={() => removeCode(code)}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Tooltip CSS logic injected here for simplicity */}
      <style dangerouslySetInnerHTML={{__html: `
        .tooltip-container:hover .tooltip-text {
          visibility: visible !important;
        }
      `}} />
    </div>
  );
}
