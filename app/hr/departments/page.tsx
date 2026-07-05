'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppListPage } from '@/components/app/AppListPage';
import { useTableState } from '@/lib/hooks/use-table-state';
import { type Column } from '@/components/ui/DataTable';
import { RowActions } from '@/components/ui/RowActions';
import { Button, Drawer } from '@/components/ui';
import { toast, confirm } from '@/lib/hooks/use-toast';
import { useMyPermissions } from '@/lib/hooks/use-my-permissions';
import { hrDepartmentsApi } from '@/lib/api/hr';
import { HRDepartment } from '@/types';

export default function DepartmentsPage() {
  const queryClient = useQueryClient();
  const { hasPermission } = useMyPermissions();
  const isAdmin = hasPermission('hr.hr_employee.view');

  const tableState = useTableState();
  const { search } = tableState;

  const [drawerOpen, setDrawerOpen]   = useState(false);
  const [editingDept, setEditingDept] = useState<HRDepartment | null>(null);
  const [form, setForm]               = useState({ name: '', name_ar: '', description: '' });

  const { data: raw, isLoading, error } = useQuery({
    queryKey: ['hr-departments'],
    queryFn: () => hrDepartmentsApi.getAll({ page_size: 200 }),
    staleTime: 60_000,
  });

  const all      = raw?.results ?? [];
  const filtered = !search
    ? all
    : all.filter((d: HRDepartment) =>
        d.name.toLowerCase().includes(search.toLowerCase()) ||
        (d.description ?? '').toLowerCase().includes(search.toLowerCase()),
      );

  const createMutation = useMutation({
    mutationFn: (data: Partial<HRDepartment>) => hrDepartmentsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-departments'] });
      setDrawerOpen(false);
      toast('Department created', 'success');
    },
    onError: () => toast('Failed to create department', 'error'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<HRDepartment> }) =>
      hrDepartmentsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-departments'] });
      setDrawerOpen(false);
      toast('Department updated', 'success');
    },
    onError: () => toast('Failed to update department', 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => hrDepartmentsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-departments'] });
      toast('Department deleted', 'success');
    },
    onError: () => toast('Failed to delete department', 'error'),
  });

  const openCreate = () => {
    setEditingDept(null);
    setForm({ name: '', name_ar: '', description: '' });
    setDrawerOpen(true);
  };

  const openEdit = (dept: HRDepartment) => {
    setEditingDept(dept);
    setForm({ name: dept.name, name_ar: dept.name_ar, description: dept.description });
    setDrawerOpen(true);
  };

  const handleSaveForm = async () => {
    if (!form.name.trim()) { toast('Name is required', 'error'); return; }
    if (editingDept) updateMutation.mutate({ id: editingDept.id, data: form });
    else createMutation.mutate(form);
  };

  const columns: Column<HRDepartment>[] = [
    {
      key: 'name',
      header: 'Name',
      render: r => (
        <span style={{ fontWeight: 'var(--weight-semibold)' }}>{r.name}</span>
      ),
    },
    {
      key: 'name_ar',
      header: 'Name (AR)',
      render: r => r.name_ar
        ? <span style={{ direction: 'rtl', display: 'block' }}>{r.name_ar}</span>
        : <span style={{ color: 'var(--text-tertiary)' }}>—</span>,
    },
    {
      key: 'description',
      header: 'Description',
      render: r => r.description
        ? <span style={{ color: 'var(--text-secondary)' }}>{r.description}</span>
        : <span style={{ color: 'var(--text-tertiary)' }}>—</span>,
    },
    {
      key: 'parent_name',
      header: 'Parent',
      render: r => r.parent_name
        ? <span style={{ color: 'var(--text-secondary)' }}>{r.parent_name}</span>
        : <span style={{ color: 'var(--text-tertiary)' }}>—</span>,
    },
    {
      key: 'manager_name',
      header: 'Manager',
      render: r => r.manager_name
        ? <span>{r.manager_name}</span>
        : <span style={{ color: 'var(--text-tertiary)' }}>—</span>,
    },
    {
      key: 'employee_count',
      header: 'Members',
      render: r => (
        <span style={{ color: 'var(--text-secondary)' }}>
          {r.employee_count} {r.employee_count === 1 ? 'member' : 'members'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: r => (
        <RowActions actions={[
          { label: 'Edit', onClick: () => openEdit(r), hidden: !isAdmin },
          { label: 'Delete', variant: 'danger', hidden: !isAdmin, onClick: async () => {
            if (await confirm(`Delete department "${r.name}"?`)) deleteMutation.mutate(r.id);
          }},
        ]} />
      ),
    },
  ];

  return (
    <AppListPage
      title="Departments"
      description="Organisational units — structure, hierarchy, headcount"
      breadcrumbs={[{ label: 'HR' }, { label: 'Departments' }]}
      totalCount={all.length}
      createAction={isAdmin
        ? <Button variant="primary" size="sm" onClick={openCreate}>+ New Department</Button>
        : undefined}
      columns={columns}
      data={filtered}
      isLoading={isLoading}
      error={error}
      emptyTitle="No departments found."
      tableState={tableState}
      searchPlaceholder="Search departments..."
    >
      <Drawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editingDept ? 'Edit Department' : 'New Department'}
        footer={<>
          <Button variant="secondary" onClick={() => setDrawerOpen(false)}>Cancel</Button>
          <Button
            variant="primary"
            onClick={handleSaveForm}
            isLoading={createMutation.isPending || updateMutation.isPending}
          >
            {editingDept ? 'Save' : 'Create'}
          </Button>
        </>}
      >
        <div className="form-field">
          <label className="form-label">Name (EN)</label>
          <input
            className="form-input"
            value={form.name}
            onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
            placeholder="e.g. Engineering"
          />
        </div>
        <div className="form-field" style={{ marginTop: 'var(--space-4)' }}>
          <label className="form-label">Name (AR)</label>
          <input
            className="form-input"
            dir="rtl"
            value={form.name_ar}
            onChange={e => setForm(p => ({ ...p, name_ar: e.target.value }))}
            placeholder="مثال: الهندسة"
          />
        </div>
        <div className="form-field" style={{ marginTop: 'var(--space-4)' }}>
          <label className="form-label">Description</label>
          <textarea
            className="form-textarea"
            rows={3}
            value={form.description}
            onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
          />
        </div>
      </Drawer>
    </AppListPage>
  );
}
