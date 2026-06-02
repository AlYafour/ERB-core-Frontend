'use client';

import { useState, useCallback, useRef } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';

export type SortDir = 'asc' | 'desc';
export interface SortState { key: string; dir: SortDir }

function loadPrefs(key: string): Record<string, unknown> {
  if (typeof window === 'undefined') return {};
  try { return JSON.parse(localStorage.getItem(`elp_${key}`) ?? '{}'); } catch { return {}; }
}

function savePrefs(key: string, patch: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  try {
    const prev = loadPrefs(key);
    localStorage.setItem(`elp_${key}`, JSON.stringify({ ...prev, ...patch }));
  } catch {}
}

export function useListState(persistKey: string) {
  const router    = useRouter();
  const pathname  = usePathname();
  const params    = useSearchParams();
  const prefs     = loadPrefs(persistKey);

  // ── URL-synced state ───────────────────────────────────────────────────────
  const [page, _setPage] = useState(() => Math.max(1, Number(params.get('page') ?? 1)));

  const [search, _setSearch] = useState(() => params.get('q') ?? '');

  const [sort, _setSort] = useState<SortState | null>(() => {
    const k = params.get('sort');
    return k ? { key: k, dir: (params.get('dir') === 'desc' ? 'desc' : 'asc') } : null;
  });

  const [filters, _setFilters] = useState<Record<string, unknown>>(() => {
    const skip = new Set(['page', 'q', 'sort', 'dir', 'pageSize']);
    const f: Record<string, unknown> = {};
    params.forEach((v, k) => { if (!skip.has(k)) f[k] = v; });
    return f;
  });

  // ── Persisted preferences (localStorage) ──────────────────────────────────
  const [pageSize, _setPageSize]    = useState<number>(Number(prefs.pageSize) || 25);
  const [density, _setDensity]      = useState<'comfortable' | 'compact'>((prefs.density as 'comfortable' | 'compact') ?? 'comfortable');
  const [hiddenColumns, _setHidden] = useState<string[]>((prefs.hiddenColumns as string[]) ?? []);

  // ── Selection ──────────────────────────────────────────────────────────────
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());

  // ── Debounce timer ─────────────────────────────────────────────────────────
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [searchInput, setSearchInput] = useState(search);

  // ── URL helper ─────────────────────────────────────────────────────────────
  const pushUrl = useCallback((updates: Record<string, string | null>) => {
    const p = new URLSearchParams(params.toString());
    Object.entries(updates).forEach(([k, v]) => {
      if (v === null || v === '') p.delete(k); else p.set(k, v);
    });
    const qs = p.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false });
  }, [router, pathname, params]);

  // ── Page ───────────────────────────────────────────────────────────────────
  const setPage = useCallback((n: number) => {
    _setPage(n);
    pushUrl({ page: n <= 1 ? null : String(n) });
  }, [pushUrl]);

  // ── Search (debounced 350 ms) ──────────────────────────────────────────────
  const handleSearch = useCallback((s: string) => {
    setSearchInput(s);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      _setSearch(s);
      _setPage(1);
      pushUrl({ q: s || null, page: null });
    }, 350);
  }, [pushUrl]);

  // ── Filters ────────────────────────────────────────────────────────────────
  const handleFilterChange = useCallback((f: Record<string, unknown>) => {
    const updates: Record<string, string | null> = { page: null };
    Object.keys(filters).forEach(k => { updates[k] = null; });
    Object.entries(f).forEach(([k, v]) => { updates[k] = v != null && v !== '' ? String(v) : null; });
    _setFilters(f);
    _setPage(1);
    pushUrl(updates);
  }, [filters, pushUrl]);

  const handleFilterReset = useCallback(() => {
    const updates: Record<string, string | null> = { page: null };
    Object.keys(filters).forEach(k => { updates[k] = null; });
    _setFilters({});
    _setPage(1);
    pushUrl(updates);
  }, [filters, pushUrl]);

  const handleRemoveFilter = useCallback((key: string) => {
    _setFilters(prev => { const n = { ...prev }; delete n[key]; return n; });
    _setPage(1);
    pushUrl({ [key]: null, page: null });
  }, [pushUrl]);

  // ── Sort ───────────────────────────────────────────────────────────────────
  const handleSort = useCallback((key: string) => {
    _setSort(prev => {
      const next: SortState = (prev?.key === key && prev.dir === 'asc')
        ? { key, dir: 'desc' }
        : { key, dir: 'asc' };
      pushUrl({ sort: next.key, dir: next.dir, page: null });
      return next;
    });
    _setPage(1);
  }, [pushUrl]);

  // ── Preferences ────────────────────────────────────────────────────────────
  const setPageSize = useCallback((n: number) => {
    _setPageSize(n);
    _setPage(1);
    savePrefs(persistKey, { pageSize: n });
    pushUrl({ page: null });
  }, [persistKey, pushUrl]);

  const setDensity = useCallback((d: 'comfortable' | 'compact') => {
    _setDensity(d);
    savePrefs(persistKey, { density: d });
  }, [persistKey]);

  const toggleColumn = useCallback((key: string) => {
    _setHidden(prev => {
      const next = prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key];
      savePrefs(persistKey, { hiddenColumns: next });
      return next;
    });
  }, [persistKey]);

  const resetColumnVisibility = useCallback(() => {
    _setHidden([]);
    savePrefs(persistKey, { hiddenColumns: [] });
  }, [persistKey]);

  // ── Selection helpers ──────────────────────────────────────────────────────
  const toggleSelect = useCallback((id: number) => {
    setSelectedItems(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }, []);

  const selectPage = useCallback((ids: number[]) => setSelectedItems(new Set(ids)), []);

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
    // URL-synced
    page, setPage,
    search, searchInput, handleSearch,
    sort, handleSort,
    filters, handleFilterChange, handleFilterReset, handleRemoveFilter,
    pageSize, setPageSize,
    // Persisted prefs
    density, setDensity,
    hiddenColumns, toggleColumn, resetColumnVisibility,
    // Selection
    selectedItems, setSelectedItems, toggleSelect, selectPage, clearSelection,
    isAllPageSelected, isSomePageSelected,
  };
}

export type ListState = ReturnType<typeof useListState>;
