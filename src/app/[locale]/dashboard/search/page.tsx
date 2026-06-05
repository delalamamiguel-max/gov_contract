export const dynamic = 'force-dynamic';
import { listOpportunities, searchOpportunities } from '@/lib/dataconnect';
import { searchSamGovLive } from '@/lib/samgov';
import { readProfile, hasProfile } from '@/lib/profile';
import { computeAssessment } from '@/lib/assessment';
import { computeChecklist } from '@/lib/checklist';
import ContractRow from '@/components/ContractRow';
import SearchInput from '@/components/SearchInput';
import FilterModal from '@/components/FilterModal';
import DistanceSlider from '@/components/DistanceSlider';

function formatContractValue(value: number | null | undefined): string {
  if (!value) return 'TBD';
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toLocaleString()}`;
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedParams = await searchParams;
  const profile = await readProfile();
  const profileReady = hasProfile(profile);

  // Radius: explicit ?radius= wins, else the onboarding service radius, else 50.
  const radiusParam = typeof resolvedParams.radius === 'string' ? parseInt(resolvedParams.radius, 10) : NaN;
  const radius = Number.isFinite(radiusParam)
    ? Math.min(100, Math.max(0, radiusParam))
    : profile.serviceRadiusMiles ?? 50;

  // Default the query from the agency profile so users don't re-type every time.
  const explicitQuery = typeof resolvedParams.q === 'string' ? resolvedParams.q : '';
  const profileDefault =
    (profile.keywords && profile.keywords[0]) ||
    (profile.services && profile.services[0]) ||
    '';
  const query = explicitQuery || profileDefault;
  const usingProfileDefault = !explicitQuery && Boolean(profileDefault);

  let opportunities: any[] = [];
  let searchSource: 'sam.gov' | 'database' | 'none' = 'none';
  let searchError: string | undefined;

  if (query) {
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
      searchError = 'Live search is temporarily unavailable.';
    }

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
    try {
      const response = await listOpportunities();
      opportunities = response.data.opportunities;
      if (opportunities.length > 0) searchSource = 'database';
    } catch (error) {
      console.error('[Search] Failed to list opportunities from Data Connect:', error);
    }
  }

  // Assess every result (deterministic, three-group score), then filter by radius
  // (remote-eligible work always passes) and sort by match score.
  const assessed = opportunities.map((o) => ({ o, a: computeAssessment(o, profile, radius) }));
  const radiusFiltered =
    radius >= 100
      ? assessed
      : assessed.filter(({ a }) => a.withinRadius || a.remoteEligible);
  radiusFiltered.sort((x, y) => y.a.matchScore - x.a.matchScore);
  const hiddenByRadius = assessed.length - radiusFiltered.length;

  const displayData = radiusFiltered.map(({ o, a }) => ({
    id: o.noticeId,
    title: o.title,
    agency: o.agency,
    description: o.description || 'No description text was available for this opportunity.',
    descriptionUrl: o.descriptionUrl ?? null,
    value: formatContractValue(o.estimatedValue),
    estimatedValue: o.estimatedValue ?? null,
    naicsCode: o.naicsCode,
    pscCode: o.pscCode,
    setAsideType: o.setAsideType,
    placeOfPerformance: o.placeOfPerformance,
    responseDeadline: o.responseDeadline,
    sourceUrl: o.sourceUrl,
    assessment: a,
    checklist: computeChecklist(o, profile),
  }));

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <header>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>Opportunity Search</h1>
        <p>Public-sector, nonprofit, education & healthcare opportunities matched to your agency.</p>
      </header>

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'stretch' }}>
        <div style={{ flex: 1, minWidth: 280 }}>
          <SearchInput />
        </div>
        <FilterModal />
        <DistanceSlider defaultRadius={profile.serviceRadiusMiles ?? 50} />
      </div>

      {!profileReady && (
        <div style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.25)', borderRadius: '8px', padding: '0.75rem 1rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          Finish your agency profile to personalize results by your services, location, and contract size.{' '}
          <a href="/en/onboarding" style={{ color: 'var(--accent-primary)' }}>Complete onboarding →</a>
        </div>
      )}

      {query && displayData.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: searchSource === 'sam.gov' ? '#10b981' : 'var(--accent-primary)' }} />
          {searchSource === 'sam.gov' ? `${displayData.length} live results from SAM.gov` : `${displayData.length} results from local database`}
          {usingProfileDefault && <span> · personalized from your profile (&ldquo;{query}&rdquo;)</span>}
          <span> · within {radius >= 100 ? '100+' : radius} mi{profile.remotePreference && profile.remotePreference !== 'local' ? ' + remote' : ''}</span>
          {hiddenByRadius > 0 && <span> · {hiddenByRadius} outside radius hidden</span>}
        </div>
      )}

      {searchError && (
        <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '8px', padding: '0.75rem 1rem', fontSize: '0.9rem', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>&#9888;</span> {searchError}
        </div>
      )}

      <div style={{ display: 'grid', gap: '1rem' }}>
        {displayData.length === 0 ? (
          <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'center' }}>
            {hiddenByRadius > 0 ? (
              <>
                <p style={{ fontSize: '1.1rem' }}>All {hiddenByRadius} results are outside your {radius} mile radius.</p>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Increase the distance slider, or set your preference to remote/hybrid to see remote-eligible work.</p>
              </>
            ) : query ? (
              <>
                <p style={{ fontSize: '1.1rem' }}>No opportunities found matching &ldquo;{query}&rdquo;.</p>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Try a broader term like &ldquo;marketing&rdquo;, &ldquo;communications&rdquo;, or &ldquo;website&rdquo;, or adjust your filters.</p>
              </>
            ) : (
              <>
                <p style={{ fontSize: '1.1rem' }}>Search to find live opportunities.</p>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Try &ldquo;marketing&rdquo;, &ldquo;advertising&rdquo;, &ldquo;public relations&rdquo;, or &ldquo;website design&rdquo;.</p>
              </>
            )}
          </div>
        ) : (
          displayData.map((opp) => <ContractRow key={opp.id} opp={opp} radius={radius} />)
        )}
      </div>
    </div>
  );
}
