'use client';

import { useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { purchaseOrdersApi } from '@/lib/api/purchase-orders';
import { PurchaseOrder } from '@/types';
import Link from 'next/link';
import { toast } from '@/lib/hooks/use-toast';
import { confirm } from '@/lib/hooks/use-toast';
import { useAuth } from '@/lib/hooks/use-auth';
import { usePermissions } from '@/lib/hooks/use-permissions';
import FilterPanel, { FilterField } from '@/components/ui/FilterPanel';
import FilterTags from '@/components/ui/FilterTags';
import { Button, TextField, Checkbox, Loader } from '@/components/ui';
import { formatPrice } from '@/lib/utils/format';
import { useT } from '@/lib/i18n/useT';

const statusColors: Record<string, string> = {
  draft: 'badge-info',
  pending: 'badge-warning',
  approved: 'badge-success',
  rejected: 'badge-error',
  completed: 'badge-success',
  cancelled: 'badge-error',
};

const statusLabels: Record<string, string> = {
  draft: 'Draft',
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export default function PurchaseOrdersPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Record<string, any>>({});
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const t = useT();
  const { hasPermission } = usePermissions();
  const isSuperuser = user?.is_superuser ?? false;
  const isAdmin = isSuperuser || user?.role === 'super_admin' || user?.is_staff;
  const canCreate = isSuperuser || (hasPermission('purchase_order', 'create') ?? false);
  const canDelete = isSuperuser;

  const { data, isLoading, error } = useQuery({
    queryKey: ['purchase-orders', page, search, filters],
    queryFn: () => purchaseOrdersApi.getAll({ page, search, ...filters }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => purchaseOrdersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['pending-count'] });
      toast('Purchase Order deleted', 'success');
    },
    onError: () => toast('Failed to delete purchase order', 'error'),
  });

  const handleDelete = async (id: number) => {
    if (await confirm('Delete this purchase order?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleBulkDelete = async () => {
    if (!selectedItems.size) return;
    if (!await confirm(`Delete ${selectedItems.size} selected purchase orders?`)) return;
    for (const id of selectedItems) {
      await purchaseOrdersApi.delete(id).catch(() => {});
    }
    queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['pending-count'] });
    setSelectedItems(new Set());
    toast(`Deleted ${selectedItems.size} purchase orders`, 'success');
  };

  const filterFields: FilterField[] = [
    { name: 'order_number', label: 'Order Number', type: 'text', group: 'Order Info' },
    { name: 'status', label: 'Status', type: 'select', group: 'Status',
      options: Object.entries(statusLabels).map(([v, l]) => ({ value: v, label: l }))
    },
    { name: 'order_date_after', label: 'Order Date From', type: 'date', group: 'Dates' },
    { name: 'order_date_before', label: 'Order Date To', type: 'date', group: 'Dates' },
    { name: 'total_min', label: 'Min Total', type: 'number', group: 'Amount' },
    { name: 'total_max', label: 'Max Total', type: 'number', group: 'Amount' },
  ];

  const orders = data?.results ?? [];
  const totalCount = data?.count ?? 0;
  const totalPages = Math.ceil(totalCount / 20);

  const toggleSelect = (id: number) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedItems.size === orders.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(orders.map((o: PurchaseOrder) => o.id)));
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Purchase Orders</h1>
            <p className="text-sm text-muted-foreground mt-1">{totalCount} total purchase orders</p>
          </div>
          {canCreate && (
            <Link href="/purchase-orders/new">
              <Button variant="primary">+ New Purchase Order</Button>
            </Link>
          )}
        </div>

        <div className="flex gap-4 items-start">
          <div className="flex-1">
            <TextField
              placeholder="Search purchase orders..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <FilterPanel
            fields={filterFields}
            filters={filters}
            onFilterChange={(f) => { setFilters(f); setPage(1); }}
            onReset={() => { setFilters({}); setPage(1); }}
          />
        </div>

        <FilterTags filters={filters} fields={filterFields} onRemoveFilter={(key) => {
          setFilters(prev => { const n = { ...prev }; delete n[key]; return n; });
        }} onClearAll={() => setFilters({})} />

        {selectedItems.size > 0 && canDelete && (
          <div className="flex gap-2 items-center p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <span className="text-sm">{selectedItems.size} selected</span>
            <Button variant="destructive" onClick={handleBulkDelete}>Delete Selected</Button>
            <Button variant="secondary" onClick={() => setSelectedItems(new Set())}>Clear</Button>
          </div>
        )}

        {isLoading ? (
          <div className="card text-center py-12"><Loader /></div>
        ) : error ? (
          <div className="card text-center py-12">
            <p className="text-destructive">Failed to load purchase orders</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="card text-center py-12">
            <p className="text-muted-foreground">No purchase orders found</p>
            {canCreate && (
              <Link href="/purchase-orders/new">
                <Button variant="primary" className="mt-4">Create Purchase Order</Button>
              </Link>
            )}
          </div>
        ) : (
          <div className="card overflow-x-auto">
            <table>
              <thead>
                <tr>
                  {canDelete && (
                    <th style={{ width: 40 }}>
                      <Checkbox
                        checked={selectedItems.size === orders.length && orders.length > 0}
                        onChange={toggleSelectAll}
                      />
                    </th>
                  )}
                  <th>Order Number</th>
                  <th>Project</th>
                  <th>Supplier</th>
                  <th>Order Date</th>
                  <th>Delivery Date</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order: PurchaseOrder) => (
                  <tr key={order.id}>
                    {canDelete && (
                      <td>
                        <Checkbox
                          checked={selectedItems.has(order.id)}
                          onChange={() => toggleSelect(order.id)}
                        />
                      </td>
                    )}
                    <td>
                      <Link href={`/purchase-orders/${order.id}`} className="text-primary hover:underline font-mono font-semibold">
                        {order.order_number}
                      </Link>
                    </td>
                    <td>
                      {order.project_name ? (
                        <div>
                          <div className="font-medium text-foreground">{order.project_name}</div>
                          {order.project_code && (
                            <div className="text-xs text-muted-foreground font-mono">{order.project_code}</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="text-muted-foreground">
                      {typeof order.supplier === 'object' ? order.supplier.name : '—'}
                    </td>
                    <td className="text-muted-foreground">
                      {new Date(order.order_date).toLocaleDateString('en-US')}
                    </td>
                    <td className="text-muted-foreground">
                      {order.delivery_date ? new Date(order.delivery_date).toLocaleDateString('en-US') : '—'}
                    </td>
                    <td className="font-semibold">{formatPrice(order.total)}</td>
                    <td>
                      <span className={`badge ${statusColors[order.status] || 'badge-info'}`}>
                        {statusLabels[order.status] || order.status}
                      </span>
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <Link href={`/purchase-orders/${order.id}`}>
                          <Button variant="secondary" size="sm">View</Button>
                        </Link>
                        <Link href={`/print/lpo/${order.id}`} target="_blank">
                          <Button variant="secondary" size="sm">Print</Button>
                        </Link>
                        {canDelete && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDelete(order.id)}
                          >
                            Delete
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex justify-center gap-2">
            <Button variant="secondary" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
            <span className="flex items-center px-4 text-sm text-muted-foreground">Page {page} of {totalPages}</span>
            <Button variant="secondary" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        )}
      </div>
    </MainLayout>
  );
}

