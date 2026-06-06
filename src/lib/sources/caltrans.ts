import { runCkanSource, type SourceSyncSummary } from '@/lib/sources/ckan';

// ---------------------------------------------------------------------------
// Caltrans — Early Development Project List (state highway / infrastructure
// project pipeline). These are PLANNED upcoming projects (not yet open bids),
// stored with status='planned' so they stay out of the active marketing bid
// feed while remaining queryable as infrastructure market intelligence.
//
// The starter script's resource id (5e554d3d-…) is stale; the resource is
// resolved at runtime from the dataset package via the shared CKAN core.
// ---------------------------------------------------------------------------

const SOURCE = 'caltrans';
const DATASET_SLUG = process.env.CALTRANS_DATASET_SLUG || 'early-development-project-list';

function parseAmount(v?: string): number {
  if (v == null) return 0;
  const n = parseInt(String(v).replace(/[^0-9.-]/g, ''), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function cleanFy(v?: string): string | null {
  const s = String(v || '').trim();
  return s && s.toLowerCase() !== 'n/a' ? s : null;
}

/** Map a Caltrans project record to an opportunities row. */
export function mapCaltransRecord(r: Record<string, any>, datasetUrl: string): Record<string, unknown> | null {
  const projectId = String(r.ProjectID || '').trim();
  if (!projectId || projectId.toLowerCase() === 'projectid') return null;

  const district = String(r.CaltransDistrict || '').trim();
  const county = String(r.County || '').trim();
  const route = String(r.Route || '').trim();
  const name = String(r.ProjectName || '').trim();
  const projDesc = String(r.ProjectDescription || '').trim();
  const workDesc = String(r.Work_Description || '').trim();
  const phase = String(r.Current_Phase || '').trim();
  const fundingType = String(r.PIDFundingType || '').trim();
  const rtlFy = cleanFy(r.Target_RTL_FY) || cleanFy(r.PID_Completion_Fiscal_Year);
  const amount = parseAmount(r.TotalCost);

  const title = name || (route && county ? `Route ${route} project in ${county} County` : `Caltrans project ${projectId}`);
  const place = [county ? `${county} County` : '', 'CA'].filter(Boolean).join(', ');

  return {
    source: SOURCE,
    source_id: projectId,
    source_url: datasetUrl,
    title,
    description:
      (projDesc ? `${projDesc} ` : '') +
      (workDesc ? `Work type: ${workDesc}. ` : '') +
      (route ? `Route ${route}${county ? ` in ${county} County` : ''}. ` : '') +
      (amount ? `Estimated total cost: $${amount.toLocaleString()}. ` : '') +
      (phase ? `Current phase: ${phase}. ` : '') +
      (fundingType ? `Funding: ${fundingType}. ` : '') +
      (rtlFy ? `Targeted to advertise (RTL): ${rtlFy}. ` : '') +
      `Caltrans planned project via data.ca.gov.`,
    description_url: null,
    agency: district ? `California Dept. of Transportation (Caltrans) — District ${district}` : 'California Dept. of Transportation (Caltrans)',
    naics_code: null,
    psc_code: null,
    set_aside_type: null,
    place_of_performance: place,
    posted_date: null, // planned project — no posting date
    response_deadline: null,
    estimated_value: amount,
    status: 'planned',
    raw: r,
    last_synced_at: new Date().toISOString(),
  };
}

export async function syncCaltrans(): Promise<SourceSyncSummary> {
  return runCkanSource({
    source: SOURCE,
    slug: DATASET_SLUG,
    prefer: (r) => String(r.format).toUpperCase() === 'CSV' || /project/i.test(r.name || ''),
    pageSize: 1000,
    mapRow: mapCaltransRecord,
  });
}
