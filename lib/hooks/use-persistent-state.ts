'use client';

/**
 * usePersistentState — drop-in useState that survives navigation.
 *
 * For page-level UI state that is NOT part of useTableState (quick toggles,
 * scoped filters, month/year pickers on list pages): persists to
 * sessionStorage under `erb:page-state:<pathname>:<subKey>` and restores
 * synchronously on mount, so coming Back to the page keeps the user's
 * choices. New browser session starts clean.
 *
 * Only JSON-serializable values. Never use it for modal/form drafts —
 * resurrecting a half-typed form after navigation is not the UX we want.
 */
import { useCallback, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

export function usePersistentState<T>(subKey: string, initial: T) {
  const pathname = usePathname();
  const storageKey = `erb:page-state:${pathname ?? 'unknown'}:${subKey}`;

  const restoredRef = useRef<{ done: boolean; value: T | undefined }>({ done: false, value: undefined });
  if (!restoredRef.current.done) {
    restoredRef.current.done = true;
    if (typeof window !== 'undefined') {
      try {
        const raw = window.sessionStorage.getItem(storageKey);
        if (raw !== null) restoredRef.current.value = JSON.parse(raw) as T;
      } catch { /* corrupt entry — fall back to initial */ }
    }
  }

  const [value, setValue] = useState<T>(
    restoredRef.current.value !== undefined ? restoredRef.current.value : initial,
  );

  const set = useCallback((next: T | ((prev: T) => T)) => {
    setValue(prev => {
      const resolved = typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
      if (typeof window !== 'undefined') {
        try {
          window.sessionStorage.setItem(storageKey, JSON.stringify(resolved));
        } catch { /* storage unavailable — state stays in memory */ }
      }
      return resolved;
    });
  }, [storageKey]);

  return [value, set] as const;
}
