export const dynamic = 'force-dynamic';

import '@/lib/firebase';
import { NextResponse } from 'next/server';
import { upsertOpportunity } from '@/lib/dataconnect';

const SAM_API_BASE = 'https://api.sam.gov/opportunities/v2/search';
const SAM_REQUEST_TIMEOUT_MS = 15_000;

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
    // 1. Verify API Key exists — standardized to SAM_GOV_API_KEY
    const apiKey = process.env.SAM_GOV_API_KEY;
    if (!apiKey) {
      console.error('[Sync] SAM_GOV_API_KEY is not configured.');
      return NextResponse.json(
        { error: 'SAM_GOV_API_KEY is not configured in environment variables.' },
        { status: 500 }
      );
    }

    // 2. Fetch the latest opportunities from SAM.gov
    const url = new URL(SAM_API_BASE);
    url.searchParams.set('api_key', apiKey);
    url.searchParams.set('limit', '50');
    url.searchParams.set('ptype', 'o,p');

    console.log('[Sync] Fetching SAM.gov opportunities...');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SAM_REQUEST_TIMEOUT_MS);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Sync] SAM.gov API returned ${response.status}: ${errorText.slice(0, 200)}`);
      return NextResponse.json(
        { error: 'Failed to fetch from SAM.gov', status: response.status },
        { status: response.status }
      );
    }

    const data = await response.json();

    if (!data.opportunitiesData || !Array.isArray(data.opportunitiesData)) {
      console.error('[Sync] Unexpected SAM.gov response format — missing opportunitiesData array.');
      return NextResponse.json({ error: 'Invalid response format from SAM.gov' }, { status: 500 });
    }

    const opportunities = data.opportunitiesData;
    let successCount = 0;
    let failureCount = 0;

    console.log(`[Sync] Received ${opportunities.length} opportunities. Starting upsert...`);

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
          estimatedValue: 0,
          sourceUrl: opp.uiLink || `https://sam.gov/opp/${noticeId}/view`
        });

        successCount++;
      } catch (err) {
        console.error(`[Sync] Failed to upsert opportunity ${opp.noticeId}:`, err instanceof Error ? err.message : err);
        failureCount++;
      }
    }

    console.log(`[Sync] Complete. Success: ${successCount}, Failed: ${failureCount}`);

    return NextResponse.json({
      message: 'Sync completed successfully',
      totalFetched: opportunities.length,
      successCount,
      failureCount
    });

  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('[Sync] SAM.gov request timed out.');
      return NextResponse.json({ error: 'SAM.gov request timed out' }, { status: 504 });
    }
    console.error('[Sync] Unexpected error:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Internal sync error' }, { status: 500 });
  }
}
