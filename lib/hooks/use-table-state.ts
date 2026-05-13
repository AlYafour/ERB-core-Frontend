import { useState, useCallback } from 'react';

export function useTableState() {
  const [page, setPage]               = useState(1);
  const [search, setSearch]           = useState('');
  const [filters, setFilters]         = useState<Record<string, unknown>>({});
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());

  const handleSearch = useCallback((s: string) => {
    setSearch(s);
    setPage(1);
  }, []);

  const handleFilterChange = useCallback((f: Record<string, unknown>) => {
    setFilters(f);
    setPage(1);
  }, []);

  const handleFilterReset = useCallback(() => {
    setFilters({});
    setPage(1);
  }, []);

  const handleRemoveFilter = useCallback((key: string) => {
    setFilters(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
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
  };
}
