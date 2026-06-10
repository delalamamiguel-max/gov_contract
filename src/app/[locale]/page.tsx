import { getTranslations, getLocale } from 'next-intl/server';
import { ArrowRight, Search, Zap, Globe } from 'lucide-react';
import Link from 'next/link';
import BidFlareLogo from '@/components/BidFlareLogo';

export default async function Home() {
  const t = await getTranslations('Index');
  const locale = await getLocale();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      {/* Navbar */}
      <nav style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '1.5rem 4rem',
        position: 'fixed', top: 0, left: 0, right: 0,
        zIndex: 50,
        background: 'rgba(255, 255, 255, 0.7)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border-color)'
      }}>
        <BidFlareLogo height={30} />
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <Link href={`/${locale}/login`} style={{ color: 'var(--text-secondary)', fontWeight: 500, padding: '0.5rem 1rem' }}>{t('login')}</Link>
          <Link href={`/${locale}/onboarding`} className="btn btn-primary" style={{ padding: '0.6rem 1.25rem' }}>
            {t('signup')}
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <main style={{ 
        padding: '12rem 2rem 8rem', 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center',
        textAlign: 'center',
        position: 'relative'
      }}>
        {/* Decorative Glow */}
        <div style={{
          position: 'absolute', top: '10%', left: '50%', transform: 'translateX(-50%)',
          width: '600px', height: '600px',
          background: 'radial-gradient(circle, rgba(26,169,201,0.15) 0%, rgba(54,242,166,0.10) 40%, rgba(0,0,0,0) 70%)',
          zIndex: -1, pointerEvents: 'none'
        }} />

        <div className="animate-fade-in" style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
          padding: '0.5rem 1rem', borderRadius: '999px',
          background: 'var(--surface-primary)', border: '1px solid var(--border-color)',
          color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: 500,
          marginBottom: '2rem'
        }}>
          <span style={{ display: 'flex', width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-primary)', boxShadow: '0 0 8px var(--accent-primary)' }}></span>
          SAM.gov, USAspending & OpenGov Integrated
        </div>

        <h1 style={{ maxWidth: '900px', margin: '0 auto 1.5rem' }}>
          Win Federal Contracts <br /> <span style={{ color: 'var(--text-secondary)' }}>Without The Red Tape.</span>
        </h1>
        
        <p style={{ maxWidth: '600px', margin: '0 auto 3rem', fontSize: '1.25rem' }}>
          The AI-powered platform for small businesses. Find perfect-fit opportunities, build your pipeline, and win more federal bids.
        </p>

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          <Link href={`/${locale}/onboarding`} className="btn btn-primary" style={{ padding: '1rem 2rem', fontSize: '1.125rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            Start For Free <ArrowRight size={20} />
          </Link>
          <Link href={`/${locale}/login`} className="btn btn-secondary" style={{ padding: '1rem 2rem', fontSize: '1.125rem' }}>
            Sign In
          </Link>
        </div>
      </main>

      {/* Features Grid */}
      <section style={{ padding: '4rem 2rem 8rem', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
          <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <div style={{ padding: '1rem', background: 'var(--surface-primary)', borderRadius: '12px', marginBottom: '1.5rem' }}>
              <Search size={24} color="var(--accent-primary)" />
            </div>
            <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Smart Search</h3>
            <p>We index SAM.gov, USAspending, and OpenGov instantly so you can find relevant bids without clicking through clunky government portals.</p>
          </div>

          <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <div style={{ padding: '1rem', background: 'var(--surface-primary)', borderRadius: '12px', marginBottom: '1.5rem' }}>
              <Zap size={24} color="#f59e0b" />
            </div>
            <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>AI Fit Scoring</h3>
            <p>Instantly know your probability of winning. Our algorithm matches your NAICS codes and capacities against the solicitation requirements.</p>
          </div>

          <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <div style={{ padding: '1rem', background: 'var(--surface-primary)', borderRadius: '12px', marginBottom: '1.5rem' }}>
              <Globe size={24} color="var(--accent-secondary)" />
            </div>
            <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Pipeline Management</h3>
            <p>Track your submitted bids, pipeline statuses, and federal opportunities all in one unified, collaborative workspace.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
