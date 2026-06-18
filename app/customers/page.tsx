'use client';

import { useMemo, useCallback } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customersApi, Customer } from '@/lib/api/customers';
import Link from 'next/link';
import { toast } from '@/lib/hooks/use-toast';
import { confirm } from '@/lib/hooks/use-toast';
import { useMyPermissions } from '@/lib/hooks/use-my-permissions';
import { usePermissions } from '@/lib/hooks/use-permissions';
import { useT } from '@/lib/i18n/useT';
import { Button, Badge, PageHeader, PageShell, TableShell, type Column } from '@/components/ui';
import { type FilterField } from '@/components/ui/FilterPanel';
import { useTableState } from '@/lib/hooks/use-table-state';
import { CUSTOMER_TYPE } from '@/lib/utils/status-colors';

const TYPE_LABEL: Record<string, string> = {
  owner: 'Owner', commercial: 'Commercial', consultant: 'Consultant',
};

const filterFields: FilterField[] = [
  { name: 'customer_type', label: 'Type', type: 'select', group: 'Customer',
    options: [{ value: 'owner', label: 'Owner' }, { value: 'commercial', label: 'Commercial' }, { value: 'consultant', label: 'Consultant' }] },
  { name: 'status', label: 'Status', type: 'select', group: 'Customer',
    options: [{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }] },
  { name: 'delete_requested', label: 'Delete Requested', type: 'boolean', group: 'Customer' },
];

export default function CustomersPage() {
  const tableState = useTableState();
  const { page, search, filters } = tableState;

  const queryClient = useQueryClient();
  const { isTenantAdmin, isPlatformAdmin } = useMyPermissions();
  const { hasPermission } = usePermissions();
  const t           = useT();
  const isAdmin     = isTenantAdmin || isPlatformAdmin;
  const canCreate   = isAdmin || (hasPermission('customer', 'create') ?? false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['customers', page, search, filters],
    queryFn:  () => customersApi.getAll({ page, search: search || undefined, ...filters }),
  });

  const deleteMutation = useMutation({
    mutationFn: customersApi.delete,
    onSuccess:  () => { queryClient.invalidateQueries({ queryKey: ['customers'] }); toast('Customer deleted', 'success'); },
    onError:    () => toast('Failed to delete customer', 'error'),
  });

  const handleDelete = useCallback(async (id: number) => {
    if (await confirm('Delete this customer?')) deleteMutation.mutate(id);
  }, [deleteMutation.mutate]);

  const customers  = Array.isArray(data?.results) ? data!.results : [];
  const totalCount = data?.count ?? 0;

  const columns = useMemo((): Column<Customer>[] => [
    {
      key: 'code', header: t('col', 'code'), width: 110,
      render: c => <span style={{ fontSize: 'var(--text-xs)', fontFamily: 'monospace', color: 'var(--text-tertiary)' }}>{c.code || '—'}</span>,
    },
    {
      key: 'name', header: t('col', 'name'),
      render: c => (
        <div>
          <div className="font-medium" style={{ color: 'var(--text-primary)' }}>{c.full_name_english}</div>
          {c.full_name_arabic && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{c.full_name_arabic}</div>}
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
          {isAdmin && (
            <Button variant="delete" size="sm" onClick={() => handleDelete(c.id)} disabled={deleteMutation.isPending}>
              {t('btn', 'delete')}
            </Button>
          )}
        </div>
      ),
    },
  ], [t, isAdmin, handleDelete, deleteMutation.isPending]);

  return (
    <MainLayout>
      <PageShell>
        <PageHeader
          title={t('nav', 'customers')}
          count={totalCount}
          breadcrumbs={[{ label: 'Customers' }]}
          actions={canCreate ? <Link href="/customers/new"><Button variant="primary">{t('btn', 'addCustomer')}</Button></Link> : undefined}
        />
        <TableShell
          tableState={tableState}
          filterFields={filterFields}
          filterSaveKey="customers"
          searchPlaceholder="Search by name, email, phone..."
          columns={columns}
          data={customers}
          isLoading={isLoading}
          error={error}
          onRetry={refetch}
          emptyMessage="No customers found."
          emptyAction={canCreate ? <Link href="/customers/new"><Button variant="primary">{t('btn', 'addCustomer')}</Button></Link> : undefined}
          selectable={isAdmin}
          totalCount={totalCount}
          paginatedData={data}
          rowStyle={c => c.delete_requested ? { opacity: 0.6 } : undefined}
        />
      </PageShell>
    </MainLayout>
  );
}
