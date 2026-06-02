// SAM.gov API Ingestion Script
// API Documentation: https://open.gsa.gov/api/sam/

const SAM_API_BASE = 'https://api.sam.gov/opportunities/v2/search';
const SAM_REQUEST_TIMEOUT_MS = 15_000;

export async function fetchSamGovOpportunities() {
  console.log('[SAM.gov Ingest] Starting data ingestion...');
  const API_KEY = process.env.SAM_GOV_API_KEY;

  if (!API_KEY || API_KEY === 'API_KEY') {
    // In development, return mock data for testing. In production, return empty.
    if (process.env.NODE_ENV === 'development') {
      console.warn('[SAM.gov Ingest] Missing SAM_GOV_API_KEY — returning mock data for local development.');
      return generateMockContracts();
    }
    console.error('[SAM.gov Ingest] SAM_GOV_API_KEY is not configured. Returning empty results (not mock data).');
    return [];
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SAM_REQUEST_TIMEOUT_MS);

  try {
    const url = new URL(SAM_API_BASE);
    url.searchParams.set('api_key', API_KEY);
    url.searchParams.set('limit', '20');
    url.searchParams.set('ptype', 'o,p');

    console.log('[SAM.gov Ingest] Fetching live contracts...');
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`[SAM.gov Ingest] API returned ${response.status}: ${response.statusText}`);
      // Do NOT fall back to mock data — return empty to avoid polluting the database
      return [];
    }

    const data = await response.json();

    if (!data.opportunitiesData || !Array.isArray(data.opportunitiesData)) {
      console.warn('[SAM.gov Ingest] Response missing opportunitiesData array.');
      return [];
    }

    console.log(`[SAM.gov Ingest] Received ${data.opportunitiesData.length} live contracts.`);

    return data.opportunitiesData.map((opp: any) => ({
      noticeId: opp.noticeId || `SAM-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: opp.title || 'Untitled Opportunity',
      agency: opp.fullParentPathName || opp.department || 'Unknown Agency',
      solicitationNumber: opp.solicitationNumber || null,
      naicsCode: Array.isArray(opp.naicsCodes) ? opp.naicsCodes[0] : (opp.naicsCode || null),
      setAsideType: opp.typeOfSetAsideDescription || 'None',
      postedDate: opp.postedDate ? new Date(opp.postedDate).toISOString() : new Date().toISOString(),
      responseDeadline: opp.responseDeadLine ? new Date(opp.responseDeadLine).toISOString() : null,
      estimatedValue: null,
      sourceUrl: opp.uiLink || `https://sam.gov/opp/${opp.noticeId}/view`
    }));

  } catch (error: unknown) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('[SAM.gov Ingest] Request timed out.');
    } else {
      console.error('[SAM.gov Ingest] Error during fetch:', error instanceof Error ? error.message : error);
    }
    // Do NOT fall back to mock data — return empty
    return [];
  }
}

function generateMockContracts() {
  const titles = [
    'Cloud Infrastructure Migration Support',
    'Cybersecurity Threat Analysis',
    'Legacy System Maintenance',
    'AI Research & Development',
    'Data Center Consolidation Services',
    'Enterprise Resource Planning (ERP) Implementation',
    'Federal Website Redesign',
    'Cloud Security Assessment',
    'IT Service Desk Support'
  ];

  const agencies = ['Department of Energy', 'Department of Defense', 'Veterans Affairs', 'Department of Health', 'NASA'];
  const naicsCodes = ['541511', '541512', '541513', '541611', '518210'];

  return Array.from({ length: 8 }).map((_, i) => {
    return {
      noticeId: `MOCK-${Date.now()}-${i}`,
      title: titles[Math.floor(Math.random() * titles.length)] + ` - ${Math.floor(Math.random() * 100)}`,
      agency: agencies[Math.floor(Math.random() * agencies.length)],
      solicitationNumber: `SOL-${Math.floor(Math.random() * 100000)}`,
      naicsCode: naicsCodes[Math.floor(Math.random() * naicsCodes.length)],
      setAsideType: Math.random() > 0.5 ? 'Total Small Business' : 'None',
      postedDate: new Date(Date.now() - Math.floor(Math.random() * 10000000000)).toISOString(),
      responseDeadline: new Date(Date.now() + Math.floor(Math.random() * 10000000000)).toISOString(),
      estimatedValue: Math.floor(Math.random() * 10000000) + 50000,
      sourceUrl: 'https://sam.gov/opp/mock/view'
    };
  });
}
