// Main Ingestion Runner
// Run this via a cron job or scheduled Firebase Cloud Function

import { fetchSamGovOpportunities } from './samgov';
import { fetchUSASpendingOpportunities } from './usaspending';
import { fetchOpenGovOpportunities } from './opengov';

// NOTE: In production, this would use Firebase Admin SDK to write to Data Connect Postgres
export async function runIngestionSync() {
  console.log('--- Starting Global Data Ingestion Sync ---');
  
  try {
    const [samData, usaData, openGovData] = await Promise.all([
      fetchSamGovOpportunities(),
      fetchUSASpendingOpportunities(),
      fetchOpenGovOpportunities()
    ]);

    const allOpportunities = [...samData, ...usaData, ...openGovData];

    console.log(`Successfully fetched ${allOpportunities.length} opportunities from external APIs.`);
    
    // Delta Detection Logic
    // 1. Fetch all existing noticeIds from our DB
    // 2. Compare against incoming data
    // 3. Upsert new/changed records
    console.log('[Delta Detection] Comparing against database... (Mocked)');
    console.log(`[Delta Detection] Upserting ${allOpportunities.length} records to Firebase Data Connect Postgres...`);

    // TODO: Use `firebase-admin` to execute the GraphQL mutations for `opportunity_insert`
    
    console.log('--- Sync Complete ---');
  } catch (error) {
    console.error('Error during data ingestion sync:', error);
  }
}

// If run directly via CLI
if (require.main === module) {
  runIngestionSync().then(() => process.exit(0));
}
