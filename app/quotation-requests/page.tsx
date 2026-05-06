'use client';

import { useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { quotationRequestsApi } from '@/lib/api/quotation-requests';
import { QuotationRequest } from '@/types';
import Link from 'next/link';
import { toast } from '@/lib/hooks/use-toast';
import { confirm } from '@/lib/hooks/use-toast';
import { useAuth } from '@/lib/hooks/use-auth';
import { usePermissions } from '@/lib/hooks/use-permissions';
import FilterPanel, { FilterField } from '@/components/ui/FilterPanel';
import FilterTags from '@/components/ui/FilterTags';
import { Button, TextField, Checkbox, Loader } from '@/components/ui';
import { useT } from '@/lib/i18n/useT';

export default function QuotationRequestsPage() {
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
  const canCreate = isSuperuser || (hasPermission('quotation_request', 'create') ?? false);
  const canView = isSuperuser || (hasPermission('quotation_request', 'view') ?? false);
  const canDelete = isSuperuser; // Only superuser can delete

  const { data, isLoading, error } = useQuery({
    queryKey: ['quotation-requests', page, search, filters],
    queryFn: () => quotationRequestsApi.getAll({ page, search, ...filters }),
  });

  // Get all request IDs when selectMode is 'all'
  const { data: allRequestsData, isLoading: isLoadingAll } = useQuery({
    queryKey: ['quotation-requests', 'all-ids', search, filters],
    queryFn: async () => {
      const allIds: number[] = [];
      let currentPage = 1;
      let hasMore = true;
      
      while (hasMore) {
        const response = await quotationRequestsApi.getAll({ page: currentPage, search, ...filters });
        allIds.push(...response.results.map((r: QuotationRequest) => r.id));
        hasMore = !!response.next;
        currentPage++;
        if (currentPage > 100) break; // Safety limit
      }
      return allIds;
    },
    enabled: selectMode === 'all' && isAdmin,
  });

  const filterFields: FilterField[] = [
    { name: 'created_at_after', label: 'Created From', type: 'date', group: 'Dates' },
    { name: 'created_at_before', label: 'Created To', type: 'date', group: 'Dates' },
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
    mutationFn: quotationRequestsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotation-requests'] });
      toast('Request deleted successfully', 'success');
    },
    onError: () => {
      toast('Failed to delete request', 'error');
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      await Promise.all(ids.map(id => quotationRequestsApi.delete(id)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotation-requests'] });
      const count = selectedItems.size;
      setSelectedItems(new Set());
      toast(`${count} request(s) deleted successfully`, 'success');
    },
    onError: () => {
      toast('Failed to delete some requests', 'error');
    },
  });

  const handleDelete = async (id: number) => {
    const confirmed = await confirm('Are you sure you want to delete this request?');
    if (confirmed) {
      deleteMutation.mutate(id);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      if (selectMode === 'page' && data?.results) {
        setSelectedItems(new Set(data.results.map((r: QuotationRequest) => r.id)));
      } else if (selectMode === 'all' && allRequestsData) {
        setSelectedItems(new Set(allRequestsData));
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
    const confirmed = await confirm(`Are you sure you want to delete ${selectedItems.size} request(s)?`);
    if (confirmed) {
      bulkDeleteMutation.mutate(Array.from(selectedItems));
    }
  };

  // Calculate checkbox state
  const currentPageIds = data?.results?.map((r: QuotationRequest) => r.id) || [];
  const allPageSelected = currentPageIds.length > 0 && currentPageIds.every(id => selectedItems.has(id));
  const somePageSelected = currentPageIds.some(id => selectedItems.has(id)) && !allPageSelected;
  
  const allSystemSelected = selectMode === 'all' && allRequestsData && 
    allRequestsData.length > 0 && 
    allRequestsData.every(id => selectedItems.has(id));
  const someSystemSelected = selectMode === 'all' && allRequestsData && 
    allRequestsData.some(id => selectedItems.has(id)) && 
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
            <h1 className="text-2xl font-semibold text-foreground">{t('page', 'quotationRequests')}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage quotation requests from suppliers
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
              <Link href="/quotation-requests/new">
                <Button variant="primary">New Request</Button>
              </Link>
            )}
          </div>
        </div>

        {/* Search and Filters */}
        <div className="card flex items-center gap-4">
          <TextField
            type="text"
            placeholder={`${t('btn', 'search')} ${t('page', 'quotationRequests').toLowerCase()}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 max-w-md"
          />
          <FilterPanel
            fields={filterFields}
            filters={filters}
            onFilterChange={handleFilterChange}
            onReset={handleFilterReset}
            saveKey="quotation-requests"
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
            <p className="text-destructive text-sm">Error loading quotation requests. Please try again.</p>
          </div>
        ) : !data || !data.results || data.results.length === 0 ? (
          <div className="card text-center py-12">
            <p className="text-muted-foreground">{t('empty', 'noQR')}</p>
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
                      <th>{t('col', 'code')}</th>
                      <th>Project</th>
                      <th>{t('col', 'supplier')}</th>
                      <th>{t('col', 'requestDate')}</th>
                      <th>{t('col', 'actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.results.map((request) => (
                      <tr key={request.id}>
                        {isAdmin && (
                          <td>
                            <Checkbox
                              checked={selectedItems.has(request.id)}
                              onChange={(e) => handleSelectItem(request.id, e.target.checked)}
                            />
                          </td>
                        )}
                        <td>
                          <div className="font-medium text-foreground">
                            {typeof request.purchase_request === 'object' && request.purchase_request
                              ? request.purchase_request.code || 'N/A'
                              : 'N/A'}
                          </div>
                        </td>
                        <td>
                          {request.project_name ? (
                            <div>
                              <div className="font-medium text-foreground">{request.project_name}</div>
                              {request.project_code && (
                                <div className="text-xs text-muted-foreground font-mono">{request.project_code}</div>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td>
                          <div className="text-foreground">
                            {typeof request.supplier === 'object' && request.supplier
                              ? request.supplier.business_name || request.supplier.name || 'N/A'
                              : 'N/A'}
                          </div>
                        </td>
                        <td>
                          <div className="text-muted-foreground">
                            {new Date(request.created_at).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </div>
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            {canView && (
                              <Link href={`/quotation-requests/${request.id}`}>
                                <Button variant="view" size="sm">{t('btn', 'view')}</Button>
                              </Link>
                            )}
                            {canDelete && (
                              <Button
                                variant="delete"
                                size="sm"
                                onClick={() => handleDelete(request.id)}
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
                  Showing {((page - 1) * 50) + 1} to {Math.min(page * 50, data.count)} of {data.count} requests
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
