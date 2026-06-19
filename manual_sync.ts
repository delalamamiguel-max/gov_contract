import { ApifyClient } from 'apify-client';
import { getSupabaseAdmin } from './src/lib/supabase';

// Manually trigger the caleprocure apify sync and wait for it
async function main() {
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error("No token");
  const client = new ApifyClient({ token });
  const actorId = process.env.CALEPROCURE_ACTOR || 'Migs_atx~caleprocure-listings';
  
  console.log('Starting actor run...');
  const run = await client.actor(actorId).call({
    testKeyword: "", 
    maxItems: 0
  }, { memoryMbytes: 4096, timeoutSecs: 600 });
  
  console.log('Actor run finished. Fetching dataset...');
  const dataset = await client.dataset(run.defaultDatasetId).listItems();
  const items = dataset.items;
  console.log(`Fetched ${items.length} items. Upserting into Supabase...`);
  
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  
  const rows = items.map(item => ({
    source: 'caleprocure',
    source_id: item.eventId || item.url || Math.random().toString(),
    title: item.name || 'Untitled Event',
    description: `Department: ${item.department}\n${item.description || ''}`,
    status: 'active',
    url: item.url || `https://caleprocure.ca.gov/pages/Events-BS3/event-search.aspx`,
    published_date: item.publishedDate ? new Date(item.publishedDate).toISOString() : now,
    due_date: item.endDate ? new Date(item.endDate).toISOString() : null,
    raw: item
  }));
  
  let inserted = 0;
  for (let i = 0; i < rows.length; i += 50) {
    const chunk = rows.slice(i, i + 50);
    const { error } = await supabase.from('opportunities').upsert(chunk, { onConflict: 'source, source_id' });
    if (error) {
      console.error('Error inserting chunk:', error);
    } else {
      inserted += chunk.length;
      console.log(`Inserted ${inserted}/${rows.length}...`);
    }
  }
  
  console.log('Done!');
}
main().catch(console.error);
