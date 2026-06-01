export default function OnboardingPage() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div className="glass-panel animate-fade-in" style={{ maxWidth: '600px', width: '100%', padding: '3rem' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Set up your Business Profile</h1>
        <p style={{ marginBottom: '2rem' }}>Tell us about your business so we can find federal contracts that match your capabilities.</p>

        <form style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontWeight: 500 }}>Primary NAICS Codes (Comma separated)</label>
            <input type="text" placeholder="e.g. 541511, 541512" style={{
              padding: '0.875rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)',
              background: 'rgba(0,0,0,0.2)', color: 'white', fontSize: '1rem', outline: 'none'
            }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontWeight: 500 }}>Set-Aside Eligibility</label>
            <select style={{
              padding: '0.875rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)',
              background: 'rgba(0,0,0,0.2)', color: 'white', fontSize: '1rem', outline: 'none'
            }}>
              <option value="none">None (Full & Open)</option>
              <option value="sba">Small Business (SBA)</option>
              <option value="8a">8(a) Business Development</option>
              <option value="hubzone">HUBZone</option>
              <option value="wosb">Women-Owned (WOSB)</option>
              <option value="sdvosb">Service-Disabled Veteran (SDVOSB)</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
              <label style={{ fontWeight: 500 }}>Min Contract Size ($)</label>
              <input type="number" placeholder="50000" style={{
                padding: '0.875rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)',
                background: 'rgba(0,0,0,0.2)', color: 'white', fontSize: '1rem', outline: 'none'
              }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
              <label style={{ fontWeight: 500 }}>Max Contract Size ($)</label>
              <input type="number" placeholder="5000000" style={{
                padding: '0.875rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)',
                background: 'rgba(0,0,0,0.2)', color: 'white', fontSize: '1rem', outline: 'none'
              }} />
            </div>
          </div>

          <button type="button" className="btn btn-primary" style={{ marginTop: '1rem', width: '100%' }}>
            Save Profile & Continue
          </button>
        </form>
      </div>
    </div>
  );
}
