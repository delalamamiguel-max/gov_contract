// No auth required — the onboarding flow runs before signup.
import OnboardingWizard from '@/components/onboarding/OnboardingWizard';

export default function OnboardingPage() {
  return (
    <div style={{
      display: 'flex', minHeight: '100vh',
      alignItems: 'flex-start', justifyContent: 'center',
      padding: '4rem 2rem 6rem',
    }}>
      <OnboardingWizard />
    </div>
  );
}
