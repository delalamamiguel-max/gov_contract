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

/** Turn SAM.gov's placeOfPerformance object into a readable "City, ST" string. */
function formatPlaceOfPerformance(pop: unknown): string | null {
  if (!pop || typeof pop !== 'object') return null;
  const p = pop as Record<string, any>;
  const city = p.city?.name || p.city;
  const state = p.state?.code || p.state?.name || p.state;
  const country = p.country?.name || p.country?.code;
  const parts = [city, state].filter(Boolean);
  if (parts.length) return parts.join(', ');
  return country || null;
}

/**
 * Build a readable summary from the structured fields SAM.gov DOES return, for
 * when the full description text is not inline. Never returns an empty string.
 */
function synthesizeDescription(o: {
  title: string;
  agency: string | null;
  naics: string | null;
  psc: string | null;
  setAside: string | null;
  pop: string | null;
  type: string | null;
}): string {
  const sentences: string[] = [];
  if (o.agency) sentences.push(`${o.agency} posted this opportunity${o.type ? ` (${o.type})` : ''}.`);
  if (o.title) sentences.push(`Scope: ${o.title}.`);
  const meta: string[] = [];
  if (o.naics) meta.push(`NAICS ${o.naics}`);
  if (o.psc) meta.push(`PSC ${o.psc}`);
  if (o.setAside && o.setAside.toLowerCase() !== 'no set aside used') meta.push(`set-aside: ${o.setAside}`);
  if (o.pop) meta.push(`place of performance: ${o.pop}`);
  if (meta.length) sentences.push(`Key details — ${meta.join('; ')}.`);
  sentences.push('Full solicitation text is available from the source; open the SAM.gov listing for complete requirements.');
  return sentences.join(' ');
}

/**
 * Lazily fetch the full notice description text from SAM.gov's noticedesc URL.
 * Returns null on any failure so callers can fall back to the synthesized summary.
 */
export async function fetchSamGovDescription(descriptionUrl: string): Promise<string | null> {
  const apiKey = process.env.SAM_GOV_API_KEY;
  if (!apiKey || !/^https?:\/\//i.test(descriptionUrl)) return null;
  try {
    const url = new URL(descriptionUrl);
    if (!url.searchParams.has('api_key')) url.searchParams.set('api_key', apiKey);
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(url.toString(), { headers: { Accept: 'application/json' }, signal: controller.signal });
    clearTimeout(t);
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      const data = await res.json();
      // SAM.gov returns { description: "<text>" } or sometimes an array.
      const text = typeof data?.description === 'string'
        ? data.description
        : Array.isArray(data) && data[0]?.description
        ? data[0].description
        : null;
      return text ? stripHtml(text) : null;
    }
    return stripHtml(await res.text());
  } catch {
    return null;
  }
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

export interface SamGovOpportunity {
  noticeId: string;
  title: string;
  agency: string;
  /** Best available human-readable description: real text if already present, otherwise a synthesized summary. */
  description: string | null;
  /** SAM.gov returns `description` as a URL to fetch the full notice text — kept here for lazy fetching. */
  descriptionUrl: string | null;
  solicitationNumber: string | null;
  naicsCode: string | null;
  pscCode: string | null;
  setAsideType: string | null;
  placeOfPerformance: string | null;
  postedDate: string;
  responseDeadline: string | null;
  estimatedValue: number | null;
  sourceUrl: string;
}

export interface SamGovSearchResult {
  results: SamGovOpportunity[];
  error?: string;
}

/**
 * Normalize one raw SAM.gov opportunity record into our SamGovOpportunity shape.
 * Shared by live search (legacy) and the centralized ingestion service.
 */
export function mapSamRecord(opp: Record<string, unknown>): SamGovOpportunity {
  const naics = Array.isArray(opp.naicsCodes)
    ? (opp.naicsCodes[0] as string)
    : (opp.naicsCode as string) || null;
  const psc = (opp.classificationCode as string) || null;
  const setAside = (opp.typeOfSetAsideDescription as string) || (opp.typeOfSetAside as string) || null;
  const pop = formatPlaceOfPerformance(opp.placeOfPerformance);

  const rawDesc = (opp.description as string) || '';
  const descIsUrl = /^https?:\/\//i.test(rawDesc.trim());
  const descriptionUrl = descIsUrl ? rawDesc.trim() : null;
  const realText = descIsUrl ? null : rawDesc.trim() || null;

  return {
    noticeId: (opp.noticeId as string) || (opp.solicitationNumber as string) || `SAM-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: (opp.title as string) || 'Untitled Opportunity',
    agency: (opp.fullParentPathName as string) || (opp.department as string) || 'Unknown Agency',
    description: realText || synthesizeDescription({
      title: (opp.title as string) || '',
      agency: (opp.fullParentPathName as string) || null,
      naics, psc, setAside, pop,
      type: (opp.type as string) || null,
    }),
    descriptionUrl,
    solicitationNumber: (opp.solicitationNumber as string) || null,
    naicsCode: naics,
    pscCode: psc,
    setAsideType: setAside,
    placeOfPerformance: pop,
    postedDate: opp.postedDate ? new Date(opp.postedDate as string).toISOString() : new Date().toISOString(),
    responseDeadline: opp.responseDeadLine ? new Date(opp.responseDeadLine as string).toISOString() : null,
    estimatedValue: null,
    sourceUrl: (opp.uiLink as string) || `https://sam.gov/opp/${opp.noticeId}/view`,
  };
}

export interface SamFetchParams {
  /** Free-text title search (optional — omit for a broad pull). */
  title?: string;
  /** Months back from today (capped to <12 to satisfy SAM's 1-year rule). */
  months?: number;
  /** Max records per request. */
  limit?: number;
  /** Pagination offset. */
  offset?: number;
}

export interface SamFetchResult {
  /** Raw SAM records (kept raw for auditing/normalization downstream). */
  records: Record<string, unknown>[];
  totalRecords: number;
  error?: string;
  status?: number;
}

/**
 * Low-level SAM.gov fetch returning RAW records (no mapping). Server-side only.
 * Used by the ingestion service so the raw payload can be stored for auditing.
 */
export async function fetchSamGovPage(params: SamFetchParams = {}): Promise<SamFetchResult> {
  const apiKey = process.env.SAM_GOV_API_KEY;
  if (!apiKey) return { records: [], totalRecords: 0, error: 'SAM_GOV_API_KEY not configured.' };

  const months = Math.min(11, Math.max(1, params.months ?? 6));
  const now = new Date();
  const rangeStart = new Date(now);
  rangeStart.setMonth(rangeStart.getMonth() - months);

  const url = new URL(SAM_API_BASE);
  url.searchParams.set('api_key', apiKey);
  if (params.title) url.searchParams.set('title', params.title);
  url.searchParams.set('limit', String(params.limit ?? 50));
  url.searchParams.set('offset', String(params.offset ?? 0));
  url.searchParams.set('postedFrom', formatSamDate(rangeStart));
  url.searchParams.set('postedTo', formatSamDate(now));
  url.searchParams.set('ptype', 'o,p');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SAM_REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url.toString(), { headers: { Accept: 'application/json' }, signal: controller.signal });
    clearTimeout(timeoutId);
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      return { records: [], totalRecords: 0, status: response.status, error: `SAM.gov HTTP ${response.status}: ${body.slice(0, 160)}` };
    }
    const data = await response.json();
    const records = Array.isArray(data.opportunitiesData) ? data.opportunitiesData : [];
    return { records, totalRecords: Number(data.totalRecords) || records.length };
  } catch (error: unknown) {
    clearTimeout(timeoutId);
    const msg = error instanceof Error && error.name === 'AbortError' ? 'SAM.gov request timed out' : (error instanceof Error ? error.message : 'SAM.gov fetch failed');
    return { records: [], totalRecords: 0, error: msg };
  }
}

/**
 * Search SAM.gov API v2 for contract opportunities matching a keyword.
 * Returns mapped results ready for display. Returns empty results with optional error message.
 *
 * This runs server-side only (in server components or API routes).
 * The API key is never exposed to the client.
 *
 * NOTE: As of Phase 1, user-facing search queries Supabase (lib/opportunities.ts),
 * not this function. This remains only for reference/ingestion-adjacent use.
 */
export async function searchSamGovLive(keyword: string): Promise<SamGovSearchResult> {
  const apiKey = process.env.SAM_GOV_API_KEY;

  if (!apiKey) {
    console.error('[SAM.gov Search] SAM_GOV_API_KEY is not configured. Cannot perform live search.');
    return { results: [], error: 'API key not configured.' };
  }

  // Build URL with params — SAM.gov v2 requires api_key, postedFrom, postedTo, and limit.
  // The posted date range must be strictly LESS than 1 year apart, otherwise SAM.gov
  // returns HTTP 400 "Date range must be 1 year(s) apart". We use 11 months to stay safe.
  const now = new Date();
  const rangeStart = new Date(now);
  rangeStart.setMonth(rangeStart.getMonth() - 11);

  const url = new URL(SAM_API_BASE);
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('title', keyword); // v2 has no "keyword" param — free-text search is "title"
  url.searchParams.set('limit', '25');
  url.searchParams.set('postedFrom', formatSamDate(rangeStart));
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
      const errorBody = await response.text().catch(() => '');
      console.error(`[SAM.gov Search] API returned ${response.status}: ${response.statusText} — ${errorBody}`);

      if (response.status === 429) {
        return { results: [], error: 'SAM.gov API rate limit exceeded. The daily quota resets at midnight UTC.' };
      }
      return { results: [], error: `SAM.gov returned HTTP ${response.status}` };
    }

    const data = await response.json();

    if (!data.opportunitiesData || !Array.isArray(data.opportunitiesData)) {
      console.warn('[SAM.gov Search] Response missing opportunitiesData array.');
      return { results: [] };
    }

    console.log(`[SAM.gov Search] Found ${data.opportunitiesData.length} results for "${keyword}"`);

    return { results: data.opportunitiesData.map((opp: Record<string, unknown>) => mapSamRecord(opp)) };
  } catch (error: unknown) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === 'AbortError') {
      console.error(`[SAM.gov Search] Request timed out after ${SAM_REQUEST_TIMEOUT_MS}ms`);
      return { results: [], error: 'SAM.gov request timed out. Please try again.' };
    }

    console.error('[SAM.gov Search] Unexpected error:', error instanceof Error ? error.message : error);
    return { results: [], error: 'Failed to reach SAM.gov. Please try again later.' };
  }
}
