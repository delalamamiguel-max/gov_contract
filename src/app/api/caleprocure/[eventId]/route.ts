import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Cal eProcure event deep-link resolver.
//
// Cal eProcure's PeopleSoft portal throws an "Oops! The page failed to load"
// error if you navigate directly to an event details page without a pre-existing
// session token, EXCEPT if you use the direct Business Unit (BU) routing URL
// (/event/{BU}/{eventId}).
//
// Since our Apify scraper doesn't currently capture the BU, we try to map the
// scraped agency string to a known BU code. If found, we route the user directly.
// Otherwise, we safely fall back to the public search page pre-seeded with the
// event ID (which correctly initializes the session without an error).
// ---------------------------------------------------------------------------

const SEARCH_FALLBACK = (id: string) =>
  `https://caleprocure.ca.gov/pages/Events-BS3/event-search.aspx?searchText=${encodeURIComponent(id)}`;

// Map of known California State Department Business Unit (BU) codes
const BU_CODES: Record<string, string> = {
  'department of transportation': '2660',
  'caltrans': '2660',
  'dgs - statewide procurement': '7760',
  'department of general services': '7760',
  'dept of corrections & rehab': '5225',
  'cal fire': '3540',
  'dept of the ca highway patrol': '2720',
  'department of water resources': '3860',
  'department of motor vehicles': '2740',
  'employment development dept': '7100',
  'franchise tax board': '7730',
  'dept of parks & recreation': '3790',
  'state board of equalization': '0860',
  'department of public health': '4265',
  'state water resources control': '3940',
  'department of technology': '7502',
  'department of justice': '0820',
  'department of fish & wildlife': '3600',
  'department of social services': '5180',
  'department of rehabilitation': '5160',
  'department of state hospitals': '4440',
  'department of consumer affairs': '1111',
  'california highway patrol': '2720',
  'office of exposition park': '3100',
  "public employees' retirement": '7900',
  'public employees retirement': '7900',
  'csu, channel islands': '6610',
  'csu channel islands': '6610',
};

async function getAgencyForEvent(eventId: string): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  try {
    const { data } = await supabase
      .from('opportunities')
      .select('agency')
      .eq('source_id', eventId)
      .limit(1)
      .single();
    return data?.agency || null;
  } catch {
    return null;
  }
}

/** Probe a URL — return true if it answers 2xx/3xx (i.e. the page exists). */
async function probe(url: string, timeoutMs = 2500): Promise<boolean> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      redirect: 'manual',
      signal: ctrl.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      },
    });
    return res.status >= 200 && res.status < 400;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;
  const id = (eventId || '').trim();
  if (!id) {
    return NextResponse.redirect(
      'https://caleprocure.ca.gov/pages/Events-BS3/event-search.aspx',
      302
    );
  }

  // 1. Check if we know the agency so we can map it to a BU code.
  const agency = await getAgencyForEvent(id);
  const bu = agency ? BU_CODES[agency.toLowerCase()] : null;

  if (bu) {
    // If we have a BU code, this is the reliable way to deep-link 
    // without triggering a PeopleSoft session error.
    // We redirect immediately because probe() often times out or gets blocked by WAF.
    return NextResponse.redirect(`https://caleprocure.ca.gov/event/${bu}/${encodeURIComponent(id)}`, 302);
  }

  // 2. We no longer include /event/preview/ or /event-details.aspx here because
  // while probe() succeeds (200 OK), those links crash in a real browser 
  // without a pre-existing PeopleSoft session cookie.

  // 3. Fallback to the search page with the query pre-filled.
  return NextResponse.redirect(SEARCH_FALLBACK(id), 302);
}
