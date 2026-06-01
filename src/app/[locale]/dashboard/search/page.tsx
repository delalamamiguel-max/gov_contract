export const dynamic = 'force-dynamic';
import { listOpportunities, searchOpportunities } from '@/lib/dataconnect';
import ContractRow from '@/components/ContractRow';
import SearchInput from '@/components/SearchInput';
import FilterModal from '@/components/FilterModal';

export default async function SearchPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined }
}) {
  const query = typeof searchParams.q === 'string' ? searchParams.q : '';

  let opportunities: any[] = [];
  try {
    if (query) {
      // Execute the parameterized Live Data Connect Search
      const response = await searchOpportunities({ keyword: query });
      opportunities = response.data.opportunities;
    } else {
      // Execute standard list
      const response = await listOpportunities();
      opportunities = response.data.opportunities;
    }
  } catch (error) {
    console.error('Failed to fetch opportunities from Data Connect', error);
  }

  // Fallback to mock data for visual testing if DB is empty and no query is active
  const displayData = opportunities.length > 0 ? opportunities.map(o => ({
    id: o.noticeId,
    title: o.title,
    agency: o.agency,
    description: o.description || 'No description provided.',
    value: o.estimatedValue ? `$${(o.estimatedValue / 1000000).toFixed(1)}M` : 'TBD',
    fit: 85, // Mock fit score for now
    match: 'Good Match',
    naicsCode: o.naicsCode,
    setAsideType: o.setAsideType,
    responseDeadline: o.responseDeadline
  })) : query ? [] : [
    { id: '1', title: 'Cloud Infrastructure Migration Support', agency: 'Department of Energy', description: 'This is a mock description of the contract requirements. The vendor will be required to provide comprehensive services adhering to federal standards, maintaining security compliance, and delivering measurable milestones on a quarterly basis.', value: '$3.2M', fit: 92, match: 'High Match' },
    { id: '2', title: 'Cybersecurity Threat Analysis', agency: 'Department of Defense', description: 'Perform advanced threat hunting and architecture review for legacy DoD assets.', value: '$1.5M', fit: 85, match: 'Good Match' },
    { id: '3', title: 'Legacy System Maintenance', agency: 'Veterans Affairs', description: 'Maintain and transition a legacy on-premise mainframe system to a cloud-ready environment.', value: '$850K', fit: 64, match: 'Low Match' },
  ];

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <header>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>Contract Search</h1>
        <p>Find the perfect federal opportunities matching your business profile.</p>
      </header>

      {/* Search Bar */}
      <div style={{ display: 'flex', gap: '1rem' }}>
        <SearchInput />
        <FilterModal />
      </div>

      {/* Results */}
      <div style={{ display: 'grid', gap: '1rem' }}>
        {displayData.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
            No contracts found matching "{query}".
          </div>
        ) : (
          displayData.map((opp) => (
            <ContractRow key={opp.id} opp={opp} />
          ))
        )}
      </div>
    </div>
  );
}
