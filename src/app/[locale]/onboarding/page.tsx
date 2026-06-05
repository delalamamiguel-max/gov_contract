import OnboardingWizard from '@/components/onboarding/OnboardingWizard';

export default function OnboardingPage() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'flex-start', justifyContent: 'center', padding: '3rem 2rem' }}>
      <div style={{ width: '100%', maxWidth: 720, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <header>
          <h1 style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>Set up your agency profile</h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            A few quick questions so we can match you to the right public-sector, nonprofit, education, and healthcare marketing opportunities.
          </p>
        </header>
        <OnboardingWizard />
      </div>
    </div>
  );
}
