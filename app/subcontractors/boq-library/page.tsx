'use client';

import React, { useState, useMemo } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { subcontractorsApi, BOQTemplateItem } from '@/lib/api/subcontractors';
import { toast, confirm } from '@/lib/hooks/use-toast';

const EMPTY_FORM = {
  section_code: '',
  section_name: '',
  item_code: '',
  item_name: '',
  description: '',
  default_unit: '',
  order: 0,
  is_active: true,
};

type FormState = typeof EMPTY_FORM;

function cellInput(
  value: string | number | boolean,
  onChange: (v: string) => void,
  opts?: { type?: string; placeholder?: string; width?: number }
) {
  return (
    <input
      type={opts?.type ?? 'text'}
      value={String(value)}
      onChange={e => onChange(e.target.value)}
      placeholder={opts?.placeholder}
      style={{
        width: opts?.width ?? '100%',
        padding: '4px 6px',
        border: '1px solid var(--border-default)',
        borderRadius: 4,
        fontSize: 'var(--text-sm)',
        background: 'var(--surface-primary)',
        color: 'var(--text-primary)',
        boxSizing: 'border-box',
      }}
    />
  );
}

export default function BOQLibraryPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<FormState>(EMPTY_FORM);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState<FormState>(EMPTY_FORM);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  // Location editing state
  const [locationsItemId, setLocationsItemId] = useState<number | null>(null);
  const [locationsDraft, setLocationsDraft] = useState<string[]>([]);

  const { data: allItems = [], isLoading } = useQuery({
    queryKey: ['boq-templates-manage'],
    queryFn: () => subcontractorsApi.boqTemplates.listAll(),
    retry: false,
  });

  const createMutation = useMutation({
    mutationFn: (data: FormState) => subcontractorsApi.boqTemplates.create({
      ...data,
      order: Number(data.order),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['boq-templates-manage'] });
      qc.invalidateQueries({ queryKey: ['boq-templates-all'] });
      setShowAdd(false);
      setAddForm(EMPTY_FORM);
      toast('Item added', 'success');
    },
    onError: () => toast('Failed to add item', 'error'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: FormState }) =>
      subcontractorsApi.boqTemplates.update(id, { ...data, order: Number(data.order) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['boq-templates-manage'] });
      qc.invalidateQueries({ queryKey: ['boq-templates-all'] });
      setEditingId(null);
      toast('Item updated', 'success');
    },
    onError: () => toast('Failed to update', 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => subcontractorsApi.boqTemplates.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['boq-templates-manage'] });
      qc.invalidateQueries({ queryKey: ['boq-templates-all'] });
      toast('Item deleted', 'success');
    },
    onError: () => toast('Failed to delete', 'error'),
  });

  const saveLocationsMutation = useMutation({
    mutationFn: ({ id, locations }: { id: number; locations: string[] }) =>
      subcontractorsApi.boqTemplates.saveLocations(id, locations),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['boq-templates-manage'] });
      setLocationsItemId(null);
      toast('Locations saved', 'success');
    },
    onError: () => toast('Failed to save locations', 'error'),
  });

  const openLocations = (item: BOQTemplateItem) => {
    setLocationsItemId(item.id);
    setLocationsDraft(
      item.location_breakdowns?.length
        ? item.location_breakdowns.map(b => b.location)
        : ['']
    );
    setEditingId(null);
  };

  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const map = new Map<string, { name: string; items: BOQTemplateItem[] }>();
    for (const item of allItems) {
      if (q && !item.item_name.toLowerCase().includes(q) &&
               !item.item_code.toLowerCase().includes(q) &&
               !item.section_name.toLowerCase().includes(q)) continue;
      if (!map.has(item.section_code)) {
        map.set(item.section_code, { name: item.section_name, items: [] });
      }
      map.get(item.section_code)!.items.push(item);
    }
    return Array.from(map.entries()).map(([code, v]) => ({ code, ...v }));
  }, [allItems, search]);

  const visibleExpanded = useMemo(() => {
    if (!search.trim()) return expandedSections;
    const auto = new Set(expandedSections);
    grouped.forEach(s => auto.add(s.code));
    return auto;
  }, [grouped, search, expandedSections]);

  const toggleSection = (code: string) =>
    setExpandedSections(prev => {
      const n = new Set(prev);
      n.has(code) ? n.delete(code) : n.add(code);
      return n;
    });

  const startEdit = (item: BOQTemplateItem) => {
    setEditingId(item.id);
    setLocationsItemId(null);
    setEditForm({
      section_code: item.section_code,
      section_name: item.section_name,
      item_code: item.item_code,
      item_name: item.item_name,
      description: item.description,
      default_unit: item.default_unit,
      order: item.order,
      is_active: item.is_active,
    });
  };

  const totalItems = allItems.length;
  const activeItems = allItems.filter(i => i.is_active).length;

  return (
    <MainLayout>
      <div style={{ padding: 'var(--space-6)', maxWidth: 1200, margin: '0 auto' }}>

        {/* Page header */}
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                BOQ Item Library
              </h1>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: '4px 0 0' }}>
                {totalItems} items total · {activeItems} active — used in all contracts &amp; payment certificates
              </p>
            </div>
            <button
              onClick={() => { setShowAdd(true); setEditingId(null); }}
              style={{
                padding: '8px 16px',
                background: 'var(--brand-primary)',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                fontWeight: 600,
                fontSize: 'var(--text-sm)',
                cursor: 'pointer',
              }}
            >
              + Add Item
            </button>
          </div>

          {/* Search */}
          <div style={{ marginTop: 16 }}>
            <input
              type="text"
              placeholder="Search by section, item name, or code…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%', maxWidth: 420,
                padding: '8px 12px',
                border: '1px solid var(--border-default)',
                borderRadius: 6,
                fontSize: 'var(--text-sm)',
                background: 'var(--surface-primary)',
                color: 'var(--text-primary)',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        {/* Add row form */}
        {showAdd && (
          <div style={{
            background: 'var(--surface-secondary)',
            border: '1px solid var(--border-default)',
            borderRadius: 8,
            padding: 16,
            marginBottom: 16,
          }}>
            <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', marginBottom: 12, color: 'var(--text-primary)' }}>
              New Item
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
              {([
                ['section_code', 'Section Code', 'e.g. 07'],
                ['section_name', 'Section Name', 'e.g. نجارة'],
                ['item_code',    'Item Code',    'e.g. 07.01'],
                ['item_name',    'Item Name',    ''],
                ['default_unit', 'Unit',         'm², No, etc'],
                ['order',        'Order',        '0'],
              ] as [keyof FormState, string, string][]).map(([field, label, ph]) => (
                <div key={field}>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 3 }}>{label}</div>
                  {cellInput(addForm[field] as string, v => setAddForm(f => ({ ...f, [field]: v })), { placeholder: ph })}
                </div>
              ))}
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 3 }}>Active</div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 'var(--text-sm)', paddingTop: 6 }}>
                  <input
                    type="checkbox"
                    checked={addForm.is_active}
                    onChange={e => setAddForm(f => ({ ...f, is_active: e.target.checked }))}
                  />
                  Active
                </label>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button
                onClick={() => createMutation.mutate(addForm)}
                disabled={createMutation.isPending || !addForm.item_code || !addForm.item_name}
                style={{
                  padding: '6px 14px', background: 'var(--brand-primary)', color: '#fff',
                  border: 'none', borderRadius: 5, fontWeight: 600, fontSize: 'var(--text-sm)',
                  cursor: 'pointer', opacity: createMutation.isPending ? 0.6 : 1,
                }}
              >
                {createMutation.isPending ? 'Saving…' : 'Save'}
              </button>
              <button
                onClick={() => { setShowAdd(false); setAddForm(EMPTY_FORM); }}
                style={{
                  padding: '6px 14px', background: 'transparent',
                  border: '1px solid var(--border-default)', borderRadius: 5,
                  fontSize: 'var(--text-sm)', cursor: 'pointer', color: 'var(--text-secondary)',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>Loading…</div>
        ) : grouped.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>
            {search ? `No items match "${search}"` : 'No items in library yet.'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {grouped.map(({ code, name, items }) => {
              const isOpen = visibleExpanded.has(code);
              return (
                <div
                  key={code}
                  style={{ border: '1px solid var(--border-subtle)', borderRadius: 8, overflow: 'hidden' }}
                >
                  {/* Section header */}
                  <button
                    onClick={() => toggleSection(code)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 16px',
                      background: 'var(--surface-secondary)',
                      border: 'none', cursor: 'pointer', textAlign: 'left',
                    }}
                  >
                    <span style={{ fontFamily: 'monospace', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', width: 40, flexShrink: 0 }}>
                      {code}
                    </span>
                    <span style={{ flex: 1, fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>
                      {name}
                    </span>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                      {items.length} item{items.length !== 1 ? 's' : ''}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{isOpen ? '▲' : '▼'}</span>
                  </button>

                  {/* Items table */}
                  {isOpen && (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
                        <thead>
                          <tr style={{ background: 'var(--surface-secondary)', borderTop: '1px solid var(--border-subtle)' }}>
                            {['Code', 'Item Name', 'Unit', 'Order', 'Active', 'Locations', ''].map(h => (
                              <th key={h} style={{
                                padding: '6px 12px', textAlign: 'left', fontWeight: 600,
                                fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)',
                                whiteSpace: 'nowrap',
                              }}>
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {items.map(item => {
                            const isEditing = editingId === item.id;
                            const isEditingLocs = locationsItemId === item.id;
                            const locCount = item.location_breakdowns?.length ?? 0;
                            return (
                              <React.Fragment key={item.id}>
                                <tr
                                  style={{
                                    borderTop: '1px solid var(--border-subtle)',
                                    background: isEditing
                                      ? 'var(--brand-subtle)'
                                      : isEditingLocs
                                      ? 'rgba(var(--brand-rgb, 59,130,246),0.04)'
                                      : item.is_active ? 'transparent' : 'rgba(0,0,0,0.02)',
                                  }}
                                >
                                  {isEditing ? (
                                    <>
                                      <td style={{ padding: '6px 12px' }}>
                                        {cellInput(editForm.item_code, v => setEditForm(f => ({ ...f, item_code: v })), { width: 90 })}
                                      </td>
                                      <td style={{ padding: '6px 12px' }}>
                                        {cellInput(editForm.item_name, v => setEditForm(f => ({ ...f, item_name: v })))}
                                      </td>
                                      <td style={{ padding: '6px 12px' }}>
                                        {cellInput(editForm.default_unit, v => setEditForm(f => ({ ...f, default_unit: v })), { width: 80 })}
                                      </td>
                                      <td style={{ padding: '6px 12px' }}>
                                        {cellInput(editForm.order, v => setEditForm(f => ({ ...f, order: Number(v) })), { type: 'number', width: 60 })}
                                      </td>
                                      <td style={{ padding: '6px 12px' }}>
                                        <input
                                          type="checkbox"
                                          checked={editForm.is_active}
                                          onChange={e => setEditForm(f => ({ ...f, is_active: e.target.checked }))}
                                        />
                                      </td>
                                      <td style={{ padding: '6px 12px' }} />
                                      <td style={{ padding: '6px 12px', whiteSpace: 'nowrap' }}>
                                        <div style={{ display: 'flex', gap: 6 }}>
                                          <button
                                            onClick={() => updateMutation.mutate({ id: item.id, data: editForm })}
                                            disabled={updateMutation.isPending}
                                            style={{ padding: '3px 10px', background: 'var(--brand-primary)', color: '#fff', border: 'none', borderRadius: 4, fontSize: 12, cursor: 'pointer', fontWeight: 600 }}
                                          >
                                            {updateMutation.isPending ? '…' : 'Save'}
                                          </button>
                                          <button
                                            onClick={() => setEditingId(null)}
                                            style={{ padding: '3px 8px', background: 'transparent', border: '1px solid var(--border-default)', borderRadius: 4, fontSize: 12, cursor: 'pointer', color: 'var(--text-secondary)' }}
                                          >
                                            Cancel
                                          </button>
                                        </div>
                                      </td>
                                    </>
                                  ) : (
                                    <>
                                      <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                                        {item.item_code}
                                      </td>
                                      <td style={{ padding: '8px 12px', color: item.is_active ? 'var(--text-primary)' : 'var(--text-tertiary)', fontWeight: 500 }}>
                                        {item.item_name}
                                      </td>
                                      <td style={{ padding: '8px 12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                                        {item.default_unit || '—'}
                                      </td>
                                      <td style={{ padding: '8px 12px', color: 'var(--text-tertiary)', textAlign: 'center' }}>
                                        {item.order}
                                      </td>
                                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                        <span style={{
                                          display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                                          background: item.is_active ? 'var(--success)' : 'var(--text-tertiary)',
                                        }} />
                                      </td>
                                      <td style={{ padding: '8px 12px' }}>
                                        <button
                                          onClick={() => isEditingLocs ? setLocationsItemId(null) : openLocations(item)}
                                          style={{
                                            display: 'flex', alignItems: 'center', gap: 5,
                                            padding: '3px 10px',
                                            background: isEditingLocs ? 'var(--brand-primary)' : 'transparent',
                                            color: isEditingLocs ? '#fff' : locCount > 0 ? 'var(--brand-primary)' : 'var(--text-tertiary)',
                                            border: `1px solid ${isEditingLocs ? 'var(--brand-primary)' : locCount > 0 ? 'var(--brand-primary)' : 'var(--border-default)'}`,
                                            borderRadius: 4, fontSize: 12, cursor: 'pointer', fontWeight: 500,
                                            whiteSpace: 'nowrap',
                                          }}
                                        >
                                          {locCount > 0 ? `${locCount} locations` : '+ Locations'}
                                        </button>
                                      </td>
                                      <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                                        <div style={{ display: 'flex', gap: 6 }}>
                                          <button
                                            onClick={() => startEdit(item)}
                                            style={{ padding: '3px 10px', background: 'transparent', border: '1px solid var(--border-default)', borderRadius: 4, fontSize: 12, cursor: 'pointer', color: 'var(--text-secondary)' }}
                                          >
                                            Edit
                                          </button>
                                          <button
                                            onClick={async () => {
                                              if (await confirm(`Delete "${item.item_name}"?`)) {
                                                deleteMutation.mutate(item.id);
                                              }
                                            }}
                                            style={{ padding: '3px 10px', background: 'transparent', border: '1px solid var(--error-border, #fca5a5)', borderRadius: 4, fontSize: 12, cursor: 'pointer', color: 'var(--error, #dc2626)' }}
                                          >
                                            Delete
                                          </button>
                                        </div>
                                      </td>
                                    </>
                                  )}
                                </tr>

                                {/* Location editor sub-row */}
                                {isEditingLocs && (
                                  <tr style={{ borderTop: '1px solid var(--border-subtle)' }}>
                                    <td colSpan={7} style={{ padding: '12px 16px', background: 'var(--surface-secondary)' }}>
                                      <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        {item.item_name} — Locations
                                      </div>
                                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                                        {locationsDraft.map((loc, idx) => (
                                          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <input
                                              value={loc}
                                              onChange={e => setLocationsDraft(d => d.map((v, i) => i === idx ? e.target.value : v))}
                                              placeholder={`Location ${idx + 1}`}
                                              style={{
                                                padding: '5px 10px',
                                                border: '1px solid var(--border-default)',
                                                borderRadius: 4,
                                                fontSize: 'var(--text-sm)',
                                                background: 'var(--surface-primary)',
                                                color: 'var(--text-primary)',
                                                width: 180,
                                              }}
                                            />
                                            <button
                                              onClick={() => setLocationsDraft(d => d.filter((_, i) => i !== idx))}
                                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 16, lineHeight: 1, padding: '0 2px' }}
                                              title="Remove"
                                            >
                                              ×
                                            </button>
                                          </div>
                                        ))}
                                        <button
                                          onClick={() => setLocationsDraft(d => [...d, ''])}
                                          style={{
                                            padding: '5px 12px',
                                            border: '1px dashed var(--border-default)',
                                            borderRadius: 4, background: 'transparent',
                                            fontSize: 'var(--text-sm)', cursor: 'pointer',
                                            color: 'var(--text-secondary)',
                                          }}
                                        >
                                          + Add
                                        </button>
                                      </div>
                                      <div style={{ display: 'flex', gap: 8 }}>
                                        <button
                                          onClick={() => saveLocationsMutation.mutate({
                                            id: item.id,
                                            locations: locationsDraft.filter(l => l.trim()),
                                          })}
                                          disabled={saveLocationsMutation.isPending}
                                          style={{
                                            padding: '5px 14px', background: 'var(--brand-primary)', color: '#fff',
                                            border: 'none', borderRadius: 5, fontWeight: 600, fontSize: 'var(--text-sm)',
                                            cursor: 'pointer', opacity: saveLocationsMutation.isPending ? 0.6 : 1,
                                          }}
                                        >
                                          {saveLocationsMutation.isPending ? 'Saving…' : 'Save Locations'}
                                        </button>
                                        <button
                                          onClick={() => setLocationsItemId(null)}
                                          style={{
                                            padding: '5px 12px', background: 'transparent',
                                            border: '1px solid var(--border-default)', borderRadius: 5,
                                            fontSize: 'var(--text-sm)', cursor: 'pointer', color: 'var(--text-secondary)',
                                          }}
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
