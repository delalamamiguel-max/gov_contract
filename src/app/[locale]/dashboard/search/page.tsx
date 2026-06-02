export const dynamic = 'force-dynamic';
import { listOpportunities, searchOpportunities } from '@/lib/dataconnect';
import { searchSamGovLive } from '@/lib/samgov';
import ContractRow from '@/components/ContractRow';
import SearchInput from '@/components/SearchInput';
import FilterModal from '@/components/FilterModal';

function formatContractValue(value: number | null | undefined): string {
  if (!value) return 'TBD';
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toLocaleString()}`;
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const resolvedParams = await searchParams;
  const query = typeof resolvedParams.q === 'string' ? resolvedParams.q : '';

  let opportunities: any[] = [];
  let searchSource: 'sam.gov' | 'database' | 'none' = 'none';
  let searchError: string | undefined;

  if (query) {
    // --- Active search: SAM.gov live is primary, Data Connect is fallback ---
    try {
      const samResult = await searchSamGovLive(query);
      if (samResult.results.length > 0) {
        opportunities = samResult.results;
        searchSource = 'sam.gov';
      } else if (samResult.error) {
        searchError = samResult.error;
      }
    } catch (error) {
      console.error('[Search] SAM.gov live search failed:', error);
    }

    // Fallback to local database if SAM.gov returned nothing
    if (opportunities.length === 0) {
      try {
        const response = await searchOpportunities({ keyword: query });
        opportunities = response.data.opportunities;
        if (opportunities.length > 0) searchSource = 'database';
      } catch (error) {
        console.error('[Search] Data Connect search also failed:', error);
      }
    }
  } else {
    // --- Browse mode: list from local database ---
    try {
      const response = await listOpportunities();
      opportunities = response.data.opportunities;
      if (opportunities.length > 0) searchSource = 'database';
    } catch (error) {
      console.error('[Search] Failed to list opportunities from Data Connect:', error);
    }
  }

  // Map results to display format
  const displayData = opportunities.map(o => ({
    id: o.noticeId,
    title: o.title,
    agency: o.agency,
    description: o.description || 'No description provided.',
    value: formatContractValue(o.estimatedValue),
    fit: 0, // Real fit score is generated on-demand via AI when user expands
    match: 'Expand to score',
    naicsCode: o.naicsCode,
    setAsideType: o.setAsideType,
    responseDeadline: o.responseDeadline,
    sourceUrl: o.sourceUrl,
  }));

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

      {/* Source Indicator */}
      {query && displayData.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          fontSize: '0.85rem', color: 'var(--text-muted)'
        }}>
          <span style={{
            display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
            background: searchSource === 'sam.gov' ? '#10b981' : 'var(--accent-primary)',
          }} />
          {searchSource === 'sam.gov'
            ? `${displayData.length} live results from SAM.gov`
            : `${displayData.length} results from local database`}
        </div>
      )}

      {/* Error Banner */}
      {searchError && (
        <div style={{
          background: 'rgba(245, 158, 11, 0.1)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          borderRadius: '8px', padding: '0.75rem 1rem',
          fontSize: '0.9rem', color: '#f59e0b',
          display: 'flex', alignItems: 'center', gap: '0.5rem',
        }}>
          <span>&#9888;</span> {searchError}
        </div>
      )}

      {/* Results */}
      <div style={{ display: 'grid', gap: '1rem' }}>
        {displayData.length === 0 ? (
          <div className="glass-panel" style={{
            textAlign: 'center', padding: '3rem',
            color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'center'
          }}>
            {query ? (
              <>
                <p style={{ fontSize: '1.1rem' }}>No contracts found matching &ldquo;{query}&rdquo;.</p>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  Try different keywords, a NAICS code, or an agency name.
                </p>
              </>
            ) : (
              <>
                <p style={{ fontSize: '1.1rem' }}>No contracts in your local database yet.</p>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  Search above to find live opportunities from SAM.gov.
                </p>
              </>
            )}
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
