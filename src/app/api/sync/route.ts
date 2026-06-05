export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';

/**
 * DEPRECATED. The old /api/sync wrote to Firebase Data Connect (non-functional).
 * Ingestion now lives in the centralized service used by /api/cron/ingest, which
 * normalizes SAM.gov data into Supabase. Trigger a manual run with:
 *   GET /api/cron/ingest?force=1   (Authorization: Bearer ${CRON_SECRET})
 */
export async function GET() {
  return NextResponse.json(
    {
      error: 'Deprecated endpoint.',
      message: 'Use GET /api/cron/ingest (Vercel Cron) or /api/cron/ingest?force=1 for a manual sync.',
    },
    { status: 410 }
  );
}
