export default function SearchLoading() {
  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <header>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>Opportunity Search</h1>
        <p>Matching live opportunities to your agency…</p>
      </header>
      <div style={{ display: 'grid', gap: '1rem' }}>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="glass-panel"
            style={{
              padding: '1.5rem',
              height: 96,
              opacity: 0.5,
              background:
                'linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.03) 75%)',
              backgroundSize: '200% 100%',
              animation: 'shimmer 1.4s ease infinite',
            }}
          />
        ))}
      </div>
      <style>{`@keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }`}</style>
    </div>
  );
}
