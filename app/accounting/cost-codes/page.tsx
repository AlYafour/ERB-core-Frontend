'use client';

/**
 * Cost Codes — a real tree, not a flat list: Work Section (L1) → Main
 * Category (L2) → Item (L3). Every node can grow a child one level deeper
 * ("+"), and a brand-new root Work Section can be added at the top. Codes
 * are generated server-side (quick-add) — nobody invents an accounting
 * code by hand.
 */

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import MainLayout from '@/components/layout/MainLayout';
import { PageShell, Button, Badge, PageHeader } from '@/components/ui';
import SearchableDropdown from '@/components/ui/SearchableDropdown';
import RouteGuard from '@/components/auth/RouteGuard';
import { costCodesApi } from '@/lib/api/cost-codes';
import { accountingApi } from '@/lib/api/accounting';
import { CostCode } from '@/types';
import { toast, confirm } from '@/lib/hooks/use-toast';
import { getApiError } from '@/lib/utils/error';

const INPUT: React.CSSProperties = {
  width: '100%', padding: '7px 9px', fontSize: 'var(--text-sm)',
  border: '1px solid var(--input-border, var(--border-subtle))', borderRadius: 'var(--radius-sm)',
  background: 'var(--input-bg, var(--bg-primary))', color: 'var(--text-primary)', boxSizing: 'border-box',
};
const LABEL: React.CSSProperties = { display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 3 };
const LEVEL_VARIANT: Record<number, 'default' | 'info' | 'success'> = { 1: 'info', 2: 'default', 3: 'success' };
const LEVEL_LABEL: Record<number, string> = { 1: 'Work Section', 2: 'Main Category', 3: 'Item' };

type Tab = 'direct' | 'indirect';
type Draft = Partial<CostCode>;

export default function CostCodesPage() {
  return (
    <RouteGuard requiredPermission={{ category: 'accounting_settings', action: 'view' }} redirectTo="/accounting">
      <CostCodesContent />
    </RouteGuard>
  );
}

function CostCodesContent() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('direct');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Draft | null>(null);
  const [addingUnder, setAddingUnder] = useState<CostCode | 'root' | null>(null);
  const [newName, setNewName] = useState('');
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const { data: codes = [], isLoading } = useQuery({
    queryKey: ['cost-codes-manage'],
    queryFn: () => costCodesApi.getAll({ is_active: true }),
  });
  const { data: accData } = useQuery({
    queryKey: ['acc-postable-accounts'],
    queryFn: () => accountingApi.listAccounts({ page_size: 500, is_postable: true, is_active: true }),
    staleTime: 300_000,
  });
  const accounts = (accData as any)?.results ?? [];
  const accOpts = accounts.map((a: any) => ({ value: a.id, label: `${a.code} — ${a.name}` }));

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['cost-codes-manage'] });

  const scoped = useMemo(
    () => codes.filter(c => (c.is_direct ?? true) === (tab === 'direct')),
    [codes, tab]);

  const childrenOf = useMemo(() => {
    const map = new Map<number | 'root', CostCode[]>();
    for (const c of scoped) {
      const key: number | 'root' = c.parent ?? 'root';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    for (const list of map.values()) list.sort((a, b) => a.excel_code.localeCompare(b.excel_code));
    return map;
  }, [scoped]);

  const byId = useMemo(() => new Map(scoped.map(c => [c.id, c])), [scoped]);

  const query = search.trim().toLowerCase();
  const matchIds = useMemo(() => {
    if (!query) return null;
    const s = new Set<number>();
    for (const c of scoped) {
      if (`${c.excel_code} ${c.qb_code} ${c.description}`.toLowerCase().includes(query)) s.add(c.id);
    }
    return s;
  }, [scoped, query]);

  // Ancestors of any match, so the path to it is force-expanded while searching.
  const forceExpand = useMemo(() => {
    if (!matchIds) return null;
    const s = new Set<number>();
    for (const id of matchIds) {
      let node = byId.get(id);
      while (node?.parent != null) {
        s.add(node.parent);
        node = byId.get(node.parent);
      }
    }
    return s;
  }, [matchIds, byId]);

  const subtreeHasMatch = useMemo(() => {
    if (!matchIds) return () => true;
    const cache = new Map<number, boolean>();
    const compute = (c: CostCode): boolean => {
      if (cache.has(c.id)) return cache.get(c.id)!;
      let hit = matchIds.has(c.id);
      if (!hit) for (const k of childrenOf.get(c.id) ?? []) if (compute(k)) { hit = true; break; }
      cache.set(c.id, hit);
      return hit;
    };
    return compute;
  }, [matchIds, childrenOf]);

  const isExpanded = (id: number) => expanded.has(id) || (forceExpand?.has(id) ?? false);
  const toggle = (id: number) => setExpanded(s => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  const saveMut = useMutation({
    mutationFn: (d: Draft) => costCodesApi.update(d.id!, d),
    onSuccess: () => { invalidate(); toast('Saved', 'success'); setEditing(null); },
    onError: (err) => toast(getApiError(err, 'Save failed'), 'error'),
  });
  const delMut = useMutation({
    mutationFn: (id: number) => costCodesApi.remove(id),
    onSuccess: () => { invalidate(); toast('Removed', 'success'); },
    onError: (err) => toast(getApiError(err, 'Delete failed'), 'error'),
  });
  const addMut = useMutation({
    mutationFn: () => costCodesApi.quickAdd({
      name: newName.trim(), is_direct: tab === 'direct',
      ...(addingUnder === 'root' ? { level: '1' as const } : { parent: (addingUnder as CostCode).id }),
    }),
    onSuccess: (created) => {
      invalidate(); toast('Added', 'success');
      if (addingUnder && addingUnder !== 'root') setExpanded(s => new Set(s).add((addingUnder as CostCode).id));
      setAddingUnder(null); setNewName('');
    },
    onError: (err) => toast(getApiError(err, 'Could not add'), 'error'),
  });

  const askDelete = async (c: CostCode) => {
    const hasKids = (childrenOf.get(c.id) ?? []).length > 0;
    if (hasKids) { toast('This code has children — remove them first.', 'error'); return; }
    if (await confirm(`Remove ${c.excel_code} — ${c.description.slice(0, 40)}?`)) delMut.mutate(c.id);
  };

  const parentOpts = scoped.map(c => ({ value: c.id, label: `${c.excel_code} — ${String(c.description).slice(0, 40)}` }));
  const roots = childrenOf.get('root') ?? [];
  const visibleRoots = roots.filter(subtreeHasMatch);

  return (
    <MainLayout>
      <PageShell>
        <PageHeader
          title="Cost Codes"
          description="The full cost-code tree — Work Section → Main Category → Item. Add a branch anywhere; codes are generated automatically."
          breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Accounting', href: '/accounting' }, { label: 'Cost Codes' }]}
          backHref="/accounting"
          actions={<Button variant="primary" size="sm" onClick={() => { setAddingUnder('root'); setNewName(''); }}>+ New Work Section</Button>}
        />

        <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border-subtle)', marginBottom: 'var(--space-3)' }}>
          {(['direct', 'indirect'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer',
              fontSize: 'var(--text-sm)', fontWeight: tab === t ? 700 : 500,
              color: tab === t ? 'var(--brand)' : 'var(--text-secondary)',
              borderBottom: `2px solid ${tab === t ? 'var(--brand)' : 'transparent'}`, marginBottom: -1,
            }}>{t === 'direct' ? 'Direct (project)' : 'Indirect (overhead)'} ({codes.filter(c => (c.is_direct ?? true) === (t === 'direct')).length})</button>
          ))}
        </div>

        <div className="card">
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 'var(--space-3)', flexWrap: 'wrap' }}>
            <input style={{ ...INPUT, maxWidth: 320 }} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search code or description…" />
            {search && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{matchIds?.size ?? 0} match{matchIds?.size === 1 ? '' : 'es'}</span>}
          </div>

          {addingUnder === 'root' && (
            <AddRow name={newName} setName={setNewName} isPending={addMut.isPending}
              placeholder="New Work Section name…"
              onCancel={() => setAddingUnder(null)}
              onAdd={() => { if (!newName.trim()) { toast('Enter a name', 'error'); return; } addMut.mutate(); }} />
          )}

          {isLoading ? <div style={{ color: 'var(--text-secondary)' }}>Loading…</div>
            : visibleRoots.length === 0 && addingUnder !== 'root' ? (
              <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', padding: '10px 4px' }}>
                {query ? 'No codes match.' : 'No codes yet — add the first Work Section.'}
              </div>
            ) : (
              <div>
                {visibleRoots.map(c => (
                  <TreeNode key={c.id} node={c} depth={0}
                    childrenOf={childrenOf} isExpanded={isExpanded} toggle={toggle}
                    subtreeHasMatch={subtreeHasMatch} isMatch={id => matchIds?.has(id) ?? false}
                    addingUnder={addingUnder} newName={newName} setNewName={setNewName} addPending={addMut.isPending}
                    onStartAdd={node => { setAddingUnder(node); setNewName(''); }}
                    onCancelAdd={() => setAddingUnder(null)}
                    onConfirmAdd={() => { if (!newName.trim()) { toast('Enter a name', 'error'); return; } addMut.mutate(); }}
                    onEdit={setEditing} onDelete={askDelete} />
                ))}
              </div>
            )}
        </div>

        {editing && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: 'var(--surface-primary, var(--bg-primary))', borderRadius: 10, padding: 22, width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.25)', maxHeight: '90vh', overflowY: 'auto' }}>
              <h3 style={{ margin: '0 0 14px', fontSize: 'var(--text-lg)', fontWeight: 700 }}>Edit Cost Code</h3>
              <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                  <div><label style={LABEL}>Excel Code <span style={{ color: 'var(--status-error)' }}>*</span></label>
                    <input style={{ ...INPUT, fontFamily: 'monospace' }} value={editing.excel_code ?? ''} onChange={e => setEditing(d => ({ ...d!, excel_code: e.target.value }))} /></div>
                  <div><label style={LABEL}>QB Code <span style={{ color: 'var(--status-error)' }}>*</span></label>
                    <input style={{ ...INPUT, fontFamily: 'monospace' }} value={editing.qb_code ?? ''} onChange={e => setEditing(d => ({ ...d!, qb_code: e.target.value }))} /></div>
                </div>
                <div><label style={LABEL}>Description</label>
                  <input style={INPUT} value={editing.description ?? ''} onChange={e => setEditing(d => ({ ...d!, description: e.target.value }))} /></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                  <div><label style={LABEL}>Level</label>
                    <div style={{ ...INPUT, background: 'var(--surface-subtle)', display: 'flex', alignItems: 'center' }}>
                      L{editing.level} — {LEVEL_LABEL[editing.level ?? 3]}
                    </div></div>
                  <div><label style={LABEL}>Parent</label>
                    {editing.id != null && (childrenOf.get(editing.id) ?? []).length > 0 ? (
                      <div style={{ ...INPUT, background: 'var(--surface-subtle)', color: 'var(--text-secondary)', fontSize: 'var(--text-xs)', display: 'flex', alignItems: 'center' }}>
                        Has children — move them first to reparent
                      </div>
                    ) : (
                      <SearchableDropdown options={parentOpts.filter(o => o.value !== editing.id)} value={editing.parent ?? null} allowClear placeholder="No parent (root)"
                        onChange={v => setEditing(d => {
                          const parentId = v ? Number(v) : null;
                          const parentNode = parentId != null ? byId.get(parentId) : null;
                          // Reparenting changes depth — keep the Level label truthful.
                          const level = (parentNode ? Math.min(parentNode.level + 1, 3) : 1) as 1 | 2 | 3;
                          return { ...d!, parent: parentId, level };
                        })} />
                    )}</div>
                </div>
                <div><label style={LABEL}>GL Account (this code posts to)</label>
                  <SearchableDropdown options={accOpts} value={editing.default_account ?? null} allowClear placeholder="Inherits from parent if empty"
                    onChange={v => setEditing(d => ({ ...d!, default_account: v ? Number(v) : null }))} /></div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, fontSize: 13, cursor: 'pointer' }}>
                <input type="checkbox" checked={!!editing.is_vehicle}
                  onChange={e => setEditing(d => ({ ...d!, is_vehicle: e.target.checked }))} />
                Vehicle / fleet code — shows the Vehicle picker on expenses (child codes inherit this)
              </label>
              <div style={{ display: 'flex', gap: 8, marginTop: 18, justifyContent: 'flex-end' }}>
                <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>Cancel</Button>
                <Button variant="primary" size="sm" isLoading={saveMut.isPending}
                  onClick={() => { if (!editing.excel_code?.trim() || !editing.qb_code?.trim()) { toast('Excel + QB codes are required', 'error'); return; } saveMut.mutate(editing as Draft); }}>Save</Button>
              </div>
            </div>
          </div>
        )}
      </PageShell>
    </MainLayout>
  );
}

function AddRow({ name, setName, isPending, placeholder, onCancel, onAdd }: {
  name: string; setName: (v: string) => void; isPending: boolean; placeholder: string;
  onCancel: () => void; onAdd: () => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px', marginBottom: 8, border: '1.5px dashed var(--brand)', borderRadius: 8, background: 'var(--surface-subtle)' }}>
      <input autoFocus style={{ ...INPUT, flex: 1 }} value={name} placeholder={placeholder}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') onAdd(); if (e.key === 'Escape') onCancel(); }} />
      <Button variant="primary" size="sm" isLoading={isPending} onClick={onAdd}>Add</Button>
      <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
    </div>
  );
}

function TreeNode({ node, depth, childrenOf, isExpanded, toggle, subtreeHasMatch, isMatch,
  addingUnder, newName, setNewName, addPending, onStartAdd, onCancelAdd, onConfirmAdd, onEdit, onDelete }: {
  node: CostCode; depth: number;
  childrenOf: Map<number | 'root', CostCode[]>;
  isExpanded: (id: number) => boolean; toggle: (id: number) => void;
  subtreeHasMatch: (c: CostCode) => boolean; isMatch: (id: number) => boolean;
  addingUnder: CostCode | 'root' | null; newName: string; setNewName: (v: string) => void; addPending: boolean;
  onStartAdd: (node: CostCode) => void; onCancelAdd: () => void; onConfirmAdd: () => void;
  onEdit: (draft: Partial<CostCode>) => void; onDelete: (c: CostCode) => void;
}) {
  const kids = (childrenOf.get(node.id) ?? []).filter(subtreeHasMatch);
  const hasKids = kids.length > 0;
  const expanded = isExpanded(node.id);
  const canGoDeeper = node.level < 3;
  const isAddingHere = addingUnder !== 'root' && addingUnder?.id === node.id;

  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px',
        paddingLeft: 8 + depth * 22, borderRadius: 6,
        background: isMatch(node.id) ? 'var(--surface-highlight, rgba(212,175,55,0.10))' : undefined,
      }}>
        <button onClick={() => hasKids && toggle(node.id)}
          style={{ width: 16, flexShrink: 0, background: 'none', border: 'none', cursor: hasKids ? 'pointer' : 'default', color: 'var(--text-secondary)', visibility: hasKids ? 'visible' : 'hidden' }}>
          {expanded ? '▾' : '▸'}
        </button>
        <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 'var(--text-sm)', flexShrink: 0 }}>{node.excel_code}</span>
        <Badge variant={LEVEL_VARIANT[node.level]}>L{node.level}</Badge>
        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>
          {node.description}
        </span>
        {node.effective_account_code ? (
          <span style={{ fontFamily: 'monospace', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', flexShrink: 0 }}>{node.effective_account_code}</span>
        ) : (
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--status-warning)', flexShrink: 0 }}>no GL</span>
        )}
        <span style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          {canGoDeeper && (
            <button title="Add child" onClick={() => onStartAdd(node)}
              style={{ width: 24, height: 24, borderRadius: 6, border: '1px solid var(--border-default)', background: 'none', color: 'var(--brand)', fontWeight: 700, cursor: 'pointer' }}>+</button>
          )}
          <Button variant="secondary" size="sm" onClick={() => onEdit({ ...node })}>Edit</Button>
          <button onClick={() => onDelete(node)}
            style={{ background: 'none', border: 'none', color: 'var(--status-error)', cursor: 'pointer', fontSize: 'var(--text-sm)', padding: '0 4px' }}>Delete</button>
        </span>
      </div>

      {isAddingHere && (
        <div style={{ marginLeft: 8 + (depth + 1) * 22 }}>
          <AddRow name={newName} setName={setNewName} isPending={addPending}
            placeholder={`New ${LEVEL_LABEL[Math.min(node.level + 1, 3)]} under ${node.excel_code}…`}
            onCancel={onCancelAdd} onAdd={onConfirmAdd} />
        </div>
      )}

      {expanded && kids.map(k => (
        <TreeNode key={k.id} node={k} depth={depth + 1}
          childrenOf={childrenOf} isExpanded={isExpanded} toggle={toggle}
          subtreeHasMatch={subtreeHasMatch} isMatch={isMatch}
          addingUnder={addingUnder} newName={newName} setNewName={setNewName} addPending={addPending}
          onStartAdd={onStartAdd} onCancelAdd={onCancelAdd} onConfirmAdd={onConfirmAdd}
          onEdit={onEdit} onDelete={onDelete} />
      ))}
    </div>
  );
}
