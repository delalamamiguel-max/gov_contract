// SAM.gov Live Search Utility
// Used by the search page to query SAM.gov API in real-time when users search.
// Separated from the batch ingestion scripts to keep concerns clean.

const SAM_API_BASE = 'https://api.sam.gov/opportunities/v2/search';
const SAM_REQUEST_TIMEOUT_MS = 12_000; // 12 seconds — well within Vercel's function timeout

/** Format a Date as MM/dd/yyyy — required by SAM.gov API */
function formatSamDate(date: Date): string {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

export interface SamGovOpportunity {
  noticeId: string;
  title: string;
  agency: string;
  description: string | null;
  solicitationNumber: string | null;
  naicsCode: string | null;
  setAsideType: string | null;
  postedDate: string;
  responseDeadline: string | null;
  estimatedValue: number | null;
  sourceUrl: string;
}

/**
 * Search SAM.gov API v2 for contract opportunities matching a keyword.
 * Returns mapped results ready for display. Returns empty array on any failure.
 *
 * This runs server-side only (in server components or API routes).
 * The API key is never exposed to the client.
 */
export async function searchSamGovLive(keyword: string): Promise<SamGovOpportunity[]> {
  const apiKey = process.env.SAM_GOV_API_KEY;

  if (!apiKey) {
    console.error('[SAM.gov Search] SAM_GOV_API_KEY is not configured. Cannot perform live search.');
    return [];
  }

  // Build URL with params — SAM.gov v2 requires api_key, postedFrom, postedTo, and limit
  const now = new Date();
  const twelveMonthsAgo = new Date(now);
  twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);

  const url = new URL(SAM_API_BASE);
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('keyword', keyword);
  url.searchParams.set('limit', '25');
  url.searchParams.set('postedFrom', formatSamDate(twelveMonthsAgo));
  url.searchParams.set('postedTo', formatSamDate(now));
  url.searchParams.set('ptype', 'o,p'); // opportunities + presolicitations

  // AbortController for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SAM_REQUEST_TIMEOUT_MS);

  try {
    console.log(`[SAM.gov Search] Querying for keyword: "${keyword}"`);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`[SAM.gov Search] API returned ${response.status}: ${response.statusText}`);
      return [];
    }

    const data = await response.json();

    if (!data.opportunitiesData || !Array.isArray(data.opportunitiesData)) {
      console.warn('[SAM.gov Search] Response missing opportunitiesData array.');
      return [];
    }

    console.log(`[SAM.gov Search] Found ${data.opportunitiesData.length} results for "${keyword}"`);

    return data.opportunitiesData.map((opp: Record<string, unknown>): SamGovOpportunity => ({
      noticeId: (opp.noticeId as string) || `SAM-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: (opp.title as string) || 'Untitled Opportunity',
      agency: (opp.fullParentPathName as string) || (opp.department as string) || 'Unknown Agency',
      description: (opp.description as string) || null,
      solicitationNumber: (opp.solicitationNumber as string) || null,
      naicsCode: Array.isArray(opp.naicsCodes)
        ? (opp.naicsCodes[0] as string)
        : (opp.naicsCode as string) || null,
      setAsideType: (opp.typeOfSetAsideDescription as string) || (opp.typeOfSetAside as string) || null,
      postedDate: opp.postedDate ? new Date(opp.postedDate as string).toISOString() : new Date().toISOString(),
      responseDeadline: opp.responseDeadLine ? new Date(opp.responseDeadLine as string).toISOString() : null,
      estimatedValue: null, // SAM.gov search results typically don't include estimated value
      sourceUrl: (opp.uiLink as string) || `https://sam.gov/opp/${opp.noticeId}/view`,
    }));
  } catch (error: unknown) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === 'AbortError') {
      console.error(`[SAM.gov Search] Request timed out after ${SAM_REQUEST_TIMEOUT_MS}ms`);
    } else {
      console.error('[SAM.gov Search] Unexpected error:', error instanceof Error ? error.message : error);
    }

    return [];
  }
}
