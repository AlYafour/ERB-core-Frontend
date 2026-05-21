'use client';

import React, { use, useState, useMemo, useRef, useEffect } from 'react';
import Link from 'next/link';
import MainLayout from '@/components/layout/MainLayout';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { subcontractorsApi, BOQTemplateItem, ContractBOQItem } from '@/lib/api/subcontractors';
import { Button, Badge, PageHeader, PageShell } from '@/components/ui';
import { toast, confirm } from '@/lib/hooks/use-toast';
import { CONTRACT_STATUS, CERTIFICATE_STATUS, PAYMENT_STATUS } from '@/lib/utils/status-colors';

type Tab = 'info' | 'boq' | 'certificates' | 'payments' | 'attachments' | 'log';
const CONTRACT_TABS: Tab[] = ['info', 'boq', 'certificates', 'payments', 'attachments', 'log'];

const CONTRACT_STATUS_LABEL: Record<string, string> = {
  draft: 'Draft', under_review: 'Under Review', approved: 'Approved',
  active: 'Active', on_hold: 'On Hold', completed: 'Completed',
  closed: 'Closed', terminated: 'Terminated',
};

const CERT_STATUS_LABEL: Record<string, string> = {
  draft: 'Draft', submitted: 'Submitted', under_review: 'Under Review',
  reviewed: 'Reviewed', approved: 'Approved', rejected: 'Rejected',
  paid: 'Paid', cancelled: 'Cancelled',
};

function InfoRow({ label, value }: { label: string; value?: string | number | boolean | null }) {
  if (value === null || value === undefined || value === '') return null;
  const display = typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value;
  return (
    <div style={{ display: 'flex', gap: 'var(--space-3)', paddingBlock: 'var(--space-2)', borderBottom: '1px solid var(--border-subtle)' }}>
      <span style={{ width: 200, flexShrink: 0, fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', fontWeight: 500 }}>
        {label}
      </span>
      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>{display}</span>
    </div>
  );
}

function TabBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: '8px 16px', fontSize: 'var(--text-sm)',
      fontWeight: active ? 600 : 500,
      color: active ? 'var(--brand)' : 'var(--text-secondary)',
      background: 'none', border: 'none',
      borderBottom: active ? '2px solid var(--brand)' : '2px solid transparent',
      cursor: 'pointer', transition: 'color 120ms, border-color 120ms',
    }}>
      {label}
    </button>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card" style={{ flex: 1, minWidth: 140 }}>
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace' }}>{value}</div>
      {sub && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ── Breakdown Modal ───────────────────────────────────────────────────────────

type BreakdownRow = { location: string; quantity: string };

function BreakdownModal({
  item,
  usedLocations,
  onClose,
  onSave,
  isPending,
}: {
  item: ContractBOQItem;
  usedLocations: string[];
  onClose: () => void;
  onSave: (rows: BreakdownRow[]) => void;
  isPending: boolean;
}) {
  const [rows, setRows] = useState<BreakdownRow[]>(
    item.breakdowns?.length
      ? item.breakdowns.map(b => ({ location: b.location, quantity: String(b.quantity) }))
      : [{ location: '', quantity: '' }]
  );

  const total = rows.reduce((s, r) => s + (parseFloat(r.quantity) || 0), 0);

  const update = (i: number, field: keyof BreakdownRow, val: string) =>
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: val } : r));

  const remove = (i: number) => setRows(prev => prev.filter((_, idx) => idx !== i));

  const validRows = rows.filter(r => r.location.trim());

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div className="card" style={{ width: 520, maxHeight: '80vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-default)' }}>
          <div style={{ fontWeight: 600, fontSize: 'var(--text-base)', color: 'var(--text-primary)' }}>
            Quantity Breakdown
          </div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginTop: 2 }}>
            {item.item_name}
          </div>
        </div>

        {/* Rows */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <datalist id="bd-locations">
            {usedLocations.map(l => <option key={l} value={l} />)}
          </datalist>

          {rows.map((row, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                className="form-input"
                list="bd-locations"
                placeholder="Location (e.g. Ground Floor)"
                value={row.location}
                onChange={e => update(i, 'location', e.target.value)}
                style={{ flex: 1, padding: '6px 10px', fontSize: 'var(--text-sm)' }}
              />
              <input
                type="number"
                className="form-input"
                placeholder="0.000"
                min="0"
                step="0.001"
                value={row.quantity}
                onChange={e => update(i, 'quantity', e.target.value)}
                style={{ width: 110, padding: '6px 10px', fontSize: 'var(--text-sm)', textAlign: 'right' }}
              />
              <button
                onClick={() => remove(i)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 16, padding: '0 4px', lineHeight: 1 }}
              >✕</button>
            </div>
          ))}

          <button
            onClick={() => setRows(prev => [...prev, { location: '', quantity: '' }])}
            style={{ alignSelf: 'flex-start', background: 'none', border: '1px dashed var(--border-default)', borderRadius: 6, padding: '5px 12px', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', cursor: 'pointer', marginTop: 4 }}
          >
            + Add Location
          </button>
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>
            Total: <span style={{ fontFamily: 'monospace', color: 'var(--text-brand)' }}>
              {total.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })} {item.unit}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={onClose}
              style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid var(--border-default)', background: 'var(--surface-raised)', color: 'var(--text-primary)', fontSize: 'var(--text-sm)', cursor: 'pointer' }}
            >Cancel</button>
            <button
              onClick={() => onSave(validRows)}
              disabled={isPending || validRows.length === 0}
              style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: 'var(--brand)', color: '#fff', fontSize: 'var(--text-sm)', cursor: isPending ? 'not-allowed' : 'pointer', opacity: (isPending || validRows.length === 0) ? 0.6 : 1 }}
            >{isPending ? 'Saving…' : 'Save Breakdown'}</button>
          </div>
        </div>

      </div>
    </div>
  );
}


// ── Import from Template Modal ────────────────────────────────────────────────

function ImportModal({
  onClose,
  onImport,
  isPending,
}: {
  onClose: () => void;
  onImport: (items: Pick<BOQTemplateItem, 'item_code' | 'item_name' | 'default_unit'>[]) => void;
  isPending: boolean;
}) {
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['boq-templates-all'],
    queryFn: () => subcontractorsApi.boqTemplates.listAll(),
    retry: false,
  });

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');

  const grouped = useMemo(() => {
    const map = new Map<string, { name: string; items: BOQTemplateItem[] }>();
    for (const t of templates) {
      if (!map.has(t.section_code)) {
        map.set(t.section_code, { name: t.section_name, items: [] });
      }
      map.get(t.section_code)!.items.push(t);
    }
    return Array.from(map.entries()).map(([code, v]) => ({ code, ...v }));
  }, [templates]);

  const filteredGrouped = useMemo(() => {
    if (!search.trim()) return grouped;
    const q = search.trim().toLowerCase();
    return grouped
      .map(section => ({
        ...section,
        items: section.items.filter(
          i => i.item_name.toLowerCase().includes(q) ||
               i.item_code.toLowerCase().includes(q) ||
               section.name.toLowerCase().includes(q)
        ),
      }))
      .filter(section => section.items.length > 0 || section.name.toLowerCase().includes(q));
  }, [grouped, search]);

  // auto-expand sections that match the search
  const searchExpanded = useMemo(() => {
    if (!search.trim()) return expanded;
    const auto = new Set(expanded);
    filteredGrouped.forEach(s => auto.add(s.code));
    return auto;
  }, [filteredGrouped, search, expanded]);

  const toggleSection = (code: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });
  };

  const toggleItem = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSection_all = (items: BOQTemplateItem[]) => {
    const ids = items.map(i => i.id);
    const allSelected = ids.every(id => selected.has(id));
    setSelected(prev => {
      const next = new Set(prev);
      if (allSelected) ids.forEach(id => next.delete(id));
      else ids.forEach(id => next.add(id));
      return next;
    });
  };

  const handleImport = async () => {
    const items = templates.filter(t => selected.has(t.id)).map(t => ({
      item_code: t.item_code,
      item_name: t.item_name,
      default_unit: t.default_unit,
    }));
    if (items.length === 0) { toast('Select at least one item', 'error'); return; }
    onImport(items);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 'var(--space-4)',
    }}>
      <div style={{
        background: 'var(--surface-primary)',
        borderRadius: 12,
        width: '100%', maxWidth: 720,
        maxHeight: '85vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-default)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 'var(--text-lg)', color: 'var(--text-primary)' }}>Import from BOQ Library</div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginTop: 2 }}>
                {selected.size > 0 ? `${selected.size} item${selected.size > 1 ? 's' : ''} selected` : 'Select items to add to this contract\'s BOQ'}
              </div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--text-tertiary)', lineHeight: 1 }}>×</button>
          </div>
          <input
            type="text"
            placeholder="Search by section or item… (e.g. نجارة، حدادة)"
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '8px 12px',
              border: '1px solid var(--border-default)',
              borderRadius: 6,
              fontSize: 'var(--text-sm)',
              background: 'var(--surface-primary)',
              color: 'var(--text-primary)',
              outline: 'none',
            }}
          />
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
          {isLoading ? (
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: 40 }}>Loading template…</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filteredGrouped.length === 0 && (
                <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: 32 }}>No items match "{search}"</p>
              )}
              {filteredGrouped.map(({ code, name, items }) => {
                const lineItems = items;
                const allSel = lineItems.length > 0 && lineItems.every(i => selected.has(i.id));
                const someSel = lineItems.some(i => selected.has(i.id));
                const isOpen = searchExpanded.has(code);
                return (
                  <div key={code} style={{ border: '1px solid var(--border-subtle)', borderRadius: 8, overflow: 'hidden' }}>
                    {/* Section header */}
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 14px',
                      background: 'var(--surface-secondary)',
                      cursor: 'pointer',
                    }}>
                      <input
                        type="checkbox"
                        checked={allSel}
                        ref={el => { if (el) el.indeterminate = someSel && !allSel; }}
                        onChange={() => toggleSection_all(lineItems)}
                        onClick={e => e.stopPropagation()}
                        style={{ width: 15, height: 15, flexShrink: 0 }}
                      />
                      <div
                        style={{ flex: 1, fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}
                        onClick={() => toggleSection(code)}
                      >
                        {code}. {name}
                      </div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                        {lineItems.filter(i => selected.has(i.id)).length}/{lineItems.length}
                      </div>
                      <span
                        style={{ fontSize: 12, color: 'var(--text-tertiary)', userSelect: 'none' }}
                        onClick={() => toggleSection(code)}
                      >
                        {isOpen ? '▲' : '▼'}
                      </span>
                    </div>

                    {/* Items */}
                    {isOpen && (
                      <div>
                        {lineItems.map(item => (
                          <label key={item.id} style={{
                            display: 'flex', alignItems: 'center', gap: 12,
                            padding: '8px 14px 8px 28px',
                            borderTop: '1px solid var(--border-subtle)',
                            cursor: 'pointer',
                            background: selected.has(item.id) ? 'var(--brand-subtle)' : 'transparent',
                            transition: 'background 80ms',
                          }}>
                            <input
                              type="checkbox"
                              checked={selected.has(item.id)}
                              onChange={() => toggleItem(item.id)}
                              style={{ width: 14, height: 14, flexShrink: 0 }}
                            />
                            <span style={{ fontFamily: 'monospace', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', width: 60, flexShrink: 0 }}>
                              {item.item_code}
                            </span>
                            <span style={{ flex: 1, fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>
                              {item.item_name}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-default)', display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleImport} disabled={isPending || selected.size === 0}>
            {isPending ? 'Importing…' : `Import ${selected.size > 0 ? selected.size + ' Items' : ''}`}
          </Button>
        </div>
      </div>
    </div>
  );
}


// ── Main page ─────────────────────────────────────────────────────────────────

export default function ContractDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [tab, setTabState] = useState<Tab>('info');
  useEffect(() => {
    const h = window.location.hash.replace('#', '') as Tab;
    if (CONTRACT_TABS.includes(h)) setTabState(h);
  }, []);
  const setTab = (t: Tab) => { setTabState(t); history.replaceState(null, '', `#${t}`); };

  const [showImportModal, setShowImportModal] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [editingBoqId, setEditingBoqId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ item_name: '', unit: '', contract_quantity: '0', unit_rate: '0' });
  const [breakdownItem, setBreakdownItem] = useState<ContractBOQItem | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const { data: contract, isLoading, error } = useQuery({
    queryKey: ['subcon-contract', id],
    queryFn: () => subcontractorsApi.contracts.getOne(Number(id)),
  });

  const { data: boqItems } = useQuery({
    queryKey: ['boq-items', id],
    queryFn: () => subcontractorsApi.boqItems.list(Number(id)),
    enabled: tab === 'boq',
  });

  const { data: certsData } = useQuery({
    queryKey: ['subcon-certs', id],
    queryFn: () => subcontractorsApi.certificates.list({ contract: id, page_size: 50 }),
    enabled: tab === 'certificates',
  });

  const { data: paymentsData } = useQuery({
    queryKey: ['subcon-payments-contract', id],
    queryFn: () => subcontractorsApi.payments.list({ contract: id, page_size: 50 }),
    enabled: tab === 'payments',
  });

  const { data: attachments } = useQuery({
    queryKey: ['subcon-contract-attachments', id],
    queryFn: () => subcontractorsApi.attachments.listForContract(Number(id)),
    enabled: tab === 'attachments',
  });

  const { data: activityLog } = useQuery({
    queryKey: ['subcon-activity', 'contract', id],
    queryFn: () => subcontractorsApi.activityLogs.list({ entity_type: 'contract', entity_id: Number(id) }),
    enabled: tab === 'log',
  });

  // ── Contract workflow mutations ──
  const submitMutation = useMutation({
    mutationFn: () => subcontractorsApi.contracts.submit(Number(id)),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['subcon-contract', id] }); toast('Contract submitted for review', 'success'); },
    onError: () => toast('Failed to submit contract', 'error'),
  });

  const approveMutation = useMutation({
    mutationFn: () => subcontractorsApi.contracts.approve(Number(id), {}),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['subcon-contract', id] }); toast('Contract approved', 'success'); },
    onError: () => toast('Failed to approve contract', 'error'),
  });

  const rejectMutation = useMutation({
    mutationFn: (reason: string) => subcontractorsApi.contracts.reject(Number(id), { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subcon-contract', id] });
      setRejectOpen(false);
      setRejectReason('');
      toast('Contract rejected and returned to draft', 'info');
    },
    onError: () => toast('Failed to reject contract', 'error'),
  });

  const activateMutation = useMutation({
    mutationFn: () => subcontractorsApi.contracts.activate(Number(id)),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['subcon-contract', id] }); toast('Contract activated', 'success'); },
    onError: () => toast('Failed to activate contract', 'error'),
  });

  const uploadAttachmentMutation = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('contract', id);
      fd.append('document_type', 'general');
      return subcontractorsApi.attachments.upload(fd);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['subcon-contract-attachments', id] }); toast('File uploaded', 'success'); },
    onError: () => toast('Upload failed', 'error'),
  });

  const closeMutation = useMutation({
    mutationFn: () => subcontractorsApi.contracts.close(Number(id)),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['subcon-contract', id] }); toast('Contract closed', 'success'); },
    onError: () => toast('Failed to close contract', 'error'),
  });

  // ── BOQ mutations ──
  const importMutation = useMutation({
    mutationFn: (items: Pick<BOQTemplateItem, 'item_code' | 'item_name' | 'default_unit'>[]) =>
      subcontractorsApi.boqItems.bulkCreate(Number(id), items.map(t => ({
        item_code: t.item_code,
        item_name: t.item_name,
        unit: t.default_unit || '',
        contract_quantity: '0',
        unit_rate: '0',
        order: 0,
      }))),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['boq-items', id] });
      toast(`${data.length} item${data.length !== 1 ? 's' : ''} imported`, 'success');
      setShowImportModal(false);
    },
    onError: () => toast('Import failed', 'error'),
  });

  const updateBoqMutation = useMutation({
    mutationFn: ({ itemId, data }: { itemId: number; data: Record<string, unknown> }) =>
      subcontractorsApi.boqItems.update(itemId, data as never),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boq-items', id] });
      setEditingBoqId(null);
      toast('Saved', 'success');
    },
    onError: () => toast('Save failed', 'error'),
  });

  const deleteBoqMutation = useMutation({
    mutationFn: (itemId: number) => subcontractorsApi.boqItems.delete(itemId),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['boq-items', id] }); toast('Item removed', 'info'); },
    onError: () => toast('Delete failed', 'error'),
  });

  const saveBreakdownMutation = useMutation({
    mutationFn: ({ itemId, rows }: { itemId: number; rows: { location: string; quantity: string }[] }) =>
      subcontractorsApi.boqBreakdowns.bulkSave(itemId, rows),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boq-items', id] });
      setBreakdownItem(null);
      toast('Breakdown saved', 'success');
    },
    onError: () => toast('Save failed', 'error'),
  });

  const { data: globalLocations = [] } = useQuery({
    queryKey: ['boq-breakdown-locations'],
    queryFn: () => subcontractorsApi.boqBreakdowns.getLocations(),
    staleTime: 5 * 60 * 1000,
  });

  const usedLocations = useMemo(() => {
    const set = new Set<string>(globalLocations);
    (boqItems ?? []).forEach(item => (item.breakdowns ?? []).forEach(b => set.add(b.location)));
    return Array.from(set).sort();
  }, [boqItems, globalLocations]);

  if (isLoading) return <MainLayout><PageShell><div className="card empty-state"><p>Loading...</p></div></PageShell></MainLayout>;
  if (error || !contract) return <MainLayout><PageShell><div className="card empty-state"><p style={{ color: 'var(--status-error)' }}>Contract not found.</p></div></PageShell></MainLayout>;

  const fmt = (v: string | number) => `AED ${Number(v).toLocaleString()}`;

  const startEdit = (item: typeof boqItems extends (infer T)[] | undefined ? T : never) => {
    setEditingBoqId((item as { id: number }).id);
    setEditForm({
      item_name: (item as { item_name: string }).item_name,
      unit: (item as { unit: string }).unit,
      contract_quantity: String((item as { contract_quantity: string }).contract_quantity),
      unit_rate: String((item as { unit_rate: string }).unit_rate),
    });
  };

  return (
    <MainLayout>
      <PageShell>

        {/* Breakdown modal */}
        {breakdownItem && (
          <BreakdownModal
            item={breakdownItem}
            usedLocations={usedLocations}
            onClose={() => setBreakdownItem(null)}
            onSave={rows => saveBreakdownMutation.mutate({ itemId: breakdownItem.id, rows })}
            isPending={saveBreakdownMutation.isPending}
          />
        )}

        {/* Reject modal */}
        {rejectOpen && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div className="card" style={{ width: 440, padding: 24 }}>
              <div style={{ fontSize: 'var(--text-base)', fontWeight: 600, marginBottom: 12 }}>Rejection Reason</div>
              <textarea
                autoFocus value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                rows={4} placeholder="Enter reason for returning to draft..."
                style={{ width: '100%', resize: 'vertical', borderRadius: 6, border: '1px solid var(--border-default)', padding: '8px 10px', fontSize: 'var(--text-sm)', background: 'var(--bg-input)', color: 'var(--text-primary)', boxSizing: 'border-box' }}
              />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
                <Button variant="secondary" size="sm" onClick={() => setRejectOpen(false)}>Cancel</Button>
                <Button variant="primary" size="sm"
                  disabled={!rejectReason.trim() || rejectMutation.isPending}
                  onClick={() => rejectMutation.mutate(rejectReason.trim())}
                  style={{ background: 'var(--status-error)', borderColor: 'var(--status-error)' }}>
                  {rejectMutation.isPending ? 'Rejecting...' : 'Return to Draft'}
                </Button>
              </div>
            </div>
          </div>
        )}

        <PageHeader
          title={`${contract.contract_no} — ${contract.contract_title}`}
          breadcrumbs={[
            { label: 'Subcontractors', href: '/subcontractors' },
            { label: 'Contracts', href: '/subcontractors/contracts' },
            { label: contract.contract_no },
          ]}
          actions={
            <div style={{ display: 'flex', gap: 8 }}>
              {contract.contract_status === 'draft' && (
                <Button variant="primary" size="sm" onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending}>
                  {submitMutation.isPending ? 'Submitting...' : 'Submit for Review'}
                </Button>
              )}
              {contract.contract_status === 'under_review' && (
                <>
                  <Button variant="primary" size="sm" onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending}>
                    {approveMutation.isPending ? 'Approving...' : 'Approve'}
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setRejectOpen(true)}>
                    Reject
                  </Button>
                </>
              )}
              {contract.contract_status === 'approved' && (
                <Button variant="secondary" size="sm" onClick={() => activateMutation.mutate()} disabled={activateMutation.isPending}>
                  {activateMutation.isPending ? 'Activating...' : 'Activate Contract'}
                </Button>
              )}
              {(contract.contract_status === 'approved' || contract.contract_status === 'active') && (
                <>
                  <Link href={`/subcontractors/certificates/new?contract=${id}`}>
                    <Button variant="primary" size="sm">+ New Certificate</Button>
                  </Link>
                  <Button variant="secondary" size="sm"
                    onClick={async () => { if (await confirm('Close this contract? This will prevent new certificates.')) closeMutation.mutate(); }}
                    disabled={closeMutation.isPending}>
                    Close Contract
                  </Button>
                </>
              )}
            </div>
          }
        />

        {/* Financial summary row */}
        <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', marginBottom: 'var(--space-5)' }}>
          <StatCard label="Contract Value"       value={fmt(contract.contract_value)} />
          <StatCard label="Approved to Date"     value={fmt(contract.total_approved_to_date)} />
          <StatCard label="Paid to Date"         value={fmt(contract.total_paid_to_date)} />
          <StatCard label="Retention Balance"    value={fmt(contract.retention_balance)} />
          <StatCard label="Remaining Balance"    value={fmt(contract.remaining_balance)} />
          <div className="card" style={{ flex: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6 }}>
            <Badge variant={CONTRACT_STATUS[contract.contract_status] ?? 'default'}>
              {CONTRACT_STATUS_LABEL[contract.contract_status]}
            </Badge>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ borderBottom: '1px solid var(--border-default)', marginBottom: 'var(--space-4)', display: 'flex', gap: 0 }}>
          <TabBtn label="General Info"    active={tab === 'info'}         onClick={() => setTab('info')} />
          <TabBtn label="BOQ"             active={tab === 'boq'}          onClick={() => setTab('boq')} />
          <TabBtn label="Certificates"    active={tab === 'certificates'} onClick={() => setTab('certificates')} />
          <TabBtn label="Payments"        active={tab === 'payments'}     onClick={() => setTab('payments')} />
          <TabBtn label="Attachments"     active={tab === 'attachments'}  onClick={() => setTab('attachments')} />
          <TabBtn label="Activity Log"    active={tab === 'log'}          onClick={() => setTab('log')} />
        </div>

        {/* Tab: Info */}
        {tab === 'info' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-5)' }}>
            <div className="card">
              <div className="info-section-title">Contract Details</div>
              <InfoRow label="Contract Number"  value={contract.contract_no} />
              <InfoRow label="Title"            value={contract.contract_title} />
              <InfoRow label="Subcontractor"    value={contract.subcontractor_name} />
              <InfoRow label="Start Date"       value={contract.start_date} />
              <InfoRow label="End Date"         value={contract.end_date} />
              <InfoRow label="Contract Value"   value={fmt(contract.contract_value)} />
            </div>
            <div className="card">
              <div className="info-section-title">Financial Settings</div>
              <InfoRow label="Retention Enabled"        value={contract.retention_enabled} />
              {contract.retention_enabled && (
                <InfoRow label="Retention %"            value={`${contract.retention_percentage}%`} />
              )}
              <InfoRow label="Advance Payment Enabled"  value={contract.advance_payment_enabled} />
              {contract.advance_payment_enabled && (
                <>
                  <InfoRow label="Advance Amount"       value={fmt(contract.advance_payment_amount)} />
                  <InfoRow label="Recovery Method"      value={contract.advance_recovery_method.replace('_', ' ')} />
                  {contract.advance_recovery_method === 'percentage' && (
                    <InfoRow label="Recovery %"         value={`${contract.advance_recovery_percentage}%`} />
                  )}
                </>
              )}
            </div>
            {contract.scope_of_work && (
              <div className="card">
                <div className="info-section-title">Scope of Work</div>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
                  {contract.scope_of_work}
                </p>
              </div>
            )}
            {contract.payment_terms && (
              <div className="card">
                <div className="info-section-title">Payment Terms</div>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
                  {contract.payment_terms}
                </p>
              </div>
            )}
            <div className="card">
              <div className="info-section-title">Workflow</div>
              <InfoRow label="Status"          value={CONTRACT_STATUS_LABEL[contract.contract_status]} />
              <InfoRow label="Created By"      value={contract.created_by_name} />
              <InfoRow label="Reviewed By"     value={contract.reviewed_by_name} />
              <InfoRow label="Approved By"     value={contract.approved_by_name} />
              <InfoRow label="Review Date"     value={contract.review_date} />
              <InfoRow label="Approval Date"   value={contract.approval_date} />
              {contract.review_notes && <InfoRow label="Review Notes" value={contract.review_notes} />}
              {contract.rejection_reason && <InfoRow label="Rejection Reason" value={contract.rejection_reason} />}
            </div>
          </div>
        )}

        {/* Tab: BOQ */}
        {tab === 'boq' && (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <div className="info-section-title" style={{ margin: 0 }}>Bill of Quantities</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button variant="secondary" size="sm" onClick={() => setShowImportModal(true)}>
                  + Import from Template
                </Button>
              </div>
            </div>

            {boqItems && boqItems.length > 0 && (() => {
              const boqTotal = boqItems.reduce((s, i) => s + Number(i.total_amount), 0);
              const cv = Number(contract.contract_value);
              if (cv > 0 && boqTotal > cv) return (
                <div style={{ marginBottom: 12, padding: '8px 12px', background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.4)', borderRadius: 6, fontSize: 'var(--text-sm)', color: 'rgb(120,90,0)' }}>
                  Warning: BOQ total (AED {boqTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}) exceeds contract value (AED {cv.toLocaleString(undefined, { minimumFractionDigits: 2 })}).
                </div>
              );
              return null;
            })()}
            {!boqItems?.length ? (
              <div className="empty-state">
                <p style={{ marginBottom: 12 }}>No BOQ items yet.</p>
                <Button variant="primary" size="sm" onClick={() => setShowImportModal(true)}>
                  Import from Template
                </Button>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: 32 }}>#</th>
                      <th style={{ width: 80 }}>Code</th>
                      <th>Item Name</th>
                      <th style={{ width: 70 }}>Unit</th>
                      <th style={{ textAlign: 'right', width: 100 }}>Qty</th>
                      <th style={{ textAlign: 'right', width: 110 }}>Rate (AED)</th>
                      <th style={{ textAlign: 'right', width: 120 }}>Total (AED)</th>
                      <th style={{ textAlign: 'right', width: 90 }}>Approved</th>
                      <th style={{ textAlign: 'right', width: 90 }}>Remaining</th>
                      <th style={{ width: 90 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {boqItems.map((item, i) => {
                      const isEditing = editingBoqId === item.id;
                      const hasBreakdowns = (item.breakdowns?.length ?? 0) > 0;
                      return (
                        <React.Fragment key={item.id}>
                        <tr style={hasBreakdowns ? { borderBottom: 'none', background: 'var(--surface-secondary)' } : undefined}>
                          <td style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)' }}>{i + 1}</td>
                          <td style={{ fontFamily: 'monospace', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                            {item.item_code || '—'}
                          </td>

                          {isEditing ? (
                            <>
                              <td>
                                <input
                                  className="form-input"
                                  style={{ padding: '2px 6px', fontSize: 'var(--text-sm)' }}
                                  value={editForm.item_name}
                                  onChange={e => setEditForm(f => ({ ...f, item_name: e.target.value }))}
                                />
                              </td>
                              <td>
                                <input
                                  className="form-input"
                                  style={{ padding: '2px 6px', fontSize: 'var(--text-sm)', width: 60 }}
                                  value={editForm.unit}
                                  onChange={e => setEditForm(f => ({ ...f, unit: e.target.value }))}
                                  placeholder="m2"
                                />
                              </td>
                              <td>
                                {item.breakdowns?.length ? (
                                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                                    {Number(editForm.contract_quantity).toLocaleString()} <em>(breakdown)</em>
                                  </span>
                                ) : (
                                  <input
                                    type="number" min="0" step="0.001" className="form-input"
                                    style={{ padding: '2px 6px', fontSize: 'var(--text-sm)', textAlign: 'right' }}
                                    value={editForm.contract_quantity}
                                    onChange={e => setEditForm(f => ({ ...f, contract_quantity: e.target.value }))}
                                  />
                                )}
                              </td>
                              <td>
                                <input
                                  type="number" min="0" step="0.01" className="form-input"
                                  style={{ padding: '2px 6px', fontSize: 'var(--text-sm)', textAlign: 'right' }}
                                  value={editForm.unit_rate}
                                  onChange={e => setEditForm(f => ({ ...f, unit_rate: e.target.value }))}
                                />
                              </td>
                              <td style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-tertiary)' }}>
                                {(Number(editForm.contract_quantity) * Number(editForm.unit_rate)).toLocaleString()}
                              </td>
                              <td colSpan={2}></td>
                            </>
                          ) : (
                            <>
                              <td>
                                <div style={{ fontWeight: 500 }}>{item.item_name}</div>
                                {item.description && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{item.description}</div>}
                              </td>
                              <td style={{ color: 'var(--text-secondary)' }}>{item.unit || '—'}</td>
                              <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                                <span>{Number(item.contract_quantity).toLocaleString()}</span>
                                <button
                                  onClick={() => setBreakdownItem(item)}
                                  title="Quantity breakdown"
                                  style={{ marginLeft: 6, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: item.breakdowns?.length ? 'var(--brand)' : 'var(--text-tertiary)', verticalAlign: 'middle' }}
                                >≡</button>
                              </td>
                              <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{Number(item.unit_rate).toLocaleString()}</td>
                              <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 500 }}>{Number(item.total_amount).toLocaleString()}</td>
                              <td style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--status-success)' }}>{Number(item.approved_quantity_to_date).toLocaleString()}</td>
                              <td style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{Number(item.remaining_quantity).toLocaleString()}</td>
                            </>
                          )}

                          <td>
                            <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                              {isEditing ? (
                                <>
                                  <Button
                                    variant="primary" size="sm"
                                    disabled={updateBoqMutation.isPending}
                                    onClick={() => updateBoqMutation.mutate({
                                      itemId: item.id,
                                      data: {
                                        item_name: editForm.item_name,
                                        unit: editForm.unit,
                                        contract_quantity: editForm.contract_quantity,
                                        unit_rate: editForm.unit_rate,
                                      },
                                    })}
                                  >
                                    Save
                                  </Button>
                                  <Button variant="secondary" size="sm" onClick={() => setEditingBoqId(null)}>✕</Button>
                                </>
                              ) : (
                                <>
                                  <Button variant="view" size="sm" onClick={() => startEdit(item)}>Edit</Button>
                                  <Button
                                    variant="secondary" size="sm"
                                    onClick={async () => { if (await confirm('Remove this item?')) deleteBoqMutation.mutate(item.id); }}
                                  >
                                    ✕
                                  </Button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* Per-location breakdown sub-rows — locations only, no quantities */}
                        {!isEditing && hasBreakdowns && item.breakdowns!.map((bd, bi) => {
                          const isLast = bi === item.breakdowns!.length - 1;
                          const borderBottom = isLast ? '2px solid var(--border-subtle)' : '1px solid var(--border-subtle)';
                          return (
                            <tr key={`${item.id}-bd-${bi}`} style={{ background: 'var(--surface-secondary)' }}>
                              <td colSpan={2} style={{ borderBottom }} />
                              <td style={{ paddingLeft: 28, paddingTop: 5, paddingBottom: 5, fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', borderBottom }}>
                                <span style={{ color: 'var(--text-tertiary)', marginRight: 6, fontSize: 11 }}>↳</span>
                                {bd.location}
                              </td>
                              <td colSpan={7} style={{ borderBottom }} />
                            </tr>
                          );
                        })}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'right', fontWeight: 600, fontSize: 'var(--text-sm)' }}>Total</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>
                        {boqItems.reduce((sum, i) => sum + Number(i.total_amount), 0).toLocaleString()}
                      </td>
                      <td colSpan={3}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab: Certificates */}
        {tab === 'certificates' && (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <div className="info-section-title" style={{ margin: 0 }}>Progress Certificates (IPC)</div>
              {(contract.contract_status === 'approved' || contract.contract_status === 'active') && (
                <Link href={`/subcontractors/certificates/new?contract=${id}`}>
                  <Button variant="primary" size="sm">+ New Certificate</Button>
                </Link>
              )}
            </div>
            {!certsData?.results?.length ? (
              <div className="empty-state"><p>No certificates issued yet.</p></div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>IPC No.</th>
                    <th>Date</th>
                    <th>Period</th>
                    <th style={{ textAlign: 'right' }}>Gross Approved</th>
                    <th style={{ textAlign: 'right' }}>Retention</th>
                    <th style={{ textAlign: 'right' }}>Net Payable</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {certsData.results.map(c => (
                    <tr key={c.id}>
                      <td style={{ fontFamily: 'monospace', fontSize: 'var(--text-xs)' }}>{c.certificate_no}</td>
                      <td style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{c.certificate_date}</td>
                      <td style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                        {c.period_from && c.period_to ? `${c.period_from} → ${c.period_to}` : '—'}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>AED {Number(c.gross_approved_amount).toLocaleString()}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>AED {Number(c.retention_amount).toLocaleString()}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>AED {Number(c.net_payable_amount).toLocaleString()}</td>
                      <td><Badge variant={CERTIFICATE_STATUS[c.status] ?? 'default'}>{CERT_STATUS_LABEL[c.status]}</Badge></td>
                      <td>
                        <Link href={`/subcontractors/certificates/${c.id}`}>
                          <Button variant="view" size="sm">View</Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Tab: Payments */}
        {tab === 'payments' && (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <div className="info-section-title" style={{ margin: 0 }}>Payments</div>
            </div>
            {!paymentsData?.results?.length ? (
              <div className="empty-state"><p>No payments recorded yet.</p></div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Payment No.</th>
                    <th>Date</th>
                    <th>Certificate</th>
                    <th style={{ textAlign: 'right' }}>Gross</th>
                    <th style={{ textAlign: 'right' }}>Net Paid</th>
                    <th>Method</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {paymentsData.results.map(p => (
                    <tr key={p.id}>
                      <td style={{ fontFamily: 'monospace', fontSize: 'var(--text-xs)' }}>{p.payment_no}</td>
                      <td style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{p.payment_date}</td>
                      <td style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{p.certificate_no || '—'}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>AED {Number(p.gross_amount).toLocaleString()}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>AED {Number(p.net_paid_amount).toLocaleString()}</td>
                      <td style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{p.payment_method.replace('_', ' ')}</td>
                      <td><Badge variant={PAYMENT_STATUS[p.status] ?? 'default'}>{p.status}</Badge></td>
                      <td>
                        <Link href={`/subcontractors/payments/${p.id}`}>
                          <Button variant="view" size="sm">View</Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Tab: Attachments */}
        {tab === 'attachments' && (
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div className="info-section-title" style={{ marginBottom: 0 }}>Attachments</div>
              <Button variant="secondary" size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadAttachmentMutation.isPending}>
                {uploadAttachmentMutation.isPending ? 'Uploading...' : '+ Upload File'}
              </Button>
              <input
                ref={fileInputRef} type="file" style={{ display: 'none' }}
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) { uploadAttachmentMutation.mutate(file); e.target.value = ''; }
                }}
              />
            </div>
            {!attachments?.length ? (
              <div className="empty-state"><p>No attachments yet.</p></div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {attachments.map(a => (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-3)', border: '1px solid var(--border-subtle)', borderRadius: 6 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>{a.file_name}</div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                        {a.document_type} · {a.uploaded_by_name} · {new Date(a.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <a href={a.file_url ?? a.file} target="_blank" rel="noreferrer">
                      <Button variant="view" size="sm">Download</Button>
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab: Activity Log */}
        {tab === 'log' && (
          <div className="card">
            <div className="info-section-title">Activity Log</div>
            {!activityLog?.results?.length ? (
              <div className="empty-state"><p>No activity recorded.</p></div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {activityLog.results.map(entry => (
                  <div key={entry.id} style={{ display: 'flex', gap: 'var(--space-3)', paddingBottom: 'var(--space-3)', borderBottom: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', flexShrink: 0, width: 130 }}>
                      {new Date(entry.created_at).toLocaleString()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-primary)' }}>{entry.action}</div>
                      {entry.description && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{entry.description}</div>}
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 2 }}>by {entry.actor_name}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Import from Template Modal */}
        {showImportModal && (
          <ImportModal
            onClose={() => setShowImportModal(false)}
            onImport={items => importMutation.mutate(items)}
            isPending={importMutation.isPending}
          />
        )}

      </PageShell>
    </MainLayout>
  );
}
