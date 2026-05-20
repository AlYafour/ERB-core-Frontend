'use client';

import MainLayout from '@/components/layout/MainLayout';
import { useQuery } from '@tanstack/react-query';
import { subcontractorsApi, Subcontractor } from '@/lib/api/subcontractors';
import Link from 'next/link';
import { useT } from '@/lib/i18n/useT';
import { Button, Badge, PageHeader, PageShell, TableShell, type Column } from '@/components/ui';
import { type FilterField } from '@/components/ui/FilterPanel';
import { useTableState } from '@/lib/hooks/use-table-state';
import { SUBCON_STATUS } from '@/lib/utils/status-colors';

const STATUS_LABEL: Record<string, string> = { active: 'Active', inactive: 'Inactive' };

const filterFields: FilterField[] = [
  {
    name: 'status', label: 'Status', type: 'select', group: 'Subcontractor',
    options: [{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }],
  },
];

export default function SubcontractorsPage() {
  const tableState = useTableState();
  const { page, search, filters } = tableState;
  const t = useT();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['subcontractors', page, search, filters],
    queryFn: () => subcontractorsApi.list({ page, search: search || undefined, ...filters }),
  });

  const rows       = data?.results ?? [];
  const totalCount = data?.count ?? 0;

  const columns: Column<Subcontractor>[] = [
    {
      key: 'company_name', header: 'Company Name',
      render: s => (
        <div>
          <div className="font-medium" style={{ color: 'var(--text-primary)' }}>{s.company_name}</div>
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
      key: 'total_contract_value', header: 'Total Value',
      render: s => (
        <span style={{ fontFamily: 'monospace', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
          {s.total_contract_value ? `AED ${Number(s.total_contract_value).toLocaleString()}` : '—'}
        </span>
      ),
    },
    {
      key: 'status', header: t('col', 'status'),
      render: s => <Badge variant={SUBCON_STATUS[s.status] ?? 'default'}>{STATUS_LABEL[s.status] || s.status}</Badge>,
    },
    {
      key: 'actions', header: t('col', 'actions'),
      render: s => (
        <Link href={`/subcontractors/${s.id}`}>
          <Button variant="view" size="sm">{t('btn', 'view')}</Button>
        </Link>
      ),
    },
  ];

  return (
    <MainLayout>
      <PageShell>
        <PageHeader
          title="Subcontractors"
          count={totalCount}
          breadcrumbs={[{ label: 'Subcontractors' }]}
          actions={
            <Link href="/subcontractors/new">
              <Button variant="primary">+ Add Subcontractor</Button>
            </Link>
          }
        />
        <TableShell
          tableState={tableState}
          filterFields={filterFields}
          filterSaveKey="subcontractors"
          searchPlaceholder="Search by company name, contact, email..."
          columns={columns}
          data={rows}
          isLoading={isLoading}
          error={error}
          onRetry={refetch}
          emptyMessage="No subcontractors found."
          emptyAction={
            <Link href="/subcontractors/new">
              <Button variant="primary">+ Add Subcontractor</Button>
            </Link>
          }
          totalCount={totalCount}
          paginatedData={data}
        />
      </PageShell>
    </MainLayout>
  );
}
