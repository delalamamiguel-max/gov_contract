// ---------------------------------------------------------------------------
// GET /api/onboarding-teaser?data=<base64>
//
// Unauthenticated. Takes the base64-encoded OnboardingAnswers from the wizard
// session, scores the opportunity database against those answers, and returns
// just enough data to display a teaser card on the payoff screen.
//
// No auth token required. No sensitive data returned (no sourceUrl, no
// full assessment breakdown). The blur is enforced by the payoff screen UI.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { queryOpportunities } from '@/lib/opportunities';
import { computeAssessment } from '@/lib/assessment';
import { answersToProfile } from '@/lib/onboardingSession';
import type { AgencyProfile } from '@/lib/profile';
import type { OnboardingAnswers } from '@/lib/onboardingSession';

export const dynamic = 'force-dynamic';

function formatDeadline(d: string | number | Date | null | undefined): string | null {
  if (!d) return null;
  try {
    const date = new Date(d);
    if (isNaN(date.getTime())) return null;
    const daysLeft = Math.round((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysLeft < 0) return null;
    if (daysLeft === 0) return 'Due today';
    if (daysLeft === 1) return '1 day left';
    if (daysLeft <= 30) return `${daysLeft} days left`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return null;
  }
}

function formatValue(v: number | null | undefined): string | null {
  if (!v) return null;
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toLocaleString()}`;
}

export async function GET(request: Request) {
  try {
    const raw = new URL(request.url).searchParams.get('data');
    if (!raw) {
      return NextResponse.json({ error: 'no data' }, { status: 400 });
    }

    let answers: Partial<OnboardingAnswers>;
    try {
      answers = JSON.parse(Buffer.from(raw, 'base64url').toString('utf-8'));
    } catch {
      return NextResponse.json({ error: 'invalid data' }, { status: 400 });
    }

    // Build a partial profile from the answers — enough for scoring.
    // Use a generous radius (100mi) so we see the most results.
    const partialProfile = answersToProfile(answers) as AgencyProfile;
    const radius = 100;

    // Pull from our Supabase store (never SAM.gov live).
    const { results, unavailable } = await queryOpportunities({ limit: 200 });

    if (unavailable) {
      return NextResponse.json({ found: false, reason: 'db_unavailable' });
    }

    if (results.length === 0) {
      return NextResponse.json({ found: false, reason: 'no_opportunities' });
    }

    // Score all results and filter to ≥40 (Possible Match and above).
    const scored = results
      .map((o) => ({ o, a: computeAssessment(o, partialProfile, radius) }))
      .filter(({ a }) => a.matchScore >= 40)
      .sort((x, y) => y.a.matchScore - x.a.matchScore);

    if (scored.length === 0) {
      return NextResponse.json({ found: false, reason: 'no_matches' });
    }

    const top = scored[0];

    return NextResponse.json({
      found: true,
      title: top.o.title,
      agency: top.o.agency ?? null,
      matchScore: top.a.matchScore,
      label: top.a.label,
      deadline: formatDeadline(top.o.responseDeadline),
      estimatedValue: formatValue(top.o.estimatedValue),
      totalFound: scored.length,
    });
  } catch (err) {
    console.error('[onboarding-teaser]', err);
    return NextResponse.json({ error: 'internal error' }, { status: 500 });
  }
}
