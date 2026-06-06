'use client';

import { Search as SearchIcon, Loader } from 'lucide-react';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import { useState, useTransition } from 'react';

export default function SearchInput() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [isPending, startTransition] = useTransition();

  const params = useParams();
  const locale = params.locale || 'en';

  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    startTransition(() => {
      if (query.trim()) {
        router.push(`/${locale}/dashboard/search?q=${encodeURIComponent(query)}`);
      } else {
        router.push(`/${locale}/dashboard/search`);
      }
      router.refresh(); // Force server component to refetch
    });
  };

  return (
    <form onSubmit={handleSearch} style={{
      flex: 1, display: 'flex', alignItems: 'center',
      background: 'var(--surface-primary)', border: '1px solid var(--border-color)',
      padding: '0.5rem 1rem', borderRadius: '12px',
      position: 'relative',
      transition: 'border-color 0.2s ease',
    }}>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by keywords, NAICS, or Agency..."
        style={{
          background: 'transparent', border: 'none', color: 'var(--text-primary)',
          width: '100%', fontSize: '1rem', outline: 'none',
          paddingRight: '2.75rem', // space for the icon on the right
          paddingTop: '0.25rem',
          paddingBottom: '0.25rem',
        }}
      />
      <button
        type="submit"
        aria-label="Search"
        style={{
          position: 'absolute',
          right: '0.75rem',
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0.25rem',
          borderRadius: '6px',
          color: isPending ? 'var(--accent-primary)' : 'var(--text-secondary)',
          transition: 'color 0.2s ease',
        }}
      >
        {isPending ? (
          <Loader size={20} style={{ animation: 'spin 1s linear infinite' }} />
        ) : (
          <SearchIcon size={20} />
        )}
      </button>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}} />
    </form>
  );
}
