'use client';

import RouteGuard from '@/components/auth/RouteGuard';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { expensesApi, type Expense, type ExpenseStatus, type CashBox } from '@/lib/api/expenses';
import { Button, Badge, PageShell, PageHeader, type Column } from '@/components/ui';
import MainLayout from '@/components/layout/MainLayout';
import { RowActions } from '@/components/ui/RowActions';
import { toast, confirm } from '@/lib/hooks/use-toast';
import { getApiError } from '@/lib/utils/error';
import { type FilterField } from '@/components/ui/FilterPanel';
import { useTableState } from '@/lib/hooks/use-table-state';
import { AppListPage } from '@/components/app/AppListPage';
import { useAuth } from '@/lib/hooks/use-auth';
import { useMyPermissions } from '@/lib/hooks/use-my-permissions';
import { formatPrice } from '@/lib/utils/format';

const STATUS_LABEL: Record<ExpenseStatus, string> = {
  draft: 'Draft', submitted: 'Submitted', accounting_approved: 'Accounting Approved',
  approved: 'Approved', posted: 'Posted', rejected: 'Rejected', cancelled: 'Cancelled',
};
const STATUS_VARIANT: Record<ExpenseStatus, 'default' | 'warning' | 'info' | 'success' | 'error'> = {
  draft: 'default', submitted: 'warning', accounting_approved: 'info',
  approved: 'success', posted: 'success', rejected: 'error', cancelled: 'default',
};
const filterFields: FilterField[] = [
  { name: 'vat_liable', label: 'VAT Liable', type: 'select', group: 'Expense',
    options: [{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }] },
];

const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

// What's missing for a complete record: who was paid, and the receipt scan.
const missingInfo = (e: Expense): string[] => {
  const m: string[] = [];
  if (!e.supplier && !e.payee_worker && !e.vehicle && !(e.payee_name || '').trim()) m.push('Payee');
  if (!e.attachments || e.attachments.length === 0) m.push('Receipt');
  return m;
};

// ── Box hub: one card per cash box with balance + review/incomplete counts ────
function BoxHub({ boxes, loading, onOpen }: {
  boxes: CashBox[]; loading: boolean; onOpen: (id: string) => void;
}) {
  if (loading) {
    return <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>Loading boxes…</div>;
  }
  if (boxes.length === 0) {
    return (
      <div style={{ padding: '60px 24px', textAlign: 'center', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 16 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🗄️</div>
        <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>No cash boxes yet</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>Create a petty-cash box to start recording vouchers.</div>
      </div>
    );
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-4)' }}>
      {boxes.map(b => {
        const bal = Number(b.balance ?? 0);
        return (
          <div key={b.id} className="card" onClick={() => onOpen(b.id)}
            style={{ padding: '18px 20px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 'var(--text-md)', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.name}</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{b.custodian_name || 'No custodian'}</div>
              </div>
              <Badge variant={b.kind === 'petty_cash' ? 'default' : 'info'} size="sm">
                {b.kind === 'petty_cash' ? 'Petty Cash' : 'Bank'}
              </Badge>
            </div>

            <div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Balance</div>
              <div style={{ fontSize: 'var(--text-xl)', fontWeight: 800, fontFamily: 'monospace', color: bal < 0 ? 'var(--status-error)' : 'var(--text-primary)' }}>
                {formatPrice(bal)}
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 2 }}>
                In {formatPrice(Number(b.cash_in ?? 0))} · Spent {formatPrice(Number(b.spent ?? 0))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', borderTop: '1px solid var(--border-subtle)', paddingTop: 10 }}>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                {b.voucher_count ?? 0} voucher{(b.voucher_count ?? 0) === 1 ? '' : 's'}
              </span>
              {!!b.to_review && <Badge variant="info" size="sm">{b.to_review} to review</Badge>}
              {!!b.incomplete && (
                <span title="Vouchers missing a payee or a receipt">
                  <Badge variant="warning" size="sm">{b.incomplete} incomplete</Badge>
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ExpensesPageInner() {
  const router = useRouter();
  const tableState = useTableState();
  const { page, search, filters } = tableState;
  const queryClient = useQueryClient();
  const [view, setView] = useState<'boxes' | 'all'>('boxes');

  const { user } = useAuth();
  const { isTenantAdmin, isPlatformAdmin, hasPermission, isLoading: permsLoading } = useMyPermissions();
  const isAdmin = isTenantAdmin || isPlatformAdmin;
  const seesAll = isAdmin
    || hasPermission('accounting.banking.view') || hasPermission('accounting.expense.approve');
  const canSubmit = isAdmin
    || hasPermission('accounting.expense.update') || hasPermission('accounting.expense.create');
  const canReview = isAdmin || hasPermission('accounting.expense.approve');
  // A row is editable/attachable when it is a draft/rejected the user can edit,
  // or a submitted voucher the user can review (mirrors the backend gate).
  const rowEditable = (e: Expense) =>
    (((e.status === 'draft' || e.status === 'rejected') && canSubmit)
     || (e.status === 'submitted' && canReview));

  // Custodians land straight on their own box; reviewers/admins get the hub.
  const { data: myBoxes } = useQuery({
    queryKey: ['exp-cash-boxes'],
    queryFn: () => expensesApi.listCashBoxes(),
    enabled: !permsLoading && !seesAll, staleTime: 300_000,
  });
  const myBox = (!permsLoading && !seesAll)
    ? myBoxes?.find(b => b.kind === 'petty_cash' && b.custodian === user?.id)
    : undefined;
  useEffect(() => {
    if (myBox) router.replace(`/expenses/cash-boxes/${myBox.id}`);
  }, [myBox, router]);

  // Box hub data (with per-box counts) — only for users who see all boxes.
  const { data: hubBoxes = [], isLoading: hubLoading } = useQuery({
    queryKey: ['exp-cash-boxes', 'hub'],
    queryFn: () => expensesApi.listCashBoxes({ withStats: true }),
    enabled: !permsLoading && seesAll && !myBox, staleTime: 60_000,
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['expenses', page, search, filters],
    queryFn: () => expensesApi.getAll({ page, search, ...filters }),
    staleTime: 2 * 60 * 1000,
    enabled: !myBox,
  });

  const deleteMut = useMutation({
    mutationFn: (ids: Array<string | number>) =>
      Promise.allSettled(ids.map(id => expensesApi.remove(String(id)))),
    onSuccess: (results) => {
      const failed = results.filter(r => r.status === 'rejected').length;
      const ok = results.length - failed;
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      tableState.clearSelection();
      if (failed) toast(`Deleted ${ok}. ${failed} skipped — approved/posted vouchers must be reversed in Accounting.`, ok ? 'warning' : 'error');
      else toast(`Deleted ${ok} expense${ok === 1 ? '' : 's'}.`, 'success');
    },
    onError: () => toast('Delete failed.', 'error'),
  });
  const handleBulkDelete = async () => {
    const ids = Array.from(tableState.selectedItems);
    if (!ids.length) return;
    if (await confirm(`Delete ${ids.length} selected expense${ids.length === 1 ? '' : 's'}? Approved/posted ones are skipped.`)) {
      deleteMut.mutate(ids);
    }
  };

  // Submit many drafts for approval at once — no need to open each voucher.
  const submitMut = useMutation({
    mutationFn: (ids: Array<string | number>) =>
      Promise.allSettled(ids.map(id => expensesApi.submit(String(id)))),
    onSuccess: (results) => {
      const failed = results.filter(r => r.status === 'rejected').length;
      const ok = results.length - failed;
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      tableState.clearSelection();
      if (failed) toast(`Submitted ${ok}. ${failed} skipped — only drafts can be submitted (check the approval chain is configured).`, ok ? 'warning' : 'error');
      else toast(`Submitted ${ok} voucher${ok === 1 ? '' : 's'} for approval.`, 'success');
    },
    onError: () => toast('Submit failed.', 'error'),
  });
  const handleBulkSubmit = async () => {
    const ids = Array.from(tableState.selectedItems);
    if (!ids.length) return;
    if (await confirm(`Submit ${ids.length} selected voucher${ids.length === 1 ? '' : 's'} for approval? Non-draft ones are skipped.`)) {
      submitMut.mutate(ids);
    }
  };

  // Per-row attach: one shared hidden file input, retargeted to the row's id.
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachTargetId = useRef<string | null>(null);
  const attachMut = useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => expensesApi.uploadAttachment(id, file),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['expenses'] }); toast('Receipt attached.', 'success'); },
    onError: (err) => toast(getApiError(err, 'Attach failed'), 'error'),
  });
  const startAttach = (id: string) => { attachTargetId.current = id; fileInputRef.current?.click(); };
  const handleRowDelete = async (id: string) => {
    if (await confirm('Delete this voucher? Approved/posted ones must be reversed in Accounting.')) {
      deleteMut.mutate([id]);
    }
  };

  const rows = data?.results ?? [];
  const totalCount = data?.count ?? 0;
  const pageTotal = rows.reduce((s, e) => s + Number(e.amount || 0), 0);

  if (myBox) return null;   // redirecting to the custodian's box — no flash

  const effectiveView = seesAll ? view : 'all';
  const toggle = seesAll ? (
    <div style={{ display: 'inline-flex', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
      {(['boxes', 'all'] as const).map(v => (
        <button key={v} type="button" onClick={() => setView(v)}
          style={{
            padding: '6px 14px', fontSize: 'var(--text-sm)', fontWeight: 600, cursor: 'pointer', border: 'none',
            background: effectiveView === v ? 'var(--brand)' : 'transparent',
            color: effectiveView === v ? '#fff' : 'var(--text-secondary)',
          }}>
          {v === 'boxes' ? 'By Box' : 'All Vouchers'}
        </button>
      ))}
    </div>
  ) : null;

  if (effectiveView === 'boxes') {
    return (
      <MainLayout>
        <PageShell>
          <PageHeader
            title="Petty Cash & Expenses"
            description="Each cash box and its balance — open a box to review its vouchers."
            breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Accounting' }, { label: 'Petty Cash & Expenses' }]}
            actions={
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {toggle}
                {isAdmin && <Link href="/expenses/cash-boxes"><Button variant="secondary" size="sm">Manage boxes</Button></Link>}
                <Link href="/expenses/new"><Button variant="primary">+ New Expense</Button></Link>
              </div>
            }
          />
          <BoxHub boxes={hubBoxes} loading={hubLoading} onOpen={id => router.push(`/expenses/cash-boxes/${id}`)} />
        </PageShell>
      </MainLayout>
    );
  }

  const columns: Column<Expense>[] = [
    { key: 'voucher', header: 'Voucher', sortKey: 'number',
      render: e => <span className="font-mono font-medium">{e.voucher_number || e.number}</span> },
    { key: 'date', header: 'Date', sortKey: 'expense_date',
      render: e => <span style={{ color: 'var(--text-secondary)' }}>{fmtDate(e.expense_date)}</span> },
    { key: 'box', header: 'Cash Box',
      render: e => <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>{e.cash_box_name || '—'}</span> },
    { key: 'supplier', header: 'Supplier / Payee',
      render: e => <span>{e.supplier_name || e.payee_name || e.payee_worker_name || '—'}</span> },
    { key: 'code', header: 'Cost Code',
      render: e => e.cost_code_code
        ? <span style={{ fontFamily: 'monospace', fontSize: 'var(--text-sm)' }}
            title={e.cost_code_path?.length ? e.cost_code_path.map(p => `${p.code} — ${p.description}`).join(' › ') : (e.cost_code_desc || '')}>
            {e.cost_code_code}
          </span>
        : <span style={{ color: 'var(--text-tertiary)' }}>—</span> },
    { key: 'project', header: 'Project',
      render: e => <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>{e.project_name || '—'}</span> },
    { key: 'amount', header: 'Amount', sortKey: 'amount',
      render: e => <span className="font-semibold">{formatPrice(Number(e.amount || 0))}</span> },
    { key: 'status', header: 'Status',
      render: e => {
        const miss = missingInfo(e);
        return (
          <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 5, alignItems: 'flex-start' }}>
            <Badge variant={STATUS_VARIANT[e.status] ?? 'default'}>{STATUS_LABEL[e.status] ?? e.status}</Badge>
            {miss.length > 0 && (
              <span title={`Missing: ${miss.join(', ')}`} style={{ display: 'inline-flex' }}>
                <Badge variant="warning" size="sm">Incomplete</Badge>
              </span>
            )}
          </span>
        );
      } },
    { key: 'actions', header: '',
      render: e => (
        <span onClick={ev => ev.stopPropagation()} style={{ display: 'inline-flex', justifyContent: 'flex-end', width: '100%' }}>
          <RowActions actions={[
            { label: 'Open', href: `/expenses/${e.id}` },
            { label: 'Submit for approval',
              hidden: !((e.status === 'draft' || e.status === 'rejected') && canSubmit),
              onClick: () => submitMut.mutate([e.id]) },
            { label: 'Attach receipt', hidden: !rowEditable(e), onClick: () => startAttach(String(e.id)) },
            { label: e.status === 'submitted' ? 'Correct' : 'Edit',
              href: `/expenses/${e.id}/edit`, hidden: !rowEditable(e) },
            { separator: true },
            { label: 'Delete', variant: 'danger',
              hidden: !(['draft', 'rejected', 'submitted'].includes(e.status) && canSubmit),
              onClick: () => handleRowDelete(String(e.id)) },
          ]} />
        </span>
      ) },
  ];

  return (
    <>
    <AppListPage
      title="Petty Cash & Expenses"
      description="Cash expense vouchers — coded to projects and cost codes, posted to the ledger on approval."
      breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Accounting' }, { label: 'Petty Cash & Expenses' }]}
      totalCount={totalCount}
      totalAmount={pageTotal}
      totalAmountLabel="Page Total"
      headerExtra={
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {toggle}
          {isAdmin && <Link href="/expenses/cash-boxes"><Button variant="secondary" size="sm">Manage boxes</Button></Link>}
        </div>
      }
      createAction={<Link href="/expenses/new"><Button variant="primary">+ New Expense</Button></Link>}
      statusItems={[
        { value: '',          label: 'All', count: totalCount },
        { value: 'draft',     label: 'Draft' },
        { value: 'submitted', label: 'Submitted' },
        { value: 'approved',  label: 'Approved' },
        { value: 'posted',    label: 'Posted' },
        { value: 'rejected',  label: 'Rejected' },
      ]}
      filterFields={filterFields}
      searchPlaceholder="Search by voucher, invoice, payee…"
      selectable
      bulkActions={
        <>
          {canSubmit && (
            <Button variant="primary" size="sm" isLoading={submitMut.isPending} onClick={handleBulkSubmit}>
              Submit selected
            </Button>
          )}
          <Button variant="destructive" size="sm" isLoading={deleteMut.isPending} onClick={handleBulkDelete}>
            Delete selected
          </Button>
        </>
      }
      columns={columns}
      data={rows}
      isLoading={isLoading}
      error={error}
      onRowClick={e => router.push(`/expenses/${e.id}`)}
      tableState={tableState}
      paginatedData={data}
      pageSize={50}
      emptyTitle="No expenses yet"
      emptyAction={<Link href="/expenses/new"><Button variant="primary">+ New Expense</Button></Link>}
    />
    <input ref={fileInputRef} type="file" hidden onChange={e => {
      const f = e.target.files?.[0];
      const id = attachTargetId.current;
      if (f && id) {
        if (f.size > 20 * 1024 * 1024) toast('Max file size is 20 MB.', 'error');
        else attachMut.mutate({ id, file: f });
      }
      e.target.value = '';
    }} />
    </>
  );
}


export default function ExpensesPage() {
  return (
    <RouteGuard requiredPermission={{ category: 'expense', action: 'view' }}
                redirectTo="/">
      <ExpensesPageInner />
    </RouteGuard>
  );
}
