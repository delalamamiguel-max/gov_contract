export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import {
  saveOpportunity,
  listSavedOpportunities,
  updateSavedStatus,
  type PipelineStatus,
} from '@/lib/pipeline';

/** GET /api/pipeline — list the current user's saved opportunities. */
export async function GET() {
  const { items, unavailable } = await listSavedOpportunities();
  return NextResponse.json({ items, unavailable: Boolean(unavailable) });
}

/** POST /api/pipeline — add an opportunity to the pipeline (defaults to "saved"). */
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const noticeId = String(body.id ?? body.noticeId ?? '').trim();
  if (!noticeId) {
    return NextResponse.json({ error: 'Missing opportunity id' }, { status: 400 });
  }

  const result = await saveOpportunity(
    {
      noticeId,
      title: (body.title as string) ?? null,
      agency: (body.agency as string) ?? null,
      value: (body.value as string) ?? null,
      source: (body.source as string) ?? null,
    },
    (body.status as PipelineStatus) || 'saved'
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error || 'Failed to add to pipeline' }, { status: result.unavailable ? 503 : 500 });
  }
  return NextResponse.json({ success: true });
}

/** PATCH /api/pipeline — move a saved opportunity to a different column. */
export async function PATCH(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const noticeId = String(body.id ?? body.noticeId ?? '').trim();
  const status = body.status as PipelineStatus;
  if (!noticeId || !status) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
  }

  const result = await updateSavedStatus(noticeId, status);
  if (!result.ok) {
    return NextResponse.json({ error: result.error || 'Failed to update pipeline' }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
