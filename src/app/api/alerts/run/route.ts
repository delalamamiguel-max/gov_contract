export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { queryOpportunities } from '@/lib/opportunities';
import { readProfile, getProfileKey, profileCookieOptions } from '@/lib/profile';
import { readAlerts, alertMatches, syncAlertsToSupabase, ALERTS_COOKIE } from '@/lib/alerts';
import { computeAssessment } from '@/lib/assessment';
import { computeChecklist } from '@/lib/checklist';
import { readFeedbackSignals } from '@/lib/feedback';

function fmtValue(v: number | null | undefined): string {
  if (!v) return 'TBD';
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toLocaleString()}`;
}

/** POST /api/alerts/run — Body: { id }. Runs one alert against the synced Supabase store. */
export async function POST(req: Request) {
  let id: string | undefined;
  try {
    ({ id } = await req.json());
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const alerts = await readAlerts();
  const alert = alerts.find((a) => a.id === id);
  if (!alert) return NextResponse.json({ error: 'Alert not found' }, { status: 404 });

  const profile = await readProfile();
  const signals = await readFeedbackSignals();
  const radius = alert.criteria.radiusMiles ?? profile.serviceRadiusMiles ?? 50;
  const query =
    alert.criteria.keywords?.[0] ||
    alert.criteria.services?.[0] ||
    profile.keywords?.[0] ||
    'marketing';

  // Query the synced Supabase store (never SAM.gov live).
  const queryRes = await queryOpportunities({
    keyword: query,
    setAsideType: alert.criteria.certifications?.[0],
    limit: 200,
  });
  const results = queryRes.results;
  const error = queryRes.unavailable
    ? 'Opportunity database is not available right now.'
    : queryRes.error;

  const matches = results
    .filter((o) => alertMatches(alert.criteria, o))
    .map((o) => ({
      id: o.noticeId,
      title: o.title,
      agency: o.agency,
      description: o.description || 'No description text was available for this opportunity.',
      descriptionUrl: o.descriptionUrl ?? null,
      value: fmtValue(o.estimatedValue),
      estimatedValue: o.estimatedValue ?? null,
      naicsCode: o.naicsCode,
      pscCode: o.pscCode,
      setAsideType: o.setAsideType,
      placeOfPerformance: o.placeOfPerformance,
      responseDeadline: o.responseDeadline,
      sourceUrl: o.sourceUrl,
      assessment: computeAssessment(o, profile, radius, signals),
      checklist: computeChecklist(o, profile),
    }))
    .sort((a, b) => b.assessment.matchScore - a.assessment.matchScore);

  // Record run stats on the alert.
  const next = alerts.map((a) =>
    a.id === id ? { ...a, lastRunAt: new Date().toISOString(), lastMatchCount: matches.length } : a
  );
  const res = NextResponse.json({ matches, count: matches.length, radius, query, error });
  res.cookies.set(ALERTS_COOKIE, JSON.stringify(next), profileCookieOptions());
  const pid = await getProfileKey();
  if (pid) await syncAlertsToSupabase(pid, next);
  return res;
}
