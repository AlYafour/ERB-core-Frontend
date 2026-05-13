'use client';

import MainLayout from '@/components/layout/MainLayout';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { goodsReceivingApi, GoodsReceivedNote } from '@/lib/api/goods-receiving';
import Link from 'next/link';
import { toast } from '@/lib/hooks/use-toast';
import { confirm } from '@/lib/hooks/use-toast';
import { useAuth } from '@/lib/hooks/use-auth';
import { usePermissions } from '@/lib/hooks/use-permissions';
import { Button, Badge, PageHeader, SearchInput, PageShell, WorkspaceSurface } from '@/components/ui';
import { useT } from '@/lib/i18n/useT';
import DataTable, { Column } from '@/components/ui/DataTable';
import { useTableState } from '@/lib/hooks/use-table-state';
import { GRN_STATUS } from '@/lib/utils/status-colors';

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft', partial: 'Partial', completed: 'Completed', cancelled: 'Cancelled',
};

export default function GoodsReceivingPage() {
  const { page, setPage, search, handleSearch } = useTableState();

  const queryClient    = useQueryClient();
  const { user }       = useAuth();
  const t              = useT();
  const { hasPermission } = usePermissions();
  const isSuperuser = user?.is_superuser ?? false;
  const canCreate   = isSuperuser || (hasPermission('goods_receiving', 'create') ?? false);
  const canDelete   = isSuperuser;

  const { data, isLoading, error } = useQuery({
    queryKey: ['grns', page, search],
    queryFn:  () => goodsReceivingApi.getAll({ page, search }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => goodsReceivingApi.delete(id),
    onSuccess:  () => { queryClient.invalidateQueries({ queryKey: ['grns'] }); toast('GRN deleted', 'success'); },
    onError:    () => toast('Failed to delete GRN', 'error'),
  });

  const handleDelete = async (id: number) => { if (await confirm('Delete this GRN?')) deleteMutation.mutate(id); };

  const grns       = Array.isArray(data?.results) ? data!.results : [];
  const totalCount = data?.count ?? 0;

  const columns: Column<GoodsReceivedNote>[] = [
    { key: 'number', header: 'GRN Number',     render: g => <span style={{ fontFamily: 'monospace', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)' }}>{g.grn_number}</span> },
    { key: 'po',     header: 'Purchase Order',  render: g => <span style={{ color: 'var(--text-secondary)' }}>{typeof g.purchase_order === 'object' && g.purchase_order ? (g.purchase_order as any).order_number : g.purchase_order_id}</span> },
    { key: 'date',   header: 'Receipt Date',    render: g => <span style={{ color: 'var(--text-secondary)' }}>{new Date(g.receipt_date).toLocaleDateString('en-US')}</span> },
    { key: 'items',  header: 'Total Items',     render: g => g.total_items ?? g.items?.length ?? 0 },
    { key: 'status', header: t('col', 'status'), render: g => <Badge variant={GRN_STATUS[g.status] ?? 'info'}>{STATUS_LABEL[g.status] || g.status}</Badge> },
    {
      key: 'invoice', header: 'Invoice',
      render: g => <Badge variant={g.invoice_delivery_status === 'delivered' ? 'success' : 'warning'}>{g.invoice_delivery_status === 'delivered' ? 'Delivered' : 'Pending'}</Badge>,
    },
    {
      key: 'actions', header: t('col', 'actions'),
      render: g => (
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <Link href={`/goods-receiving/${g.id}`}><Button variant="view" size="sm">{t('btn', 'view')}</Button></Link>
          <Link href={`/print/grn/${g.id}`} target="_blank"><Button variant="secondary" size="sm">Print</Button></Link>
          {canDelete && <Button variant="destructive" size="sm" onClick={() => handleDelete(g.id)}>{t('btn', 'delete')}</Button>}
        </div>
      ),
    },
  ];

  return (
    <MainLayout>
      <PageShell>
        <PageHeader
          breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Purchase Management', href: '#' }, { label: 'Goods Receiving' }]}
          title="Goods Receiving"
          description="Record and verify goods receipt against purchase orders."
          count={totalCount}
          actions={
            canCreate ? <Link href="/goods-receiving/new"><Button variant="primary">+ New GRN</Button></Link> : undefined
          }
        />
        <WorkspaceSurface
          toolbar={
            <>
              <SearchInput value={search} onChange={handleSearch} placeholder="Search GRN records…" width={260} />
              <div style={{ flex: 1 }} />
            </>
          }
        >
          <DataTable
            surface
            columns={columns}
            data={grns}
            isLoading={isLoading}
            error={error}
            emptyMessage="No goods receiving notes found."
            emptyAction={canCreate ? <Link href="/goods-receiving/new"><Button variant="primary">Create GRN</Button></Link> : undefined}
            page={page}
            totalCount={totalCount}
            pageSize={20}
            hasPrev={!!data?.previous}
            hasNext={!!data?.next}
            onPageChange={setPage}
          />
        </WorkspaceSurface>
      </PageShell>
    </MainLayout>
  );
}
