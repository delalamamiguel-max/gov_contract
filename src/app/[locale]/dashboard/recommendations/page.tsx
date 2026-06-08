export const dynamic = 'force-dynamic';
import { readProfile, hasProfile } from '@/lib/profile';
import { readFeedbackSignals } from '@/lib/feedback';
import { getRecommendations, type RecommendationItem } from '@/lib/recommendations';
import { countOpportunities } from '@/lib/opportunities';
import ContractRow from '@/components/ContractRow';
import FeedSeenBeacon from '@/components/FeedSeenBeacon';
import { Sparkles, Clock, Layers } from 'lucide-react';

function ItemBlock({ item, radius }: { item: RecommendationItem; radius: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.5rem',
          fontSize: '0.85rem',
          color: 'var(--text-secondary)',
          padding: '0 0.25rem',
        }}
      >
        <Sparkles size={14} color="var(--accent-primary)" style={{ marginTop: 2, flexShrink: 0 }} />
        <span>{item.explanation}</span>
      </div>
      <ContractRow opp={item} radius={radius} />
    </div>
  );
}

/**
 * Lower-confidence "other match" row — visually subordinate to the primary feed:
 * dimmed, no Sparkles explanation header, and slightly reduced opacity so the eye
 * goes to the recommended matches first.
 */
function OtherItemBlock({ item, radius }: { item: RecommendationItem; radius: number }) {
  return (
    <div style={{ opacity: 0.78 }}>
      <ContractRow opp={item} radius={radius} />
    </div>
  );
}

export default async function RecommendationsPage() {
  const profile = await readProfile();
  const profileReady = hasProfile(profile);
  const signals = await readFeedbackSignals();
  const radius = profile.serviceRadiusMiles ?? 50;

  const rec = await getRecommendations(profile, { radius, signals });
  const totalInDb = await countOpportunities();

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <header>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>
          {rec.isFirstVisit ? 'Your top matches' : 'Recommended for you'}
        </h1>
        <p>
          {rec.isFirstVisit
            ? 'Based on your agency profile, here are the opportunities that fit best right now.'
            : 'Newly available best-fit opportunities first, then the rest of your matches.'}
        </p>
      </header>

      {!profileReady && (
        <div style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.25)', borderRadius: '8px', padding: '0.75rem 1rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          Finish your agency profile to sharpen these recommendations.{' '}
          <a href="/en/onboarding" style={{ color: 'var(--accent-primary)' }}>Complete onboarding →</a>
        </div>
      )}

      {/* DB unavailable */}
      {rec.unavailable ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
          <p style={{ fontSize: '1.1rem' }}>Opportunity database isn&apos;t available right now.</p>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>This is a configuration issue, not your profile. Please try again shortly.</p>
        </div>
      ) : totalInDb === 0 ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
          <p style={{ fontSize: '1.1rem' }}>No opportunities have been synced yet.</p>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>The nightly sync pulls fresh opportunities into your database. Check back after the next sync runs.</p>
        </div>
      ) : (
        <>
          {/* NEW since last visit (returning users) */}
          {!rec.isFirstVisit && (
            <section style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Sparkles size={18} color="#34d399" />
                <h2 style={{ fontSize: '1.3rem' }}>New since your last visit</h2>
                {rec.newItems.length > 0 && (
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#34d399', background: 'rgba(16,185,129,0.15)', padding: '0.15rem 0.5rem', borderRadius: 999 }}>
                    {rec.newItems.length}
                  </span>
                )}
              </div>
              {rec.newItems.length === 0 ? (
                <div className="glass-panel" style={{ padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  No new matching opportunities since you last checked. We&apos;ll surface fresh ones here after the next sync.
                </div>
              ) : (
                rec.newItems.map((item) => <ItemBlock key={item.id} item={item} radius={radius} />)
              )}
            </section>
          )}

          {/* Top matches (first visit) OR older matches (returning) */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {!rec.isFirstVisit && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                <Clock size={18} color="var(--text-muted)" />
                <h2 style={{ fontSize: '1.3rem' }}>Your matches</h2>
              </div>
            )}
            {(rec.isFirstVisit ? rec.newItems : rec.olderItems).length === 0 ? (
              <div className="glass-panel" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-secondary)' }}>
                <p style={{ fontSize: '1.05rem' }}>No strong matches yet.</p>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  We scored {totalInDb} synced opportunities but none cleared your match threshold. Broaden your services or keywords in your profile, or widen your radius.
                </p>
              </div>
            ) : (
              (rec.isFirstVisit ? rec.newItems : rec.olderItems).map((item) => (
                <ItemBlock key={item.id} item={item} radius={radius} />
              ))
            )}
          </section>

          {/* Other opportunities — lower-confidence (Possible Match) results, kept
              visually separate and subordinate so the user can see how many more
              opportunities exist without diluting the top recommendations. */}
          {rec.otherItems.length > 0 && (
            <section
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                marginTop: '1rem',
                paddingTop: '1.5rem',
                borderTop: '1px dashed var(--border-color)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Layers size={18} color="var(--text-muted)" />
                <h2 style={{ fontSize: '1.15rem', color: 'var(--text-secondary)' }}>
                  Other opportunities
                </h2>
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    background: 'var(--border-color)',
                    padding: '0.15rem 0.5rem',
                    borderRadius: 999,
                  }}
                >
                  {rec.otherItems.length}
                </span>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '-0.5rem' }}>
                Lower match scores — worth a look if you want to broaden your pipeline.
              </p>
              {rec.otherItems.map((item) => (
                <OtherItemBlock key={item.id} item={item} radius={radius} />
              ))}
            </section>
          )}
        </>
      )}

      {/* Advance the "seen" watermark after the user has viewed the feed. */}
      <FeedSeenBeacon />
    </div>
  );
}
