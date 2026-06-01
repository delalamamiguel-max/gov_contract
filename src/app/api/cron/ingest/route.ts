import { NextResponse } from 'next/server';
import { fetchSamGovOpportunities } from '@/scripts/ingestion/samgov';
import { upsertOpportunity } from '@/lib/dataconnect';

export async function GET(request: Request) {
  // Simple security check to prevent public abuse
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET || 'dev-secret'}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log('[CRON] Starting SAM.gov data ingestion...');
    const opportunities = await fetchSamGovOpportunities();
    
    let insertedCount = 0;
    
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
        console.error(`[CRON] Failed to upsert opportunity ${opp.noticeId}:`, err);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Ingested ${insertedCount} opportunities from SAM.gov`,
      data: opportunities
    });
    
  } catch (error) {
    console.error('[CRON] Ingestion Failed:', error);
    return NextResponse.json({ error: 'Ingestion Failed' }, { status: 500 });
  }
}
