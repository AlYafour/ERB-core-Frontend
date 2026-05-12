'use client';

import { useRef } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { suppliersApi } from '@/lib/api/suppliers';
import { Supplier } from '@/types';
import Link from 'next/link';
import { toast } from '@/lib/hooks/use-toast';
import { confirm } from '@/lib/hooks/use-toast';
import { useAuth } from '@/lib/hooks/use-auth';
import FilterPanel, { FilterField } from '@/components/ui/FilterPanel';
import FilterTags from '@/components/ui/FilterTags';
import { Button, Badge, PageHeader, PageToolbar, SearchInput } from '@/components/ui';
import { exportToExcel, fetchAllPages } from '@/lib/utils/export-excel';
import BilingualName from '@/components/ui/BilingualName';
import { useT } from '@/lib/i18n/useT';
import DataTable, { Column } from '@/components/ui/DataTable';
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
  const {
    page, setPage, search, filters, selectedItems,
    handleSearch, handleFilterChange, handleFilterReset, handleRemoveFilter,
    toggleSelect, selectPage, clearSelection, isAllPageSelected, isSomePageSelected,
  } = useTableState();

  const importFileRef = useRef<HTMLInputElement>(null);
  const queryClient   = useQueryClient();
  const { user }      = useAuth();
  const t             = useT();
  const isSuperuser   = user?.is_superuser ?? false;
  const isAdmin       = isSuperuser || user?.role === 'super_admin' || user?.is_staff;

  const { data, isLoading, error } = useQuery({
    queryKey: ['suppliers', page, search, filters],
    queryFn:  () => suppliersApi.getAll({ page, search, ...filters }),
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

  const handleDelete = async (id: number) => {
    if (await confirm('Delete this supplier?')) deleteMutation.mutate(id);
  };

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
      exportToExcel<Supplier>(
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

  const suppliers   = data?.results ?? [];
  const totalCount  = data?.count ?? 0;
  const currentIds  = suppliers.map((s: Supplier) => s.id);

  const columns: Column<Supplier>[] = [
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
      key: 'actions', header: t('col', 'actions'),
      render: s => (
        <div className="flex items-center gap-2">
          <Link href={`/suppliers/view/${s.id}`}><Button variant="view" size="sm">{t('btn', 'view')}</Button></Link>
          <Link href={`/suppliers/${s.id}`}><Button variant="edit" size="sm">{t('btn', 'edit')}</Button></Link>
          {isSuperuser && (
            <Button variant="delete" size="sm" onClick={() => handleDelete(s.id)} disabled={deleteMutation.isPending}>
              {t('btn', 'delete')}
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          title={t('page', 'suppliers')}
          count={totalCount}
          breadcrumbs={[{ label: 'Suppliers' }]}
          actions={
            <div className="flex items-center gap-2">
              {isAdmin && selectedItems.size > 0 && (
                <Button variant="destructive" onClick={handleBulkDelete} isLoading={bulkDeleteMutation.isPending}>
                  {t('btn', 'delete')} {selectedItems.size}
                </Button>
              )}
              <Button variant="secondary" onClick={handleExport}>⬇ {t('btn', 'export')}</Button>
              {isAdmin && (
                <>
                  <input ref={importFileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} />
                  <Button variant="secondary" onClick={() => importFileRef.current?.click()}>⬆ {t('btn', 'import')}</Button>
                </>
              )}
              <Link href="/suppliers/new"><Button variant="primary">{t('btn', 'addSupplier')}</Button></Link>
            </div>
          }
        />

        <PageToolbar
          search={<SearchInput value={search} onChange={handleSearch} placeholder={t('misc', 'searchSuppliers')} />}
          filters={<FilterPanel fields={filterFields} filters={filters} onFilterChange={handleFilterChange} onReset={handleFilterReset} saveKey="suppliers" />}
          filterTags={<FilterTags filters={filters} fields={filterFields} onRemoveFilter={handleRemoveFilter} onClearAll={handleFilterReset} />}
        />

        <DataTable
          columns={columns}
          data={suppliers}
          isLoading={isLoading}
          error={error}
          emptyMessage={t('empty', 'noSuppliers')}
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
      </div>
    </MainLayout>
  );
}
