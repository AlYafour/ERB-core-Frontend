'use client';

import { useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { purchaseQuotationsApi } from '@/lib/api/purchase-quotations';
import { PurchaseQuotation } from '@/types';
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
  pending: 'badge-warning',
  awarded: 'badge-success',
  rejected: 'badge-error',
  expired: 'badge-info',
};

const statusLabels: Record<string, string> = {
  pending: 'Pending',
  awarded: 'Awarded',
  rejected: 'Rejected',
  expired: 'Expired',
};

export default function PurchaseQuotationsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Record<string, any>>({});
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [selectMode, setSelectMode] = useState<'page' | 'all'>('page');
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const t = useT();
  const { hasPermission } = usePermissions();
  const isAdmin = user?.role === 'super_admin' || user?.is_staff;
  
  // Permission checks - Superuser has all permissions
  const isSuperuser = user?.is_superuser ?? false;
  const canCreate = isSuperuser || (hasPermission('purchase_quotation', 'create') ?? false);
  const canView = isSuperuser || (hasPermission('purchase_quotation', 'view') ?? false);
  const canDelete = isSuperuser; // Only superuser can delete

  const { data, isLoading, error } = useQuery({
    queryKey: ['purchase-quotations', page, search, filters],
    queryFn: () => purchaseQuotationsApi.getAll({ page, search, ...filters }),
  });

  // Get all quotation IDs when selectMode is 'all'
  const { data: allQuotationsData, isLoading: isLoadingAll } = useQuery({
    queryKey: ['purchase-quotations', 'all-ids', search, filters],
    queryFn: async () => {
      const allIds: number[] = [];
      let currentPage = 1;
      let hasMore = true;
      
      while (hasMore) {
        const response = await purchaseQuotationsApi.getAll({ page: currentPage, search, ...filters });
        allIds.push(...response.results.map((q: PurchaseQuotation) => q.id));
        hasMore = !!response.next;
        currentPage++;
        if (currentPage > 100) break; // Safety limit
      }
      return allIds;
    },
    enabled: selectMode === 'all' && isAdmin,
  });

  const filterFields: FilterField[] = [
    // Quotation Info
    { name: 'quotation_number', label: 'Quotation Number', type: 'text', group: 'Quotation Info' },
    // Pricing
    { name: 'total', label: 'Total Amount', type: 'range', group: 'Pricing' },
    // Dates
    { name: 'quotation_date_after', label: 'Quotation Date From', type: 'date', group: 'Dates' },
    { name: 'quotation_date_before', label: 'Quotation Date To', type: 'date', group: 'Dates' },
    { name: 'valid_until_after', label: 'Valid Until From', type: 'date', group: 'Dates' },
    { name: 'valid_until_before', label: 'Valid Until To', type: 'date', group: 'Dates' },
  ];

  const handleFilterChange = (newFilters: Record<string, any>) => {
    setFilters(newFilters);
    setPage(1);
  };

  const handleFilterReset = () => {
    setFilters({});
    setPage(1);
  };

  const handleRemoveFilter = (key: string) => {
    const newFilters = { ...filters };
    delete newFilters[key];
    setFilters(newFilters);
    setPage(1);
  };

  const handleClearAllFilters = () => {
    setFilters({});
    setPage(1);
  };

  const deleteMutation = useMutation({
    mutationFn: purchaseQuotationsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-quotations'] });
      queryClient.invalidateQueries({ queryKey: ['pending-count'] });
      toast('Quotation deleted successfully', 'success');
    },
    onError: () => {
      toast('Failed to delete quotation', 'error');
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      await Promise.all(ids.map(id => purchaseQuotationsApi.delete(id)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-quotations'] });
      queryClient.invalidateQueries({ queryKey: ['pending-count'] });
      const count = selectedItems.size;
      setSelectedItems(new Set());
      toast(`${count} quotation(s) deleted successfully`, 'success');
    },
    onError: () => {
      toast('Failed to delete some quotations', 'error');
    },
  });

  const handleDelete = async (id: number) => {
    const confirmed = await confirm('Are you sure you want to delete this quotation?');
    if (confirmed) {
      deleteMutation.mutate(id);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      if (selectMode === 'page' && data?.results) {
        setSelectedItems(new Set(data.results.map((q: PurchaseQuotation) => q.id)));
      } else if (selectMode === 'all' && allQuotationsData) {
        setSelectedItems(new Set(allQuotationsData));
      }
    } else {
      setSelectedItems(new Set());
    }
  };

  const handleSelectItem = (id: number, checked: boolean) => {
    const newSelected = new Set(selectedItems);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedItems(newSelected);
  };

  const handleBulkDelete = async () => {
    if (selectedItems.size === 0) return;
    const confirmed = await confirm(`Are you sure you want to delete ${selectedItems.size} quotation(s)?`);
    if (confirmed) {
      bulkDeleteMutation.mutate(Array.from(selectedItems));
    }
  };

  // Calculate checkbox state
  const currentPageIds = data?.results?.map((q: PurchaseQuotation) => q.id) || [];
  const allPageSelected = currentPageIds.length > 0 && currentPageIds.every(id => selectedItems.has(id));
  const somePageSelected = currentPageIds.some(id => selectedItems.has(id)) && !allPageSelected;
  
  const allSystemSelected = selectMode === 'all' && allQuotationsData && 
    allQuotationsData.length > 0 && 
    allQuotationsData.every(id => selectedItems.has(id));
  const someSystemSelected = selectMode === 'all' && allQuotationsData && 
    allQuotationsData.some(id => selectedItems.has(id)) && 
    !allSystemSelected;

  const checkboxChecked = selectMode === 'page' 
    ? allPageSelected 
    : (allSystemSelected ?? false);
  const checkboxIndeterminate = selectMode === 'page'
    ? somePageSelected
    : (someSystemSelected ?? false);

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">{t('page', 'purchaseQuotations')}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              View and manage supplier quotations
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <div className="flex items-center gap-2 border-r border-border pr-2 mr-2">
                <span className="text-xs text-muted-foreground">Select:</span>
                <Button
                  variant={selectMode === 'page' ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => {
                    setSelectMode('page');
                    setSelectedItems(new Set());
                  }}
                >
                  Page
                </Button>
                <Button
                  variant={selectMode === 'all' ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => {
                    setSelectMode('all');
                    setSelectedItems(new Set());
                  }}
                >
                  All
                </Button>
              </div>
            )}
            {isAdmin && selectedItems.size > 0 && (
              <Button
                variant="destructive"
                onClick={handleBulkDelete}
                disabled={bulkDeleteMutation.isPending}
                isLoading={bulkDeleteMutation.isPending}
              >
                {bulkDeleteMutation.isPending ? 'Deleting...' : `Delete ${selectedItems.size}`}
              </Button>
            )}
            {canCreate && (
              <Link href="/purchase-quotations/new">
                <Button variant="primary">New Quotation</Button>
              </Link>
            )}
          </div>
        </div>

        {/* Search and Filters */}
        <div className="card flex items-center gap-4">
          <TextField
            type="text"
            placeholder={`${t('btn', 'search')} ${t('page', 'purchaseQuotations').toLowerCase()}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 max-w-md"
          />
          <FilterPanel
            fields={filterFields}
            filters={filters}
            onFilterChange={handleFilterChange}
            onReset={handleFilterReset}
            saveKey="purchase-quotations"
          />
        </div>

        {/* Filter Tags */}
        {Object.keys(filters).length > 0 && (
          <FilterTags
            filters={filters}
            fields={filterFields}
            onRemoveFilter={handleRemoveFilter}
            onClearAll={handleClearAllFilters}
          />
        )}

        {/* Content */}
        {isLoading ? (
          <div className="card text-center py-12">
            <Loader className="mx-auto mb-4" />
            <p className="text-muted-foreground">{t('btn', 'loading')}</p>
          </div>
        ) : error ? (
          <div className="card border-destructive bg-destructive/10">
            <p className="text-destructive text-sm">Error loading quotations. Please try again.</p>
          </div>
        ) : !data || !data.results || data.results.length === 0 ? (
          <div className="card text-center py-12">
            <p className="text-muted-foreground">{t('empty', 'noPQ')}</p>
          </div>
        ) : (
          <>
            <div className="card p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table>
                  <thead>
                    <tr>
                      {isAdmin && (
                        <th className="w-12">
                          <Checkbox
                            checked={checkboxChecked}
                            ref={(input) => {
                              if (input) input.indeterminate = checkboxIndeterminate ?? false;
                            }}
                            onChange={(e) => handleSelectAll(e.target.checked)}
                            disabled={selectMode === 'all' && isLoadingAll}
                            title={selectMode === 'page' ? 'Select all in page' : 'Select all in system'}
                          />
                        </th>
                      )}
                      <th>{t('col', 'quotationNumber')}</th>
                      <th>{t('col', 'status')}</th>
                      <th>PR</th>
                      <th>QR</th>
                      <th>Project</th>
                      <th>{t('col', 'supplier')}</th>
                      <th>{t('col', 'requestDate')}</th>
                      <th>{t('col', 'deliveryMethod')}</th>
                      <th>{t('col', 'totalAmount')}</th>
                      <th>{t('col', 'actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.results.map((quotation) => (
                      <tr key={quotation.id}>
                        {isAdmin && (
                          <td>
                            <Checkbox
                              checked={selectedItems.has(quotation.id)}
                              onChange={(e) => handleSelectItem(quotation.id, e.target.checked)}
                            />
                          </td>
                        )}
                        <td>
                          <div className="font-medium text-foreground">
                            {quotation.quotation_number}
                          </div>
                        </td>
                        <td>
                          <div className="text-foreground">
                            <span className={`badge ${statusColors[quotation.status || 'pending'] || 'badge-info'}`}>
                              {statusLabels[quotation.status || 'pending'] || quotation.status || 'Pending'}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div className="text-foreground">
                            {quotation.purchase_request_code ? (() => {
                              // Get purchase request ID safely
                              let prId: number | null = null;
                              if (quotation.purchase_request_id) {
                                prId = quotation.purchase_request_id;
                              } else if (quotation.purchase_request && typeof quotation.purchase_request === 'object' && quotation.purchase_request.id) {
                                prId = quotation.purchase_request.id;
                              } else if (quotation.purchase_request && typeof quotation.purchase_request === 'number') {
                                prId = quotation.purchase_request;
                              }
                              
                              return prId ? (
                                <Link 
                                  href={`/purchase-requests/${prId}`}
                                  style={{ color: 'var(--color-primary)', textDecoration: 'none' }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.textDecoration = 'underline';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.textDecoration = 'none';
                                  }}
                                >
                                  {quotation.purchase_request_code}
                                </Link>
                              ) : (
                                <span>{quotation.purchase_request_code}</span>
                              );
                            })() : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </div>
                        </td>
                        <td>
                          <div className="text-foreground">
                            {quotation.quotation_request_code ? (
                              <Link 
                                href={`/quotation-requests/${quotation.quotation_request_id || (typeof quotation.quotation_request === 'number' ? quotation.quotation_request : (typeof quotation.quotation_request === 'object' && quotation.quotation_request?.id ? quotation.quotation_request.id : null))}`}
                                style={{ color: 'var(--color-primary)', textDecoration: 'none' }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.textDecoration = 'underline';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.textDecoration = 'none';
                                }}
                              >
                                {quotation.quotation_request_code}
                              </Link>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </div>
                        </td>
                        <td>
                          {quotation.project_name ? (
                            <div>
                              <div className="font-medium text-foreground">{quotation.project_name}</div>
                              {quotation.project_code && (
                                <div className="text-xs text-muted-foreground font-mono">{quotation.project_code}</div>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td>
                          <div className="text-foreground">
                            {typeof quotation.supplier === 'object' && quotation.supplier
                              ? quotation.supplier.business_name || quotation.supplier.name || 'N/A'
                              : 'N/A'}
                          </div>
                        </td>
                        <td>
                          <div className="text-muted-foreground">
                            {new Date(quotation.quotation_date).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </div>
                        </td>
                        <td>
                          <div className="text-foreground">
                            {quotation.delivery_method ? (
                              quotation.delivery_method === 'pickup' ? 'Pick Up' : 'Delivery'
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </div>
                        </td>
                        <td>
                          <div className="font-medium text-foreground">
                            {formatPrice(quotation.total || 0)}
                          </div>
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            {canView && (
                              <Link href={`/purchase-quotations/${quotation.id}`}>
                                <Button variant="view" size="sm">{t('btn', 'view')}</Button>
                              </Link>
                            )}
                            {canDelete && (
                              <Button
                                variant="delete"
                                size="sm"
                                onClick={() => handleDelete(quotation.id)}
                                disabled={deleteMutation.isPending}
                                isLoading={deleteMutation.isPending}
                                title={!canDelete ? 'You do not have permission to delete' : ''}
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
            </div>

            {/* Pagination */}
            {data && data.count > 50 && (
              <div className="flex items-center justify-between card">
                <div className="text-sm text-muted-foreground">
                  Showing {((page - 1) * 50) + 1} to {Math.min(page * 50, data.count)} of {data.count} quotations
                  {selectMode === 'all' && selectedItems.size > 0 && (
                    <span className="ml-2 text-foreground font-medium">
                      ({selectedItems.size} selected)
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={!data.previous || page === 1}
                  >
                    {t('btn', 'previous')}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => setPage(p => p + 1)}
                    disabled={!data.next}
                  >
                    {t('btn', 'next')}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </MainLayout>
  );
}

