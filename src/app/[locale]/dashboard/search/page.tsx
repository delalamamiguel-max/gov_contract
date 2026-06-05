export const dynamic = 'force-dynamic';
import { listOpportunities, searchOpportunities } from '@/lib/dataconnect';
import { searchSamGovLive, type SamGovOpportunity } from '@/lib/samgov';
import { readProfile, hasProfile, type AgencyProfile } from '@/lib/profile';
import ContractRow from '@/components/ContractRow';
import SearchInput from '@/components/SearchInput';
import FilterModal from '@/components/FilterModal';

function formatContractValue(value: number | null | undefined): string {
  if (!value) return 'TBD';
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toLocaleString()}`;
}

/** Marketing-relevance signal so we don't just trust raw API order. */
const MARKETING_TERMS = [
  'marketing', 'advertis', 'communication', 'public relations', 'branding', 'brand',
  'website', 'web design', 'web development', 'digital', 'seo', 'social media', 'media buy',
  'creative', 'campaign', 'outreach', 'graphic design', 'video', 'content', 'copywrit',
  'strategy', 'market research', 'translation', 'localization', 'photography', 'email marketing',
];

function relevanceScore(opp: Partial<SamGovOpportunity>, profile: AgencyProfile): number {
  const hay = `${opp.title || ''} ${opp.description || ''} ${opp.setAsideType || ''}`.toLowerCase();
  let score = 0;
  if (MARKETING_TERMS.some((t) => hay.includes(t))) score += 30;
  for (const s of profile.services || []) if (s && hay.includes(s.toLowerCase())) score += 8;
  for (const k of profile.keywords || []) if (k && hay.includes(k.toLowerCase())) score += 6;
  for (const ind of profile.industries || []) if (ind && hay.includes(ind.toLowerCase())) score += 4;
  for (const x of profile.excludeKeywords || []) if (x && hay.includes(x.toLowerCase())) score -= 40;
  // Deadline urgency: soonest first gets a small boost
  if (opp.responseDeadline) {
    const days = (new Date(opp.responseDeadline).getTime() - Date.now()) / 86_400_000;
    if (days > 0 && days < 30) score += 5;
  }
  return score;
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedParams = await searchParams;
  const profile = await readProfile();
  const profileReady = hasProfile(profile);

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

  // Rank by agency relevance (don't rely on raw API order), then map to display.
  const ranked = [...opportunities].sort((a, b) => relevanceScore(b, profile) - relevanceScore(a, profile));

  const displayData = ranked.map((o) => ({
    id: o.noticeId,
    title: o.title,
    agency: o.agency,
    description: o.description || 'No description text was available for this opportunity.',
    descriptionUrl: o.descriptionUrl ?? null,
    value: formatContractValue(o.estimatedValue),
    estimatedValue: o.estimatedValue ?? null,
    fit: 0,
    match: 'Expand to assess',
    naicsCode: o.naicsCode,
    pscCode: o.pscCode,
    setAsideType: o.setAsideType,
    placeOfPerformance: o.placeOfPerformance,
    responseDeadline: o.responseDeadline,
    sourceUrl: o.sourceUrl,
  }));

  const clientProfile: AgencyProfile = {
    services: profile.services,
    industries: profile.industries,
    certifications: profile.certifications,
    location: profile.location,
    serviceRadiusMiles: profile.serviceRadiusMiles,
    remotePreference: profile.remotePreference,
    minContract: profile.minContract,
    maxContract: profile.maxContract,
    keywords: profile.keywords,
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <header>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>Opportunity Search</h1>
        <p>Public-sector, nonprofit, education & healthcare opportunities matched to your agency.</p>
      </header>

      <div style={{ display: 'flex', gap: '1rem' }}>
        <SearchInput />
        <FilterModal />
      </div>

      {/* Profile-not-set hint */}
      {!profileReady && (
        <div
          style={{
            background: 'rgba(59,130,246,0.08)',
            border: '1px solid rgba(59,130,246,0.25)',
            borderRadius: '8px',
            padding: '0.75rem 1rem',
            fontSize: '0.9rem',
            color: 'var(--text-secondary)',
          }}
        >
          Finish your agency profile to personalize results by your services, location, and contract size.{' '}
          <a href="/en/onboarding" style={{ color: 'var(--accent-primary)' }}>Complete onboarding →</a>
        </div>
      )}

      {/* Source / personalization indicator */}
      {query && displayData.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          <span
            style={{
              display: 'inline-block',
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: searchSource === 'sam.gov' ? '#10b981' : 'var(--accent-primary)',
            }}
          />
          {searchSource === 'sam.gov'
            ? `${displayData.length} live results from SAM.gov`
            : `${displayData.length} results from local database`}
          {usingProfileDefault && <span> · personalized from your profile (&ldquo;{query}&rdquo;)</span>}
        </div>
      )}

      {searchError && (
        <div
          style={{
            background: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: '8px',
            padding: '0.75rem 1rem',
            fontSize: '0.9rem',
            color: '#f59e0b',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <span>&#9888;</span> {searchError}
        </div>
      )}

      <div style={{ display: 'grid', gap: '1rem' }}>
        {displayData.length === 0 ? (
          <div
            className="glass-panel"
            style={{
              textAlign: 'center',
              padding: '3rem',
              color: 'var(--text-secondary)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              alignItems: 'center',
            }}
          >
            {query ? (
              <>
                <p style={{ fontSize: '1.1rem' }}>No opportunities found matching &ldquo;{query}&rdquo;.</p>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  Try a broader term like &ldquo;marketing&rdquo;, &ldquo;communications&rdquo;, or &ldquo;website&rdquo;, or adjust your filters.
                </p>
              </>
            ) : (
              <>
                <p style={{ fontSize: '1.1rem' }}>Search to find live opportunities.</p>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  Try &ldquo;marketing&rdquo;, &ldquo;advertising&rdquo;, &ldquo;public relations&rdquo;, or &ldquo;website design&rdquo;.
                </p>
              </>
            )}
          </div>
        ) : (
          displayData.map((opp) => <ContractRow key={opp.id} opp={opp} agencyProfile={clientProfile} />)
        )}
      </div>
    </div>
  );
}
