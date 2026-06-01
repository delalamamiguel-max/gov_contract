export const dynamic = 'force-dynamic';
import { Search as SearchIcon, Filter, Zap } from 'lucide-react';
import { listOpportunities } from '@/lib/dataconnect';

// Since this is fetching from Firebase Data Connect, we can use React Server Components
export default async function SearchPage() {
  // Fetch live data from PostgreSQL via Firebase Data Connect
  let opportunities: any[] = [];
  try {
    const response = await listOpportunities();
    opportunities = response.data.opportunities;
  } catch (error) {
    console.error('Failed to fetch opportunities from Data Connect', error);
  }

  // Fallback to mock data for visual testing if DB is empty
  const displayData = opportunities.length > 0 ? opportunities.map(o => ({
    id: o.id,
    title: o.title,
    agency: o.agency,
    value: o.estimatedValue ? `$${(o.estimatedValue / 1000000).toFixed(1)}M` : 'TBD',
    fit: 85, // Mock fit score for now
    match: 'Good Match'
  })) : [
    { id: 1, title: 'Cloud Infrastructure Migration Support', agency: 'Department of Energy', value: '$3.2M', fit: 92, match: 'High Match' },
    { id: 2, title: 'Cybersecurity Threat Analysis', agency: 'Department of Defense', value: '$1.5M', fit: 85, match: 'Good Match' },
    { id: 3, title: 'Legacy System Maintenance', agency: 'Veterans Affairs', value: '$850K', fit: 64, match: 'Low Match' },
  ];

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <header>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>Contract Search</h1>
        <p>Find the perfect federal opportunities matching your business profile.</p>
      </header>

      {/* Search Bar */}
      <div style={{ display: 'flex', gap: '1rem' }}>
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', gap: '1rem',
          background: 'var(--surface-primary)', border: '1px solid var(--border-color)',
          padding: '0.5rem 1rem', borderRadius: '12px'
        }}>
          <SearchIcon size={20} color="var(--text-secondary)" />
          <input type="text" placeholder="Search by keywords, NAICS, or Agency..." style={{
            background: 'transparent', border: 'none', color: 'white', width: '100%', fontSize: '1rem', outline: 'none'
          }} />
        </div>
        <button className="btn btn-secondary" style={{ padding: '0 1.5rem', borderRadius: '12px' }}>
          <Filter size={18} /> Filters
        </button>
      </div>

      {/* Results */}
      <div style={{ display: 'grid', gap: '1rem' }}>
        {displayData.map((opp) => (
          <div key={opp.id} className="glass-panel" style={{
            padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <h3 style={{ fontSize: '1.25rem' }}>{opp.title}</h3>
                <span style={{
                  padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600,
                  background: opp.fit > 80 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                  color: opp.fit > 80 ? '#34d399' : '#fbbf24',
                  display: 'flex', alignItems: 'center', gap: '0.25rem'
                }}>
                  <Zap size={12} /> {opp.fit}% Fit Score
                </span>
              </div>
              <p style={{ color: 'var(--text-secondary)' }}>{opp.agency} &bull; Est. Value: {opp.value}</p>
            </div>

            <button className="btn btn-secondary">View Details</button>
          </div>
        ))}
      </div>
    </div>
  );
}
