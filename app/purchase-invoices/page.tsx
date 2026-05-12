'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { purchaseInvoicesApi } from '@/lib/api/purchase-invoices';
import MainLayout from '@/components/layout/MainLayout';
import Link from 'next/link';
import { formatPrice } from '@/lib/utils/format';
import { toast } from '@/lib/hooks/use-toast';
import { confirm } from '@/lib/hooks/use-toast';
import { useAuth } from '@/lib/hooks/use-auth';
import { usePermissions } from '@/lib/hooks/use-permissions';
import FilterPanel, { FilterField } from '@/components/ui/FilterPanel';
import FilterTags from '@/components/ui/FilterTags';
import { Button, Badge } from '@/components/ui';
import { PurchaseInvoice } from '@/types';
import { useT } from '@/lib/i18n/useT';
import DataTable, { Column } from '@/components/ui/DataTable';
import { useTableState } from '@/lib/hooks/use-table-state';
import { INVOICE_STATUS } from '@/lib/utils/status-colors';
import PageHeader from '@/components/ui/PageHeader';
import PageToolbar from '@/components/ui/PageToolbar';
import { SearchInput } from '@/components/ui/SearchInput';

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft', pending: 'Pending Approval', approved: 'Approved',
  rejected: 'Rejected', paid: 'Paid', cancelled: 'Cancelled',
};

const filterFields: FilterField[] = [
  { name: 'invoice_number',       label: 'Invoice Number',    type: 'text',   group: 'Invoice Info' },
  { name: 'status',               label: 'Status',            type: 'select', group: 'Status',
    options: Object.entries(STATUS_LABEL).map(([v, l]) => ({ value: v, label: l })) },
  { name: 'invoice_date_after',   label: 'Invoice Date From', type: 'date',   group: 'Dates' },
  { name: 'invoice_date_before',  label: 'Invoice Date To',   type: 'date',   group: 'Dates' },
  { name: 'due_date_after',       label: 'Due Date From',     type: 'date',   group: 'Dates' },
  { name: 'due_date_before',      label: 'Due Date To',       type: 'date',   group: 'Dates' },
];

const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

export default function PurchaseInvoicesPage() {
  const {
    page, setPage, search, filters, selectedItems,
    handleSearch, handleFilterChange, handleFilterReset, handleRemoveFilter,
    toggleSelect, selectPage, clearSelection, isAllPageSelected, isSomePageSelected,
  } = useTableState();

  const queryClient = useQueryClient();
  const { user } = useAuth();
  const t = useT();
  const { hasPermission } = usePermissions();
  const isSuperuser = user?.is_superuser ?? false;
  const isAdmin   = user?.role === 'super_admin' || user?.is_staff;
  const canCreate = isSuperuser || (hasPermission('purchase_invoice', 'create') ?? false);
  const canView   = isSuperuser || (hasPermission('purchase_invoice', 'view') ?? false);
  const canDelete = isSuperuser;

  const { data, isLoading, error } = useQuery({
    queryKey: ['purchase-invoices', page, search, filters],
    queryFn: () => purchaseInvoicesApi.getAll({ page, search, ...filters }),
  });

  const deleteMutation = useMutation({
    mutationFn: purchaseInvoicesApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['pending-count'] });
      toast('Invoice deleted', 'success');
    },
    onError: () => toast('Failed to delete invoice', 'error'),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: number[]) => { await Promise.all(ids.map(id => purchaseInvoicesApi.delete(id))); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['pending-count'] });
      toast(`${selectedItems.size} invoice(s) deleted`, 'success');
      clearSelection();
    },
    onError: () => toast('Failed to delete some invoices', 'error'),
  });

  const handleDelete = async (id: number) => { if (await confirm('Delete this invoice?')) deleteMutation.mutate(id); };
  const handleBulkDelete = async () => {
    if (selectedItems.size && await confirm(`Delete ${selectedItems.size} invoice(s)?`)) bulkDeleteMutation.mutate(Array.from(selectedItems));
  };

  const invoices   = data?.results ?? [];
  const totalCount = data?.count ?? 0;
  const currentIds = invoices.map((i: PurchaseInvoice) => i.id);

  const columns: Column<PurchaseInvoice>[] = [
    { key: 'number',   header: t('col', 'invoiceNumber'), render: i => <span className="font-medium text-foreground">{i.invoice_number}</span> },
    {
      key: 'po', header: t('col', 'relatedPO'),
      render: i => <span className="text-foreground">{typeof i.purchase_order === 'object' ? (i.purchase_order as any)?.order_number : 'N/A'}</span>,
    },
    { key: 'date',    header: t('col', 'invoiceDate'),  render: i => <span className="text-muted-foreground">{fmtDate(i.invoice_date)}</span> },
    { key: 'due',     header: t('col', 'deliveryDate'), render: i => <span className="text-muted-foreground">{i.due_date ? fmtDate(i.due_date) : '—'}</span> },
    { key: 'status',  header: t('col', 'status'),       render: i => <Badge variant={INVOICE_STATUS[i.status] ?? 'info'}>{STATUS_LABEL[i.status] || i.status}</Badge> },
    { key: 'total',   header: t('col', 'total'),        render: i => <span className="font-semibold text-foreground">{formatPrice(Number(i.total || 0))}</span> },
    { key: 'paid',    header: t('misc', 'paidAmount'),  render: i => <span className="text-foreground">{formatPrice(Number(i.paid_amount || 0))}</span> },
    {
      key: 'actions', header: t('col', 'actions'),
      render: i => (
        <div className="flex items-center gap-2">
          {canView   && <Link href={`/purchase-invoices/${i.id}`}><Button variant="view" size="sm">{t('btn', 'view')}</Button></Link>}
          {canDelete && <Button variant="destructive" size="sm" onClick={() => handleDelete(i.id)} isLoading={deleteMutation.isPending}>{t('btn', 'delete')}</Button>}
        </div>
      ),
    },
  ];

  return (
    <MainLayout>
      <PageHeader
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Purchase Management', href: '#' }, { label: 'Purchase Invoices' }]}
        title="Purchase Invoices"
        description="Manage supplier invoices and payment tracking."
        count={totalCount}
        actions={
          <>
            {isAdmin && selectedItems.size > 0 && (
              <Button variant="destructive" onClick={handleBulkDelete} isLoading={bulkDeleteMutation.isPending}>
                Delete {selectedItems.size}
              </Button>
            )}
            {canCreate && <Link href="/purchase-invoices/new"><Button variant="primary">Create Invoice</Button></Link>}
          </>
        }
      />
      <PageToolbar
        search={<SearchInput value={search} onChange={handleSearch} placeholder="Search invoices…" width={260} />}
        filters={<FilterPanel fields={filterFields} filters={filters} onFilterChange={handleFilterChange} onReset={handleFilterReset} saveKey="purchase-invoices" />}
        filterTags={<FilterTags filters={filters} fields={filterFields} onRemoveFilter={handleRemoveFilter} onClearAll={handleFilterReset} />}
      />

      <DataTable
        columns={columns}
        data={invoices}
        isLoading={isLoading}
        error={error}
        emptyMessage={t('empty', 'noInvoices')}
        selectable={isAdmin}
        selectedItems={selectedItems}
        onToggleSelect={toggleSelect}
        onToggleSelectAll={() => isAllPageSelected(currentIds) ? clearSelection() : selectPage(currentIds)}
        isAllSelected={isAllPageSelected(currentIds)}
        isSomeSelected={isSomePageSelected(currentIds)}
        page={page}
        totalCount={totalCount}
        pageSize={50}
        hasPrev={!!data?.previous}
        hasNext={!!data?.next}
        onPageChange={setPage}
      />
    </MainLayout>
  );
}
