'use client';

import { Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import { subcontractorsApi, Subcontractor } from '@/lib/api/subcontractors';
import Link from 'next/link';
import { Button, Badge } from '@/components/ui';
import { type FilterField } from '@/components/ui/FilterPanel';
import { useListState } from '@/lib/hooks/use-list-state';
import { SUBCON_STATUS } from '@/lib/utils/status-colors';
import { EnterpriseListPage, type EnterpriseColumn } from '@/components/ui/enterprise';

const STATUS_LABEL: Record<string, string> = { active: 'Active', inactive: 'Inactive' };

const filterFields: FilterField[] = [
  {
    name: 'status', label: 'Status', type: 'select', group: 'Subcontractor',
    options: [{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }],
  },
];

const columns: EnterpriseColumn<Subcontractor>[] = [
  {
    key: 'company_name', header: 'Company Name',
    sortable: true, mobileMain: true, minWidth: 180,
    render: s => (
      <div>
        <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{s.company_name}</div>
        {s.trade_type_name && (
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{s.trade_type_name}</div>
        )}
      </div>
    ),
  },
  {
    key: 'contact_person', header: 'Contact', minWidth: 140,
    render: s => (
      <div>
        {s.contact_person && <div style={{ color: 'var(--text-primary)' }}>{s.contact_person}</div>}
        {s.mobile && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{s.mobile}</div>}
      </div>
    ),
  },
  {
    key: 'email', header: 'Email', minWidth: 160,
    render: s => <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>{s.email || '—'}</span>,
  },
  {
    key: 'active_contracts_count', header: 'Active Contracts', align: 'center', width: 140,
    render: s => (
      <Badge variant={s.active_contracts_count > 0 ? 'info' : 'default'}>
        {s.active_contracts_count}
      </Badge>
    ),
  },
  {
    key: 'total_contract_value', header: 'Total Value', align: 'right', sortable: true, width: 150,
    render: s => (
      <span style={{ fontFamily: 'monospace', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
        {s.total_contract_value ? `AED ${Number(s.total_contract_value).toLocaleString()}` : '—'}
      </span>
    ),
  },
  {
    key: 'status', header: 'Status', width: 100,
    render: s => <Badge variant={SUBCON_STATUS[s.status] ?? 'default'}>{STATUS_LABEL[s.status] || s.status}</Badge>,
  },
  {
    key: 'actions', header: '', width: 80, hideable: false,
    render: s => (
      <Link href={`/subcontractors/${s.id}`}>
        <Button variant="view" size="sm">View</Button>
      </Link>
    ),
  },
];

function SubcontractorsContent() {
  const listState = useListState('subcontractors');
  const { page, search, filters, pageSize } = listState;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['subcontractors', page, pageSize, search, filters],
    queryFn: () => subcontractorsApi.list({ page, page_size: pageSize, search: search || undefined, ...filters }),
  });

  const rows       = data?.results ?? [];
  const totalCount = data?.count ?? 0;

  const kpiCards = [
    { label: 'Total', value: totalCount, variant: 'default' as const },
    {
      label: 'Active', variant: 'success' as const,
      value: rows.filter(s => s.status === 'active').length,
      sub: totalCount > 0 ? `${Math.round(rows.filter(s => s.status === 'active').length / Math.max(rows.length, 1) * 100)}% of page` : undefined,
    },
    {
      label: 'Inactive', variant: 'warning' as const,
      value: rows.filter(s => s.status === 'inactive').length,
    },
  ];

  return (
    <EnterpriseListPage
      title="Subcontractors"
      breadcrumbs={[{ label: 'Subcontractors' }]}
      primaryAction={
        <Link href="/subcontractors/new">
          <Button variant="primary">+ Add Subcontractor</Button>
        </Link>
      }
      kpiCards={kpiCards}
      listState={listState}
      filterFields={filterFields}
      filterSaveKey="subcontractors"
      searchPlaceholder="Search by company name, contact, email..."
      columns={columns}
      data={rows}
      totalCount={totalCount}
      isLoading={isLoading}
      error={error}
      onRefetch={refetch}
      paginatedData={data}
      emptyMessage="No subcontractors found."
      emptyAction={
        <Link href="/subcontractors/new">
          <Button variant="primary">+ Add Subcontractor</Button>
        </Link>
      }
    />
  );
}

export default function SubcontractorsPage() {
  return <Suspense><SubcontractorsContent /></Suspense>;
}
