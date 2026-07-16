'use client';

/**
 * useTableState — the list-state manager for every list page.
 *
 * State (search, filters incl. status tabs, page, ordering, page size, the
 * advanced-filter panel and scroll position) persists to sessionStorage under
 * a per-page key, and is restored SYNCHRONOUSLY on mount — before the first
 * query fires — so navigating into a record and coming Back lands the user
 * exactly where they left the list.
 *
 * Persistence rules:
 *  - Keyed by pathname by default; pass { key } for pages with several lists.
 *  - sessionStorage → a new browser session starts clean.
 *  - "Reset filters" clears the saved state (explicit user intent).
 *  - Corrupt / outdated payloads are discarded (versioned schema).
 *  - Row selection is deliberately NOT persisted (bulk actions must never
 *    resurrect an invisible selection).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

const VERSION = 1;
const PREFIX = 'erb:list-state:';

interface PersistedListState {
  v: number;
  page: number;
  search: string;
  filters: Record<string, unknown>;
  ordering: string;
  pageSize: number | null;
  advOpen: boolean;
  scrollY: number;
}

function loadState(storageKey: string): PersistedListState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedListState;
    if (
      parsed?.v !== VERSION ||
      typeof parsed.page !== 'number' ||
      typeof parsed.search !== 'string' ||
      typeof parsed.filters !== 'object' || parsed.filters === null ||
      typeof parsed.ordering !== 'string'
    ) {
      window.sessionStorage.removeItem(storageKey);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function saveState(storageKey: string, state: PersistedListState) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(storageKey, JSON.stringify(state));
  } catch {
    /* storage full/blocked — state simply won't persist */
  }
}

function clearState(storageKey: string) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(storageKey);
  } catch { /* ignore */ }
}

export interface UseTableStateOptions {
  /** Override the storage key (default: the current pathname). Use when one
   *  page hosts more than one list. */
  key?: string;
  defaultPageSize?: number;
}

export function useTableState(options: UseTableStateOptions = {}) {
  const pathname = usePathname();
  const storageKey = PREFIX + (options.key ?? pathname ?? 'unknown');

  // One-time synchronous restore, BEFORE the first render/query.
  const restoredRef = useRef<PersistedListState | null | undefined>(undefined);
  if (restoredRef.current === undefined) {
    restoredRef.current = loadState(storageKey);
  }
  const restored = restoredRef.current;

  const [page, setPage]         = useState(restored?.page ?? 1);
  const [search, setSearch]     = useState(restored?.search ?? '');
  const [filters, setFilters]   = useState<Record<string, unknown>>(restored?.filters ?? {});
  const [ordering, setOrderingState] = useState(restored?.ordering ?? '');
  const [pageSize, setPageSizeState] = useState<number>(
    restored?.pageSize ?? options.defaultPageSize ?? 50,
  );
  const [advOpen, setAdvOpen]   = useState(restored?.advOpen ?? false);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());

  const scrollYRef = useRef(restored?.scrollY ?? 0);

  // Persist whenever anything the user can lose changes.
  useEffect(() => {
    saveState(storageKey, {
      v: VERSION, page, search, filters, ordering,
      pageSize, advOpen, scrollY: scrollYRef.current,
    });
  }, [storageKey, page, search, filters, ordering, pageSize, advOpen]);

  // Track scroll (throttled) so Back can land at the same spot.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.setTimeout(() => {
        ticking = false;
        scrollYRef.current = window.scrollY;
        const current = loadState(storageKey);
        if (current) saveState(storageKey, { ...current, scrollY: window.scrollY });
      }, 250);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [storageKey]);

  // One-shot scroll restore — AppListPage calls this once data has rendered.
  const scrollRestoredRef = useRef(false);
  const restoreScroll = useCallback(() => {
    if (scrollRestoredRef.current) return;
    scrollRestoredRef.current = true;
    const y = restoredRef.current?.scrollY ?? 0;
    if (y > 0 && typeof window !== 'undefined') {
      requestAnimationFrame(() => window.scrollTo({ top: y }));
    }
  }, []);

  const handleSearch = useCallback((s: string) => {
    setSearch(s);
    setPage(1);
  }, []);

  const handleFilterChange = useCallback((keyOrFilters: string | Record<string, unknown>, value?: unknown) => {
    if (typeof keyOrFilters === 'string') {
      setFilters(prev => ({ ...prev, [keyOrFilters]: value }));
    } else {
      setFilters(keyOrFilters);
    }
    setPage(1);
  }, []);

  /** Explicit reset — the ONLY flow that wipes the saved state. */
  const handleFilterReset = useCallback(() => {
    setFilters({});
    setOrderingState('');
    setPage(1);
    scrollYRef.current = 0;
    clearState(storageKey);
  }, [storageKey]);

  const handleRemoveFilter = useCallback((key: string) => {
    setFilters(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setPage(1);
  }, []);

  const setOrdering = useCallback((o: string) => {
    setOrderingState(o);
    setPage(1);
  }, []);

  const setPageSize = useCallback((n: number) => {
    setPageSizeState(n);
    setPage(1);
  }, []);

  const toggleSelect = useCallback((id: number) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const selectPage = useCallback((ids: number[]) => {
    setSelectedItems(new Set(ids));
  }, []);

  const clearSelection = useCallback(() => setSelectedItems(new Set()), []);

  const isAllPageSelected = useCallback(
    (ids: number[]) => ids.length > 0 && ids.every(id => selectedItems.has(id)),
    [selectedItems],
  );

  const isSomePageSelected = useCallback(
    (ids: number[]) => ids.some(id => selectedItems.has(id)) && !ids.every(id => selectedItems.has(id)),
    [selectedItems],
  );

  return {
    page, setPage,
    search,
    filters,
    ordering, setOrdering,
    pageSize, setPageSize,
    advOpen, setAdvOpen,
    selectedItems,
    handleSearch,
    handleFilterChange,
    handleFilterReset,
    handleRemoveFilter,
    toggleSelect,
    selectPage,
    clearSelection,
    isAllPageSelected,
    isSomePageSelected,
    restoreScroll,
  };
}
