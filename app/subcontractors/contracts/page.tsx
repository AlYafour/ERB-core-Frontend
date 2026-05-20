'use client';

import MainLayout from '@/components/layout/MainLayout';
import { useQuery } from '@tanstack/react-query';
import { subcontractorsApi, SubcontractorContract } from '@/lib/api/subcontractors';
import Link from 'next/link';
import { Button, Badge, PageHeader, PageShell, TableShell, type Column } from '@/components/ui';
import { type FilterField } from '@/components/ui/FilterPanel';
import { useTableState } from '@/lib/hooks/use-table-state';
import { CONTRACT_STATUS } from '@/lib/utils/status-colors';

const CONTRACT_STATUS_LABEL: Record<string, string> = {
  draft: 'Draft', under_review: 'Under Review', approved: 'Approved',
  active: 'Active', on_hold: 'On Hold', completed: 'Completed',
  closed: 'Closed', terminated: 'Terminated',
};

const filterFields: FilterField[] = [
  {
    name: 'contract_status', label: 'Status', type: 'select', group: 'Contract',
    options: Object.entries(CONTRACT_STATUS_LABEL).map(([value, label]) => ({ value, label })),
  },
];

export default function ContractsPage() {
  const tableState = useTableState();
  const { page, search, filters } = tableState;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['subcon-contracts', page, search, filters],
    queryFn: () => subcontractorsApi.contracts.list({ page, search: search || undefined, ...filters }),
  });

  const rows       = data?.results ?? [];
  const totalCount = data?.count ?? 0;

  const columns: Column<SubcontractorContract>[] = [
    {
      key: 'contract_no', header: 'Contract No.',
      render: c => <span style={{ fontFamily: 'monospace', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{c.contract_no}</span>,
    },
    {
      key: 'contract_title', header: 'Title',
      render: c => (
        <div>
          <div className="font-medium" style={{ color: 'var(--text-primary)' }}>{c.contract_title}</div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{c.subcontractor_name}</div>
        </div>
      ),
    },
    {
      key: 'contract_value', header: 'Contract Value',
      render: c => (
        <span style={{ fontFamily: 'monospace', fontSize: 'var(--text-sm)' }}>
          AED {Number(c.contract_value).toLocaleString()}
        </span>
      ),
    },
    {
      key: 'total_approved_to_date', header: 'Approved to Date',
      render: c => (
        <span style={{ fontFamily: 'monospace', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
          AED {Number(c.total_approved_to_date).toLocaleString()}
        </span>
      ),
    },
    {
      key: 'contract_status', header: 'Status',
      render: c => <Badge variant={CONTRACT_STATUS[c.contract_status] ?? 'default'}>{CONTRACT_STATUS_LABEL[c.contract_status] || c.contract_status}</Badge>,
    },
    {
      key: 'start_date', header: 'Period',
      render: c => (
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
          {c.start_date ?? '—'} {c.end_date ? `→ ${c.end_date}` : ''}
        </span>
      ),
    },
    {
      key: 'actions', header: '',
      render: c => (
        <Link href={`/subcontractors/contracts/${c.id}`}>
          <Button variant="view" size="sm">View</Button>
        </Link>
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
        />
      </PageShell>
    </MainLayout>
  );
}
