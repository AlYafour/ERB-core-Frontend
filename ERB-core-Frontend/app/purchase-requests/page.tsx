'use client';

import { useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { purchaseRequestsApi } from '@/lib/api/purchase-requests';
import { projectsApi } from '@/lib/api/projects';
import { PurchaseRequest, Project } from '@/types';
import Link from 'next/link';
import { toast } from '@/lib/hooks/use-toast';
import { confirm } from '@/lib/hooks/use-toast';
import { getApiError } from '@/lib/utils/error';
import { useAuth } from '@/lib/hooks/use-auth';
import { usePermissions } from '@/lib/hooks/use-permissions';
import { type FilterField } from '@/components/ui/FilterPanel';
import RejectionReasonDialog from '@/components/features/RejectionReasonDialog';
import { Button, Badge, PageHeader, PageShell, TableShell, type Column } from '@/components/ui';
import StatusTabs from '@/components/ui/StatusTabs';
import { useT } from '@/lib/i18n/useT';
import { useTableState } from '@/lib/hooks/use-table-state';
import { PR_STATUS } from '@/lib/utils/status-colors';
import { usePendingCounts } from '@/lib/hooks/use-pending-counts';

const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

export default function PurchaseRequestsPage() {
  const tableState = useTableState();
  const { page, search, filters, selectedItems } = tableState;
  const pending = usePendingCounts();
  const statusValue = (filters.status as string) || '';
  const handleStatusTab = (v: string) => { tableState.handleFilterChange('status', v); tableState.setPage(1); };

  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectingId, setRejectingId]           = useState<number | null>(null);

  const queryClient    = useQueryClient();
  const { user }       = useAuth();
  const t              = useT();
  const { hasPermission } = usePermissions();
  const isSuperuser = user?.is_superuser ?? false;
  const isAdmin     = user?.role === 'super_admin' || user?.is_staff;
  const canCreate   = isSuperuser || (hasPermission('purchase_request', 'create') ?? false);
  const canView     = isSuperuser || (hasPermission('purchase_request', 'view') ?? false);
  const canDelete   = isSuperuser;
  const canApprove  = isSuperuser || ((hasPermission('purchase_request', 'approve') ?? false) && user?.role !== 'procurement_officer' && user?.role !== 'site_engineer');
  const canReject   = isSuperuser || ((hasPermission('purchase_request', 'reject') ?? false) && user?.role !== 'procurement_officer' && user?.role !== 'site_engineer');

  const { data: projectsData } = useQuery({
    queryKey: ['projects-for-filter'],
    queryFn:  () => projectsApi.getAll({ page: 1, page_size: 200, is_active: true }),
    staleTime: 10 * 60 * 1000,
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['purchase-requests', page, search, filters],
    queryFn:  () => purchaseRequestsApi.getAll({ page, search, ...filters }),
    staleTime: 2 * 60 * 1000,
  });

  const approveMutation = useMutation({
    mutationFn: purchaseRequestsApi.approve,
    onSuccess:  () => { queryClient.invalidateQueries({ queryKey: ['purchase-requests'] }); queryClient.invalidateQueries({ queryKey: ['pending-count'] }); toast('Request approved', 'success'); },
    onError:    () => toast('Failed to approve request', 'error'),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) => purchaseRequestsApi.reject(id, reason),
    onSuccess:  () => { queryClient.invalidateQueries({ queryKey: ['purchase-requests'] }); queryClient.invalidateQueries({ queryKey: ['pending-count'] }); toast('Request rejected', 'info'); },
    onError:    (e: unknown) => toast(getApiError(e, 'Failed to reject request'), 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: purchaseRequestsApi.delete,
    onSuccess:  () => { queryClient.invalidateQueries({ queryKey: ['purchase-requests'] }); queryClient.invalidateQueries({ queryKey: ['pending-count'] }); toast('Request deleted', 'success'); },
    onError:    () => toast('Failed to delete request', 'error'),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: number[]) => { await Promise.all(ids.map(id => purchaseRequestsApi.delete(id))); },
    onSuccess:  () => { queryClient.invalidateQueries({ queryKey: ['purchase-requests'] }); queryClient.invalidateQueries({ queryKey: ['pending-count'] }); toast(`${selectedItems.size} request(s) deleted`, 'success'); tableState.clearSelection(); },
    onError:    () => toast('Failed to delete some requests', 'error'),
  });

  const handleApprove = async (id: number) => { if (await confirm('Approve this request?')) approveMutation.mutate(id); };
  const handleReject  = (id: number) => { setRejectingId(id); setRejectDialogOpen(true); };
  const handleDelete  = async (id: number) => { if (await confirm('Delete this request?')) deleteMutation.mutate(id); };
  const handleBulkDelete = async () => { if (selectedItems.size && await confirm(`Delete ${selectedItems.size} request(s)?`)) bulkDeleteMutation.mutate(Array.from(selectedItems)); };

  const filterFields: FilterField[] = [
    { name: 'code',                 label: 'Code',              type: 'text',   group: 'Request Info' },
    { name: 'title',                label: 'Title',             type: 'text',   group: 'Request Info' },
    { name: 'project',              label: 'Project',           type: 'select', group: 'Request Info',
      options: projectsData?.results?.map((p: Project) => ({ value: p.id, label: `${p.name} (${p.code})` })) || [] },
    { name: 'status',               label: 'Status',            type: 'select', group: 'Status',
      options: [{ value: 'pending', label: 'Pending' }, { value: 'approved', label: 'Approved' }, { value: 'rejected', label: 'Rejected' }] },
    { name: 'request_date_after',   label: 'Request Date From', type: 'date',   group: 'Dates' },
    { name: 'request_date_before',  label: 'Request Date To',   type: 'date',   group: 'Dates' },
    { name: 'required_by_after',    label: 'Required By From',  type: 'date',   group: 'Dates' },
    { name: 'required_by_before',   label: 'Required By To',    type: 'date',   group: 'Dates' },
  ];

  const requests   = Array.isArray(data?.results) ? data!.results : [];
  const totalCount = data?.count ?? 0;

  const columns: Column<PurchaseRequest>[] = [
    {
      key: 'code', header: t('col', 'code'),
      render: r => <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{r.code}</span>,
    },
    {
      key: 'project', header: t('col', 'project'),
      render: r => r.project && typeof r.project === 'object'
        ? (
          <div>
            <div className="font-medium">{r.project.name}</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{r.project.code}</div>
          </div>
        )
        : <span style={{ color: 'var(--text-secondary)' }}>—</span>,
    },
    { key: 'title',     header: t('col', 'title'),       render: r => <span className="block max-w-[240px] truncate" title={r.title}>{r.title}</span> },
    { key: 'requester', header: t('col', 'requester'),   render: r => <span style={{ color: 'var(--text-primary)' }}>{r.created_by_name || '—'}</span> },
    { key: 'req_date',  header: t('col', 'requestDate'), render: r => <span style={{ color: 'var(--text-secondary)' }}>{fmtDate(r.request_date)}</span> },
    { key: 'req_by',    header: t('col', 'requiredBy'),  render: r => <span style={{ color: 'var(--text-secondary)' }}>{fmtDate(r.required_by)}</span> },
    {
      key: 'status', header: t('col', 'status'),
      render: r => <Badge variant={PR_STATUS[r.status] ?? 'info'}>{t('status', r.status as any) || r.status}</Badge>,
    },
    {
      key: 'actions', header: t('col', 'actions'),
      render: r => (
        <div className="flex items-center gap-2">
          {canView && <Link href={`/purchase-requests/${r.id}`}><Button variant="view" size="sm">{t('btn', 'view')}</Button></Link>}
          {r.status === 'pending' && canApprove && (
            <Button variant="success" size="sm" onClick={() => handleApprove(r.id)} isLoading={approveMutation.isPending}>{t('btn', 'approve')}</Button>
          )}
          {r.status === 'pending' && canReject && (
            <Button variant="delete" size="sm" onClick={() => handleReject(r.id)} isLoading={rejectMutation.isPending}>{t('btn', 'reject')}</Button>
          )}
          {canDelete && <Button variant="destructive" size="sm" onClick={() => handleDelete(r.id)} isLoading={deleteMutation.isPending}>{t('btn', 'delete')}</Button>}
        </div>
      ),
    },
  ];

  return (
    <MainLayout>
      <PageShell>
        <PageHeader
          title="Purchase Requests"
          description="Track and manage all internal procurement requests."
          count={totalCount}
          breadcrumbs={[{ label: 'Purchase Requests' }]}
          metrics={pending.pr > 0 ? [{ label: 'pending review', value: pending.pr, variant: 'warning' }] : undefined}
          actions={
            canCreate
              ? <Link href="/purchase-requests/new"><Button variant="primary">{t('btn', 'create')} {t('page', 'purchaseRequests')}</Button></Link>
              : undefined
          }
        />
        <TableShell
          tableState={tableState}
          tabs={
            <StatusTabs
              options={[
                { value: 'pending',  label: 'Pending',  count: pending.pr },
                { value: 'approved', label: 'Approved' },
                { value: 'rejected', label: 'Rejected' },
              ]}
              value={statusValue}
              onChange={handleStatusTab}
            />
          }
          filterFields={filterFields}
          filterSaveKey="purchase-requests"
          searchPlaceholder="Search by code, title, requester…"
          toolbarActions={
            isAdmin && selectedItems.size > 0 ? (
              <Button variant="destructive" onClick={handleBulkDelete} isLoading={bulkDeleteMutation.isPending}>
                {t('btn', 'delete')} {selectedItems.size}
              </Button>
            ) : undefined
          }
          columns={columns}
          data={requests}
          isLoading={isLoading}
          error={error}
          emptyMessage={t('empty', 'noPR')}
          selectable={isAdmin}
          rowStyle={(r) => r.status === 'pending' && new Date(r.required_by) < new Date()
            ? { borderLeft: '3px solid var(--status-warning)', background: 'rgba(217,119,6,0.03)' }
            : undefined}
          totalCount={totalCount}
          pageSize={50}
          paginatedData={data}
        />

        <RejectionReasonDialog
          isOpen={rejectDialogOpen}
          onClose={() => { setRejectDialogOpen(false); setRejectingId(null); }}
          onConfirm={(reason) => { if (rejectingId) { rejectMutation.mutate({ id: rejectingId, reason }); setRejectDialogOpen(false); setRejectingId(null); } }}
          title="Reject Purchase Request"
          message="Please provide a reason for rejecting this request."
        />
      </PageShell>
    </MainLayout>
  );
}
