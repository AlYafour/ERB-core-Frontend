'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { productsApi } from '@/lib/api/products';
import { Product } from '@/types';

interface ProductSelectorProps {
  selectedProductId: number | null;
  onProductSelect: (product: Product | null) => void;
  selectedCategory?: string;
  onCategoryChange?: (category: string) => void;
}

function useDebounce(value: string, delay: number) {
  const [d, setD] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setD(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return d;
}

interface MenuPos { top: number; left: number; width: number; }

function usePortalMenu(triggerRef: React.RefObject<HTMLDivElement | null>, open: boolean) {
  const [pos, setPos] = useState<MenuPos | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const compute = useCallback(() => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + window.scrollY + 4, left: r.left + window.scrollX, width: r.width });
  }, [triggerRef]);

  useEffect(() => {
    if (!open) return;
    compute();
    window.addEventListener('scroll', compute, true);
    window.addEventListener('resize', compute);
    return () => {
      window.removeEventListener('scroll', compute, true);
      window.removeEventListener('resize', compute);
    };
  }, [open, compute]);

  return { pos, mounted };
}

export default function ProductSelector({
  selectedProductId,
  onProductSelect,
  selectedCategory,
  onCategoryChange,
}: ProductSelectorProps) {
  const [catQuery, setCatQuery]   = useState('');
  const [catOpen, setCatOpen]     = useState(false);
  const [prodQuery, setProdQuery] = useState('');
  const [prodOpen, setProdOpen]   = useState(false);

  const catTriggerRef  = useRef<HTMLDivElement>(null);
  const prodTriggerRef = useRef<HTMLDivElement>(null);
  const catMenuRef     = useRef<HTMLDivElement>(null);
  const prodMenuRef    = useRef<HTMLDivElement>(null);

  const debouncedProd = useDebounce(prodQuery, 200);

  const catPortal  = usePortalMenu(catTriggerRef, catOpen);
  const prodPortal = usePortalMenu(prodTriggerRef, prodOpen);

  // ── Data ──────────────────────────────────────────────────────────────
  const { data: allCategories = [], isLoading: catsLoading } = useQuery({
    queryKey: ['product-categories'],
    queryFn: productsApi.getCategories,
    staleTime: 5 * 60_000,
  });

  const filteredCats = catQuery.trim()
    ? allCategories.filter((c) => c.toLowerCase().includes(catQuery.toLowerCase()))
    : allCategories;

  const { data: productsData, isLoading: prodsLoading } = useQuery({
    queryKey: ['products-selector', selectedCategory, debouncedProd],
    queryFn: () => productsApi.getAll({
      page_size: 50,
      ...(selectedCategory ? { category: selectedCategory } : {}),
      ...(debouncedProd.trim() ? { search: debouncedProd.trim() } : {}),
    }),
    enabled: !!(selectedCategory || debouncedProd.trim().length >= 2),
    staleTime: 30_000,
  });

  const products = productsData?.results ?? [];

  const selectedProduct = selectedProductId
    ? products.find((p) => p.id === selectedProductId) ?? null
    : null;

  // ── Outside-click close ───────────────────────────────────────────────
  useEffect(() => {
    const h = (e: MouseEvent) => {
      const t = e.target as Node;
      if (catTriggerRef.current?.contains(t) || catMenuRef.current?.contains(t)) return;
      setCatOpen(false); setCatQuery('');
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      const t = e.target as Node;
      if (prodTriggerRef.current?.contains(t) || prodMenuRef.current?.contains(t)) return;
      setProdOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // ── Handlers ─────────────────────────────────────────────────────────
  const handleCatSelect = (cat: string) => {
    onCategoryChange?.(cat);
    onProductSelect(null);
    setProdQuery('');
    setCatOpen(false);
    setCatQuery('');
  };

  const handleProdSelect = (p: Product) => {
    onProductSelect(p);
    if (p.category && p.category !== selectedCategory) onCategoryChange?.(p.category);
    setProdOpen(false);
    setProdQuery('');
  };

  const clearProduct  = () => { onProductSelect(null); setProdQuery(''); };
  const clearCategory = () => { onCategoryChange?.(''); onProductSelect(null); setProdQuery(''); };

  const catDisplay  = catOpen ? catQuery : (selectedCategory || '');
  const prodDisplay = selectedProduct
    ? `${selectedProduct.name}  (${selectedProduct.code})`
    : prodOpen ? prodQuery : '';

  // ── Portal menus ──────────────────────────────────────────────────────
  const catMenu = catPortal.mounted && catOpen && catPortal.pos ? createPortal(
    <div
      ref={catMenuRef}
      className="dropdown-container"
      style={{ position: 'absolute', zIndex: 9999, top: catPortal.pos.top, left: catPortal.pos.left, width: Math.max(catPortal.pos.width, 220), maxHeight: 220, overflowY: 'auto', boxSizing: 'border-box' }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {catsLoading
        ? <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-secondary)' }}>Loading…</div>
        : filteredCats.length === 0
          ? <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-secondary)' }}>No categories</div>
          : filteredCats.map((cat) => (
            <button key={cat} type="button"
              className={`dropdown-item${selectedCategory === cat ? ' selected' : ''}`}
              onMouseDown={(e) => { e.preventDefault(); handleCatSelect(cat); }}>
              {cat}
            </button>
          ))
      }
    </div>,
    document.body
  ) : null;

  const prodMenu = prodPortal.mounted && prodOpen && !selectedProduct && prodPortal.pos ? createPortal(
    <div
      ref={prodMenuRef}
      className="dropdown-container"
      style={{ position: 'absolute', zIndex: 9999, top: prodPortal.pos.top, left: prodPortal.pos.left, width: prodPortal.pos.width, maxHeight: 240, overflowY: 'auto', boxSizing: 'border-box' }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {prodsLoading
        ? <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-secondary)' }}>Searching…</div>
        : !selectedCategory && debouncedProd.trim().length < 2
          ? <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-secondary)' }}>Select a category or type 2+ characters…</div>
          : products.length === 0
            ? <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-secondary)' }}>No products found</div>
            : products.map((p) => (
              <button key={p.id} type="button"
                className="dropdown-item"
                onMouseDown={(e) => { e.preventDefault(); handleProdSelect(p); }}>
                <span style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</span>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginLeft: 6 }}>
                  {p.code}{p.category ? ` · ${p.category}` : ''}{p.unit ? ` · ${p.unit}` : ''}
                </span>
              </button>
            ))
      }
    </div>,
    document.body
  ) : null;

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>

      {/* ── Category ── */}
      <div style={{ width: 180, flexShrink: 0 }}>
        <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 3 }}>Category</label>
        <div ref={catTriggerRef} style={{ position: 'relative' }}>
          <input
            className="input"
            style={{ width: '100%', paddingRight: 44, fontSize: 13, boxSizing: 'border-box' }}
            placeholder="All…"
            value={catDisplay}
            onChange={(e) => { setCatQuery(e.target.value); setCatOpen(true); }}
            onFocus={() => setCatOpen(true)}
            autoComplete="off"
          />
          {selectedCategory && !catOpen && (
            <button type="button" onClick={clearCategory}
              style={{ position: 'absolute', right: 22, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1, padding: '0 2px' }}>
              ×
            </button>
          )}
          <span style={{ position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-secondary)', fontSize: 10 }}>
            {catOpen ? '▲' : '▼'}
          </span>
        </div>
      </div>

      {/* ── Product ── */}
      <div style={{ flex: 1 }}>
        <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 3 }}>
          Product <span style={{ color: '#ef4444' }}>*</span>
          {selectedProduct && (
            <span style={{ marginLeft: 8, fontWeight: 600, color: 'var(--text-primary)', fontSize: 11 }}>
              {selectedProduct.code} · {selectedProduct.unit || '—'} · stock: {selectedProduct.stock_balance ?? '—'}
            </span>
          )}
        </label>
        <div ref={prodTriggerRef} style={{ position: 'relative' }}>
          <input
            className="input"
            style={{ width: '100%', paddingRight: 28, fontSize: 13, boxSizing: 'border-box' }}
            placeholder={selectedCategory ? 'Search product…' : 'Search by name, code, SKU…'}
            value={prodDisplay}
            onChange={(e) => {
              if (selectedProduct) clearProduct();
              setProdQuery(e.target.value);
              setProdOpen(true);
            }}
            onFocus={() => { if (!selectedProduct) setProdOpen(true); }}
            onClick={() => { if (selectedProduct) { clearProduct(); setProdOpen(true); } }}
            autoComplete="off"
          />
          {(selectedProduct || prodQuery) && (
            <button type="button" onClick={() => { clearProduct(); setProdOpen(false); }}
              style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1 }}>
              ×
            </button>
          )}
          {prodsLoading && !selectedProduct && (
            <div style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)' }}>
              <div style={{ width: 13, height: 13, border: '2px solid var(--brand-orange)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
            </div>
          )}
        </div>
      </div>

      {catMenu}
      {prodMenu}
    </div>
  );
}
