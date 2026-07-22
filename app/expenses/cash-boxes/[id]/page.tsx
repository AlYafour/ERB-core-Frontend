'use client';

/**
 * Cash Box statement — everything about one box in one place:
 * totals (cash in / spent / balance from the ledger), every ledger movement
 * (funding, transfers, cutover entries, aggregated history) and the box's
 * expense vouchers (paginated, searchable), each linking to its documents.
 */

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import MainLayout from '@/components/layout/MainLayout';
import { PageShell, Button, Badge, PageHeader } from '@/components/ui';
import RouteGuard from '@/components/auth/RouteGuard';
import { expensesApi, type Expense } from '@/lib/api/expenses';
import { toast, confirm } from '@/lib/hooks/use-toast';
import { getApiError } from '@/lib/utils/error';
import { formatPrice } from '@/lib/utils/format';

const TH: React.CSSProperties = { padding: '8px 10px', textAlign: 'left', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', textTransform: 'uppercase', borderBottom: '1px solid var(--border-subtle)', whiteSpace: 'nowrap' };
const TD: React.CSSProperties = { padding: '9px 10px', fontSize: 'var(--text-sm)', borderBottom: '1px solid var(--border-subtle)' };
const NUM: React.CSSProperties = { ...TD, textAlign: 'right', fontFamily: 'monospace', whiteSpace: 'nowrap' };
const INPUT: React.CSSProperties = {
  padding: '7px 10px', fontSize: 'var(--text-sm)', border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-sm)', background: 'var(--bg-primary)', color: 'var(--text-primary)',
};

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft', submitted: 'Submitted', accounting_approved: 'Acc. Approved',
  approved: 'Approved', posted: 'Posted', rejected: 'Rejected', cancelled: 'Cancelled',
};
const STATUS_VARIANT: Record<string, 'default' | 'warning' | 'info' | 'success' | 'error'> = {
  draft: 'default', submitted: 'warning', accounting_approved: 'info',
  approved: 'success', posted: 'success', rejected: 'error', cancelled: 'default',
};

const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export default function CashBoxDetailPage() {
  return (
    <RouteGuard requiredPermission={{ category: 'expense', action: 'view' }} redirectTo="/expenses">
      <CashBoxDetail />
    </RouteGuard>
  );
}

function CashBoxDetail() {
  const params = useParams<{ id: string }>();
  const boxId = String(params.id);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const { data: stmt, isLoading } = useQuery({
    queryKey: ['box-statement', boxId],
    queryFn: () => expensesApi.getCashBoxStatement(boxId),
  });
  const { data: expData, isLoading: expLoading } = useQuery({
    queryKey: ['box-expenses', boxId, page, search, statusFilter],
    queryFn: () => expensesApi.getAll({
      cash_box: boxId, page, ...(search ? { search } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
    }),
  });

  const vouchers: Expense[] = expData?.results ?? [];
  const voucherCount = expData?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(voucherCount / 25));

  const balance = Number(stmt?.totals.balance ?? 0);

  const kpis = useMemo(() => ([
    { label: 'Cash In (funding)', value: stmt?.totals.cash_in, color: 'var(--status-success)' },
    { label: 'Spent', value: stmt?.totals.spent, color: 'var(--text-primary)' },
    { label: 'Balance', value: stmt?.totals.balance, color: balance < 0 ? 'var(--status-error)' : 'var(--brand)' },
  ]), [stmt, balance]);

  return (
    <MainLayout>
      <PageShell>
        <PageHeader
          title={stmt ? stmt.box.name : 'Cash Box'}
          description={stmt ? [
            stmt.box.custodian_name ? `Custodian: ${stmt.box.custodian_name}` : 'No custodian assigned',
            stmt.box.account_number
              ? `Bank sub-account ${stmt.box.account_number}${stmt.box.parent_name ? ` (under ${stmt.box.parent_name})` : ''}`
              : null,
            stmt.box.ledger_code ? `Ledger ${stmt.box.ledger_code}` : null,
            `${stmt.vouchers.count} vouchers = ${formatPrice(Number(stmt.vouchers.total))}`,
          ].filter(Boolean).join(' · ') : 'Box statement'}
          breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Petty Cash & Expenses', href: '/expenses' }, { label: 'Cash Boxes', href: '/expenses/cash-boxes' }, { label: stmt?.box.name ?? '…' }]}
          backHref="/expenses/cash-boxes"
          actions={
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {stmt && !stmt.box.is_active && <Badge variant="error">Inactive</Badge>}
              <Link href="/expenses/new"><Button variant="primary" size="sm">+ New Expense</Button></Link>
            </div>
          }
        />

        {/* Totals */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
          {kpis.map(k => (
            <div key={k.label} className="card" style={{ padding: '14px 18px' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>{k.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'monospace', color: k.color }}>
                {isLoading || k.value === undefined ? '…' : formatPrice(Number(k.value))}
              </div>
            </div>
          ))}
        </div>
        {balance < 0 && stmt && (
          <div className="card" style={{ marginBottom: 'var(--space-4)', padding: '10px 16px', borderLeft: '3px solid var(--status-error)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
            Balance is negative — recorded funding is less than recorded spend. Reconcile the funding with accounting.
          </div>
        )}

        {/* Workers — the custodian's sub-floats */}
        <WorkersCard boxId={boxId} />

        {/* Ledger movements */}
        <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
          <div className="proc-section-head"><h3 className="proc-section-title">Funding & Ledger Movements</h3></div>
          {isLoading ? <div style={{ color: 'var(--text-secondary)' }}>Loading…</div>
            : !stmt || stmt.movements.length === 0 ? (
              <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>No ledger movements yet.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>
                    <th style={TH}>Date</th><th style={TH}>Type</th><th style={TH}>Description</th>
                    <th style={TH}>Reference</th><th style={TH}>Journal</th>
                    <th style={{ ...TH, textAlign: 'right' }}>In</th><th style={{ ...TH, textAlign: 'right' }}>Out</th>
                  </tr></thead>
                  <tbody>
                    {stmt.movements.map((m, i) => (
                      <tr key={`${m.journal_id}-${i}`}>
                        <td style={{ ...TD, whiteSpace: 'nowrap' }}>{fmtDate(m.date)}</td>
                        <td style={TD}><Badge variant={Number(m.in) > 0 ? 'success' : 'default'}>{m.source}</Badge></td>
                        <td style={{ ...TD, maxWidth: 340, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={m.description}>{m.description || '—'}</td>
                        <td style={{ ...TD, fontFamily: 'monospace', fontSize: 'var(--text-xs)' }}>{m.reference || '—'}</td>
                        <td style={TD}>
                          <Link href={`/accounting/journal/${m.journal_id}`} style={{ color: 'var(--brand)', fontFamily: 'monospace', fontSize: 'var(--text-xs)', textDecoration: 'none', fontWeight: 600 }}>
                            {m.journal_number || m.status}
                          </Link>
                        </td>
                        <td style={{ ...NUM, color: Number(m.in) > 0 ? 'var(--status-success)' : 'var(--text-muted)' }}>{Number(m.in) > 0 ? formatPrice(Number(m.in)) : '—'}</td>
                        <td style={{ ...NUM, color: Number(m.out) > 0 ? 'var(--status-error)' : 'var(--text-muted)' }}>{Number(m.out) > 0 ? formatPrice(Number(m.out)) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </div>

        {/* Vouchers */}
        <div className="card">
          <div className="proc-section-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <h3 className="proc-section-title">Expense Vouchers ({voucherCount})</h3>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input style={{ ...INPUT, width: 220 }} placeholder="Search vouchers…" value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }} />
              <select style={INPUT} value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
                <option value="">All statuses</option>
                {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>
          {expLoading ? <div style={{ color: 'var(--text-secondary)' }}>Loading…</div>
            : vouchers.length === 0 ? (
              <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>No vouchers match.</div>
            ) : (
              <>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr>
                      <th style={TH}>Date</th><th style={TH}>Number</th><th style={TH}>Serial</th>
                      <th style={TH}>Description</th><th style={TH}>Paid To</th><th style={TH}>Project</th>
                      <th style={{ ...TH, textAlign: 'right' }}>Amount</th><th style={TH}>Status</th>
                    </tr></thead>
                    <tbody>
                      {vouchers.map(e => (
                        <tr key={e.id}>
                          <td style={{ ...TD, whiteSpace: 'nowrap' }}>{fmtDate(e.expense_date)}</td>
                          <td style={TD}>
                            <Link href={`/expenses/${e.id}`} style={{ color: 'var(--brand)', fontFamily: 'monospace', fontWeight: 600, textDecoration: 'none' }}>
                              {e.number || '—'}
                            </Link>
                          </td>
                          <td style={{ ...TD, fontFamily: 'monospace', fontSize: 'var(--text-xs)' }}>{e.voucher_number || '—'}</td>
                          <td style={{ ...TD, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={e.description}>{e.description || '—'}</td>
                          <td style={{ ...TD, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(e as any).supplier_name || e.payee_name || '—'}</td>
                          <td style={{ ...TD, fontFamily: 'monospace', fontSize: 'var(--text-xs)' }}>{(e as any).project_code || (e as any).project_name || '—'}</td>
                          <td style={{ ...NUM, fontWeight: 700 }}>{formatPrice(Number(e.amount))}</td>
                          <td style={TD}><Badge variant={STATUS_VARIANT[e.status] ?? 'default'}>{STATUS_LABEL[e.status] ?? e.status}</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {totalPages > 1 && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
                    <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>‹ Prev</Button>
                    <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>Page {page} / {totalPages}</span>
                    <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next ›</Button>
                  </div>
                )}
              </>
            )}
        </div>
      </PageShell>
    </MainLayout>
  );
}

/** The people this box's custodian hands cash to — each is a tracked
 *  sub-float: received (handovers) − spent (their vouchers) = balance.
 *  Negative is allowed (spent from their own pocket, settled later) — it
 *  shows red, it never blocks. */
function WorkersCard({ boxId }: { boxId: string }) {
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState('');
  const [handingTo, setHandingTo] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  const { data: workers = [], isLoading } = useQuery({
    queryKey: ['box-workers', boxId],
    queryFn: () => expensesApi.listBoxWorkers(boxId),
  });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['box-workers', boxId] });

  const addMut = useMutation({
    mutationFn: () => expensesApi.createBoxWorker(boxId, { name: newName.trim() }),
    onSuccess: () => { invalidate(); setNewName(''); toast('Person added', 'success'); },
    onError: (err) => toast(getApiError(err, 'Could not add'), 'error'),
  });
  const handMut = useMutation({
    mutationFn: (workerId: string) => expensesApi.workerHandover(boxId, workerId, { amount, note }),
    onSuccess: () => { invalidate(); setHandingTo(null); setAmount(''); setNote(''); toast('Cash handed over', 'success'); },
    onError: (err) => toast(getApiError(err, 'Handover failed'), 'error'),
  });
  const deactivateMut = useMutation({
    mutationFn: (workerId: string) => expensesApi.updateBoxWorker(boxId, workerId, { is_active: false }),
    onSuccess: () => { invalidate(); toast('Deactivated', 'success'); },
    onError: (err) => toast(getApiError(err, 'Failed'), 'error'),
  });

  return (
    <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
      <div className="proc-section-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <h3 className="proc-section-title">People Holding Cash ({workers.length})</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <input style={{ ...INPUT, width: 200 }} placeholder="Add a person…" value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && newName.trim()) addMut.mutate(); }} />
          <Button variant="secondary" size="sm" isLoading={addMut.isPending}
            onClick={() => { if (!newName.trim()) { toast('Enter a name', 'error'); return; } addMut.mutate(); }}>
            + Add
          </Button>
        </div>
      </div>
      {isLoading ? <div style={{ color: 'var(--text-secondary)' }}>Loading…</div>
        : workers.length === 0 ? (
          <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
            No one registered yet — add the people you hand cash to (site engineers, buyers…). They become the Payee list on new vouchers.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <th style={TH}>Name</th>
                <th style={{ ...TH, textAlign: 'right' }}>Received</th>
                <th style={{ ...TH, textAlign: 'right' }}>Spent</th>
                <th style={{ ...TH, textAlign: 'right' }}>Holding Now</th>
                <th style={TH}></th>
              </tr></thead>
              <tbody>
                {workers.map(w => {
                  const bal = Number(w.balance);
                  return (
                    <tr key={w.id}>
                      <td style={{ ...TD, fontWeight: 600 }}>{w.name}</td>
                      <td style={{ ...NUM, color: 'var(--status-success)' }}>{formatPrice(Number(w.received))}</td>
                      <td style={NUM}>{formatPrice(Number(w.spent))}</td>
                      <td style={{ ...NUM, fontWeight: 700, color: bal < 0 ? 'var(--status-error)' : 'var(--text-primary)' }}>
                        {formatPrice(bal)}{bal < 0 && ' ⚠'}
                      </td>
                      <td style={{ ...TD, textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {handingTo === w.id ? (
                          <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                            <input autoFocus type="number" min="0" step="0.01" placeholder="Amount"
                              style={{ ...INPUT, width: 110, fontFamily: 'monospace', textAlign: 'right' }}
                              value={amount} onChange={e => setAmount(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter' && Number(amount) > 0) handMut.mutate(w.id); if (e.key === 'Escape') setHandingTo(null); }} />
                            <input placeholder="Note (optional)" style={{ ...INPUT, width: 150 }}
                              value={note} onChange={e => setNote(e.target.value)} />
                            <Button variant="primary" size="sm" isLoading={handMut.isPending}
                              onClick={() => { if (!(Number(amount) > 0)) { toast('Enter a valid amount', 'error'); return; } handMut.mutate(w.id); }}>
                              Hand
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setHandingTo(null)}>Cancel</Button>
                          </span>
                        ) : (
                          <span style={{ display: 'inline-flex', gap: 6 }}>
                            <Button variant="secondary" size="sm" onClick={() => { setHandingTo(w.id); setAmount(''); setNote(''); }}>
                              + Hand Cash
                            </Button>
                            <Button variant="ghost" size="sm" onClick={async () => {
                              if (await confirm(`Deactivate "${w.name}"? Their history stays; they disappear from the Payee list.`)) deactivateMut.mutate(w.id);
                            }}>Deactivate</Button>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
    </div>
  );
}
