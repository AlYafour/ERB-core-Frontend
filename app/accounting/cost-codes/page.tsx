'use client';

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
const TH: React.CSSProperties = { padding: '8px 10px', textAlign: 'left', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', textTransform: 'uppercase', borderBottom: '1px solid var(--border-subtle)', whiteSpace: 'nowrap' };
const TD: React.CSSProperties = { padding: '8px 10px', fontSize: 'var(--text-sm)', borderBottom: '1px solid var(--border-subtle)' };

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

  const { data: codes = [], isLoading } = useQuery({
    queryKey: ['cost-codes-manage'],
    queryFn: () => costCodesApi.getAll({ is_active: true }),
  });
  const { data: accData } = useQuery({
    queryKey: ['acc-postable-accounts'],
    queryFn: () => accountingApi.listAccounts({ page_size: 500, is_postable: true, is_active: true }),
    staleTime: 300_000,
  });
  const accounts = accData?.results ?? [];
  const accOpts = accounts.map((a: any) => ({ value: a.id, label: `${a.code} — ${a.name}` }));

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['cost-codes-manage'] });

  const filtered = useMemo(() => {
    const wantDirect = tab === 'direct';
    return codes
      .filter(c => (c.is_direct ?? true) === wantDirect)
      .filter(c => !search || `${c.excel_code} ${c.qb_code} ${c.description}`.toLowerCase().includes(search.toLowerCase()));
  }, [codes, tab, search]);

  const parentOpts = codes.filter(c => (c.is_direct ?? true) === (tab === 'direct'))
    .map(c => ({ value: c.id, label: `${c.excel_code} — ${String(c.description).slice(0, 40)}` }));

  const saveMut = useMutation({
    mutationFn: (d: Draft) => d.id
      ? costCodesApi.update(d.id, d)
      : costCodesApi.create({ ...d, is_direct: tab === 'direct' }),
    onSuccess: () => { invalidate(); toast('Saved', 'success'); setEditing(null); },
    onError: (err) => toast(getApiError(err, 'Save failed'), 'error'),
  });
  const delMut = useMutation({
    mutationFn: (id: number) => costCodesApi.remove(id),
    onSuccess: () => { invalidate(); toast('Removed', 'success'); },
    onError: (err) => toast(getApiError(err, 'Delete failed'), 'error'),
  });

  const startNew = () => setEditing({ level: 3, is_direct: tab === 'direct', qb_code: '', excel_code: '', description: '' });

  return (
    <MainLayout>
      <PageShell>
        <PageHeader
          title="Cost Codes"
          description="Your company's cost codes — Direct (project) and Indirect (overhead). Add, edit and link each to a GL account."
          breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Accounting', href: '/accounting' }, { label: 'Cost Codes' }]}
          backHref="/accounting"
          actions={<Button variant="primary" size="sm" onClick={startNew}>+ New Code</Button>}
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
          <div style={{ marginBottom: 'var(--space-3)' }}>
            <input style={{ ...INPUT, maxWidth: 320 }} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search code or description…" />
          </div>
          {isLoading ? <div style={{ color: 'var(--text-secondary)' }}>Loading…</div> : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>{['Excel Code', 'QB Code', 'Description', 'Level', 'GL Account', ''].map((h, i) =>
                  <th key={h || i} style={TH}>{h}</th>)}</tr></thead>
                <tbody>
                  {filtered.map(c => (
                    <tr key={c.id}>
                      <td style={{ ...TD, fontFamily: 'monospace', fontWeight: 600 }}>{c.excel_code}</td>
                      <td style={{ ...TD, fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{c.qb_code}</td>
                      <td style={TD}>{String(c.description).slice(0, 60)}</td>
                      <td style={TD}><Badge variant="default">L{c.level}</Badge></td>
                      <td style={{ ...TD, fontFamily: 'monospace' }}>{c.effective_account_code || <span style={{ color: 'var(--status-warning)' }}>—</span>}</td>
                      <td style={{ ...TD, textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <Button variant="secondary" size="sm" onClick={() => setEditing({ ...c })}>Edit</Button>{' '}
                        <button onClick={async () => { if (await confirm(`Remove ${c.excel_code}?`)) delMut.mutate(c.id); }}
                                style={{ background: 'none', border: 'none', color: 'var(--status-error)', cursor: 'pointer', fontSize: 'var(--text-sm)' }}>Delete</button>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && <tr><td colSpan={6} style={{ ...TD, color: 'var(--text-tertiary)' }}>No codes in this category.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {editing && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: 'var(--surface-primary, var(--bg-primary))', borderRadius: 10, padding: 22, width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.25)', maxHeight: '90vh', overflowY: 'auto' }}>
              <h3 style={{ margin: '0 0 14px', fontSize: 'var(--text-lg)', fontWeight: 700 }}>
                {editing.id ? 'Edit Cost Code' : `New ${tab === 'direct' ? 'Direct' : 'Indirect'} Code`}
              </h3>
              <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                  <div><label style={LABEL}>Excel Code <span style={{ color: 'var(--status-error)' }}>*</span></label>
                    <input style={{ ...INPUT, fontFamily: 'monospace' }} value={editing.excel_code ?? ''} onChange={e => setEditing(d => ({ ...d!, excel_code: e.target.value }))} placeholder="O-SB-A100" /></div>
                  <div><label style={LABEL}>QB Code <span style={{ color: 'var(--status-error)' }}>*</span></label>
                    <input style={{ ...INPUT, fontFamily: 'monospace' }} value={editing.qb_code ?? ''} onChange={e => setEditing(d => ({ ...d!, qb_code: e.target.value }))} placeholder="O-SB-A100" /></div>
                </div>
                <div><label style={LABEL}>Description</label>
                  <input style={INPUT} value={editing.description ?? ''} onChange={e => setEditing(d => ({ ...d!, description: e.target.value }))} placeholder="Office electricity / water bills" /></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                  <div><label style={LABEL}>Level</label>
                    <select style={INPUT} value={editing.level ?? 3} onChange={e => setEditing(d => ({ ...d!, level: Number(e.target.value) as 1 | 2 | 3 }))}>
                      <option value={1}>1 — Main Category</option>
                      <option value={2}>2 — Sub Category</option>
                      <option value={3}>3 — Item</option>
                    </select></div>
                  <div><label style={LABEL}>Parent</label>
                    <SearchableDropdown options={parentOpts} value={editing.parent ?? null} allowClear placeholder="Parent code"
                      onChange={v => setEditing(d => ({ ...d!, parent: v ? Number(v) : null }))} /></div>
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
                  onClick={() => { if (!editing.excel_code?.trim() || !editing.qb_code?.trim()) { toast('Excel + QB codes are required', 'error'); return; } saveMut.mutate(editing); }}>Save</Button>
              </div>
            </div>
          </div>
        )}
      </PageShell>
    </MainLayout>
  );
}
