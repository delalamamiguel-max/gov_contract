import { Search, LayoutDashboard, Settings, Bell, Sparkles } from 'lucide-react';
import Link from 'next/link';
import BidFlareLogo from '@/components/BidFlareLogo';
import { redirect } from 'next/navigation';
import { readProfile, isOnboarded } from '@/lib/profile';
import { getCurrentUser } from '@/lib/supabase/server';
import LogoutButton from '@/components/LogoutButton';

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // Auth gate: must be signed in to access the dashboard.
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/${locale}/login`);
  }

  // First-time gate: send new users through onboarding before the dashboard.
  const profile = await readProfile();
  if (!isOnboarded(profile)) {
    redirect(`/${locale}/onboarding`);
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', width: '100%' }}>
        {/* Sidebar */}
        <aside style={{
          width: '260px',
          background: 'rgba(255, 255, 255, 0.7)',
          backdropFilter: 'blur(12px)',
          borderRight: '1px solid var(--border-color)',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '2rem'
        }}>
          <BidFlareLogo height={30} />

          <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flexGrow: 1 }}>
            <Link href={`/${locale}/dashboard/recommendations`} style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem',
              borderRadius: '8px', color: 'var(--text-primary)', background: 'var(--surface-primary)',
              border: '1px solid var(--border-color)'
            }}>
              <Sparkles size={18} />
              <span style={{ fontWeight: 500 }}>For You</span>
            </Link>
            <Link href={`/${locale}/dashboard/search`} style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem',
              borderRadius: '8px', color: 'var(--text-secondary)'
            }}>
              <Search size={18} />
              <span style={{ fontWeight: 500 }}>Contract Search</span>
            </Link>
            <Link href={`/${locale}/dashboard/pipeline`} style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem',
              borderRadius: '8px', color: 'var(--text-secondary)'
            }}>
              <LayoutDashboard size={18} />
              <span style={{ fontWeight: 500 }}>My Pipeline</span>
            </Link>
            <Link href={`/${locale}/dashboard/alerts`} style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem',
              borderRadius: '8px', color: 'var(--text-secondary)'
            }}>
              <Bell size={18} />
              <span style={{ fontWeight: 500 }}>Alerts</span>
            </Link>
          </nav>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <Link href={`/${locale}/dashboard/settings`} style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem',
              borderRadius: '8px', color: 'var(--text-secondary)'
            }}>
              <Settings size={18} />
              <span style={{ fontWeight: 500 }}>Settings</span>
            </Link>
            <LogoutButton />
          </div>
        </aside>

        {/* Main Content Area */}
        <main style={{ flexGrow: 1, padding: '2rem 3rem', overflowY: 'auto' }}>
          {children}
        </main>
      </div>
  );
}
