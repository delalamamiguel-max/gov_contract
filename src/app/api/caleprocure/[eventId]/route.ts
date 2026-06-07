import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Cal eProcure event deep-link resolver.
//
// We do not control Cal eProcure's URL scheme and the Apify actor currently
// only captures the generic search page. To still give users a meaningful
// "View on Cal eProcure" link, this route does a quick head/get on a list of
// known per-event URL patterns and 302s to the first one that responds. The
// last entry is the public event-search page pre-seeded with the event id, so
// the user is always at most one click from the event.
//
// Designed to be cheap: HEAD/GET only, short timeout, no scraping.
// ---------------------------------------------------------------------------

const SEARCH_FALLBACK = (id: string) =>
  `https://caleprocure.ca.gov/pages/Events-BS3/event-search.aspx?searchText=${encodeURIComponent(id)}`;

/** Candidate per-event URL patterns to try, in priority order. */
function candidateUrls(eventId: string): string[] {
  const e = encodeURIComponent(eventId);
  return [
    // Public event preview routes used by Cal eProcure's bidder portal.
    `https://caleprocure.ca.gov/event/preview/${e}`,
    `https://caleprocure.ca.gov/event/${e}`,
    `https://caleprocure.ca.gov/pages/Events-BS3/event-details.aspx?eventID=${e}`,
    // Always-valid fallback: the public search page pre-seeded with the id.
    SEARCH_FALLBACK(eventId),
  ];
}

/** Probe a URL — return true if it answers 2xx/3xx (i.e. the page exists). */
async function probe(url: string, timeoutMs = 2500): Promise<boolean> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'manual', signal: ctrl.signal });
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

  const candidates = candidateUrls(id);
  // The last candidate (search fallback) is always considered valid, so skip
  // probing it — we only need to find a real per-event URL among the others.
  for (let i = 0; i < candidates.length - 1; i++) {
    if (await probe(candidates[i])) {
      return NextResponse.redirect(candidates[i], 302);
    }
  }
  return NextResponse.redirect(SEARCH_FALLBACK(id), 302);
}
