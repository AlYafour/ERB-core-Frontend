'use client';

import { useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { hrDepartmentsApi } from '@/lib/api/hr';
import { HRDepartment } from '@/types';
import { toast } from '@/lib/hooks/use-toast';
import { confirm } from '@/lib/hooks/use-toast';
import { useAuth } from '@/lib/hooks/use-auth';
import { Button, Loader, PageHeader, SearchInput, Drawer, PageShell } from '@/components/ui';

export default function DepartmentsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = !!(user?.role === 'admin' || user?.role === 'super_admin' || user?.is_staff || user?.is_superuser);

  const [search, setSearch]           = useState('');
  const [drawerOpen, setDrawerOpen]   = useState(false);
  const [editingDept, setEditingDept] = useState<HRDepartment | null>(null);
  const [form, setForm]               = useState({ name: '', name_ar: '', description: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['hr-departments', search],
    queryFn: () => hrDepartmentsApi.getAll({ search }),
  });

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
    mutationFn: hrDepartmentsApi.delete,
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

  const handleDelete = async (dept: HRDepartment) => {
    const ok = await confirm(`Delete department "${dept.name}"?`);
    if (ok) deleteMutation.mutate(dept.id);
  };

  return (
    <MainLayout>
      <PageShell>
        <PageHeader
          title="Departments"
          description="Organisational units — structure, hierarchy, headcount"
          count={data?.results?.length ?? null}
          breadcrumbs={[{ label: 'HR' }, { label: 'Departments' }]}
          actions={isAdmin ? <Button variant="primary" onClick={openCreate}>+ New Department</Button> : undefined}
        />

        <SearchInput
          placeholder="Search departments..."
          value={search}
          onChange={setSearch}
        />

        {isLoading ? <Loader /> : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 'var(--space-3)',
            marginTop: 'var(--space-3)',
          }}>
            {data?.results?.length === 0 && (
              <p style={{
                fontSize: 'var(--text-sm)', color: 'var(--text-secondary)',
                gridColumn: '1 / -1', textAlign: 'center', padding: 'var(--space-8) 0',
              }}>
                No departments found.
              </p>
            )}
            {data?.results?.map((dept: HRDepartment) => (
              <div key={dept.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
                  <p style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', margin: 0 }}>
                    {dept.name}
                  </p>
                  {isAdmin && (
                    <div style={{ display: 'flex', gap: 'var(--space-1)', flexShrink: 0 }}>
                      <button
                        onClick={() => openEdit(dept)}
                        style={{ fontSize: 'var(--text-xs)', padding: '2px var(--space-2)', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)', background: 'var(--surface-subtle)', border: 'none', cursor: 'pointer' }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(dept)}
                        style={{ fontSize: 'var(--text-xs)', padding: '2px var(--space-2)', borderRadius: 'var(--radius-sm)', color: 'var(--color-error)', background: 'var(--surface-subtle)', border: 'none', cursor: 'pointer' }}
                      >
                        Del
                      </button>
                    </div>
                  )}
                </div>
                {dept.description && (
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: 0 }}>
                    {dept.description}
                  </p>
                )}
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: 0, marginTop: 'auto', paddingTop: 'var(--space-1)' }}>
                  {dept.employee_count} {dept.employee_count === 1 ? 'member' : 'members'}
                  {dept.manager_name ? ` · ${dept.manager_name}` : ''}
                  {dept.parent_name ? ` · ${dept.parent_name}` : ''}
                </p>
              </div>
            ))}
          </div>
        )}
      </PageShell>

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
          <input className="form-input" value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Engineering" />
        </div>
        <div className="form-field" style={{ marginTop: 'var(--space-4)' }}>
          <label className="form-label">Name (AR)</label>
          <input className="form-input" dir="rtl" value={form.name_ar} onChange={(e) => setForm(p => ({ ...p, name_ar: e.target.value }))} placeholder="مثال: الهندسة" />
        </div>
        <div className="form-field" style={{ marginTop: 'var(--space-4)' }}>
          <label className="form-label">Description</label>
          <textarea className="form-textarea" rows={3} value={form.description} onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))} />
        </div>
      </Drawer>
    </MainLayout>
  );
}
