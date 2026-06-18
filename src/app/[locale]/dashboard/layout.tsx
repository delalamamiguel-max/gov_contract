import BidFlareLogo from '@/components/BidFlareLogo';
import DashboardSidebar from '@/components/DashboardSidebar';
import { redirect } from 'next/navigation';
import { readProfile } from '@/lib/profile';
import { getCurrentUser } from '@/lib/supabase/server';

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
  // Redirect removed to prevent routing loops on profile resets.
  // Individual dashboard pages handle their own empty states.

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
        gap: '2rem',
      }}>
        <BidFlareLogo height={30} />
        {/* Client-rendered nav: highlights the active section via usePathname,
            and renders Settings + Logout directly below Alerts. */}
        <DashboardSidebar />
      </aside>

      {/* Main Content Area */}
      <main style={{ flexGrow: 1, padding: '2rem 3rem', overflowY: 'auto' }}>
        {children}
      </main>
    </div>
  );
}
