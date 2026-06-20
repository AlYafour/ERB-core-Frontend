'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { purchaseRequestsApi } from '@/lib/api/purchase-requests';
import { projectsApi } from '@/lib/api/projects';
import { PurchaseRequest, Project } from '@/types';
import Link from 'next/link';
import { toast } from '@/lib/hooks/use-toast';
import { confirm } from '@/lib/hooks/use-toast';
import { getApiError } from '@/lib/utils/error';
import { usePermissions } from '@/lib/hooks/use-permissions';
import { useMyPermissions } from '@/lib/hooks/use-my-permissions';
import { type FilterField } from '@/components/ui/FilterPanel';
import RejectionReasonDialog from '@/components/features/RejectionReasonDialog';
import { Button, Badge, PersonCell, type Column } from '@/components/ui';
import { RowActions } from '@/components/ui/RowActions';
import { useT } from '@/lib/i18n/useT';
import { useTableState } from '@/lib/hooks/use-table-state';
import { PR_STATUS } from '@/lib/utils/status-colors';
import { usePendingCounts } from '@/lib/hooks/use-pending-counts';
import { ProcListPage } from '@/components/procurement/list/ProcListPage';

import { fmtDate } from '@/lib/utils/format';
import { PrPipelinePopover } from '@/components/procurement/PrPipelinePopover';

export default function PurchaseRequestsPage() {
  const router = useRouter();
  const tableState = useTableState();
  const { page, search, filters, selectedItems } = tableState;
  const pending = usePendingCounts();

  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectingId,      setRejectingId]       = useState<number | null>(null);

  const queryClient       = useQueryClient();
  const t                 = useT();
  const { hasPermission } = usePermissions();
  const { isTenantAdmin, isPlatformAdmin } = useMyPermissions();
  const isAdmin    = isTenantAdmin || isPlatformAdmin;
  const canCreate  = isAdmin || (hasPermission('purchase_request', 'create') ?? false);
  const canDelete  = isAdmin || (hasPermission('purchase_request', 'delete') ?? false);
  const canApprove = isAdmin || (hasPermission('purchase_request', 'approve') ?? false);
  const canReject  = isAdmin || (hasPermission('purchase_request', 'reject') ?? false);

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

  const { data: kpiTotal }    = useQuery({ queryKey: ['pr-kpi', 'total'],    queryFn: () => purchaseRequestsApi.getAll({ page: 1, page_size: 1 }),                  staleTime: 5 * 60 * 1000, select: (d: any) => d.count ?? 0 });
  const { data: kpiPending }  = useQuery({ queryKey: ['pr-kpi', 'pending'],  queryFn: () => purchaseRequestsApi.getAll({ page: 1, page_size: 1, status: 'pending' }),  staleTime: 5 * 60 * 1000, select: (d: any) => d.count ?? 0 });
  const { data: kpiApproved } = useQuery({ queryKey: ['pr-kpi', 'approved'], queryFn: () => purchaseRequestsApi.getAll({ page: 1, page_size: 1, status: 'approved' }), staleTime: 5 * 60 * 1000, select: (d: any) => d.count ?? 0 });
  const { data: kpiRejected } = useQuery({ queryKey: ['pr-kpi', 'rejected'], queryFn: () => purchaseRequestsApi.getAll({ page: 1, page_size: 1, status: 'rejected' }), staleTime: 5 * 60 * 1000, select: (d: any) => d.count ?? 0 });

  const invalidatePR = () => {
    queryClient.invalidateQueries({ queryKey: ['purchase-requests'] });
    queryClient.invalidateQueries({ queryKey: ['pr-kpi'] });
    queryClient.invalidateQueries({ queryKey: ['pending-count'] });
  };

  const approveMutation = useMutation({
    mutationFn: purchaseRequestsApi.approve,
    onSuccess:  () => { invalidatePR(); toast('Request approved', 'success'); },
    onError:    (e: unknown) => toast(getApiError(e, 'Failed to approve request'), 'error'),
  });
  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) => purchaseRequestsApi.reject(id, reason),
    onSuccess:  () => { invalidatePR(); toast('Request rejected', 'info'); },
    onError:    (e: unknown) => toast(getApiError(e, 'Failed to reject request'), 'error'),
  });
  const deleteMutation = useMutation({
    mutationFn: purchaseRequestsApi.delete,
    onSuccess:  () => { invalidatePR(); toast('Request deleted', 'success'); },
    onError:    (e: unknown) => toast(getApiError(e, 'Failed to delete request'), 'error'),
  });
  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: number[]) => { await Promise.all(ids.map(id => purchaseRequestsApi.delete(id))); },
    onSuccess:  () => { invalidatePR(); toast(`${selectedItems.size} request(s) deleted`, 'success'); tableState.clearSelection(); },
    onError:    (e: unknown) => toast(getApiError(e, 'Failed to delete some requests'), 'error'),
  });

  const handleApprove     = useCallback(async (id: number) => { if (await confirm('Approve this request?')) approveMutation.mutate(id); }, [approveMutation.mutate]);
  const handleReject      = useCallback((id: number) => { setRejectingId(id); setRejectDialogOpen(true); }, []);
  const handleDelete      = useCallback(async (id: number) => { if (await confirm('Delete this request?')) deleteMutation.mutate(id); }, [deleteMutation.mutate]);
  const handleBulkDelete  = async () => { if (selectedItems.size && await confirm(`Delete ${selectedItems.size} request(s)?`)) bulkDeleteMutation.mutate(Array.from(selectedItems)); };

  const filterFields: FilterField[] = [
    { name: 'code',  label: 'Code',  type: 'text',   group: 'Request Info' },
    { name: 'title', label: 'Title', type: 'text',   group: 'Request Info' },
    { name: 'project', label: 'Project', type: 'select', group: 'Request Info',
      options: projectsData?.results?.map((p: Project) => ({ value: p.id, label: `${p.name} (${p.code})` })) ?? [] },
    { name: 'request_date_after',  label: 'Request Date From', type: 'date', group: 'Dates' },
    { name: 'request_date_before', label: 'Request Date To',   type: 'date', group: 'Dates' },
    { name: 'required_by_after',   label: 'Required By From',  type: 'date', group: 'Dates' },
    { name: 'required_by_before',  label: 'Required By To',    type: 'date', group: 'Dates' },
  ];

  const requests   = Array.isArray(data?.results) ? data!.results : [];
  const totalCount = data?.count ?? 0;

  const columns = useMemo((): Column<PurchaseRequest>[] => [
    { key: 'code',     header: t('col', 'code'),        render: r => <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{r.code}</span> },
    {
      key: 'project', header: t('col', 'project'),
      render: r => r.project && typeof r.project === 'object'
        ? <div><div className="font-medium">{(r.project as any).name}</div><div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{(r.project as any).code}</div></div>
        : <span style={{ color: 'var(--text-secondary)' }}>—</span>,
    },
    { key: 'title',     header: t('col', 'title'),       render: r => <span className="block max-w-[240px] truncate" title={r.title}>{r.title}</span> },
    { key: 'requester', header: t('col', 'requester'),   render: r => <PersonCell name={r.created_by_name || '—'} avatarUrl={null} /> },
    { key: 'req_date',  header: t('col', 'requestDate'), render: r => <span style={{ color: 'var(--text-secondary)' }}>{fmtDate(r.request_date)}</span> },
    { key: 'req_by',    header: t('col', 'requiredBy'),  render: r => <span style={{ color: 'var(--text-secondary)' }}>{fmtDate(r.required_by)}</span> },
    { key: 'status',    header: t('col', 'status'),      render: r => <Badge variant={PR_STATUS[r.status] ?? 'info'}>{t('status', r.status as any) || r.status}</Badge> },
    {
      key: 'procurement', header: 'Procurement',
      render: r => {
        const hasQR = r.has_quotation_requests;
        const hasPO = r.has_purchase_orders;

        const badge = r.status !== 'approved'
          ? <span style={{ color: 'var(--text-muted)' }}>—</span>
          : !hasQR && !hasPO
            ? <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'2px 8px', borderRadius:999, fontSize:'var(--text-xs)', fontWeight:600, background:'var(--status-warning-bg)', color:'var(--status-warning)' }}>⚠ Not Started</span>
            : (
              <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                {hasQR && <span style={{ padding:'2px 8px', borderRadius:999, fontSize:'var(--text-xs)', fontWeight:600, background:'var(--task-assigned-bg)', color:'var(--task-assigned)' }}>QR</span>}
                {hasPO && <span style={{ padding:'2px 8px', borderRadius:999, fontSize:'var(--text-xs)', fontWeight:600, background:'var(--status-success-bg)', color:'var(--status-success)' }}>LPO</span>}
              </div>
            );

        return (
          <PrPipelinePopover request={r}>{badge}</PrPipelinePopover>
        );
      },
    },
    {
      key: 'actions', header: '',
      render: r => (
        <RowActions actions={[
          { label: 'Approve', onClick: () => handleApprove(r.id), hidden: r.status !== 'pending' || !canApprove },
          { label: 'Reject',  onClick: () => handleReject(r.id),  hidden: r.status !== 'pending' || !canReject },
          { separator: true,  hidden: !canDelete },
          { label: 'Delete',  onClick: () => handleDelete(r.id), variant: 'danger', hidden: !canDelete },
        ]} />
      ),
    },
  ], [t, canApprove, canReject, canDelete, handleApprove, handleReject, handleDelete]);

  return (
    <ProcListPage
      breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Purchase Management' }, { label: 'Purchase Requests' }]}
      title="Purchase Requests"
      description="Track and manage all internal procurement requests."
      totalCount={totalCount}
      pendingCount={pending.pr > 0 ? pending.pr : undefined}
      createAction={canCreate ? <Link href="/purchase-requests/new"><Button variant="primary">{t('btn', 'create')} PR</Button></Link> : undefined}
      statusItems={[
        { value: '',         label: 'All',      count: kpiTotal,    loading: kpiTotal === undefined },
        { value: 'pending',  label: 'Pending',  count: kpiPending,  loading: kpiPending === undefined },
        { value: 'approved', label: 'Approved', count: kpiApproved, loading: kpiApproved === undefined },
        { value: 'rejected', label: 'Rejected', count: kpiRejected, loading: kpiRejected === undefined },
      ]}
      searchPlaceholder="Search by code, title, requester…"
      filterFields={filterFields}
      advFilterTitle="Purchase Request Filters"
      advFilterDesc="Filter purchase requests by project, date range, and more."
      columns={columns}
      data={requests}
      isLoading={isLoading}
      error={error}
      onRowClick={r => router.push(`/purchase-requests/${r.id}`)}
      selectable={isAdmin}
      rowStyle={(r) => r.status === 'pending' && new Date(r.required_by) < new Date()
        ? { borderLeft: '3px solid var(--status-warning)', background: 'rgba(217,119,6,.03)' }
        : undefined}
      tableState={tableState}
      paginatedData={data}
      pageSize={50}
      emptyTitle="No purchase requests found"
      emptyAction={canCreate ? <Link href="/purchase-requests/new"><Button variant="primary">New Purchase Request</Button></Link> : undefined}
      bulkActions={
        isAdmin ? (
          <Button variant="destructive" onClick={handleBulkDelete} isLoading={bulkDeleteMutation.isPending}>
            Delete {selectedItems.size}
          </Button>
        ) : undefined
      }
    >
      <RejectionReasonDialog
        isOpen={rejectDialogOpen}
        onClose={() => { setRejectDialogOpen(false); setRejectingId(null); }}
        onConfirm={(reason) => { if (rejectingId) { rejectMutation.mutate({ id: rejectingId, reason }); setRejectDialogOpen(false); setRejectingId(null); } }}
        title="Reject Purchase Request"
        message="Please provide a reason for rejecting this request."
      />
    </ProcListPage>
  );
}
