'use client';

/**
 * Cash Box statement — everything about one box in one place:
 * totals (cash in / spent / balance from the ledger), every ledger movement
 * (funding, transfers, cutover entries, aggregated history) and the box's
 * expense vouchers (paginated, searchable), each linking to its documents.
 */

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import MainLayout from '@/components/layout/MainLayout';
import { PageShell, Button, Badge, PageHeader } from '@/components/ui';
import { RowActions } from '@/components/ui/RowActions';
import RouteGuard from '@/components/auth/RouteGuard';
import { expensesApi, type Expense } from '@/lib/api/expenses';
import { useMyPermissions } from '@/lib/hooks/use-my-permissions';
import { toast, confirm } from '@/lib/hooks/use-toast';
import { getApiError } from '@/lib/utils/error';
import { formatPrice } from '@/lib/utils/format';

// What's missing for a complete record: who was paid, and the receipt scan.
const missingInfo = (e: Expense): string[] => {
  const m: string[] = [];
  if (!e.supplier && !e.payee_worker && !e.vehicle && !(e.payee_name || '').trim()) m.push('Payee');
  if (!e.attachments || e.attachments.length === 0) m.push('Receipt');
  return m;
};

const TH: React.CSSProperties = { padding: '7px 8px', textAlign: 'left', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', textTransform: 'uppercase', borderBottom: '1px solid var(--border-subtle)', whiteSpace: 'nowrap' };
const TD: React.CSSProperties = { padding: '7px 8px', fontSize: 'var(--text-sm)', borderBottom: '1px solid var(--border-subtle)', verticalAlign: 'top' };
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

type Tier = { code: string; description: string } | null;
// One classification tier as a table cell: code (bold) + its description beneath.
function TierCell({ tier }: { tier: Tier }) {
  if (!tier) return <td style={{ ...TD, color: 'var(--text-tertiary)' }}>—</td>;
  return (
    <td style={TD}>
      <span style={{ fontFamily: 'monospace', fontWeight: 600, whiteSpace: 'nowrap' }}>{tier.code}</span>
      {tier.description && (
        <span style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={tier.description}>
          {tier.description}
        </span>
      )}
    </td>
  );
}

export default function CashBoxDetailPage() {
  return (
    <RouteGuard requiredPermission={{ category: 'expense', action: 'view' }}
                anyOfPermissions={[{ category: 'banking', action: 'view' }, { category: 'expense', action: 'approve' }]}
                redirectTo="/expenses">
      <CashBoxDetail />
    </RouteGuard>
  );
}

function CashBoxDetail() {
  const params = useParams<{ id: string }>();
  const boxId = String(params.id);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { isTenantAdmin, isPlatformAdmin, hasPermission } = useMyPermissions();
  const isAdmin = isTenantAdmin || isPlatformAdmin;
  const canSubmit = isAdmin || hasPermission('accounting.expense.update') || hasPermission('accounting.expense.create');
  const canReview = isAdmin || hasPermission('accounting.expense.approve');
  const rowEditable = (e: Expense) =>
    (((e.status === 'draft' || e.status === 'rejected') && canSubmit)
     || (e.status === 'submitted' && canReview));

  const invalidateVouchers = () => {
    queryClient.invalidateQueries({ queryKey: ['box-expenses', boxId] });
    queryClient.invalidateQueries({ queryKey: ['box-statement', boxId] });
  };
  const submitVoucherMut = useMutation({
    mutationFn: (id: string) => expensesApi.submit(id),
    onSuccess: () => { invalidateVouchers(); toast('Submitted for approval', 'success'); },
    onError: (err) => toast(getApiError(err, 'Submit failed'), 'error'),
  });
  const deleteVoucherMut = useMutation({
    mutationFn: (id: string) => expensesApi.remove(id),
    onSuccess: () => { invalidateVouchers(); toast('Deleted', 'success'); },
    onError: (err) => toast(getApiError(err, 'Delete failed'), 'error'),
  });
  const attachVoucherMut = useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => expensesApi.uploadAttachment(id, file),
    onSuccess: () => { invalidateVouchers(); toast('Receipt attached.', 'success'); },
    onError: (err) => toast(getApiError(err, 'Attach failed'), 'error'),
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachTargetId = useRef<string | null>(null);
  const startAttach = (id: string) => { attachTargetId.current = id; fileInputRef.current?.click(); };
  const handleVoucherDelete = async (id: string) => {
    if (await confirm('Delete this voucher? Approved/posted ones must be reversed in Accounting.')) {
      deleteVoucherMut.mutate(id);
    }
  };

  // Multi-select → submit many drafts at once.
  const toggleOne = (id: string) => setSelected(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });
  const bulkSubmitMut = useMutation({
    mutationFn: (ids: string[]) => Promise.allSettled(ids.map(id => expensesApi.submit(id))),
    onSuccess: (results) => {
      const failed = results.filter(r => r.status === 'rejected').length;
      const ok = results.length - failed;
      invalidateVouchers(); setSelected(new Set());
      if (failed) toast(`Submitted ${ok}. ${failed} skipped — only drafts can be submitted.`, ok ? 'warning' : 'error');
      else toast(`Submitted ${ok} voucher${ok === 1 ? '' : 's'} for approval.`, 'success');
    },
    onError: () => toast('Submit failed.', 'error'),
  });
  const handleBulkSubmit = async () => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    if (await confirm(`Submit ${ids.length} selected voucher${ids.length === 1 ? '' : 's'} for approval? Non-draft ones are skipped.`)) {
      bulkSubmitMut.mutate(ids);
    }
  };

  const { data: stmt, isLoading } = useQuery({
    queryKey: ['box-statement', boxId],
    queryFn: () => expensesApi.getCashBoxStatement(boxId),
  });
  const { data: expData, isLoading: expLoading } = useQuery({
    queryKey: ['box-expenses', boxId, page, search, statusFilter],
    queryFn: () => expensesApi.getAll({
      // Order by ENTRY sequence (the voucher number) ascending — the FIRST
      // voucher entered sits at the top, reading down in the order they were
      // recorded (the original sheet order), not by the voucher date.
      cash_box: boxId, page, ordering: 'number', ...(search ? { search } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
    }),
  });

  const vouchers: Expense[] = expData?.results ?? [];
  const voucherCount = expData?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(voucherCount / 25));
  const pageIds = vouchers.map(v => String(v.id));
  const allSelected = pageIds.length > 0 && pageIds.every(id => selected.has(id));
  const toggleAll = () => setSelected(prev => {
    const n = new Set(prev);
    if (allSelected) pageIds.forEach(id => n.delete(id));
    else pageIds.forEach(id => n.add(id));
    return n;
  });

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
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {canSubmit && selected.size > 0 && (
                <>
                  <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{selected.size} selected</span>
                  <Button variant="primary" size="sm" isLoading={bulkSubmitMut.isPending} onClick={handleBulkSubmit}>
                    Submit selected
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>Clear</Button>
                </>
              )}
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
                      {canSubmit && <th style={{ ...TH, width: 32 }}><input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all" /></th>}
                      <th style={TH}>Date</th><th style={TH}>Number</th>
                      <th style={TH}>Cost Type</th><th style={TH}>Project</th>
                      <th style={TH}>Main Category</th><th style={TH}>Sub Category</th><th style={TH}>Cost Code</th>
                      <th style={TH}>Paid To</th><th style={{ ...TH, textAlign: 'right' }}>Amount</th>
                      <th style={TH}>Description</th><th style={TH}>Status</th><th style={TH}></th>
                    </tr></thead>
                    <tbody>
                      {vouchers.map(e => {
                        const miss = missingInfo(e);
                        const path = e.cost_code_path ?? [];
                        const main: Tier = path.length >= 2 ? path[0] : null;
                        const sub: Tier = path.length === 3 ? path[1] : null;
                        const leaf: Tier = path.length ? path[path.length - 1]
                          : (e.cost_code_code ? { code: e.cost_code_code, description: e.cost_code_desc || '' } : null);
                        return (
                        <tr key={e.id} onClick={() => router.push(`/expenses/${e.id}`)} style={{ cursor: 'pointer' }}>
                          {canSubmit && (
                            <td style={{ ...TD, width: 32 }} onClick={ev => ev.stopPropagation()}>
                              <input type="checkbox" checked={selected.has(String(e.id))} onChange={() => toggleOne(String(e.id))} aria-label="Select voucher" />
                            </td>
                          )}
                          <td style={{ ...TD, whiteSpace: 'nowrap' }}>{fmtDate(e.expense_date)}</td>
                          <td style={{ ...TD, fontFamily: 'monospace', fontWeight: 600, color: 'var(--brand)', whiteSpace: 'nowrap' }} title={e.voucher_number ? `Serial: ${e.voucher_number}` : undefined}>{e.number || '—'}</td>
                          <td style={TD}>
                            {e.cost_type_label
                              ? <Badge variant="default" size="sm">{e.cost_type_label}</Badge>
                              : <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
                          </td>
                          <td style={{ ...TD, maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={(e as any).project_name || ''}>{(e as any).project_code || (e as any).project_name || '—'}</td>
                          <TierCell tier={main} />
                          <TierCell tier={sub} />
                          <TierCell tier={leaf} />
                          <td style={{ ...TD, maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(e as any).supplier_name || e.payee_name || e.payee_worker_name || '—'}</td>
                          <td style={{ ...NUM, fontWeight: 700 }}>{formatPrice(Number(e.amount))}</td>
                          <td style={{ ...TD, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={e.description}>{e.description || '—'}</td>
                          <td style={TD}>
                            <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                              <Badge variant={STATUS_VARIANT[e.status] ?? 'default'}>{STATUS_LABEL[e.status] ?? e.status}</Badge>
                              {miss.length > 0 && (
                                <span title={`Missing: ${miss.join(', ')}`} style={{ display: 'inline-flex' }}>
                                  <Badge variant="warning" size="sm">Incomplete</Badge>
                                </span>
                              )}
                            </span>
                          </td>
                          <td style={{ ...TD, textAlign: 'right' }} onClick={ev => ev.stopPropagation()}>
                            <RowActions actions={[
                              { label: 'Open', href: `/expenses/${e.id}` },
                              { label: 'Submit for approval',
                                hidden: !((e.status === 'draft' || e.status === 'rejected') && canSubmit),
                                onClick: () => submitVoucherMut.mutate(String(e.id)) },
                              { label: 'Attach receipt', hidden: !rowEditable(e), onClick: () => startAttach(String(e.id)) },
                              { label: e.status === 'submitted' ? 'Correct' : 'Edit',
                                href: `/expenses/${e.id}/edit`, hidden: !rowEditable(e) },
                              { separator: true },
                              { label: 'Delete', variant: 'danger',
                                hidden: !(['draft', 'rejected', 'submitted'].includes(e.status) && canSubmit),
                                onClick: () => handleVoucherDelete(String(e.id)) },
                            ]} />
                          </td>
                        </tr>
                      ); })}
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

        <input ref={fileInputRef} type="file" hidden onChange={ev => {
          const f = ev.target.files?.[0];
          const id = attachTargetId.current;
          if (f && id) {
            if (f.size > 20 * 1024 * 1024) toast('Max file size is 20 MB.', 'error');
            else attachVoucherMut.mutate({ id, file: f });
          }
          ev.target.value = '';
        }} />
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
