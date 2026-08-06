'use client';

import RouteGuard from '@/components/auth/RouteGuard';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { expensesApi, type Expense, type ExpenseStatus } from '@/lib/api/expenses';
import { Button, Badge, type Column } from '@/components/ui';
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

function ExpensesPageInner() {
  const router = useRouter();
  const tableState = useTableState();
  const { page, search, filters } = tableState;
  const queryClient = useQueryClient();

  // Best-practice workspaces: a box custodian's whole world is HIS box page —
  // the company-wide voucher list belongs to admins / accounting / approvers.
  // Custodians landing here are sent straight to their box.
  const { user } = useAuth();
  const { isTenantAdmin, isPlatformAdmin, hasPermission, isLoading: permsLoading } = useMyPermissions();
  const seesAll = isTenantAdmin || isPlatformAdmin
    || hasPermission('accounting.banking.view') || hasPermission('accounting.expense.approve');
  const canSubmit = isTenantAdmin || isPlatformAdmin
    || hasPermission('accounting.expense.update') || hasPermission('accounting.expense.create');
  const canReview = isTenantAdmin || isPlatformAdmin || hasPermission('accounting.expense.approve');
  // A row is editable/attachable when it is a draft/rejected the user can edit,
  // or a submitted voucher the user can review (mirrors the backend gate).
  const rowEditable = (e: Expense) =>
    (((e.status === 'draft' || e.status === 'rejected') && canSubmit)
     || (e.status === 'submitted' && canReview));
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

  const columns: Column<Expense>[] = [
    { key: 'voucher', header: 'Voucher', sortKey: 'number',
      render: e => <span className="font-mono font-medium">{e.voucher_number || e.number}</span> },
    { key: 'date', header: 'Date', sortKey: 'expense_date',
      render: e => <span style={{ color: 'var(--text-secondary)' }}>{fmtDate(e.expense_date)}</span> },
    { key: 'supplier', header: 'Supplier / Payee',
      render: e => <span>{e.supplier_name || e.payee_name || '—'}</span> },
    { key: 'cost', header: 'Cost',
      render: e => e.cost_type_label ? <Badge variant="default">{e.cost_type_label}</Badge> : <span style={{ color: 'var(--text-tertiary)' }}>—</span> },
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
    { key: 'vat', header: 'VAT',
      render: e => e.vat_liable ? <span style={{ fontFamily: 'monospace' }}>{formatPrice(Number(e.vat_amount || 0))}</span> : <span style={{ color: 'var(--text-tertiary)' }}>—</span> },
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
      headerExtra={<Link href="/expenses/cash-boxes"><Button variant="secondary" size="sm">Cash Boxes</Button></Link>}
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
