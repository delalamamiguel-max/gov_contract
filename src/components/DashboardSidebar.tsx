'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale } from 'next-intl';
import { Search, LayoutDashboard, Settings, Bell, Sparkles, LogOut } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

interface NavItem {
  href: string;
  label: string;
  Icon: typeof Search;
}

export default function DashboardSidebar() {
  const pathname = usePathname() || '';
  const locale = useLocale();
  const router = useRouter();

  // Single ordered list so visual order is obvious and easy to reorder.
  // Per latest UX feedback Settings + Logout sit directly under Alerts
  // (no flex-spacer in between).
  const items: NavItem[] = [
    { href: `/${locale}/dashboard/recommendations`, label: 'For You', Icon: Sparkles },
    { href: `/${locale}/dashboard/search`, label: 'Contract Search', Icon: Search },
    { href: `/${locale}/dashboard/pipeline`, label: 'My Pipeline', Icon: LayoutDashboard },
    { href: `/${locale}/dashboard/alerts`, label: 'Alerts', Icon: Bell },
    { href: `/${locale}/dashboard/settings`, label: 'Settings', Icon: Settings },
  ];

  // Treat a link as active when the current path starts with its href —
  // covers nested routes (e.g. /search?q=…).
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/') || pathname.startsWith(href + '?');

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push(`/${locale}/login`);
    router.refresh();
  };

  return (
    <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flexGrow: 1 }}>
      {items.map(({ href, label, Icon }) => {
        const active = isActive(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              color: active ? 'var(--accent-primary)' : 'var(--text-secondary)',
              background: active ? 'rgba(26, 169, 201, 0.10)' : 'transparent',
              border: active ? '1px solid rgba(26, 169, 201, 0.35)' : '1px solid transparent',
              borderLeft: active ? '3px solid var(--accent-primary)' : '3px solid transparent',
              fontWeight: active ? 600 : 500,
              transition: 'background 0.15s ease, color 0.15s ease, border-color 0.15s ease',
              textDecoration: 'none',
            }}
          >
            <Icon size={18} />
            <span>{label}</span>
          </Link>
        );
      })}

      <button
        onClick={handleLogout}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '0.75rem 1rem',
          borderRadius: '8px',
          color: 'var(--text-secondary)',
          background: 'transparent',
          border: '1px solid transparent',
          borderLeft: '3px solid transparent',
          cursor: 'pointer',
          textAlign: 'left',
          width: '100%',
          fontWeight: 500,
          fontFamily: 'inherit',
          fontSize: 'inherit',
        }}
      >
        <LogOut size={18} />
        <span>Logout</span>
      </button>
    </nav>
  );
}
