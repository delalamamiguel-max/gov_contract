'use client';

import '@/lib/firebase';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getTenant } from '@/lib/dataconnect';

const DEMO_TENANT_ID = '123e4567-e89b-12d3-a456-426614174000';

export default function PaywallGuard({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function checkPaywall() {
      try {
        const res = await getTenant({ id: DEMO_TENANT_ID });
        const tenant = res.data.tenant;
        
        if (tenant) {
          if (tenant.tokensRemaining <= 0 && !tenant.isPro) {
            // Out of tokens and not Pro, block access
            router.push('/pricing');
            return;
          }
        }
      } catch (error) {
        console.error("Failed to check paywall status:", error);
      } finally {
        setLoading(false);
      }
    }
    
    checkPaywall();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return <>{children}</>;
}
