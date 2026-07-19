'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import MainLayout from '@/components/layout/MainLayout';
import { PageShell, PageHeader, Button } from '@/components/ui';
import RouteGuard from '@/components/auth/RouteGuard';
import { expensesApi } from '@/lib/api/expenses';
import { toast, confirm } from '@/lib/hooks/use-toast';
import { getApiError } from '@/lib/utils/error';
import { usePermissions } from '@/lib/hooks/use-permissions';
import { useMyPermissions } from '@/lib/hooks/use-my-permissions';

// ── Shared row shape (Cost Type carries is_direct; Office/Location doesn't) ─────
interface Row {
  id: string;
  name: string;
  name_ar?: string;
  is_active?: boolean;
  is_direct?: boolean;
  display_order?: number;
}

interface SectionApi {
  list: (includeInactive: boolean) => Promise<Row[]>;
  create: (p: { name: string; name_ar: string; is_direct?: boolean }) => Promise<Row>;
  update: (id: string, patch: Partial<Row>) => Promise<Row>;
  remove: (id: string) => Promise<void>;
}

const inputStyle: React.CSSProperties = {
  padding: '8px 11px', borderRadius: 8, border: '1.5px solid var(--border-default)',
  background: 'var(--surface-primary)', color: 'var(--text-primary)', fontSize: 13,
  outline: 'none', boxSizing: 'border-box', width: '100%',
};

function DirectPill({ direct }: { direct: boolean }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 999,
      background: direct ? 'rgba(37,99,235,0.12)' : 'rgba(217,119,6,0.12)',
      color: direct ? '#2563eb' : '#b45309',
    }}>{direct ? 'Direct · project' : 'Indirect · office'}</span>
  );
}

function LookupSection({
  title, subtitle, addNoun, queryKey, hasDirect, canManage, api,
}: {
  title: string; subtitle: string; addNoun: string;
  queryKey: string[]; hasDirect: boolean; canManage: boolean; api: SectionApi;
}) {
  const qc = useQueryClient();
  const [showInactive, setShowInactive] = useState(false);
  const [newName, setNewName] = useState('');
  const [newNameAr, setNewNameAr] = useState('');
  const [newDirect, setNewDirect] = useState(true);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editNameAr, setEditNameAr] = useState('');
  const [editDirect, setEditDirect] = useState(true);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: [...queryKey, showInactive],
    queryFn: () => api.list(showInactive),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey });
  const onErr = (e: unknown) => toast(getApiError(e, 'Action failed'), 'error');

  const createMut = useMutation({
    mutationFn: () => api.create({ name: newName.trim(), name_ar: newNameAr.trim(), is_direct: newDirect }),
    onSuccess: () => { setNewName(''); setNewNameAr(''); setNewDirect(true); invalidate(); toast(`${addNoun} added.`, 'success'); },
    onError: onErr,
  });
  const updateMut = useMutation({
    mutationFn: (v: { id: string; patch: Partial<Row> }) => api.update(v.id, v.patch),
    onSuccess: () => { setEditId(null); invalidate(); toast('Saved.', 'success'); },
    onError: onErr,
  });
  // Separate mutation for the activate/deactivate toggle so it never disturbs a
  // different row that happens to be mid-edit.
  const toggleMut = useMutation({
    mutationFn: (v: { id: string; active: boolean }) => api.update(v.id, { is_active: v.active }),
    onSuccess: () => { invalidate(); toast('Updated.', 'success'); },
    onError: onErr,
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => api.remove(id),
    onSuccess: () => { invalidate(); toast('Deleted.', 'success'); },
    onError: onErr,
  });

  const startEdit = (r: Row) => {
    setEditId(r.id); setEditName(r.name); setEditNameAr(r.name_ar ?? ''); setEditDirect(r.is_direct ?? true);
  };
  const saveEdit = (r: Row) => {
    const patch: Partial<Row> = { name: editName.trim(), name_ar: editNameAr.trim() };
    if (hasDirect) patch.is_direct = editDirect;
    updateMut.mutate({ id: r.id, patch });
  };
  const handleDelete = async (r: Row) => {
    if (await confirm(`Delete "${r.name}"? If it's used by any expense you'll be asked to deactivate it instead.`)) {
      deleteMut.mutate(r.id);
    }
  };

  return (
    <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 16, padding: '20px 22px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{title}</h3>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '3px 0 0' }}>{subtitle}</p>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
          <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />
          Show inactive
        </label>
      </div>

      {/* Add row */}
      {canManage && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
          <input placeholder={`New ${addNoun} (English)`} value={newName} onChange={e => setNewName(e.target.value)} style={{ ...inputStyle, flex: '1 1 180px' }} />
          <input placeholder="الاسم بالعربي (اختياري)" value={newNameAr} onChange={e => setNewNameAr(e.target.value)} dir="rtl" style={{ ...inputStyle, flex: '1 1 160px' }} />
          {hasDirect && (
            <select value={newDirect ? 'direct' : 'indirect'} onChange={e => setNewDirect(e.target.value === 'direct')} style={{ ...inputStyle, width: 'auto', cursor: 'pointer' }}>
              <option value="direct">Direct (project)</option>
              <option value="indirect">Indirect (office)</option>
            </select>
          )}
          <Button variant="primary" size="sm" onClick={() => newName.trim() && createMut.mutate()} isLoading={createMut.isPending} disabled={!newName.trim()}>Add</Button>
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Loading…</div>
      ) : rows.length === 0 ? (
        <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Nothing here yet.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {rows.map(r => {
            const editing = editId === r.id;
            const inactive = r.is_active === false;
            return (
              <div key={r.id} style={{
                display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                padding: '9px 12px', borderRadius: 10,
                border: '1px solid var(--border-subtle)',
                background: inactive ? 'var(--surface-subtle)' : 'var(--surface-primary)',
                opacity: inactive ? 0.7 : 1,
              }}>
                {editing ? (
                  <>
                    <input value={editName} onChange={e => setEditName(e.target.value)} style={{ ...inputStyle, flex: '1 1 160px' }} />
                    <input value={editNameAr} onChange={e => setEditNameAr(e.target.value)} dir="rtl" style={{ ...inputStyle, flex: '1 1 140px' }} />
                    {hasDirect && (
                      <select value={editDirect ? 'direct' : 'indirect'} onChange={e => setEditDirect(e.target.value === 'direct')} style={{ ...inputStyle, width: 'auto', cursor: 'pointer' }}>
                        <option value="direct">Direct</option>
                        <option value="indirect">Indirect</option>
                      </select>
                    )}
                    <Button variant="primary" size="sm" onClick={() => saveEdit(r)} isLoading={updateMut.isPending} disabled={!editName.trim()}>Save</Button>
                    <Button variant="ghost" size="sm" onClick={() => setEditId(null)}>Cancel</Button>
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{r.name}</span>
                    {r.name_ar && <span style={{ fontSize: 13, color: 'var(--text-secondary)' }} dir="rtl">{r.name_ar}</span>}
                    {hasDirect && <DirectPill direct={r.is_direct ?? true} />}
                    {inactive && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>Inactive</span>}
                    {canManage && (
                      <div style={{ marginInlineStart: 'auto', display: 'flex', gap: 6 }}>
                        <Button variant="edit" size="sm" onClick={() => startEdit(r)}>Edit</Button>
                        <Button variant="ghost" size="sm" onClick={() => toggleMut.mutate({ id: r.id, active: inactive })}>
                          {inactive ? 'Activate' : 'Deactivate'}
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => handleDelete(r)}>Delete</Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function QuickLink({ href, emoji, title, sub }: { href: string; emoji: string; title: string; sub: string }) {
  return (
    <Link href={href} style={{
      display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none',
      background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 14,
      padding: '16px 18px',
    }}>
      <span style={{ fontSize: 24 }}>{emoji}</span>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{sub}</div>
      </div>
      <span style={{ marginInlineStart: 'auto', color: 'var(--text-muted)' }}>→</span>
    </Link>
  );
}

function Content() {
  const { hasPermission } = usePermissions();
  const { isTenantAdmin, isPlatformAdmin } = useMyPermissions();
  const canManage = isTenantAdmin || isPlatformAdmin || (hasPermission('expense', 'update') ?? false);

  return (
    <MainLayout>
      <PageShell>
        <PageHeader
          title="Expense Setup"
          description="Manage the lists used across petty-cash vouchers — cost types, offices, cash boxes, cost codes and suppliers."
          breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Petty Cash & Expenses', href: '/expenses' }, { label: 'Setup' }]}
          backHref="/expenses"
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <LookupSection
            title="Cost Types"
            subtitle="Direct types code to a project; Indirect types code to an office / location."
            addNoun="cost type"
            queryKey={['exp-costtypes-mgmt']}
            hasDirect
            canManage={canManage}
            api={{
              list: (inc) => expensesApi.listCostTypes(inc),
              create: (p) => expensesApi.createCostType(p.name, p.is_direct ?? true, p.name_ar),
              update: (id, patch) => expensesApi.updateCostType(id, patch),
              remove: (id) => expensesApi.deleteCostType(id),
            }}
          />

          <LookupSection
            title="Office / Locations"
            subtitle="Where indirect (overhead) expenses are charged when there's no project."
            addNoun="office / location"
            queryKey={['exp-overheads-mgmt']}
            hasDirect={false}
            canManage={canManage}
            api={{
              list: (inc) => expensesApi.listOverheadCategories(inc),
              create: (p) => expensesApi.createOverheadCategory(p.name, p.name_ar),
              update: (id, patch) => expensesApi.updateOverheadCategory(id, patch),
              remove: (id) => expensesApi.deleteOverheadCategory(id),
            }}
          />

          <div>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '6px 2px 10px' }}>
              Managed on their own pages
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
              <QuickLink href="/expenses/cash-boxes" emoji="💰" title="Cash Boxes" sub="Boxes, custodians & balances" />
              <QuickLink href="/accounting/cost-codes" emoji="🏷️" title="Cost Codes" sub="Direct / indirect codes & GL accounts" />
              <QuickLink href="/suppliers" emoji="🚚" title="Suppliers" sub="Vendors, TRN & contacts" />
            </div>
          </div>
        </div>
      </PageShell>
    </MainLayout>
  );
}

export default function ExpenseSetupPage() {
  return (
    <RouteGuard requiredPermission={{ category: 'expense', action: 'view' }} redirectTo="/expenses">
      <Content />
    </RouteGuard>
  );
}
