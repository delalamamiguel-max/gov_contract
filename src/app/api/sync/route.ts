export const dynamic = 'force-dynamic';

import '@/lib/firebase';
import { NextResponse } from 'next/server';
import { upsertOpportunity } from '@/lib/dataconnect';

// Utility to parse SAM.gov dates (YYYY-MM-DD or MM/DD/YYYY) to ISO Timestamp strings
function parseDateString(dateStr?: string) {
  if (!dateStr) return undefined;
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? undefined : d.toISOString();
  } catch {
    return undefined;
  }
}

export async function GET(request: Request) {
  try {
    // 1. Verify API Key exists
    const apiKey = process.env.SAM_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'SAM_API_KEY is not configured in environment variables.' }, { status: 500 });
    }

    // 2. Fetch the latest opportunities from SAM.gov (e.g. limit to 50 for testing/syncing)
    // In a real production app, this would use 'postedFrom' and 'postedTo' based on the last sync date.
    // We will just fetch the latest 50 results for the MVP.
    const samUrl = `https://api.sam.gov/opportunities/v2/search?api_key=${apiKey}&limit=50&ptype=o,p`;
    
    console.log('Fetching SAM.gov opportunities:', samUrl);
    
    const response = await fetch(samUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('SAM API Error:', errorText);
      return NextResponse.json({ error: 'Failed to fetch from SAM.gov', details: errorText }, { status: response.status });
    }

    const data = await response.json();
    
    if (!data.opportunitiesData || !Array.isArray(data.opportunitiesData)) {
      return NextResponse.json({ error: 'Invalid response format from SAM.gov' }, { status: 500 });
    }

    const opportunities = data.opportunitiesData;
    let successCount = 0;
    let failureCount = 0;

    // 3. Sync each opportunity into Firebase Data Connect
    for (const opp of opportunities) {
      try {
        const noticeId = opp.noticeId || opp.solicitationNumber;
        if (!noticeId) continue; // Skip if no ID

        await upsertOpportunity({
          noticeId: noticeId,
          title: opp.title || 'Untitled Opportunity',
          agency: opp.fullParentPathName || opp.department || 'Unknown Agency',
          description: opp.description || opp.solicitationNumber || 'Detailed description available on SAM.gov',
          solicitationNumber: opp.solicitationNumber || '',
          naicsCode: Array.isArray(opp.naicsCodes) ? opp.naicsCodes[0] : (opp.naicsCode || ''),
          setAsideType: opp.typeOfSetAsideDescription || opp.typeOfSetAside || 'None',
          postedDate: parseDateString(opp.postedDate) || new Date().toISOString(),
          responseDeadline: parseDateString(opp.responseDeadLine),
          estimatedValue: 0, // SAM doesn't typically provide this in search
          sourceUrl: opp.uiLink || `https://sam.gov/opp/${noticeId}/view`
        });
        
        successCount++;
      } catch (err) {
        console.error(`Failed to upsert opportunity ${opp.noticeId}:`, err);
        failureCount++;
      }
    }

    return NextResponse.json({
      message: 'Sync completed successfully',
      totalFetched: opportunities.length,
      successCount,
      failureCount
    });

  } catch (error: any) {
    console.error('Sync Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
