'use client';

import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { subcontractorsApi, Subcontractor } from '@/lib/api/subcontractors';
import Link from 'next/link';
import { Button, Badge, type Column } from '@/components/ui';
import { type FilterField } from '@/components/ui/FilterPanel';
import { useTableState } from '@/lib/hooks/use-table-state';
import { SUBCON_STATUS } from '@/lib/utils/status-colors';
import { AppListPage } from '@/components/app/AppListPage';

const STATUS_LABEL: Record<string, string> = { active: 'Active', inactive: 'Inactive' };

const filterFields: FilterField[] = [
  {
    name: 'status', label: 'Status', type: 'select', group: 'Subcontractor',
    options: [{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }],
  },
];

const columns: Column<Subcontractor>[] = [
  {
    key: 'company_name', header: 'Company Name', sortKey: 'company_name',
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
    key: 'contact_person', header: 'Contact',
    render: s => (
      <div>
        {s.contact_person && <div style={{ color: 'var(--text-primary)' }}>{s.contact_person}</div>}
        {s.mobile && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{s.mobile}</div>}
      </div>
    ),
  },
  {
    key: 'email', header: 'Email',
    render: s => <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>{s.email || '—'}</span>,
  },
  {
    key: 'active_contracts_count', header: 'Active Contracts',
    render: s => (
      <Badge variant={s.active_contracts_count > 0 ? 'info' : 'default'}>
        {s.active_contracts_count}
      </Badge>
    ),
  },
  {
    key: 'total_contract_value', header: 'Total Value', sortKey: 'total_contract_value',
    render: s => (
      <span style={{ fontFamily: 'monospace', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
        {s.total_contract_value ? `AED ${Number(s.total_contract_value).toLocaleString()}` : '—'}
      </span>
    ),
  },
  {
    key: 'status', header: 'Status',
    render: s => <Badge variant={SUBCON_STATUS[s.status] ?? 'default'}>{STATUS_LABEL[s.status] || s.status}</Badge>,
  },
  {
    key: 'actions', header: '',
    render: s => (
      <Link href={`/subcontractors/${s.id}`} onClick={e => e.stopPropagation()}>
        <Button variant="view" size="sm">View</Button>
      </Link>
    ),
  },
];

export default function SubcontractorsPage() {
  const router = useRouter();
  const tableState = useTableState({ key: 'subcontractors' });
  const { page, search, filters } = tableState;

  const { data, isLoading, error } = useQuery({
    queryKey: ['subcontractors', page, search, filters],
    queryFn: () => subcontractorsApi.list({ page, search: search || undefined, ...filters }),
  });

  const rows       = data?.results ?? [];
  const totalCount = data?.count ?? 0;

  return (
    <AppListPage
      title="Subcontractors"
      description="Manage subcontractors, their contracts and progress."
      breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Subcontractors' }]}
      totalCount={totalCount}
      createAction={
        <Link href="/subcontractors/new"><Button variant="primary">+ Add Subcontractor</Button></Link>
      }
      statusItems={[
        { value: '',         label: 'All', count: totalCount },
        { value: 'active',   label: 'Active' },
        { value: 'inactive', label: 'Inactive' },
      ]}
      filterFields={filterFields}
      searchPlaceholder="Search by company name, contact, email…"
      columns={columns}
      data={rows}
      isLoading={isLoading}
      error={error}
      onRowClick={s => router.push(`/subcontractors/${s.id}`)}
      tableState={tableState}
      paginatedData={data}
      pageSize={50}
      emptyTitle="No subcontractors found."
      emptyAction={
        <Link href="/subcontractors/new"><Button variant="primary">+ Add Subcontractor</Button></Link>
      }
    />
  );
}
