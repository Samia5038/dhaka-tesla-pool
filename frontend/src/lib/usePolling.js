'use client';

import { useEffect, useRef } from 'react';

export function usePolling(load, ms = 1000, enabled = true) {
  const latest = useRef(load);

  useEffect(() => {
    latest.current = load;
  }, [load]);

  useEffect(() => {
    if (!enabled) return undefined;

    latest.current();

    const id = setInterval(() => {
      latest.current();
    }, ms);

    return () => clearInterval(id);
  }, [ms, enabled]);
}