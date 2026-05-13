'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { SearchIcon } from '@/components/icons';
import { purchaseRequestsApi } from '@/lib/api/purchase-requests';
import { purchaseOrdersApi } from '@/lib/api/purchase-orders';
import { purchaseInvoicesApi } from '@/lib/api/purchase-invoices';
import { goodsReceivingApi } from '@/lib/api/goods-receiving';
import { purchaseQuotationsApi } from '@/lib/api/purchase-quotations';

interface SearchResult {
  id: number;
  type: 'PR' | 'LPO' | 'GRN' | 'INV' | 'PQ';
  label: string;
  sub: string;
  href: string;
  status?: string;
}

const TYPE_COLOR: Record<string, string> = {
  PR:  '#3b82f6',
  LPO: '#f97316',
  GRN: '#10b981',
  INV: '#8b5cf6',
  PQ:  '#f59e0b',
};

const STATUS_CLASS: Record<string, string> = {
  draft:    'badge-info',
  pending:  'badge-warning',
  approved: 'badge-success',
  rejected: 'badge-error',
  paid:     'badge-success',
  cancelled:'badge-error',
  awarded:  'badge-success',
  completed:'badge-success',
};

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debouncedQuery = useDebounce(query.trim(), 300);

  const search = useCallback(async (q: string) => {
    if (!q || q.length < 2) { setResults([]); return; }
    setLoading(true);
    try {
      const params = { search: q, page_size: 5 };
      const [prs, pos, grns, invs, pqs] = await Promise.allSettled([
        purchaseRequestsApi.getAll(params),
        purchaseOrdersApi.getAll(params),
        goodsReceivingApi.getAll(params),
        purchaseInvoicesApi.getAll(params),
        purchaseQuotationsApi.getAll(params),
      ]);

      const out: SearchResult[] = [];

      if (prs.status === 'fulfilled') {
        const list = Array.isArray(prs.value) ? prs.value : (prs.value as any).results ?? [];
        list.slice(0, 4).forEach((r: any) => out.push({
          id: r.id, type: 'PR', label: r.code, sub: r.title || '',
          href: `/purchase-requests/${r.id}`, status: r.status,
        }));
      }
      if (pos.status === 'fulfilled') {
        const list = Array.isArray(pos.value) ? pos.value : (pos.value as any).results ?? [];
        list.slice(0, 4).forEach((r: any) => out.push({
          id: r.id, type: 'LPO', label: r.order_number,
          sub: typeof r.supplier === 'object' ? r.supplier?.name || '' : '',
          href: `/purchase-orders/${r.id}`, status: r.status,
        }));
      }
      if (grns.status === 'fulfilled') {
        const list = Array.isArray(grns.value) ? grns.value : (grns.value as any).results ?? [];
        list.slice(0, 4).forEach((r: any) => out.push({
          id: r.id, type: 'GRN', label: r.grn_number, sub: '',
          href: `/goods-receiving/${r.id}`, status: r.status,
        }));
      }
      if (invs.status === 'fulfilled') {
        const list = Array.isArray(invs.value) ? invs.value : (invs.value as any).results ?? [];
        list.slice(0, 4).forEach((r: any) => out.push({
          id: r.id, type: 'INV', label: r.invoice_number, sub: '',
          href: `/purchase-invoices/${r.id}`, status: r.status,
        }));
      }
      if (pqs.status === 'fulfilled') {
        const list = Array.isArray(pqs.value) ? pqs.value : (pqs.value as any).results ?? [];
        list.slice(0, 3).forEach((r: any) => out.push({
          id: r.id, type: 'PQ', label: r.quotation_number,
          sub: typeof r.supplier === 'object' ? r.supplier?.name || '' : '',
          href: `/purchase-quotations/${r.id}`, status: r.status,
        }));
      }

      setResults(out);
      setSelected(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { search(debouncedQuery); }, [debouncedQuery, search]);

  // keyboard shortcut Ctrl+K / Cmd+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const navigate = (href: string) => {
    setOpen(false);
    setQuery('');
    setResults([]);
    router.push(href);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (!results.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, results.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)); }
    if (e.key === 'Enter')     { e.preventDefault(); navigate(results[selected].href); }
  };

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {/* Trigger bar */}
      <div
        className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all duration-200 cursor-text"
        style={{
          backgroundColor: 'var(--input-bg)',
          border: '1px solid var(--input-border)',
          width: 280,
        }}
        onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 50); }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--input-focus-border)'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = open ? 'var(--input-focus-border)' : 'var(--input-border)'; }}
      >
        <SearchIcon className="w-4 h-4 flex-shrink-0" />
        {open ? (
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Search PR, LPO, GRN, Invoice…"
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              fontSize: 13, color: 'var(--text-primary)',
            }}
          />
        ) : (
          <span style={{ fontSize: 13, color: 'var(--input-placeholder)', flex: 1 }}>Search…</span>
        )}
        <kbd style={{
          fontSize: 10, color: 'var(--text-secondary)',
          background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)',
          borderRadius: 4, padding: '1px 5px', fontFamily: 'monospace',
        }}>⌃K</kbd>
      </div>

      {/* Dropdown results */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0,
          width: 400, maxHeight: 420, overflowY: 'auto',
          background: 'var(--card-bg)', border: '1px solid var(--border-primary)',
          borderRadius: 10, boxShadow: 'var(--shadow-lg)',
          zIndex: 9999,
        }}>
          {loading && (
            <div style={{ padding: '14px 16px', fontSize: 13, color: 'var(--text-secondary)' }}>
              Searching…
            </div>
          )}

          {!loading && debouncedQuery.length >= 2 && results.length === 0 && (
            <div style={{ padding: '14px 16px', fontSize: 13, color: 'var(--text-secondary)' }}>
              No results for &ldquo;{debouncedQuery}&rdquo;
            </div>
          )}

          {!loading && debouncedQuery.length < 2 && (
            <div style={{ padding: '14px 16px', fontSize: 13, color: 'var(--text-secondary)' }}>
              Type at least 2 characters to search…
            </div>
          )}

          {results.length > 0 && results.map((r, i) => (
            <div
              key={`${r.type}-${r.id}`}
              onClick={() => navigate(r.href)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px', cursor: 'pointer',
                background: i === selected ? 'var(--bg-secondary)' : 'transparent',
                borderBottom: '1px solid var(--border-primary)',
                transition: 'background 0.1s',
              }}
              onMouseEnter={() => setSelected(i)}
            >
              {/* Type badge */}
              <span style={{
                fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
                color: '#fff', background: TYPE_COLOR[r.type],
                borderRadius: 4, padding: '2px 6px', flexShrink: 0,
                minWidth: 34, textAlign: 'center',
              }}>
                {r.type}
              </span>
              {/* Text */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {r.label}
                </div>
                {r.sub && (
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {r.sub}
                  </div>
                )}
              </div>
              {/* Status */}
              {r.status && (
                <span className={`badge ${STATUS_CLASS[r.status] || 'badge-info'}`} style={{ fontSize: 10, flexShrink: 0 }}>
                  {r.status}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
