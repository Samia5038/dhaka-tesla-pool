'use client';

import { useEffect, useRef } from 'react';

// Calls load() now and then every `ms` milliseconds. Simple "live" updates without websockets.
export function usePolling(load, ms = 4000, enabled = true) {
  const latest = useRef(load);

  useEffect(() => {
    latest.current = load;
  });

  useEffect(() => {
    if (!enabled) return undefined;
    latest.current();
    const id = setInterval(() => latest.current(), ms);
    return () => clearInterval(id);
  }, [ms, enabled]);
}
