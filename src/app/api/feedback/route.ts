export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import {
  appendFeedbackCookie, saveFeedbackToSupabase, readFeedbackSignals,
  FEEDBACK_COOKIE, type Feedback, type FeedbackAnswers,
} from '@/lib/feedback';
import { getProfileKey, profileCookieOptions } from '@/lib/profile';

/** GET — return distilled feedback signals (for transparency/debug). */
export async function GET() {
  const signals = await readFeedbackSignals();
  return NextResponse.json({ signals });
}

/** POST — store a feedback questionnaire. Body: { noticeId, opportunityTitle, answers } */
export async function POST(req: Request) {
  let body: { noticeId?: string; opportunityTitle?: string; answers?: FeedbackAnswers };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const fb: Feedback = {
    id: globalThis.crypto.randomUUID(),
    noticeId: body.noticeId ?? null,
    opportunityTitle: body.opportunityTitle ?? null,
    answers: body.answers || {},
    createdAt: new Date().toISOString(),
  };

  const nextCookie = await appendFeedbackCookie(fb);
  const res = NextResponse.json({ success: true });
  res.cookies.set(FEEDBACK_COOKIE, JSON.stringify(nextCookie), profileCookieOptions());

  const pid = await getProfileKey();
  if (pid) await saveFeedbackToSupabase(pid, fb); // best-effort

  return res;
}
