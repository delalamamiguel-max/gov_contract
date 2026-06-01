import { Users, Mail, Trash2 } from 'lucide-react';

export default function SettingsPage() {
  // Mock data representing workers in the admin's tenant
  const workers = [
    { id: 1, email: 'john@example.com', role: 'worker', status: 'active' },
    { id: 2, email: 'sarah@example.com', role: 'worker', status: 'pending' },
  ];

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <header>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>Tenant Settings</h1>
        <p>Manage your billing and invite workers to your workspace.</p>
      </header>

      {/* Subscription Status Panel */}
      <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <h2 style={{ fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          Subscription Status
        </h2>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
          <div>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>Pro Plan (4 Seats)</h3>
            <p style={{ color: 'var(--text-secondary)' }}>You are using 3 out of 4 available seats.</p>
          </div>
          <button className="btn btn-secondary">Manage Billing via Stripe</button>
        </div>
      </div>

      {/* Team Management Panel */}
      <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Users size={24} /> Team Members (Workers)
          </h2>
          <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Mail size={18} /> Invite Worker
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {workers.map((worker) => (
            <div key={worker.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <div>
                <h4 style={{ fontWeight: 600 }}>{worker.email}</h4>
                <span style={{ fontSize: '0.75rem', padding: '0.1rem 0.5rem', background: worker.status === 'active' ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)', color: worker.status === 'active' ? '#34d399' : '#fbbf24', borderRadius: '12px', marginTop: '0.25rem', display: 'inline-block' }}>
                  {worker.status.toUpperCase()}
                </span>
              </div>
              <button style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.5rem' }}>
                <Trash2 size={18} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
