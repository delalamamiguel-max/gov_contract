import { runCkanSource, type SourceSyncSummary } from '@/lib/sources/ckan';

// ---------------------------------------------------------------------------
// California DGS — Approved Non-Competitive Bids.
//
// APPROVED sole-source / non-competitive contracts (awarded, not open bids).
// Stored with status='awarded' so they stay out of the active bidding feed
// (search/recommendations filter status='active') while remaining queryable as
// market intelligence. Uses the CKAN DataStore API via the shared source core.
// ---------------------------------------------------------------------------

const SOURCE = 'dgs-ncb';
const DATASET_SLUG = process.env.DGS_DATASET_SLUG || 'dgs-approved-non-competitive-bids';

const JUSTIFICATION = { NCB: 'Non-Competitive Bid', SCR: 'Special Category Request', LTB: 'Limited to Brand' } as const;

function parseAmount(...values: (string | undefined)[]): number {
  for (const v of values) {
    if (v == null) continue;
    const n = parseInt(String(v).replace(/[^0-9.-]/g, ''), 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}

function parseDate(v?: string): string | null {
  if (!v) return null;
  const d = new Date(v.replace(' ', 'T'));
  return isNaN(d.getTime()) ? null : d.toISOString();
}

/** Map a DGS record to an opportunities row. Skips the stray header row. */
export function mapDgsRecord(r: Record<string, any>, datasetUrl: string): Record<string, unknown> | null {
  const number = String(r.Number || '').trim();
  if (!number || number.toLowerCase() === 'number') return null; // header artifact / blank

  const org = String(r['Requesting Organization'] || 'California State Agency').trim();
  const vendor = String(r['Contractor or Commodity'] || 'Undisclosed vendor').trim();
  const acqType = String(r['Acquisition Type'] || '').trim();
  const justCode = String(r.Type || '').trim().toUpperCase();
  const justLabel = JUSTIFICATION[justCode as keyof typeof JUSTIFICATION] || justCode || 'Non-competitive';
  const amount = parseAmount(r['Amended Contract Amount'], r['Total Original Contract Amount']);
  const approved = parseDate(r['Approved on']);

  return {
    source: SOURCE,
    source_id: number,
    source_url: datasetUrl,
    title: acqType ? `${vendor} — ${acqType}` : vendor,
    description:
      `Approved non-competitive bid (${justLabel}${justCode && justLabel !== justCode ? `, ${justCode}` : ''}) by ${org}. ` +
      `Contractor/commodity: ${vendor}.` +
      (acqType ? ` Acquisition type: ${acqType}.` : '') +
      (amount ? ` Contract amount: $${amount.toLocaleString()}.` : '') +
      (approved ? ` Approved ${new Date(approved).toLocaleDateString()}.` : '') +
      ` Source: California DGS via data.ca.gov.`,
    description_url: null,
    agency: org,
    naics_code: null,
    psc_code: null,
    set_aside_type: null,
    place_of_performance: 'California',
    posted_date: approved,
    response_deadline: null,
    estimated_value: amount,
    status: 'awarded',
    raw: r,
    last_synced_at: new Date().toISOString(),
  };
}

export async function syncDgsNcb(): Promise<SourceSyncSummary> {
  return runCkanSource({
    source: SOURCE,
    slug: DATASET_SLUG,
    prefer: (r) => String(r.format).toUpperCase() === 'XLSX' && !/dictionary/i.test(r.name || ''),
    mapRow: mapDgsRecord,
  });
}
