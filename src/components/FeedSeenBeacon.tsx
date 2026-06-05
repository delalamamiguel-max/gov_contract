'use client';

import { useEffect, useRef } from 'react';

/**
 * Fires once after the recommendations feed renders to advance the
 * "last feed seen" watermark, so items shown now aren't flagged "new" next time.
 * Renders nothing.
 */
export default function FeedSeenBeacon() {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    // Small delay so the user actually sees the "new" labels before we clear them.
    const t = setTimeout(() => {
      fetch('/api/feed/seen', { method: 'POST' }).catch(() => {});
    }, 4000);
    return () => clearTimeout(t);
  }, []);
  return null;
}
