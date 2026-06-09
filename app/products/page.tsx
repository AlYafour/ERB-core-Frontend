'use client';

import { fetchAllPages } from '@/lib/utils/export-excel';
import { useRef } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { productsApi } from '@/lib/api/products';
import { Product } from '@/types';
import Link from 'next/link';
import { toast } from '@/lib/hooks/use-toast';
import { confirm } from '@/lib/hooks/use-toast';
import { useAuth } from '@/lib/hooks/use-auth';
import { usePermissions } from '@/lib/hooks/use-permissions';
import { type FilterField } from '@/components/ui/FilterPanel';
import { Button, Badge, PageHeader, PageShell, TableShell, type Column } from '@/components/ui';
import { formatPrice } from '@/lib/utils/format';
import BilingualName from '@/components/domain/BilingualName';
import { useT } from '@/lib/i18n/useT';
import { useTableState } from '@/lib/hooks/use-table-state';
import { PRODUCT_STATUS } from '@/lib/utils/status-colors';

const filterFields: FilterField[] = [
  { name: 'name',              label: 'Name',      type: 'text',    group: 'Product Info' },
  { name: 'code',              label: 'Code',      type: 'text',    group: 'Product Info' },
  { name: 'category',          label: 'Category',  type: 'text',    group: 'Product Info' },
  { name: 'brand',             label: 'Brand',     type: 'text',    group: 'Product Info' },
  { name: 'status',            label: 'Status',    type: 'select',  group: 'Status',
    options: [
      { value: 'active',   label: 'Active' },
      { value: 'inactive', label: 'Inactive' },
      { value: 'archived', label: 'Archived' },
    ],
  },
  { name: 'is_active',         label: 'Is Active',    type: 'boolean', group: 'Status' },
  { name: 'track_stock',       label: 'Track Stock',  type: 'boolean', group: 'Status' },
  { name: 'unit_price_min',    label: 'Min Price',    type: 'number',  group: 'Pricing' },
  { name: 'unit_price_max',    label: 'Max Price',    type: 'number',  group: 'Pricing' },
  { name: 'stock_balance_min', label: 'Min Stock',    type: 'number',  group: 'Stock' },
  { name: 'stock_balance_max', label: 'Max Stock',    type: 'number',  group: 'Stock' },
];

export default function ProductsPage() {
  const tableState = useTableState();
  const { page, search, filters, selectedItems, clearSelection } = tableState;

  const importFileRef = useRef<HTMLInputElement>(null);
  const queryClient   = useQueryClient();
  const { user }      = useAuth();
  const t             = useT();
  const { hasPermission } = usePermissions();
  const isSuperuser = user?.is_superuser ?? false;
  const isAdmin     = isSuperuser || user?.role === 'admin' || user?.is_superuser;
  const canCreate   = isSuperuser || (hasPermission('product', 'create') ?? false);
  const canDelete   = isSuperuser;

  const { data, isLoading, error } = useQuery({
    queryKey: ['products', page, search, filters],
    queryFn:  () => productsApi.getAll({ page, search, ...filters }),
    staleTime: 2 * 60 * 1000,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => productsApi.delete(id),
    onSuccess:  () => { queryClient.invalidateQueries({ queryKey: ['products'] }); toast('Product deleted', 'success'); },
    onError:    () => toast('Failed to delete product', 'error'),
  });

  const handleDelete = async (id: number) => {
    if (await confirm('Delete this product?')) deleteMutation.mutate(id);
  };

  const handleBulkDelete = async () => {
    if (!selectedItems.size) return;
    if (!await confirm(`Delete ${selectedItems.size} selected products?`)) return;
    for (const id of selectedItems) await productsApi.delete(id).catch(() => {});
    queryClient.invalidateQueries({ queryKey: ['products'] });
    clearSelection();
    toast(`Deleted ${selectedItems.size} products`, 'success');
  };

  const handleExport = async () => {
    try {
      const XLSX = await import('xlsx');
      const all = await fetchAllPages<Product>((p, ps) => productsApi.getAll({ page: p, page_size: ps }));
      const rows = all.map((p: Product) => ({
        Code: p.code, Name: p.name, Name_AR: p.name_ar ?? '',
        Category: p.category ?? '', Unit: p.unit ?? '', Brand: p.brand ?? '',
        Unit_Price: p.unit_price ?? '', Stock: p.stock_balance ?? '', Status: p.status ?? '',
      }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Products');
      XLSX.writeFile(wb, `products-${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast(`Exported ${rows.length} products`, 'success');
    } catch {
      toast('Export failed', 'error');
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    try {
      const result = await productsApi.importExcel(file);
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast(`Import done: ${result.created} created, ${result.updated} updated`, 'success');
    } catch {
      toast('Import failed', 'error');
    }
  };

  const products   = Array.isArray(data?.results) ? data!.results : [];
  const totalCount = data?.count ?? 0;

  const columns: Column<Product>[] = [
    {
      key: 'name', header: 'Product',
      render: p => (
        <Link href={`/products/view/${p.id}`} className="font-medium" style={{ color: 'var(--text-brand)' }}>
          <BilingualName nameEn={p.name} nameAr={p.name_ar} />
        </Link>
      ),
    },
    { key: 'code',     header: 'Code',       render: p => <span style={{ color: 'var(--text-secondary)' }}>{p.code}</span> },
    { key: 'category', header: 'Category',   render: p => <span style={{ color: 'var(--text-secondary)' }}>{p.category || '—'}</span> },
    { key: 'price',    header: 'Unit Price',  render: p => formatPrice(p.sell_price ?? p.unit_price) },
    { key: 'stock',    header: 'Stock',       render: p => p.track_stock ? (p.stock_balance ?? 0) : '—' },
    {
      key: 'status', header: 'Status',
      render: p => <Badge variant={PRODUCT_STATUS[p.status ?? ''] ?? 'info'}>{p.status || '—'}</Badge>,
    },
    {
      key: 'actions', header: t('col', 'actions'),
      render: p => (
        <div className="flex gap-2">
          <Link href={`/products/view/${p.id}`}>
            <Button variant="view" size="sm">{t('btn', 'view')}</Button>
          </Link>
          {canDelete && (
            <Button variant="delete" size="sm" onClick={() => handleDelete(p.id)}>
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
          title="Products"
          count={totalCount}
          breadcrumbs={[{ label: 'Products' }]}
          actions={
            <div className="flex gap-2">
              {isAdmin && (
                <>
                  <input ref={importFileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} />
                  <Button variant="secondary" onClick={handleExport}>Export Excel</Button>
                  <Button variant="secondary" onClick={() => importFileRef.current?.click()}>Import Excel</Button>
                </>
              )}
              {canCreate && (
                <Link href="/products/new">
                  <Button variant="primary">+ {t('btn', 'addProduct') || 'New Product'}</Button>
                </Link>
              )}
            </div>
          }
        />
        <TableShell
          tableState={tableState}
          filterFields={filterFields}
          searchPlaceholder="Search products..."
          toolbarActions={
            canDelete && selectedItems.size > 0 ? (
              <>
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                  {selectedItems.size} selected
                </span>
                <Button variant="destructive" onClick={handleBulkDelete}>Delete Selected</Button>
                <Button variant="secondary" onClick={clearSelection}>Clear</Button>
              </>
            ) : undefined
          }
          columns={columns}
          data={products}
          isLoading={isLoading}
          error={error}
          emptyMessage="No products found."
          emptyAction={canCreate ? <Link href="/products/new"><Button variant="primary">Create Product</Button></Link> : undefined}
          selectable={canDelete}
          totalCount={totalCount}
          paginatedData={data}
        />
      </PageShell>
    </MainLayout>
  );
}
