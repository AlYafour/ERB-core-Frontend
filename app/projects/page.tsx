'use client';

import { useState, useRef } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '@/lib/api/projects';
import { Project } from '@/types';
import Link from 'next/link';
import { toast } from '@/lib/hooks/use-toast';
import { confirm } from '@/lib/hooks/use-toast';
import { useAuth } from '@/lib/hooks/use-auth';
import { usePermissions } from '@/lib/hooks/use-permissions';
import { Button, Badge, PageHeader, PageShell, TableShell, type Column } from '@/components/ui';
import { exportToExcel, fetchAllPages } from '@/lib/utils/export-excel';
import BilingualName from '@/components/domain/BilingualName';
import { useT } from '@/lib/i18n/useT';
import { useTableState } from '@/lib/hooks/use-table-state';
import { PROJECT_STATUS } from '@/lib/utils/status-colors';

const STATUS_LABEL: Record<string, string> = {
  on_going: 'On Going', completed: 'Completed', on_hold: 'On Hold', cancelled: 'Cancelled',
};

export default function ProjectsPage() {
  const tableState = useTableState();
  const { page, search, selectedItems, clearSelection } = tableState;

  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);

  const queryClient = useQueryClient();
  const { user }    = useAuth();
  const t           = useT();
  const { hasPermission } = usePermissions();
  const isSuperuser = user?.is_superuser ?? false;
  const isAdmin     = isSuperuser || user?.role === 'super_admin' || user?.is_staff;
  const canCreate   = isSuperuser || (hasPermission('project', 'create') ?? false);
  const canDelete   = isSuperuser;

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const all = await fetchAllPages<Project>((p, ps) => projectsApi.getAll({ page: p, page_size: ps, search }));
      await exportToExcel<Project>(
        all,
        [
          { header: 'Code',           key: 'code',           width: 15 },
          { header: 'Name',           key: 'name',           width: 40 },
          { header: 'Name AR',        key: 'name_ar',        width: 40 },
          { header: 'Location',       key: 'location',       width: 30 },
          { header: 'Contact Person', key: 'contact_person', width: 25 },
          { header: 'Mobile Number',  key: 'mobile_number',  width: 18 },
          { header: 'Sector',         key: 'sector',         width: 20 },
          { header: 'Plot',           key: 'plot',           width: 15 },
          { header: 'Consultant',     key: 'consultant',     width: 25 },
          { header: 'Status',         key: 'project_status', width: 15 },
          { header: 'Active',         key: (r) => r.is_active ? 'Yes' : 'No', width: 10 },
          { header: 'Description',    key: 'description',    width: 40 },
        ],
        `Projects_Export_${new Date().toISOString().slice(0, 10)}`,
        'Projects',
      );
      toast(`Exported ${all.length} projects`, 'success');
    } catch {
      toast('Export failed', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setIsImporting(true);
    try {
      const result = await projectsApi.importExcel(file);
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast(`Import done: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped`, 'success');
    } catch {
      toast('Import failed', 'error');
    } finally {
      setIsImporting(false);
    }
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ['projects', page, search],
    queryFn:  () => projectsApi.getAll({ page, search }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => projectsApi.delete(id),
    onSuccess:  () => { queryClient.invalidateQueries({ queryKey: ['projects'] }); toast('Project deleted', 'success'); },
    onError:    () => toast('Failed to delete project', 'error'),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: number[]) => { await Promise.all(ids.map(id => projectsApi.delete(id))); },
    onSuccess:  () => { queryClient.invalidateQueries({ queryKey: ['projects'] }); toast(`${selectedItems.size} projects deleted`, 'success'); clearSelection(); },
    onError:    () => toast('Failed to delete some projects', 'error'),
  });

  const handleDelete = async (id: number) => { if (await confirm('Delete this project?')) deleteMutation.mutate(id); };
  const handleBulkDelete = async () => {
    if (selectedItems.size && await confirm(`Delete ${selectedItems.size} project(s)?`))
      bulkDeleteMutation.mutate(Array.from(selectedItems));
  };

  const projects   = Array.isArray(data?.results) ? data!.results : [];
  const totalCount = data?.count ?? 0;

  const columns: Column<Project>[] = [
    {
      key: 'code', header: 'Code',
      render: p => <span className="font-mono" style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{p.code}</span>,
    },
    {
      key: 'name', header: 'Name',
      render: p => (
        <Link href={`/projects/view/${p.id}`} className="font-medium" style={{ color: 'var(--text-brand)' }}>
          <BilingualName nameEn={p.name} nameAr={p.name_ar} />
        </Link>
      ),
    },
    { key: 'location', header: 'Location', render: p => <span style={{ color: 'var(--text-secondary)' }}>{p.location || '—'}</span> },
    { key: 'status',   header: 'Status',   render: p => <Badge variant={PROJECT_STATUS[p.project_status] ?? 'info'}>{STATUS_LABEL[p.project_status] || p.project_status}</Badge> },
    { key: 'active',   header: 'Active',   render: p => <Badge variant={p.is_active ? 'success' : 'error'}>{p.is_active ? 'Yes' : 'No'}</Badge> },
    {
      key: 'actions', header: t('col', 'actions'),
      render: p => (
        <div className="flex gap-2">
          <Link href={`/projects/view/${p.id}`}><Button variant="view" size="sm">View</Button></Link>
          <Link href={`/projects/${p.id}`}><Button variant="edit" size="sm">Edit</Button></Link>
          {canDelete && <Button variant="delete" size="sm" onClick={() => handleDelete(p.id)} isLoading={deleteMutation.isPending}>{t('btn', 'delete')}</Button>}
        </div>
      ),
    },
  ];

  return (
    <MainLayout>
      <PageShell>
        <PageHeader
          title="Projects"
          count={totalCount}
          breadcrumbs={[{ label: 'Projects' }]}
          actions={
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={handleExport} isLoading={isExporting}>
                {isExporting ? t('btn', 'exporting') : `⬇ ${t('btn', 'export')}`}
              </Button>
              {isAdmin && (
                <>
                  <input ref={importFileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} />
                  <Button variant="secondary" onClick={() => importFileRef.current?.click()} isLoading={isImporting}>
                    {isImporting ? t('btn', 'importing') : `⬆ ${t('btn', 'import')}`}
                  </Button>
                </>
              )}
              {canCreate && <Link href="/projects/new"><Button variant="primary">+ New Project</Button></Link>}
            </div>
          }
        />
        <TableShell
          tableState={tableState}
          searchPlaceholder="Search projects..."
          toolbarActions={
            canDelete && selectedItems.size > 0 ? (
              <Button variant="destructive" onClick={handleBulkDelete} isLoading={bulkDeleteMutation.isPending}>
                {t('btn', 'delete')} {selectedItems.size}
              </Button>
            ) : undefined
          }
          columns={columns}
          data={projects}
          isLoading={isLoading}
          error={error}
          emptyMessage="No projects found."
          emptyAction={canCreate ? <Link href="/projects/new"><Button variant="primary">Create Project</Button></Link> : undefined}
          selectable={isAdmin}
          totalCount={totalCount}
          paginatedData={data}
        />
      </PageShell>
    </MainLayout>
  );
}
