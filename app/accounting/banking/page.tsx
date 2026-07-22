'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import MainLayout from '@/components/layout/MainLayout';
import { PageShell } from '@/components/ui/PageShell';
import { Button, Badge } from '@/components/ui';
import { BaseModal } from '@/components/ui/base/BaseModal';
import DateInputDMY from '@/components/ui/DateInputDMY';
import { toast, confirm } from '@/lib/hooks/use-toast';
const toastOk = (m: string) => toast(m, 'success');
const toastErr = (m: string) => toast(m, 'error');
const toastInfo = (m: string) => toast(m, 'info');
import { getApiError } from '@/lib/utils/error';
import {
  accountingApi, type BankAccount, type BankStatement, type MatchSuggestion,
} from '@/lib/api/accounting';
import { usersApi } from '@/lib/api/users';

type UserOpt = { id: number; label: string };

const fmt = (v: string | number) =>
  `AED ${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const CARD: React.CSSProperties = {
  background: 'var(--surface-1, var(--card-bg))',
  border: '1px solid var(--border-primary, var(--border-subtle))',
  borderRadius: 'var(--radius-lg)', padding: 16,
};
const INPUT: React.CSSProperties = {
  width: '100%', padding: '7px 10px', borderRadius: 'var(--radius-md)',
  border: '1px solid var(--input-border)', background: 'var(--input-bg)',
  color: 'var(--text-primary)', fontSize: 'var(--text-sm)',
};
const LABEL: React.CSSProperties = {
  fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', display: 'block', marginBottom: 4,
};
const TD: React.CSSProperties = {
  padding: '6px 8px', fontSize: 'var(--text-sm)',
  borderBottom: '1px solid var(--border-primary, var(--border-subtle))',
};

const KIND_LABEL: Record<string, string> = {
  bank: 'Bank', cash: 'Cash box', petty_cash: 'Petty cash',
};

export default function BankingPage() {
  const queryClient = useQueryClient();
  // false = closed · true = blank form · string = create a SUB under that main
  const [showNewBox, setShowNewBox] = useState<boolean | string>(false);
  const [transferFrom, setTransferFrom] = useState<BankAccount | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [openStatement, setOpenStatement] = useState<string | null>(null);
  const [showOpening, setShowOpening] = useState(false);

  const { data: boxesData } = useQuery({
    queryKey: ['acc-bank-accounts'],
    queryFn: () => accountingApi.listBankAccounts(),
  });
  const boxes = boxesData?.results ?? [];

  const { data: statementsData } = useQuery({
    queryKey: ['acc-statements'],
    queryFn: () => accountingApi.listStatements(),
  });
  const statements = statementsData?.results ?? [];

  const { data: usersResp } = useQuery({
    queryKey: ['users-for-custodian'],
    queryFn: () => usersApi.getAll({ page_size: 200 } as any),
    staleTime: 300_000,
  });
  const users: UserOpt[] = ((usersResp as any)?.results ?? []).map((u: any) => ({
    id: u.id, label: u.full_name || `${u.first_name} ${u.last_name}`.trim() || u.username,
  }));

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['acc-bank-accounts'] });
    queryClient.invalidateQueries({ queryKey: ['acc-statements'] });
  };

  // Visible, editable structure — never hidden data:
  const patchAccount = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<BankAccount> }) =>
      accountingApi.updateBankAccount(id, patch),
    onSuccess: () => { invalidate(); toastOk('Saved.'); },
    onError: (e) => toastErr(getApiError(e)),
  });

  // The bank's own shape: main accounts, each with its sub-accounts nested,
  // then whatever isn't linked under any bank yet.
  const mains = boxes.filter(b => !b.parent && b.kind === 'bank');
  const subsOf = (id: string) => boxes.filter(b => b.parent === id);
  const unlinked = boxes.filter(b => !b.parent && b.kind !== 'bank');

  const sum = (list: BankAccount[]) => list.reduce((s, b) => s + Number(b.balance ?? 0), 0);
  const banksTotal = sum(boxes.filter(b => b.kind === 'bank'));
  const pettyTotal = sum(boxes.filter(b => b.kind !== 'bank'));

  return (
    <MainLayout>
      <PageShell>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 700 }}>Banking</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
              Bank accounts, cash boxes, transfers and statement reconciliation.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="secondary" onClick={() => setShowOpening(true)}>Opening balances</Button>
            <Button variant="secondary" onClick={() => setShowImport(true)}>Import statement</Button>
            <Button onClick={() => setShowNewBox(true)}>+ New account / box</Button>
          </div>
        </div>

        {/* Position summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          {[
            { label: 'Bank Accounts', value: banksTotal },
            { label: 'Petty Cash', value: pettyTotal },
            { label: 'Total Cash Position', value: banksTotal + pettyTotal },
          ].map(k => (
            <div key={k.label} style={{ ...CARD, padding: '12px 16px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 4 }}>{k.label}</div>
              <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'monospace', color: k.value < 0 ? 'var(--status-error)' : 'var(--text-primary)' }}>{fmt(k.value)}</div>
            </div>
          ))}
        </div>

        {/* Banks — each main account with its sub-accounts nested, exactly
            like the bank's own portal. Structure is visible AND editable. */}
        {mains.map(main => (
          <div key={main.id} style={{ ...CARD, padding: 0, overflow: 'hidden' }}>
            {/* Main account header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', flexWrap: 'wrap', borderBottom: '1px solid var(--border-subtle)' }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--brand)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 15, flexShrink: 0 }}>
                {(main.bank_name || main.name).slice(0, 2).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 800, fontSize: 'var(--text-base)' }}>{main.name}</span>
                  <Badge variant="info">Main Account</Badge>
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: 3, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                  {main.bank_name && <span>{main.bank_name}</span>}
                  {main.account_number && <span dir="ltr" style={{ fontFamily: 'monospace' }}>A/C {main.account_number}</span>}
                  {main.iban && <span dir="ltr" style={{ fontFamily: 'monospace' }}>{main.iban}</span>}
                  <span>Ledger {main.ledger_account_code}</span>
                </div>
              </div>
              <div style={{ textAlign: 'end' }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Balance</div>
                <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'monospace', color: Number(main.balance ?? 0) < 0 ? 'var(--status-error)' : 'var(--text-primary)' }}>
                  {fmt(main.balance ?? 0)}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button variant="secondary" size="sm" onClick={() => setTransferFrom(main)}>Transfer</Button>
                <Button variant="primary" size="sm" onClick={() => setShowNewBox(main.id)}>+ Sub-account</Button>
              </div>
            </div>

            {/* Sub-accounts */}
            {subsOf(main.id).length === 0 ? (
              <div style={{ padding: '12px 20px', fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>
                No sub-accounts yet — "+ Sub-account" adds one under this bank (e.g. a custodian's CDC petty-cash sub).
              </div>
            ) : subsOf(main.id).map((b, i, arr) => (
              <div key={b.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                padding: '12px 20px 12px 34px',
                borderBottom: i < arr.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                background: 'var(--surface-subtle)',
              }}>
                <span style={{ color: 'var(--brand)', fontWeight: 800, flexShrink: 0 }}>└</span>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700 }}>{b.name}</span>
                    <Badge variant="default">{KIND_LABEL[b.kind]}</Badge>
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: 2, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {b.account_number && <span dir="ltr" style={{ fontFamily: 'monospace' }}>Sub A/C {b.account_number}</span>}
                    <span>Ledger {b.ledger_account_code}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Custodian</span>
                  <select
                    value={b.custodian ?? ''} style={{ ...INPUT, width: 150, padding: '5px 8px' }}
                    onChange={e => patchAccount.mutate({ id: b.id, patch: { custodian: e.target.value ? Number(e.target.value) : null } as any })}>
                    <option value="">— none —</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.label}</option>)}
                  </select>
                </div>
                <div style={{ textAlign: 'end', minWidth: 120 }}>
                  <span style={{ fontSize: 'var(--text-base)', fontWeight: 800, fontFamily: 'monospace', color: Number(b.balance ?? 0) < 0 ? 'var(--status-error)' : 'var(--text-primary)' }}>
                    {fmt(b.balance ?? 0)}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <Button variant="secondary" size="sm" onClick={() => setTransferFrom(b)}>Transfer</Button>
                  {b.kind === 'petty_cash' && (
                    <a href={`/expenses/cash-boxes/${b.id}`} style={{ fontSize: 'var(--text-sm)', color: 'var(--brand)', textDecoration: 'none', fontWeight: 700, alignSelf: 'center' }}>
                      Open box →
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        ))}

        {/* Cash boxes not linked under any bank yet */}
        {unlinked.length > 0 && (
          <div style={{ ...CARD, padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ fontWeight: 800 }}>Cash Boxes (not linked to a bank)</span>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginInlineStart: 10 }}>
                Physical floats with no bank sub-account — link one below if the bank issues it a number.
              </span>
            </div>
            {unlinked.map((b, i, arr) => (
              <div key={b.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                padding: '12px 20px',
                borderBottom: i < arr.length - 1 ? '1px solid var(--border-subtle)' : 'none',
              }}>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700 }}>{b.name}</span>
                    <Badge variant="default">{KIND_LABEL[b.kind]}</Badge>
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: 2 }}>Ledger {b.ledger_account_code}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Custodian</span>
                  <select
                    value={b.custodian ?? ''} style={{ ...INPUT, width: 150, padding: '5px 8px' }}
                    onChange={e => patchAccount.mutate({ id: b.id, patch: { custodian: e.target.value ? Number(e.target.value) : null } as any })}>
                    <option value="">— none —</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.label}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Link under</span>
                  <select
                    value="" style={{ ...INPUT, width: 170, padding: '5px 8px' }}
                    onChange={e => { if (e.target.value) patchAccount.mutate({ id: b.id, patch: { parent: e.target.value } as any }); }}>
                    <option value="">— choose bank —</option>
                    {mains.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
                <div style={{ textAlign: 'end', minWidth: 120 }}>
                  <span style={{ fontSize: 'var(--text-base)', fontWeight: 800, fontFamily: 'monospace', color: Number(b.balance ?? 0) < 0 ? 'var(--status-error)' : 'var(--text-primary)' }}>
                    {fmt(b.balance ?? 0)}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <Button variant="secondary" size="sm" onClick={() => setTransferFrom(b)}>Transfer</Button>
                  {b.kind === 'petty_cash' && (
                    <a href={`/expenses/cash-boxes/${b.id}`} style={{ fontSize: 'var(--text-sm)', color: 'var(--brand)', textDecoration: 'none', fontWeight: 700, alignSelf: 'center' }}>
                      Open box →
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {!boxes.length ? (
          <div style={{ ...CARD, color: 'var(--text-secondary)' }}>
            No bank accounts or cash boxes yet — create your first one to start
            paying, receiving and reconciling.
          </div>
        ) : null}

        <div style={CARD}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>Statements</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Imported', 'Account', 'Reference', 'Period', 'Unmatched', 'Status', ''].map((h) => (
                    <th key={h} style={{ ...TD, textAlign: 'left', color: 'var(--text-secondary)', fontSize: 'var(--text-xs)', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {statements.map((s) => (
                  <tr key={s.id}>
                    <td style={TD}>{new Date(s.created_at).toLocaleDateString()}</td>
                    <td style={TD}>{s.bank_account_name}</td>
                    <td style={TD}>{s.reference || '—'}</td>
                    <td style={TD}>{s.period_start} → {s.period_end}</td>
                    <td style={TD}>
                      <Badge variant={s.unmatched_count ? 'warning' : 'success'}>{s.unmatched_count ?? 0}</Badge>
                    </td>
                    <td style={TD}>
                      <Badge variant={s.status === 'reconciled' ? 'success' : 'default'}>{s.status}</Badge>
                    </td>
                    <td style={TD}>
                      <Button variant="secondary" size="sm" onClick={() => setOpenStatement(s.id)}>Reconcile</Button>
                    </td>
                  </tr>
                ))}
                {!statements.length ? (
                  <tr><td style={{ ...TD, color: 'var(--text-secondary)' }} colSpan={7}>No statements imported yet.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        {showNewBox ? (
          <NewBoxModal
            mains={mains} users={users}
            defaultParent={typeof showNewBox === 'string' ? showNewBox : ''}
            onClose={() => { setShowNewBox(false); invalidate(); }} />
        ) : null}
        {transferFrom ? (
          <TransferModal source={transferFrom} boxes={boxes}
                         onClose={() => { setTransferFrom(null); invalidate(); }} />
        ) : null}
        {showImport ? (
          <ImportModal boxes={boxes} onClose={() => { setShowImport(false); invalidate(); }} />
        ) : null}
        {openStatement ? (
          <ReconcileModal statementId={openStatement} onClose={() => { setOpenStatement(null); invalidate(); }} />
        ) : null}
        {showOpening ? (
          <OpeningBalancesModal boxes={boxes} onClose={() => { setShowOpening(false); invalidate(); }} />
        ) : null}
      </PageShell>
    </MainLayout>
  );
}

function OpeningBalancesModal({ boxes, onClose }: { boxes: BankAccount[]; onClose: () => void }) {
  // Default cutover = start of the current year; overridden by the saved
  // statement's date once the prefill loads.
  const [asOf, setAsOf] = useState(`${new Date().getFullYear()}-01-01`);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);

  const { data: existing } = useQuery({
    queryKey: ['opening-balances'],
    queryFn: accountingApi.getBankOpeningBalances,
    staleTime: 0,
  });
  useEffect(() => {
    if (!existing || loaded) return;
    if (existing.exists) {
      if (existing.as_of) setAsOf(existing.as_of);
      setAmounts(Object.fromEntries(existing.entries.map(e => [e.account, e.amount])));
    }
    setLoaded(true);
  }, [existing, loaded]);

  const save = useMutation({
    mutationFn: () => accountingApi.setBankOpeningBalances({
      as_of: asOf,
      // Send every account — 0 tells the backend to drop a previously saved
      // line, so clearing a field really removes it.
      entries: boxes.map(b => ({ account: b.id, amount: String(Number(amounts[b.id] || 0)) })),
    }),
    onSuccess: (d) => { toastOk(d.restated ? 'Opening balances updated (old entry reversed automatically).' : 'Opening balances posted.'); onClose(); },
    onError: (err) => toastErr(getApiError(err, 'Could not set opening balances')),
  });

  const anyAmount = boxes.some(b => Number(amounts[b.id] || 0) > 0);

  return (
    <BaseModal isOpen onClose={onClose} title="Opening balances">
      <p style={{ margin: '0 0 12px', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
        Enter each account&apos;s starting balance as of the cutover date. One balanced
        opening entry is posted (the difference goes to Opening Balance Equity).
        You can come back anytime — edit a number, add the rest, or clear a field
        to remove it, then save again.
      </p>
      {existing?.exists ? (
        <div style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 8,
          background: 'var(--surface-secondary)', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
          Currently on the books: <b style={{ color: 'var(--text-primary)' }}>{existing.number}</b>.
          Saving restates it — the old entry is reversed automatically, nothing is lost from the audit trail.
          {existing.other_lines ? ` ${existing.other_lines} non-bank line(s) from the full wizard are preserved as-is.` : ''}
        </div>
      ) : null}
      <div style={{ marginBottom: 12 }}>
        <label style={LABEL}>As of date</label>
        <DateInputDMY style={{ ...INPUT, maxWidth: 200 }} value={asOf} onChange={setAsOf} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {boxes.map(b => (
          <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ flex: 1, fontSize: 'var(--text-sm)' }}>
              {b.name} <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-xs)' }}>({KIND_LABEL[b.kind]})</span>
            </span>
            <input type="number" min="0" step="0.01" placeholder="0.00" style={{ ...INPUT, maxWidth: 160, textAlign: 'right', fontFamily: 'monospace' }}
              value={amounts[b.id] ?? ''} onChange={e => setAmounts(a => ({ ...a, [b.id]: e.target.value }))} />
          </div>
        ))}
        {!boxes.length && <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>No accounts yet — add one first.</span>}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
        <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
        <Button variant="primary" size="sm" isLoading={save.isPending} disabled={!anyAmount}
          onClick={() => save.mutate()}>{existing?.exists ? 'Save & restate' : 'Post opening balances'}</Button>
      </div>
    </BaseModal>
  );
}

function NewBoxModal({ onClose, mains, users, defaultParent }: {
  onClose: () => void; mains: BankAccount[]; users: UserOpt[]; defaultParent: string;
}) {
  const [f, setF] = useState({
    kind: defaultParent ? 'petty_cash' : 'bank',
    name: '', name_ar: '', bank_name: '',
    account_number: '', iban: '', currency: 'AED', ledger_account: '',
    parent: defaultParent, custodian: '',
  });
  const { data: accountsData } = useQuery({
    queryKey: ['acc-asset-accounts'],
    queryFn: () => accountingApi.listAccounts({ nature: 'asset', is_postable: true, is_active: true, page_size: 500 }),
  });
  const accounts = accountsData?.results ?? [];
  const parentBank = mains.find(m => m.id === f.parent);

  const create = useMutation({
    mutationFn: () => accountingApi.createBankAccount({
      ...f,
      // Blank = the backend provisions a dedicated ledger sub-account —
      // one box, one line in the chart of accounts.
      ledger_account: f.ledger_account ? Number(f.ledger_account) : null,
      parent: f.parent || null,
      custodian: f.custodian ? Number(f.custodian) : null,
      bank_name: f.bank_name || parentBank?.bank_name || '',
    } as never),
    onSuccess: () => { toastOk('Account created.'); onClose(); },
    onError: (e) => toastErr(getApiError(e)),
  });

  return (
    <BaseModal isOpen onClose={onClose}
      title={parentBank ? `New sub-account under ${parentBank.name}` : 'New bank account / cash box'}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10 }}>
          <div>
            <label style={LABEL}>Kind</label>
            <select style={INPUT} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>
              <option value="bank">Bank account</option>
              <option value="cash">Cash box</option>
              <option value="petty_cash">Petty cash box</option>
            </select>
          </div>
          <div>
            <label style={LABEL}>Name</label>
            <input style={INPUT} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder={parentBank ? 'e.g. SAIF' : 'e.g. FAB — Current (AED)'} />
          </div>
        </div>
        <div>
          <label style={LABEL}>Arabic name</label>
          <input style={INPUT} dir="rtl" value={f.name_ar} onChange={(e) => setF({ ...f, name_ar: e.target.value })} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={LABEL}>Sub-account of (main bank account)</label>
            <select style={INPUT} value={f.parent} onChange={(e) => setF({ ...f, parent: e.target.value })}>
              <option value="">— none (top-level) —</option>
              {mains.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div>
            <label style={LABEL}>Custodian (accountable person)</label>
            <select style={INPUT} value={f.custodian} onChange={(e) => setF({ ...f, custodian: e.target.value })}>
              <option value="">— none —</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <div>
            <label style={LABEL}>Bank name</label>
            <input style={INPUT} value={f.bank_name} placeholder={parentBank?.bank_name || ''} onChange={(e) => setF({ ...f, bank_name: e.target.value })} />
          </div>
          <div>
            <label style={LABEL}>Account no. {f.parent ? '(the sub-account number)' : ''}</label>
            <input style={INPUT} value={f.account_number} onChange={(e) => setF({ ...f, account_number: e.target.value })} />
          </div>
          <div>
            <label style={LABEL}>IBAN</label>
            <input style={INPUT} value={f.iban} onChange={(e) => setF({ ...f, iban: e.target.value })} />
          </div>
        </div>
        <div>
          <label style={LABEL}>Ledger account (optional)</label>
          <select style={INPUT} value={f.ledger_account} onChange={(e) => setF({ ...f, ledger_account: e.target.value })}>
            <option value="">Automatic — a dedicated account is created in the chart</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
          </select>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
            Leave on Automatic — every account/box gets its own line in the Chart of Accounts.
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button disabled={create.isPending} onClick={() => {
            if (!f.name) { toastErr('Name is required.'); return; }
            create.mutate();
          }}>
            {create.isPending ? 'Saving…' : 'Create'}
          </Button>
        </div>
      </div>
    </BaseModal>
  );
}

function TransferModal({ source, boxes, onClose }: {
  source: BankAccount; boxes: BankAccount[]; onClose: () => void;
}) {
  const router = useRouter();
  const [f, setF] = useState({
    destination: '', amount: '',
    transfer_date: new Date().toISOString().slice(0, 10),
    reference: '', memo: '',
  });
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);

  const targets = boxes.filter((b) => b.id !== source.id && b.is_active);
  const dest = targets.find((b) => b.id === f.destination) || null;
  const amt = Number(f.amount) > 0 ? Number(f.amount) : 0;

  const submit = async (thenView: boolean) => {
    if (!f.destination || amt <= 0) { toastErr('Destination and a positive amount are required.'); return; }
    setBusy(true);
    try {
      const r = await accountingApi.transfer(source.id, f) as { journal_entry: string; journal_number?: string };
      let attached = 0;
      for (const file of files) {
        try { await accountingApi.uploadJournalAttachment(r.journal_entry, file); attached += 1; }
        catch { toastErr(`Could not attach ${file.name}`); }
      }
      toastOk(`Transfer posted — journal ${r.journal_number ?? ''}`
        + (attached ? ` with ${attached} attachment${attached !== 1 ? 's' : ''}` : '') + '.');
      onClose();
      if (thenView) router.push(`/accounting/journal/${r.journal_entry}`);
    } catch (e) { toastErr(getApiError(e)); }
    finally { setBusy(false); }
  };

  const acctLine = (b: BankAccount | null, fallback: string) => b
    ? `${b.name}${b.account_number ? ` — A/C ${b.account_number}` : ''}`
    : fallback;

  return (
    <BaseModal isOpen onClose={onClose} title={`Transfer from ${source.name}`}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* From → To */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 10, alignItems: 'end' }}>
          <div>
            <label style={LABEL}>From</label>
            <div style={{ ...INPUT, background: 'var(--surface-secondary)', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{source.name}</span>
              <span style={{ color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{fmt(source.balance ?? 0)}</span>
            </div>
          </div>
          <span style={{ paddingBottom: 8, color: 'var(--text-secondary)' }}>→</span>
          <div>
            <label style={LABEL}>To</label>
            <select style={INPUT} value={f.destination} onChange={(e) => setF({ ...f, destination: e.target.value })}>
              <option value="">Select…</option>
              {targets.map((b) => <option key={b.id} value={b.id}>{b.name} ({KIND_LABEL[b.kind]}{b.account_number ? ` · ${b.account_number}` : ''})</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={LABEL}>Amount (AED)</label>
            <input type="number" min="0" step="0.01" style={{ ...INPUT, textAlign: 'right', fontFamily: 'monospace' }} value={f.amount}
                   onChange={(e) => setF({ ...f, amount: e.target.value })} />
          </div>
          <div>
            <label style={LABEL}>Date</label>
            <DateInputDMY style={INPUT} value={f.transfer_date}
                          onChange={(v) => setF({ ...f, transfer_date: v })} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={LABEL}>Bank Reference No</label>
            <input style={INPUT} placeholder="PHUB… / CASH" value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} />
          </div>
          <div>
            <label style={LABEL}>Description</label>
            <input style={INPUT} placeholder="What is this transfer for?" value={f.memo} onChange={(e) => setF({ ...f, memo: e.target.value })} />
          </div>
        </div>

        {/* Live double-entry preview — the journal this will post */}
        <div style={{ border: '1px solid var(--border-primary, var(--border-subtle))', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
          <div style={{ padding: '6px 10px', fontSize: 'var(--text-xs)', fontWeight: 700, letterSpacing: '0.04em',
            textTransform: 'uppercase', color: 'var(--text-secondary)', background: 'var(--surface-secondary)' }}>
            Journal entry preview
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...TD, textAlign: 'left', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>Account</th>
                <th style={{ ...TD, textAlign: 'right', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>Debit</th>
                <th style={{ ...TD, textAlign: 'right', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>Credit</th>
              </tr>
            </thead>
            <tbody style={{ fontVariantNumeric: 'tabular-nums' }}>
              <tr>
                <td style={TD}>{acctLine(dest, 'Destination…')}</td>
                <td style={{ ...TD, textAlign: 'right' }}>{amt ? fmt(amt) : '—'}</td>
                <td style={{ ...TD, textAlign: 'right', color: 'var(--text-secondary)' }}>—</td>
              </tr>
              <tr>
                <td style={TD}>{acctLine(source, source.name)}</td>
                <td style={{ ...TD, textAlign: 'right', color: 'var(--text-secondary)' }}>—</td>
                <td style={{ ...TD, textAlign: 'right' }}>{amt ? fmt(amt) : '—'}</td>
              </tr>
              <tr>
                <td style={{ ...TD, borderBottom: 'none', fontWeight: 700 }}>Total</td>
                <td style={{ ...TD, borderBottom: 'none', textAlign: 'right', fontWeight: 700 }}>{fmt(amt)}</td>
                <td style={{ ...TD, borderBottom: 'none', textAlign: 'right', fontWeight: 700 }}>{fmt(amt)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Attachments — the bank slip lives on the journal entry */}
        <div>
          <label style={LABEL}>Attachments (transfer slip, advice…)</label>
          <input type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp"
                 onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
                 style={{ fontSize: 'var(--text-sm)' }} />
          {files.length > 0 && (
            <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {files.map((file, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                  <span>{file.name}</span>
                  <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))}
                          style={{ border: 'none', background: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>✕</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="secondary" disabled={busy} onClick={() => submit(true)}>
            {busy ? 'Posting…' : 'Transfer & view entry'}
          </Button>
          <Button disabled={busy} onClick={() => submit(false)}>
            {busy ? 'Posting…' : 'Transfer'}
          </Button>
        </div>
      </div>
    </BaseModal>
  );
}

function ImportModal({ boxes, onClose }: { boxes: BankAccount[]; onClose: () => void }) {
  const [f, setF] = useState({ bank_account: '', format: 'csv' as 'csv' | 'ofx', content: '', filename: '', reference: '' });
  const run = useMutation({
    mutationFn: () => accountingApi.importStatement(f),
    onSuccess: (r) => { toastOk(`Imported ${r.imported} line(s), skipped ${r.skipped}.`); onClose(); },
    onError: (e) => toastErr(getApiError(e)),
  });

  const onFile = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setF((prev) => ({
      ...prev,
      content: String(reader.result ?? ''),
      filename: file.name,
      format: file.name.toLowerCase().endsWith('.ofx') || file.name.toLowerCase().endsWith('.qfx') ? 'ofx' : 'csv',
    }));
    reader.readAsText(file);
  };

  return (
    <BaseModal isOpen onClose={onClose} title="Import bank statement">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
          <div>
            <label style={LABEL}>Bank account</label>
            <select style={INPUT} value={f.bank_account} onChange={(e) => setF({ ...f, bank_account: e.target.value })}>
              <option value="">Select…</option>
              {boxes.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label style={LABEL}>Format</label>
            <select style={INPUT} value={f.format} onChange={(e) => setF({ ...f, format: e.target.value as 'csv' | 'ofx' })}>
              <option value="csv">CSV</option>
              <option value="ofx">OFX / QFX</option>
            </select>
          </div>
        </div>
        <div>
          <label style={LABEL}>File</label>
          <input type="file" accept=".csv,.ofx,.qfx,.txt" style={INPUT}
                 onChange={(e) => onFile(e.target.files?.[0])} />
        </div>
        <div>
          <label style={LABEL}>…or paste content</label>
          <textarea style={{ ...INPUT, minHeight: 120, fontFamily: 'monospace' }} value={f.content}
                    onChange={(e) => setF({ ...f, content: e.target.value })}
                    placeholder={'Date,Description,Reference,Amount\n2026-07-01,Client receipt,TRF-1,5000.00'} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button disabled={run.isPending} onClick={() => {
            if (!f.bank_account || !f.content.trim()) { toastErr('Bank account and file content are required.'); return; }
            run.mutate();
          }}>
            {run.isPending ? 'Importing…' : 'Import'}
          </Button>
        </div>
      </div>
    </BaseModal>
  );
}

function ReconcileModal({ statementId, onClose }: { statementId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [reopenReason, setReopenReason] = useState('');

  const { data: stmt } = useQuery({
    queryKey: ['acc-statement', statementId],
    queryFn: async () => {
      const page = await accountingApi.listStatements({ page_size: 100 });
      return page.results.find((s) => s.id === statementId) ?? null;
    },
  });
  const { data: suggestionsData, refetch: refetchSuggestions } = useQuery({
    queryKey: ['acc-suggest', statementId],
    queryFn: () => accountingApi.suggestMatches(statementId),
    enabled: false,
  });
  const suggestions = suggestionsData?.suggestions ?? [];
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['acc-statement', statementId] });
    queryClient.invalidateQueries({ queryKey: ['acc-statements'] });
  };

  const act = {
    match: useMutation({
      mutationFn: (s: MatchSuggestion) => accountingApi.matchLine(statementId, s.line_id, s.journal_line_id, s.confidence),
      onSuccess: () => { refresh(); refetchSuggestions(); },
      onError: (e) => toastErr(getApiError(e)),
    }),
    unmatch: useMutation({
      mutationFn: (lineId: number) => accountingApi.unmatchLine(statementId, lineId),
      onSuccess: refresh,
      onError: (e) => toastErr(getApiError(e)),
    }),
    reconcile: useMutation({
      mutationFn: () => accountingApi.reconcileStatement(statementId),
      onSuccess: () => { toastOk('Statement reconciled.'); refresh(); },
      onError: (e) => toastErr(getApiError(e)),
    }),
    reopen: useMutation({
      mutationFn: () => accountingApi.reopenStatement(statementId, reopenReason.trim()),
      onSuccess: () => { toastOk('Statement reopened.'); refresh(); },
      onError: (e) => toastErr(getApiError(e)),
    }),
  };

  if (!stmt) {
    return <BaseModal isOpen onClose={onClose} title="Reconciliation"><div>Loading…</div></BaseModal>;
  }
  const unmatched = stmt.lines.filter((l) => l.status === 'unmatched').length;

  return (
    <BaseModal isOpen onClose={onClose} title={`Reconcile — ${stmt.bank_account_name} (${stmt.reference || stmt.id.slice(0, 8)})`}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '70vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Badge variant={stmt.status === 'reconciled' ? 'success' : 'default'}>{stmt.status}</Badge>
          <Badge variant={unmatched ? 'warning' : 'success'}>{unmatched} unmatched</Badge>
          {stmt.status === 'open' ? (
            <>
              <Button variant="secondary" size="sm" onClick={() => refetchSuggestions()}>Suggest matches</Button>
              <Button size="sm" disabled={unmatched > 0 || act.reconcile.isPending}
                      onClick={async () => {
                        if (await confirm('Reconcile this statement? It becomes permanent history.')) act.reconcile.mutate();
                      }}>
                Reconcile
              </Button>
            </>
          ) : null}
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['#', 'Date', 'Description', 'Ref', 'Amount', 'Status', 'Journal', ''].map((h) => (
                  <th key={h} style={{ ...TD, textAlign: 'left', color: 'var(--text-secondary)', fontSize: 'var(--text-xs)', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stmt.lines.map((l) => {
                const lineSuggestions = suggestions.filter((s) => s.line_id === l.id);
                return (
                  <LineRows key={l.id} line={l} suggestions={lineSuggestions}
                            reconciled={stmt.status === 'reconciled'}
                            onAccept={(s) => act.match.mutate(s)}
                            onUnmatch={() => act.unmatch.mutate(l.id)} />
                );
              })}
            </tbody>
          </table>
        </div>

        {stmt.status === 'reconciled' ? (
          <div>
            <label style={LABEL}>Reopen (requires a reason)</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input style={INPUT} value={reopenReason} onChange={(e) => setReopenReason(e.target.value)} />
              <Button variant="secondary" disabled={!reopenReason.trim()} onClick={() => act.reopen.mutate()}>Reopen</Button>
            </div>
          </div>
        ) : null}
      </div>
    </BaseModal>
  );
}

function LineRows({ line, suggestions, reconciled, onAccept, onUnmatch }: {
  line: BankStatement['lines'][number];
  suggestions: MatchSuggestion[];
  reconciled: boolean;
  onAccept: (s: MatchSuggestion) => void;
  onUnmatch: () => void;
}) {
  const negative = Number(line.amount) < 0;
  return (
    <>
      <tr>
        <td style={TD}>{line.line_no}</td>
        <td style={TD}>{line.txn_date}</td>
        <td style={TD}>{line.description || '—'}</td>
        <td style={TD}>{line.reference || '—'}</td>
        <td style={{ ...TD, fontVariantNumeric: 'tabular-nums', color: negative ? 'var(--error, #dc2626)' : 'var(--success, #16a34a)' }}>
          {fmt(line.amount)}
        </td>
        <td style={TD}>
          <Badge variant={line.status === 'matched' ? 'success' : 'warning'}>{line.status}</Badge>
        </td>
        <td style={TD}>{line.journal_number ?? '—'}</td>
        <td style={TD}>
          {line.status === 'matched' && !reconciled ? (
            <Button variant="secondary" size="sm" onClick={onUnmatch}>Unmatch</Button>
          ) : null}
        </td>
      </tr>
      {suggestions.map((s) => (
        <tr key={s.journal_line_id} style={{ background: 'var(--surface-2, transparent)' }}>
          <td style={TD} />
          <td style={TD} colSpan={5}>
            ↳ {s.journal_number} · {s.posting_date} · {s.journal_memo}
            <Badge variant={s.confidence === 'high' ? 'success' : 'info'}>{s.confidence}</Badge>
          </td>
          <td style={TD} colSpan={2}>
            <Button size="sm" onClick={() => onAccept(s)}>Accept match</Button>
          </td>
        </tr>
      ))}
    </>
  );
}
