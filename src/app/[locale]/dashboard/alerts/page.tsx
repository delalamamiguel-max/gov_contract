import AlertsManager from '@/components/AlertsManager';

export default function AlertsPage() {
  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <header>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>Opportunity Alerts</h1>
        <p>Get notified about new marketing opportunities that match your criteria.</p>
      </header>
      <AlertsManager />
    </div>
  );
}
