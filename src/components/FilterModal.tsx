'use client';

import { useState } from 'react';
import { Filter, X } from 'lucide-react';

export default function FilterModal() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="btn btn-secondary" 
        style={{ padding: '0 1.5rem', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
      >
        <Filter size={18} /> Filters
      </button>

      {isOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="glass-panel" style={{
            width: '400px', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Filter Contracts</h2>
              <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Set-Aside Type</label>
              <select style={{
                background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)',
                padding: '0.75rem', borderRadius: '8px', color: 'white'
              }}>
                <option value="all">All</option>
                <option value="sb">Small Business (Total)</option>
                <option value="wosb">Women-Owned Small Business</option>
                <option value="sdvosb">Service-Disabled Veteran-Owned</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Agency</label>
              <input type="text" placeholder="e.g. Department of Defense" style={{
                background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)',
                padding: '0.75rem', borderRadius: '8px', color: 'white'
              }} />
            </div>

            <button onClick={() => setIsOpen(false)} className="btn btn-primary" style={{ marginTop: '1rem', padding: '0.75rem' }}>
              Apply Filters
            </button>
          </div>
        </div>
      )}
    </>
  );
}
