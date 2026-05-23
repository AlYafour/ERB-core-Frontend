'use client';

import { useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { subcontractorsApi, SubcontractorContract } from '@/lib/api/subcontractors';
import Link from 'next/link';
import { Button, Badge, PageHeader, PageShell, TableShell, type Column } from '@/components/ui';
import { type FilterField } from '@/components/ui/FilterPanel';
import { useTableState } from '@/lib/hooks/use-table-state';
import { CONTRACT_STATUS } from '@/lib/utils/status-colors';
import { toast, confirm } from '@/lib/hooks/use-toast';
import { useAuth } from '@/lib/hooks/use-auth';

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft', under_review: 'Under Review', approved: 'Approved',
  active: 'Active', on_hold: 'On Hold', completed: 'Completed',
  closed: 'Closed', terminated: 'Terminated',
};

const filterFields: FilterField[] = [
  { name: 'contract_status', label: 'Status', type: 'select', group: 'Contract',
    options: Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label })) },
  { name: 'start_date_after',  label: 'Start Date From', type: 'date', group: 'Dates' },
  { name: 'start_date_before', label: 'Start Date To',   type: 'date', group: 'Dates' },
  { name: 'end_date_after',    label: 'End Date From',   type: 'date', group: 'Dates' },
  { name: 'end_date_before',   label: 'End Date To',     type: 'date', group: 'Dates' },
  { name: 'value_min', label: 'Min Value', type: 'number', group: 'Value' },
  { name: 'value_max', label: 'Max Value', type: 'number', group: 'Value' },
];

interface RejectDialog { id: number; reason: string }

export default function ContractsPage() {
  const tableState = useTableState();
  const { page, search, filters, selectedItems, clearSelection } = tableState;
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isSuperuser = user?.is_superuser ?? false;

  const [rejectDialog, setRejectDialog] = useState<RejectDialog | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['subcon-contracts', page, search, filters],
    queryFn: () => subcontractorsApi.contracts.list({ page, search: search || undefined, ...filters }),
    staleTime: 2 * 60 * 1000,
  });

  const rows       = data?.results ?? [];
  const totalCount = data?.count ?? 0;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['subcon-contracts'] });

  const reviewMutation = useMutation({
    mutationFn: (id: number) => subcontractorsApi.contracts.review(id, {}),
    onSuccess: () => { invalidate(); toast('Contract submitted for review', 'success'); },
    onError:   () => toast('Failed to submit for review', 'error'),
  });

  const approveMutation = useMutation({
    mutationFn: (id: number) => subcontractorsApi.contracts.approve(id, {}),
    onSuccess: () => { invalidate(); toast('Contract approved', 'success'); },
    onError:   () => toast('Failed to approve contract', 'error'),
  });

  const activateMutation = useMutation({
    mutationFn: (id: number) => subcontractorsApi.contracts.activate(id),
    onSuccess: () => { invalidate(); toast('Contract activated', 'success'); },
    onError:   () => toast('Failed to activate contract', 'error'),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      subcontractorsApi.contracts.reject(id, { reason }),
    onSuccess: () => { invalidate(); toast('Contract rejected', 'success'); setRejectDialog(null); },
    onError:   () => toast('Failed to reject contract', 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (ids: number[]) => { for (const id of ids) await subcontractorsApi.contracts.delete(id); },
    onSuccess: () => { invalidate(); toast('Deleted selected contracts', 'success'); clearSelection(); },
    onError:   () => toast('Failed to delete', 'error'),
  });

  const columns: Column<SubcontractorContract>[] = [
    {
      key: 'contract_no', header: 'Contract No.',
      render: c => (
        <Link href={`/subcontractors/contracts/${c.id}`} style={{ fontFamily: 'monospace', fontSize: 'var(--text-xs)', color: 'var(--text-brand)', fontWeight: 600 }}>
          {c.contract_no}
        </Link>
      ),
    },
    {
      key: 'contract_title', header: 'Title / Subcontractor',
      render: c => (
        <div>
          <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{c.contract_title}</div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{c.subcontractor_name}</div>
        </div>
      ),
    },
    {
      key: 'contract_value', header: 'Contract Value',
      render: c => (
        <span style={{ fontFamily: 'monospace', fontSize: 'var(--text-sm)', fontWeight: 600 }}>
          AED {Number(c.contract_value).toLocaleString()}
        </span>
      ),
    },
    {
      key: 'total_approved_to_date', header: 'Approved',
      render: c => (
        <span style={{ fontFamily: 'monospace', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
          AED {Number(c.total_approved_to_date).toLocaleString()}
        </span>
      ),
    },
    {
      key: 'total_paid_to_date', header: 'Paid',
      render: c => (
        <span style={{ fontFamily: 'monospace', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
          AED {Number(c.total_paid_to_date).toLocaleString()}
        </span>
      ),
    },
    {
      key: 'contract_status', header: 'Status',
      render: c => <Badge variant={CONTRACT_STATUS[c.contract_status] ?? 'default'}>{STATUS_LABEL[c.contract_status] || c.contract_status}</Badge>,
    },
    {
      key: 'start_date', header: 'Period',
      render: c => (
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
          {c.start_date ?? '—'}{c.end_date ? ` → ${c.end_date}` : ''}
        </span>
      ),
    },
    {
      key: 'actions', header: '',
      render: c => (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <Link href={`/subcontractors/contracts/${c.id}`}>
            <Button variant="view" size="sm">View</Button>
          </Link>
          {!['closed', 'terminated', 'completed'].includes(c.contract_status) && (
            <Link href={`/subcontractors/contracts/${c.id}/edit`}>
              <Button variant="secondary" size="sm">Edit</Button>
            </Link>
          )}
          {c.contract_status === 'draft' && (
            <Button variant="secondary" size="sm"
              onClick={() => reviewMutation.mutate(c.id)}
              disabled={reviewMutation.isPending}>
              Submit
            </Button>
          )}
          {c.contract_status === 'under_review' && (
            <Button variant="primary" size="sm"
              onClick={() => approveMutation.mutate(c.id)}
              disabled={approveMutation.isPending}>
              Approve
            </Button>
          )}
          {c.contract_status === 'approved' && (
            <Button variant="primary" size="sm"
              onClick={() => activateMutation.mutate(c.id)}
              disabled={activateMutation.isPending}>
              Activate
            </Button>
          )}
          {(c.contract_status === 'draft' || c.contract_status === 'under_review') && (
            <Button variant="destructive" size="sm"
              onClick={() => setRejectDialog({ id: c.id, reason: '' })}>
              Reject
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
          title="Subcontractor Contracts"
          count={totalCount}
          breadcrumbs={[
            { label: 'Subcontractors', href: '/subcontractors' },
            { label: 'Contracts' },
          ]}
          actions={
            <Link href="/subcontractors/contracts/new">
              <Button variant="primary">+ New Contract</Button>
            </Link>
          }
        />

        <TableShell
          tableState={tableState}
          filterFields={filterFields}
          filterSaveKey="subcon-contracts"
          searchPlaceholder="Search by contract number, title, subcontractor..."
          columns={columns}
          data={rows}
          isLoading={isLoading}
          error={error}
          onRetry={refetch}
          emptyMessage="No contracts found."
          totalCount={totalCount}
          paginatedData={data}
          selectable={isSuperuser}
          toolbarActions={
            isSuperuser && selectedItems.size > 0 ? (
              <>
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                  {selectedItems.size} selected
                </span>
                <Button variant="destructive" size="sm"
                  onClick={async () => { if (await confirm(`Delete ${selectedItems.size} contracts?`)) deleteMutation.mutate([...selectedItems]); }}
                  disabled={deleteMutation.isPending}>
                  {deleteMutation.isPending ? 'Deleting…' : 'Delete Selected'}
                </Button>
                <Button variant="secondary" size="sm" onClick={clearSelection}>Clear</Button>
              </>
            ) : undefined
          }
        />
      </PageShell>

      {/* Reject dialog */}
      {rejectDialog && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 50,
          background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            background: 'var(--surface-primary)', borderRadius: 10,
            padding: 24, width: '100%', maxWidth: 440,
            boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
          }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 'var(--text-lg)', fontWeight: 700 }}>Reject Contract</h3>
            <p style={{ margin: '0 0 16px', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
              Please provide a reason for rejecting this contract.
            </p>
            <textarea
              value={rejectDialog.reason}
              onChange={e => setRejectDialog(d => d ? { ...d, reason: e.target.value } : null)}
              rows={3}
              placeholder="Enter rejection reason..."
              style={{
                width: '100%', padding: '8px 12px', borderRadius: 6,
                border: '1px solid var(--border-default)',
                background: 'var(--surface-secondary)', color: 'var(--text-primary)',
                fontSize: 'var(--text-sm)', resize: 'vertical', boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <Button variant="secondary" size="sm" onClick={() => setRejectDialog(null)}>Cancel</Button>
              <Button variant="destructive" size="sm"
                disabled={!rejectDialog.reason.trim() || rejectMutation.isPending}
                onClick={() => rejectMutation.mutate({ id: rejectDialog.id, reason: rejectDialog.reason })}>
                {rejectMutation.isPending ? 'Rejecting…' : 'Reject Contract'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
