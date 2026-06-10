'use client';

import { useState, Children } from 'react';
import { ChevronDown } from 'lucide-react';

// ---------------------------------------------------------------------------
// ShowMoreFeed — generic progressive-disclosure wrapper for any list of items.
// Renders the first `initialVisible` items; clicking "Show more" reveals the
// rest in-place. No reload, no scroll jump.
//
// IMPORTANT: this is a Client Component, so it CANNOT receive a render function
// (e.g. `renderItem`) from a Server Component — React cannot serialize functions
// across the RSC boundary and the production build throws
// ("Functions cannot be passed directly to Client Components"). Instead the
// parent pre-renders the items and passes them as children; JSX/ReactNodes are
// serializable, functions are not. We slice the children to control visibility.
// ---------------------------------------------------------------------------

interface ShowMoreFeedProps {
  /** Pre-rendered item nodes. The parent renders these (server-safe). */
  children: React.ReactNode;
  initialVisible?: number;
  /** Label for the show-more button, e.g. "more matches" */
  moreLabel?: string;
}

export default function ShowMoreFeed({
  children,
  initialVisible = 5,
  moreLabel = 'more',
}: ShowMoreFeedProps) {
  const [showAll, setShowAll] = useState(false);

  const all = Children.toArray(children);
  const visible = showAll ? all : all.slice(0, initialVisible);
  const hiddenCount = all.length - initialVisible;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {visible}

      {!showAll && hiddenCount > 0 && (
        <button
          onClick={() => setShowAll(true)}
          className="btn btn-secondary"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: '0.5rem', padding: '0.6rem 1.25rem',
            fontSize: '0.86rem', width: '100%',
          }}
        >
          <ChevronDown size={14} />
          Show more ({hiddenCount} {moreLabel})
        </button>
      )}
    </div>
  );
}
