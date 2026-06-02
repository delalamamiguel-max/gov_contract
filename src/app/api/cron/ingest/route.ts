import { NextResponse } from 'next/server';
import { fetchSamGovOpportunities } from '@/scripts/ingestion/samgov';
import { upsertOpportunity } from '@/lib/dataconnect';

export async function GET(request: Request) {
  // Security check to prevent public abuse
  const authHeader = request.headers.get('authorization');
  const expectedToken = process.env.CRON_SECRET;

  if (!expectedToken) {
    console.error('[CRON] CRON_SECRET is not configured. Rejecting request.');
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
  }

  if (authHeader !== `Bearer ${expectedToken}`) {
    console.warn('[CRON] Unauthorized cron attempt.');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log('[CRON] Starting SAM.gov data ingestion...');
    const opportunities = await fetchSamGovOpportunities();

    if (opportunities.length === 0) {
      console.warn('[CRON] SAM.gov returned 0 opportunities. Nothing to ingest.');
      return NextResponse.json({
        success: true,
        message: 'No opportunities returned from SAM.gov. Ensure SAM_GOV_API_KEY is configured.',
        insertedCount: 0,
      });
    }

    let insertedCount = 0;
    let failedCount = 0;

    for (const opp of opportunities) {
      try {
        await upsertOpportunity({
          noticeId: opp.noticeId,
          title: opp.title,
          agency: opp.agency,
          solicitationNumber: opp.solicitationNumber,
          naicsCode: opp.naicsCode,
          setAsideType: opp.setAsideType,
          postedDate: opp.postedDate,
          responseDeadline: opp.responseDeadline,
          estimatedValue: opp.estimatedValue,
          sourceUrl: opp.sourceUrl
        });
        insertedCount++;
      } catch (err) {
        failedCount++;
        console.error(`[CRON] Failed to upsert ${opp.noticeId}:`, err instanceof Error ? err.message : err);
      }
    }

    console.log(`[CRON] Ingestion complete. Inserted: ${insertedCount}, Failed: ${failedCount}`);

    return NextResponse.json({
      success: true,
      message: `Ingested ${insertedCount} opportunities from SAM.gov`,
      insertedCount,
      failedCount,
      totalFetched: opportunities.length,
    });

  } catch (error) {
    console.error('[CRON] Ingestion failed:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Ingestion failed' }, { status: 500 });
  }
}
