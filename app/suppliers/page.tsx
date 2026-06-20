'use client';

import { useMemo, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { suppliersApi } from '@/lib/api/suppliers';
import { Supplier } from '@/types';
import Link from 'next/link';
import { toast } from '@/lib/hooks/use-toast';
import { confirm } from '@/lib/hooks/use-toast';
import { useAuth } from '@/lib/hooks/use-auth';
import { useMyPermissions } from '@/lib/hooks/use-my-permissions';
import { usePermissions } from '@/lib/hooks/use-permissions';
import { type FilterField } from '@/components/ui/FilterPanel';
import { useRouter } from 'next/navigation';
import { Button, Badge, type Column } from '@/components/ui';
import { RowActions } from '@/components/ui/RowActions';
import { AppListPage } from '@/components/app/AppListPage';
import { exportToExcel, fetchAllPages } from '@/lib/utils/export-excel';
import BilingualName from '@/components/domain/BilingualName';
import { useT } from '@/lib/i18n/useT';
import { useTableState } from '@/lib/hooks/use-table-state';

const filterFields: FilterField[] = [
  { name: 'name',            label: 'Name',            type: 'text',   group: 'Supplier Info' },
  { name: 'business_name',   label: 'Business Name',   type: 'text',   group: 'Supplier Info' },
  { name: 'supplier_number', label: 'Supplier Number', type: 'text',   group: 'Supplier Info' },
  { name: 'contact_person',  label: 'Contact Person',  type: 'text',   group: 'Supplier Info' },
  { name: 'email',           label: 'Email',           type: 'text',   group: 'Contact' },
  { name: 'phone',           label: 'Phone',           type: 'text',   group: 'Contact' },
  { name: 'city',            label: 'City',            type: 'text',   group: 'Contact' },
  { name: 'country',         label: 'Country',         type: 'text',   group: 'Contact' },
  { name: 'currency',        label: 'Currency',        type: 'select', group: 'Settings',
    options: [{ value: 'AED', label: 'AED - UAE Dirham' }] },
  { name: 'is_active',       label: 'Is Active',       type: 'boolean', group: 'Settings' },
];

export default function SuppliersPage() {
  const router     = useRouter();
  const tableState = useTableState();
  const { page, search, filters, selectedItems, clearSelection } = tableState;

  const importFileRef = useRef<HTMLInputElement>(null);
  const queryClient   = useQueryClient();
  const { user }      = useAuth();
  const { isTenantAdmin, isPlatformAdmin } = useMyPermissions();
  const { hasPermission } = usePermissions();
  const t             = useT();
  const isAdmin       = isTenantAdmin || isPlatformAdmin;
  const canCreate     = isAdmin || (hasPermission('supplier', 'create') ?? false);
  const canEdit       = isAdmin || (hasPermission('supplier', 'update') ?? false);
  const canDelete     = isAdmin || (hasPermission('supplier', 'delete') ?? false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['suppliers', page, search, filters],
    queryFn:  () => suppliersApi.getAll({ page, search, ...filters }),
    staleTime: 2 * 60 * 1000,
  });

  const deleteMutation = useMutation({
    mutationFn: suppliersApi.delete,
    onSuccess:  () => { queryClient.invalidateQueries({ queryKey: ['suppliers'] }); toast('Supplier deleted', 'success'); },
    onError:    () => toast('Failed to delete supplier', 'error'),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: number[]) => { await Promise.all(ids.map(id => suppliersApi.delete(id))); },
    onSuccess:  () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast(`${selectedItems.size} suppliers deleted`, 'success');
      clearSelection();
    },
    onError: () => toast('Failed to delete some suppliers', 'error'),
  });

  const handleDelete = useCallback(async (id: number) => {
    if (await confirm('Delete this supplier?')) deleteMutation.mutate(id);
  }, [deleteMutation.mutate]);

  const handleBulkDelete = async () => {
    if (!selectedItems.size) return;
    if (await confirm(`Delete ${selectedItems.size} supplier(s)?`))
      bulkDeleteMutation.mutate(Array.from(selectedItems));
  };

  const handleExport = async () => {
    try {
      const all = await fetchAllPages<Supplier>(
        (p, ps) => suppliersApi.getAll({ page: p, page_size: ps, search, ...filters }),
      );
      await exportToExcel<Supplier>(
        all,
        [
          { header: 'Supplier Number', key: 'supplier_number', width: 18 },
          { header: 'Business Name',   key: 'business_name',   width: 40 },
          { header: 'Contact Person',  key: 'contact_person',  width: 25 },
          { header: 'Phone',           key: 'phone',           width: 18 },
          { header: 'Email',           key: 'email',           width: 30 },
          { header: 'Status',          key: 'status',          width: 12 },
          { header: 'Active',          key: (r) => r.is_active ? 'Yes' : 'No', width: 10 },
        ],
        `Suppliers_Export_${new Date().toISOString().slice(0, 10)}`,
        'Suppliers',
      );
      toast(`Exported ${all.length} suppliers`, 'success');
    } catch {
      toast('Export failed', 'error');
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    try {
      const result = await suppliersApi.importExcel(file);
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast(`Import done: ${result.created} created, ${result.updated} updated`, 'success');
    } catch {
      toast('Import failed', 'error');
    }
  };

  const suppliers  = Array.isArray(data?.results) ? data!.results : [];
  const totalCount = data?.count ?? 0;

  const columns = useMemo((): Column<Supplier>[] => [
    {
      key: 'name', header: t('col', 'name'),
      render: s => <BilingualName nameEn={s.business_name || s.name} nameAr={s.business_name_ar} />,
    },
    { key: 'email', header: t('col', 'email'), render: s => <span style={{ color: 'var(--text-secondary)' }}>{s.email || '—'}</span> },
    { key: 'phone', header: t('col', 'phone'), render: s => <span style={{ color: 'var(--text-secondary)' }}>{s.phone || '—'}</span> },
    {
      key: 'status', header: t('col', 'status'),
      render: s => <Badge variant={s.is_active ? 'success' : 'error'}>{s.is_active ? t('status', 'active') : t('status', 'inactive')}</Badge>,
    },
    {
      key: 'actions', header: '',
      render: s => (
        <RowActions actions={[
          { label: 'View',   href: `/suppliers/view/${s.id}` },
          { label: 'Edit',   href: `/suppliers/${s.id}`, hidden: !canEdit },
          { separator: true, hidden: !canDelete },
          { label: 'Delete', onClick: () => handleDelete(s.id), variant: 'danger', hidden: !canDelete },
        ]} />
      ),
    },
  ], [t, canEdit, canDelete, handleDelete]);

  return (
    <AppListPage
      title={t('page', 'suppliers')}
      description="Manage your supplier directory."
      breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Suppliers' }]}
      totalCount={totalCount}
      createAction={
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={handleExport}>⬇ {t('btn', 'export')}</Button>
          {isAdmin && (
            <>
              <input ref={importFileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} />
              <Button variant="secondary" onClick={() => importFileRef.current?.click()}>⬆ {t('btn', 'import')}</Button>
            </>
          )}
          {canCreate && <Link href="/suppliers/new"><Button variant="primary">{t('btn', 'addSupplier')}</Button></Link>}
        </div>
      }
      filterFields={filterFields}
      searchPlaceholder={t('misc', 'searchSuppliers')}
      onRowClick={s => router.push(`/suppliers/view/${s.id}`)}
      columns={columns}
      data={suppliers}
      isLoading={isLoading}
      error={error}
      emptyTitle={t('empty', 'noSuppliers')}
      selectable={isAdmin}
      tableState={tableState}
      paginatedData={data}
      pageSize={50}
      bulkActions={
        isAdmin && selectedItems.size > 0 ? (
          <Button variant="destructive" onClick={handleBulkDelete} isLoading={bulkDeleteMutation.isPending}>
            {t('btn', 'delete')} {selectedItems.size}
          </Button>
        ) : undefined
      }
    />
  );
}