'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

// ---------------------------------------------------------------------------
// ShowMoreFeed — generic progressive-disclosure wrapper for any list of items.
// Renders the first `initialVisible` items; clicking "Show more" reveals the
// rest in-place. No reload, no scroll jump.
// ---------------------------------------------------------------------------

interface ShowMoreFeedProps<T> {
  items: T[];
  initialVisible?: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  /** Label for the show-more button, e.g. "more matches" */
  moreLabel?: string;
}

export default function ShowMoreFeed<T>({
  items,
  initialVisible = 5,
  renderItem,
  moreLabel = 'more',
}: ShowMoreFeedProps<T>) {
  const [showAll, setShowAll] = useState(false);

  const visible = showAll ? items : items.slice(0, initialVisible);
  const hiddenCount = items.length - initialVisible;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {visible.map((item, i) => renderItem(item, i))}

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
