'use client';

import { Search as SearchIcon } from 'lucide-react';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import { useState, useTransition } from 'react';

export default function SearchInput() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [isPending, startTransition] = useTransition();

  const params = useParams();
  const locale = params.locale || 'en';

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
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
      flex: 1, display: 'flex', alignItems: 'center', gap: '1rem',
      background: 'var(--surface-primary)', border: '1px solid var(--border-color)',
      padding: '0.5rem 1rem', borderRadius: '12px'
    }}>
      <SearchIcon size={20} color={isPending ? 'var(--accent-primary)' : 'var(--text-secondary)'} />
      <input 
        type="text" 
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by keywords, NAICS, or Agency..." 
        style={{
          background: 'transparent', border: 'none', color: 'white', width: '100%', fontSize: '1rem', outline: 'none'
        }} 
      />
    </form>
  );
}
