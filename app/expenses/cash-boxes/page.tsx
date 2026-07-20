'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import MainLayout from '@/components/layout/MainLayout';
import { PageShell, Button, Badge, PageHeader } from '@/components/ui';
import SearchableDropdown from '@/components/ui/SearchableDropdown';
import RouteGuard from '@/components/auth/RouteGuard';
import { expensesApi } from '@/lib/api/expenses';
import { accountingApi } from '@/lib/api/accounting';
import { usersApi } from '@/lib/api/users';
import { toast, confirm } from '@/lib/hooks/use-toast';
import { getApiError } from '@/lib/utils/error';
import { formatPrice } from '@/lib/utils/format';

const INPUT: React.CSSProperties = {
  width: '100%', padding: '7px 9px', fontSize: 'var(--text-sm)',
  border: '1px solid var(--input-border, var(--border-subtle))', borderRadius: 'var(--radius-sm)',
  background: 'var(--input-bg, var(--bg-primary))', color: 'var(--text-primary)', boxSizing: 'border-box',
};
const LABEL: React.CSSProperties = { display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 3 };
const TH: React.CSSProperties = { padding: '8px 10px', textAlign: 'left', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', textTransform: 'uppercase', borderBottom: '1px solid var(--border-subtle)' };
const TD: React.CSSProperties = { padding: '9px 10px', fontSize: 'var(--text-sm)', borderBottom: '1px solid var(--border-subtle)' };

export default function CashBoxesPage() {
  return (
    <RouteGuard requiredPermission={{ category: 'expense', action: 'view' }} redirectTo="/expenses">
      <CashBoxesContent />
    </RouteGuard>
  );
}

function CashBoxesContent() {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [cashInBox, setCashInBox] = useState<{ id: string; name: string } | null>(null);
  const [newName, setNewName] = useState('');
  const [newCustodian, setNewCustodian] = useState<number | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState('');

  const { data: boxes = [], isLoading } = useQuery({ queryKey: ['exp-cash-boxes'], queryFn: () => expensesApi.listCashBoxes() });
  const { data: usersResp } = useQuery({ queryKey: ['users-for-custodian'], queryFn: () => usersApi.getAll({ page_size: 200 } as any), staleTime: 300_000 });
  const users = (usersResp as any)?.results ?? (Array.isArray(usersResp) ? usersResp : []);
  const userOpts = users.map((u: any) => ({ value: u.id, label: u.full_name || `${u.first_name} ${u.last_name}`.trim() || u.username }));

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['exp-cash-boxes'] });

  const createBox = useMutation({
    mutationFn: () => expensesApi.createCashBox({ name: newName, custodian: newCustodian }),
    onSuccess: () => { invalidate(); toast('Cash box created', 'success'); setShowAdd(false); setNewName(''); setNewCustodian(null); },
    onError: (err) => toast(getApiError(err, 'Could not create box'), 'error'),
  });
  const setCustodian = useMutation({
    mutationFn: ({ id, custodian }: { id: string; custodian: number | null }) => expensesApi.updateCashBox(id, { custodian }),
    onSuccess: () => { invalidate(); toast('Custodian updated', 'success'); },
    onError: (err) => toast(getApiError(err, 'Update failed'), 'error'),
  });
  const renameBox = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => expensesApi.updateCashBox(id, { name }),
    onSuccess: () => { invalidate(); setRenameId(null); toast('Box renamed', 'success'); },
    onError: (err) => toast(getApiError(err, 'Rename failed'), 'error'),
  });
  const deactivateBox = useMutation({
    mutationFn: (id: string) => expensesApi.deactivateCashBox(id),
    onSuccess: () => { invalidate(); toast('Box deactivated', 'success'); },
    onError: (err) => toast(getApiError(err, 'Could not deactivate'), 'error'),
  });
  const askDeactivate = async (b: { id: string; name: string }) => {
    if (await confirm(`Deactivate "${b.name}"? It will be hidden from new vouchers; its history stays intact.`)) {
      deactivateBox.mutate(b.id);
    }
  };

  return (
    <MainLayout>
      <PageShell>
        <PageHeader
          title="Cash Boxes"
          description="Petty-cash boxes and their custodians. Each box's balance = top-ups minus expenses (imprest system)."
          breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Petty Cash & Expenses', href: '/expenses' }, { label: 'Cash Boxes' }]}
          backHref="/expenses"
          actions={<Button variant="primary" size="sm" onClick={() => setShowAdd(v => !v)}>{showAdd ? 'Close' : '+ New Box'}</Button>}
        />

        {showAdd && (
          <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
            <div className="proc-section-head"><h3 className="proc-section-title">New Cash Box</h3></div>
            <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ minWidth: 220, flex: 1 }}><label style={LABEL}>Box name</label>
                <input style={INPUT} value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Ghaith Petty Cash" /></div>
              <div style={{ minWidth: 220, flex: 1 }}><label style={LABEL}>Custodian (accountable person)</label>
                <SearchableDropdown options={userOpts} value={newCustodian} allowClear placeholder="Who holds this cash"
                  onChange={v => setNewCustodian(v ? Number(v) : null)} /></div>
              <Button variant="primary" size="sm" onClick={() => { if (!newName.trim()) { toast('Enter a box name', 'error'); return; } createBox.mutate(); }} isLoading={createBox.isPending}>Create</Button>
            </div>
          </div>
        )}

        <div className="card">
          {isLoading ? <div style={{ color: 'var(--text-secondary)' }}>Loading…</div> : boxes.length === 0 ? (
            <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>No cash boxes yet. Add one to start recording petty-cash.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>{['Box', 'Custodian', 'Topped up', 'Spent', 'Balance', ''].map((h, i) =>
                  <th key={h || i} style={{ ...TH, textAlign: ['Topped up', 'Spent', 'Balance'].includes(h) ? 'right' : 'left' }}>{h}</th>)}</tr></thead>
                <tbody>
                  {boxes.map(b => {
                    const bal = Number(b.balance ?? 0);
                    return (
                      <tr key={b.id}>
                        <td style={{ ...TD, fontWeight: 600 }}>
                          {renameId === b.id ? (
                            <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                              <input style={{ ...INPUT, width: 180 }} value={renameVal} onChange={e => setRenameVal(e.target.value)} autoFocus />
                              <Button variant="primary" size="sm" onClick={() => renameVal.trim() && renameBox.mutate({ id: b.id, name: renameVal.trim() })} isLoading={renameBox.isPending}>Save</Button>
                              <Button variant="ghost" size="sm" onClick={() => setRenameId(null)}>Cancel</Button>
                            </span>
                          ) : (
                            <>{b.name}{b.kind !== 'petty_cash' && <Badge variant="info">Bank</Badge>}</>
                          )}
                        </td>
                        <td style={TD}>
                          <SearchableDropdown options={userOpts} value={b.custodian ?? null} allowClear placeholder="Assign custodian"
                            onChange={v => setCustodian.mutate({ id: b.id, custodian: v ? Number(v) : null })} />
                        </td>
                        <td style={{ ...TD, textAlign: 'right', fontFamily: 'monospace' }}>{formatPrice(Number(b.cash_in ?? 0))}</td>
                        <td style={{ ...TD, textAlign: 'right', fontFamily: 'monospace' }}>{formatPrice(Number(b.spent ?? 0))}</td>
                        <td style={{ ...TD, textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: bal < 0 ? 'var(--status-error)' : 'var(--text-primary)' }}>{formatPrice(bal)}</td>
                        <td style={{ ...TD, textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <span style={{ display: 'inline-flex', gap: 6, justifyContent: 'flex-end' }}>
                            <Button variant="secondary" size="sm" onClick={() => setCashInBox({ id: b.id, name: b.name })}>+ Cash In</Button>
                            <Button variant="edit" size="sm" onClick={() => { setRenameId(b.id); setRenameVal(b.name); }}>Rename</Button>
                            <Button variant="ghost" size="sm" onClick={() => askDeactivate({ id: b.id, name: b.name })}>Deactivate</Button>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {cashInBox && <CashInModal box={cashInBox} onClose={() => setCashInBox(null)} onDone={invalidate} />}
      </PageShell>
    </MainLayout>
  );
}

function CashInModal({ box, onClose, onDone }: { box: { id: string; name: string }; onClose: () => void; onDone: () => void }) {
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [sourceAccount, setSourceAccount] = useState<string | null>(null);
  const [from, setFrom] = useState('');
  const [ref, setRef] = useState('');

  const { data: banksData } = useQuery({
    queryKey: ['acc-bank-accounts'],
    queryFn: () => accountingApi.listBankAccounts(),
    staleTime: 300_000,
  });
  const bankOpts = ((banksData?.results ?? []) as any[])
    .filter(b => b.kind === 'bank' && b.is_active !== false)
    .map(b => ({ value: b.id, label: b.name }));

  const save = useMutation({
    mutationFn: async () => {
      const ci = await expensesApi.createCashIn({
        cash_box: box.id, amount, date,
        source_account: sourceAccount, transfer_from: from, bank_reference: ref });
      await expensesApi.approveCashIn(ci.id);   // approve immediately → posts + counts in balance
      return ci;
    },
    onSuccess: () => { toast('Cash in recorded', 'success'); onDone(); onClose(); },
    onError: (err) => toast(getApiError(err, 'Failed to record cash in'), 'error'),
  });

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--surface-primary, var(--bg-primary))', borderRadius: 10, padding: 22, width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
        <h3 style={{ margin: '0 0 4px', fontSize: 'var(--text-lg)', fontWeight: 700 }}>Cash In — {box.name}</h3>
        <p style={{ margin: '0 0 14px', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>Top up this box from the bank.</p>
        <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
          <div><label style={LABEL}>Amount (AED) <span style={{ color: 'var(--status-error)' }}>*</span></label>
            <input type="number" min="0" step="0.01" style={INPUT} value={amount} onChange={e => setAmount(e.target.value)} autoFocus /></div>
          <div><label style={LABEL}>Date</label><input type="date" style={INPUT} value={date} onChange={e => setDate(e.target.value)} /></div>
          <div><label style={LABEL}>From bank account</label>
            <SearchableDropdown options={bankOpts} value={sourceAccount} allowClear
              placeholder={bankOpts.length ? 'Which bank funded this' : 'No bank accounts — add one in Banking'}
              onChange={v => setSourceAccount(v ? String(v) : null)} /></div>
          <div><label style={LABEL}>Note (optional)</label><input style={INPUT} value={from} onChange={e => setFrom(e.target.value)} placeholder="e.g. cheque / branch" /></div>
          <div><label style={LABEL}>Bank reference</label><input style={INPUT} value={ref} onChange={e => setRef(e.target.value)} /></div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="primary" size="sm" onClick={() => { if (!amount || Number(amount) <= 0) { toast('Enter an amount', 'error'); return; } save.mutate(); }} isLoading={save.isPending}>Record</Button>
        </div>
      </div>
    </div>
  );
}
