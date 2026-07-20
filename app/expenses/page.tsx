'use client';

import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { expensesApi, type Expense, type ExpenseStatus } from '@/lib/api/expenses';
import { Button, Badge, type Column } from '@/components/ui';
import { type FilterField } from '@/components/ui/FilterPanel';
import { useTableState } from '@/lib/hooks/use-table-state';
import { AppListPage } from '@/components/app/AppListPage';
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

const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

export default function ExpensesPage() {
  const router = useRouter();
  const tableState = useTableState();
  const { page, search, filters } = tableState;

  const { data, isLoading, error } = useQuery({
    queryKey: ['expenses', page, search, filters],
    queryFn: () => expensesApi.getAll({ page, search, ...filters }),
    staleTime: 2 * 60 * 1000,
  });

  const rows = data?.results ?? [];
  const totalCount = data?.count ?? 0;
  const pageTotal = rows.reduce((s, e) => s + Number(e.amount || 0), 0);

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
        ? <span style={{ fontFamily: 'monospace', fontSize: 'var(--text-sm)' }} title={e.cost_code_desc || ''}>{e.cost_code_code}</span>
        : <span style={{ color: 'var(--text-tertiary)' }}>—</span> },
    { key: 'project', header: 'Project',
      render: e => <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>{e.project_name || '—'}</span> },
    { key: 'amount', header: 'Amount', sortKey: 'amount',
      render: e => <span className="font-semibold">{formatPrice(Number(e.amount || 0))}</span> },
    { key: 'vat', header: 'VAT',
      render: e => e.vat_liable ? <span style={{ fontFamily: 'monospace' }}>{formatPrice(Number(e.vat_amount || 0))}</span> : <span style={{ color: 'var(--text-tertiary)' }}>—</span> },
    { key: 'status', header: 'Status',
      render: e => <Badge variant={STATUS_VARIANT[e.status] ?? 'default'}>{STATUS_LABEL[e.status] ?? e.status}</Badge> },
  ];

  return (
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
  );
}
