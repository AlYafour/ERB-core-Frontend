'use client';

import { useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { hrDepartmentsApi } from '@/lib/api/hr';
import { permissionsApi, Permission } from '@/lib/api/permissions';
import { HRDepartment } from '@/types';
import { toast } from '@/lib/hooks/use-toast';
import { confirm } from '@/lib/hooks/use-toast';
import { useAuth } from '@/lib/hooks/use-auth';
import { Button, Loader, Badge, Checkbox, PageHeader, SearchInput, Drawer, PageShell } from '@/components/ui';

const CATEGORY_LABELS: Record<string, string> = {
  purchase_request:   'Purchase Request',
  quotation_request:  'Quotation Request',
  purchase_quotation: 'Purchase Quotation',
  purchase_order:     'Purchase Order',
  goods_receiving:    'Goods Receiving',
  purchase_invoice:   'Invoice',
  supplier:           'Suppliers',
  product:            'Products',
  project:            'Projects',
  user:               'Users',
  settings:           'Settings',
};

const ACTION_LABELS: Record<string, string> = {
  create: 'Create', view: 'View', update: 'Update', delete: 'Delete',
  approve: 'Approve', reject: 'Reject', cancel: 'Cancel',
  award: 'Award', convert: 'Convert to PO', mark_paid: 'Mark Paid',
};

export default function RolesPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === 'super_admin' || user?.is_staff || user?.is_superuser;

  const [selected, setSelected]     = useState<HRDepartment | null>(null);
  const [search, setSearch]         = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<HRDepartment | null>(null);
  const [form, setForm]             = useState({ name: '', name_ar: '', description: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['hr-departments', search],
    queryFn: () => hrDepartmentsApi.getAll({ search }),
  });

  const { data: permsByCategory, isLoading: loadingPerms } = useQuery({
    queryKey: ['permissions', 'by-category'],
    queryFn:  () => permissionsApi.getPermissionsByCategory(),
  });

  const { data: selectedSetDetail } = useQuery({
    queryKey: ['permission-set', selected?.permission_set_id],
    queryFn:  () => permissionsApi.getPermissionSetById(selected!.permission_set_id!),
    enabled:  !!selected?.permission_set_id,
  });

  const assignMutation = useMutation({
    mutationFn: ({ id, ids }: { id: number; ids: number[] }) =>
      hrDepartmentsApi.assignPermissions(id, ids),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['hr-departments'] });
      queryClient.invalidateQueries({ queryKey: ['permission-set', updated.permission_set_id] });
      setSelected(updated);
      toast('Permissions saved', 'success');
    },
    onError: () => toast('Failed to save permissions', 'error'),
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<HRDepartment>) => hrDepartmentsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-departments'] });
      setDrawerOpen(false);
      toast('Role created', 'success');
    },
    onError: () => toast('Failed to create role', 'error'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<HRDepartment> }) =>
      hrDepartmentsApi.update(id, data),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['hr-departments'] });
      setSelected(updated);
      setDrawerOpen(false);
      toast('Role updated', 'success');
    },
    onError: () => toast('Failed to update role', 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: hrDepartmentsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-departments'] });
      if (selected) setSelected(null);
      toast('Role deleted', 'success');
    },
    onError: () => toast('Failed to delete role', 'error'),
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

  const handleSaveForm = () => {
    if (!form.name.trim()) { toast('Name is required', 'error'); return; }
    if (editingDept) updateMutation.mutate({ id: editingDept.id, data: form });
    else createMutation.mutate(form);
  };

  const handleDelete = async (dept: HRDepartment) => {
    const ok = await confirm(`Delete role "${dept.name}"?`);
    if (ok) deleteMutation.mutate(dept.id);
  };

  const handlePermToggle = (permId: number, checked: boolean) => {
    if (!selected) return;
    const current = selectedSetDetail?.permissions.map((p) => p.id) ?? [];
    const next = checked ? [...current, permId] : current.filter((id) => id !== permId);
    assignMutation.mutate({ id: selected.id, ids: next });
  };

  return (
    <MainLayout>
      <PageShell>
        <PageHeader
          title="Roles"
          description="Each role is a department — assign permissions to control what its members can do"
          count={data?.results?.length ?? null}
          breadcrumbs={[{ label: 'HR' }, { label: 'Roles' }]}
          actions={isAdmin ? <Button variant="primary" onClick={openCreate}>+ New Role</Button> : undefined}
        />

        <div style={{ display: 'flex', gap: 'var(--space-5)', alignItems: 'flex-start' }}>

          {/* Left: role list */}
          <div style={{ width: 288, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <SearchInput
              placeholder="Search roles..."
              value={search}
              onChange={setSearch}
            />

            {isLoading ? <Loader /> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {data?.results?.length === 0 && (
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', textAlign: 'center', padding: 'var(--space-6) 0' }}>No roles found.</p>
                )}
                {data?.results?.map((dept: HRDepartment) => {
                  const isSelected = selected?.id === dept.id;
                  return (
                    <div
                      key={dept.id}
                      onClick={() => setSelected(dept)}
                      style={{
                        padding: 'var(--space-3)',
                        borderRadius: 'var(--radius-md)',
                        border: isSelected ? '2px solid var(--sidebar-active-text)' : '1px solid var(--border-subtle)',
                        background: isSelected ? 'var(--sidebar-active-bg)' : 'var(--card-bg)',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>{dept.name}</p>
                          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: 'var(--space-1)', marginBottom: 0 }}>
                            {dept.permissions_count} permissions · {dept.employee_count} members
                          </p>
                        </div>
                        {isAdmin && (
                          <div style={{ display: 'flex', gap: 'var(--space-1)', flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
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
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right: permissions grid */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {!selected ? (
              <div className="card empty-state">
                <p className="empty-state-title">Select a role to manage its permissions</p>
                <p className="empty-state-desc">Choose a role from the list on the left</p>
              </div>
            ) : (
              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-semibold)', margin: 0 }}>{selected.name}</h2>
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: 'var(--space-1)', marginBottom: 0 }}>
                      {selectedSetDetail?.permissions_count ?? 0} / {Object.values(permsByCategory || {}).flat().length} permissions active
                    </p>
                  </div>
                  {assignMutation.isPending && <Loader />}
                </div>

                {loadingPerms ? <Loader /> : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
                    {Object.entries(permsByCategory || {}).map(([category, perms]: [string, Permission[]]) => (
                      <div key={category}>
                        <h4 style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--space-2)', marginTop: 0 }}>
                          {CATEGORY_LABELS[category] || category}
                        </h4>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                          {perms.map((perm) => {
                            const isChecked = selectedSetDetail?.permissions.some((p) => p.id === perm.id) ?? false;
                            return (
                              <label
                                key={perm.id}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
                                  padding: 'var(--space-1-5) var(--space-3)',
                                  borderRadius: 'var(--radius-md)',
                                  cursor: 'pointer',
                                  fontSize: 'var(--text-sm)',
                                  border: isChecked ? '1px solid var(--sidebar-active-text)' : '1px solid transparent',
                                  background: isChecked ? 'var(--sidebar-active-bg)' : 'var(--surface-subtle)',
                                  color: isChecked ? 'var(--sidebar-active-text)' : 'inherit',
                                }}
                              >
                                <Checkbox
                                  checked={isChecked}
                                  onChange={(e) => handlePermToggle(perm.id, e.target.checked)}
                                  disabled={!isAdmin || assignMutation.isPending}
                                />
                                {ACTION_LABELS[perm.action] || perm.action}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </PageShell>

      <Drawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editingDept ? 'Edit Role' : 'New Role'}
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
          <input className="form-input" value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Procurement Team" />
        </div>
        <div className="form-field" style={{ marginTop: 'var(--space-4)' }}>
          <label className="form-label">Name (AR)</label>
          <input className="form-input" dir="rtl" value={form.name_ar} onChange={(e) => setForm(p => ({ ...p, name_ar: e.target.value }))} placeholder="مثال: فريق المشتريات" />
        </div>
        <div className="form-field" style={{ marginTop: 'var(--space-4)' }}>
          <label className="form-label">Description</label>
          <textarea className="form-textarea" rows={3} value={form.description} onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))} />
        </div>
      </Drawer>
    </MainLayout>
  );
}
