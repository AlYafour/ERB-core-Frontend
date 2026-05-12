'use client';

import MainLayout from '@/components/layout/MainLayout';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customersApi, Customer } from '@/lib/api/customers';
import Link from 'next/link';
import { toast } from '@/lib/hooks/use-toast';
import { confirm } from '@/lib/hooks/use-toast';
import { useAuth } from '@/lib/hooks/use-auth';
import { useT } from '@/lib/i18n/useT';
import { Button, Badge, PageHeader, SearchInput, PageShell, WorkspaceSurface } from '@/components/ui';
import FilterPanel, { FilterField } from '@/components/ui/FilterPanel';
import FilterTags from '@/components/ui/FilterTags';
import DataTable, { Column } from '@/components/ui/DataTable';
import { useTableState } from '@/lib/hooks/use-table-state';
import { CUSTOMER_TYPE } from '@/lib/utils/status-colors';

const TYPE_LABEL: Record<string, string> = {
  owner:      'Owner / مالك',
  commercial: 'Commercial / تجاري',
  consultant: 'Consultant / استشاري',
};

const filterFields: FilterField[] = [
  { name: 'customer_type', label: 'Type', type: 'select', group: 'Customer',
    options: [
      { value: 'owner',      label: 'Owner / مالك' },
      { value: 'commercial', label: 'Commercial / تجاري' },
      { value: 'consultant', label: 'Consultant / استشاري' },
    ],
  },
  { name: 'status',           label: 'Status',          type: 'select', group: 'Customer',
    options: [{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }],
  },
  { name: 'delete_requested', label: 'Delete Requested', type: 'boolean', group: 'Customer' },
];

export default function CustomersPage() {
  const {
    page, setPage, search, filters, selectedItems,
    handleSearch, handleFilterChange, handleFilterReset, handleRemoveFilter,
    toggleSelect, selectPage, clearSelection, isAllPageSelected, isSomePageSelected,
  } = useTableState();

  const queryClient = useQueryClient();
  const { user }    = useAuth();
  const t           = useT();
  const isSuperuser = user?.is_superuser ?? false;

  const { data, isLoading, error } = useQuery({
    queryKey: ['customers', page, search, filters],
    queryFn:  () => customersApi.getAll({ page, search: search || undefined, ...filters }),
  });

  const deleteMutation = useMutation({
    mutationFn: customersApi.delete,
    onSuccess:  () => { queryClient.invalidateQueries({ queryKey: ['customers'] }); toast('Customer deleted', 'success'); },
    onError:    () => toast('Failed to delete customer', 'error'),
  });

  const handleDelete = async (id: number) => {
    if (await confirm('Delete this customer?')) deleteMutation.mutate(id);
  };

  const customers  = data?.results ?? [];
  const totalCount = data?.count ?? 0;
  const currentIds = customers.map((c: Customer) => c.id);

  const columns: Column<Customer>[] = [
    {
      key: 'code', header: t('col', 'code'), width: 110,
      render: c => <span className="text-xs font-mono" style={{ color: 'var(--text-tertiary)' }}>{c.code || '—'}</span>,
    },
    {
      key: 'name', header: t('col', 'name'),
      render: c => (
        <div>
          <div className="font-medium" style={{ color: 'var(--text-primary)' }}>{c.full_name_english}</div>
          {c.full_name_arabic && <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{c.full_name_arabic}</div>}
        </div>
      ),
    },
    {
      key: 'type', header: 'Type',
      render: c => <Badge variant={CUSTOMER_TYPE[c.customer_type] ?? 'default'}>{TYPE_LABEL[c.customer_type] || c.customer_type}</Badge>,
    },
    { key: 'email', header: t('col', 'email'), render: c => <span style={{ color: 'var(--text-secondary)' }}>{c.email || '—'}</span> },
    { key: 'phone', header: t('col', 'phone'), render: c => <span style={{ color: 'var(--text-secondary)' }}>{c.telephone_number || c.whatsapp_number || '—'}</span> },
    {
      key: 'status', header: t('col', 'status'),
      render: c => c.delete_requested
        ? <Badge variant="error">Delete Requested</Badge>
        : <Badge variant="success">Active</Badge>,
    },
    {
      key: 'actions', header: t('col', 'actions'),
      render: c => (
        <div className="flex items-center gap-2">
          <Link href={`/customers/${c.id}`}><Button variant="view" size="sm">{t('btn', 'view')}</Button></Link>
          {isSuperuser && (
            <Button variant="delete" size="sm" onClick={() => handleDelete(c.id)} disabled={deleteMutation.isPending}>
              {t('btn', 'delete')}
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <MainLayout>
      <PageShell>
        <PageHeader
          title={t('nav', 'customers')}
          count={totalCount}
          breadcrumbs={[{ label: 'Customers' }]}
          actions={<Link href="/customers/new"><Button variant="primary">{t('btn', 'addCustomer')}</Button></Link>}
        />

        <WorkspaceSurface
          toolbar={
            <>
              <SearchInput value={search} onChange={handleSearch} placeholder="Search by name, email, phone..." />
              <div style={{ flex: 1 }} />
              <FilterPanel fields={filterFields} filters={filters} onFilterChange={handleFilterChange} onReset={handleFilterReset} saveKey="customers" />
            </>
          }
          filterTags={
            Object.keys(filters).length > 0
              ? <FilterTags filters={filters} fields={filterFields} onRemoveFilter={handleRemoveFilter} onClearAll={handleFilterReset} />
              : undefined
          }
        >
          <DataTable
            surface
            columns={columns}
            data={customers}
            isLoading={isLoading}
            error={error}
            emptyMessage="No customers found."
            emptyAction={<Link href="/customers/new"><Button variant="primary">{t('btn', 'addCustomer')}</Button></Link>}
            selectable={isSuperuser}
            selectedItems={selectedItems}
            onToggleSelect={toggleSelect}
            onToggleSelectAll={() => isAllPageSelected(currentIds) ? clearSelection() : selectPage(currentIds)}
            isAllSelected={isAllPageSelected(currentIds)}
            isSomeSelected={isSomePageSelected(currentIds)}
            rowStyle={c => c.delete_requested ? { opacity: 0.6 } : undefined}
            page={page}
            totalCount={totalCount}
            pageSize={20}
            hasPrev={!!data?.previous}
            hasNext={!!data?.next}
            onPageChange={setPage}
          />
        </WorkspaceSurface>
      </PageShell>
    </MainLayout>
  );
}
