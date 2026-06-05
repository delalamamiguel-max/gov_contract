'use client';

import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { LogOut } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function LogoutButton() {
  const router = useRouter();
  const locale = useLocale();
  const supabase = createClient();

  const logout = async () => {
    await supabase.auth.signOut();
    router.push(`/${locale}/login`);
    router.refresh();
  };

  return (
    <button
      onClick={logout}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.75rem 1rem',
        borderRadius: '8px',
        color: 'var(--text-secondary)',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        textAlign: 'left',
        width: '100%',
      }}
    >
      <LogOut size={18} />
      <span style={{ fontWeight: 500 }}>Logout</span>
    </button>
  );
}
