import { getSupabaseAdmin } from './src/lib/supabase';
import { openSyncRun, closeSyncRun, upsertOpportunityRows, type SourceSyncSummary } from './src/lib/sources/ckan';
import { mapCaleprocureRecord } from './src/lib/sources/caleprocure';

const SOURCE = 'caleprocure';
const ACTOR = 'Migs_atx~caleprocure-listings';

async function robustSync() {
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error("No token");
  const supabase = getSupabaseAdmin();
  const input = { status: 'P' };

  console.log("Starting Apify run asynchronously...");
  const startRes = await fetch(`https://api.apify.com/v2/acts/${ACTOR}/runs?token=${token}&memory=4096`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  });
  const startData = await startRes.json();
  const runId = startData.data.id;
  console.log("Started run:", runId);

  let status = startData.data.status;
  while (status === 'READY' || status === 'RUNNING') {
    await new Promise(r => setTimeout(r, 15000));
    console.log(`Run status: ${status}...`);
    const statusRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${token}`);
    const statusData = await statusRes.json();
    status = statusData.data.status;
  }
  console.log("Run finished with status:", status);

  if (status !== 'SUCCEEDED') throw new Error("Run failed");

  const runInfoRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${token}`);
  const runInfo = await runInfoRes.json();
  const datasetId = runInfo.data.defaultDatasetId;

  console.log("Fetching dataset", datasetId);
  const datasetRes = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${token}`);
  const items = await datasetRes.json();

  console.log(`Fetched ${items.length} items. Upserting into Supabase...`);
  const syncRunId = await openSyncRun(supabase, SOURCE, { actor: ACTOR, runId });
  
  const byId = new Map<string, Record<string, unknown>>();
  for (const item of items) {
    const row = mapCaleprocureRecord(item);
    if (row) byId.set(row.source_id as string, row);
  }
  const rows = [...byId.values()];
  const result = await upsertOpportunityRows(supabase, SOURCE, rows);
  
  await closeSyncRun(supabase, syncRunId, { status: 'success', imported: result.imported, updated: result.updated, failed: result.failed, total: rows.length });
  console.log(result);
}
robustSync().catch(console.error);
