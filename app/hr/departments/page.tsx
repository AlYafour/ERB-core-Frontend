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
import { Button, TextField, Loader, Badge, Checkbox } from '@/components/ui';

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

const inp = 'w-full px-3 py-2 rounded-md border text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40';
const fld = 'flex flex-col gap-1';
const lbl = 'text-xs font-medium text-muted-foreground uppercase tracking-wide';

export default function RolesPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === 'super_admin' || user?.is_staff || user?.is_superuser;

  const [selected, setSelected]     = useState<HRDepartment | null>(null);
  const [search, setSearch]         = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<HRDepartment | null>(null);
  const [form, setForm]             = useState({ name: '', name_ar: '', description: '' });

  // ── Queries ────────────────────────────────────────────────────────────────
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

  // ── Mutations ──────────────────────────────────────────────────────────────
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

  // ── Handlers ──────────────────────────────────────────────────────────────
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

  const cardBase = 'p-3 rounded-lg border cursor-pointer transition-all';
  const cardSelected = `${cardBase} border-2` ;

  return (
    <MainLayout>
      <div className="space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Roles</h1>
            <p className="text-sm text-muted-foreground mt-1">Each role is a department — assign permissions to control what its members can do</p>
          </div>
          {isAdmin && (
            <Button variant="primary" onClick={openCreate}>+ New Role</Button>
          )}
        </div>

        <div className="flex gap-5 items-start">

          {/* ── LEFT: role list ── */}
          <div className="w-72 flex-shrink-0 space-y-3">
            <TextField
              placeholder="Search roles..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full"
            />

            {isLoading ? <Loader className="mx-auto" /> : (
              <div className="space-y-2">
                {data?.results?.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6">No roles found.</p>
                )}
                {data?.results?.map((dept: HRDepartment) => {
                  const isSelected = selected?.id === dept.id;
                  return (
                    <div
                      key={dept.id}
                      onClick={() => setSelected(dept)}
                      className={isSelected ? cardSelected : cardBase}
                      style={{
                        borderColor: isSelected ? 'var(--sidebar-active-text)' : 'var(--border)',
                        background: isSelected ? 'var(--sidebar-active-bg)' : 'var(--card)',
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{dept.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {dept.permissions_count} permissions · {dept.employee_count} members
                          </p>
                        </div>
                        {isAdmin && (
                          <div className="flex gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => openEdit(dept)}
                              className="text-xs px-2 py-0.5 rounded text-muted-foreground hover:text-foreground"
                              style={{ background: 'var(--muted)' }}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(dept)}
                              className="text-xs px-2 py-0.5 rounded text-destructive hover:opacity-80"
                              style={{ background: 'var(--muted)' }}
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

          {/* ── RIGHT: permissions grid ── */}
          <div className="flex-1 min-w-0">
            {!selected ? (
              <div className="card text-center py-20">
                <p className="text-muted-foreground text-sm">Select a role to manage its permissions</p>
              </div>
            ) : (
              <div className="card space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">{selected.name}</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {selectedSetDetail?.permissions_count ?? 0} / {Object.values(permsByCategory || {}).flat().length} permissions active
                    </p>
                  </div>
                  {assignMutation.isPending && <Loader />}
                </div>

                {loadingPerms ? <Loader className="mx-auto" /> : (
                  <div className="space-y-6">
                    {Object.entries(permsByCategory || {}).map(([category, perms]: [string, Permission[]]) => (
                      <div key={category}>
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                          {CATEGORY_LABELS[category] || category}
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {perms.map((perm) => {
                            const isChecked = selectedSetDetail?.permissions.some((p) => p.id === perm.id) ?? false;
                            return (
                              <label
                                key={perm.id}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-md cursor-pointer text-sm border transition-colors"
                                style={{
                                  background: isChecked ? 'var(--sidebar-active-bg)' : 'var(--muted)',
                                  borderColor: isChecked ? 'var(--sidebar-active-text)' : 'transparent',
                                  color: isChecked ? 'var(--sidebar-active-text)' : 'var(--foreground)',
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
      </div>

      {/* ── Drawer: create / edit role ── */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex" style={{ background: 'rgba(0,0,0,0.45)' }} onClick={() => setDrawerOpen(false)}>
          <div className="ml-auto w-full max-w-md h-full flex flex-col shadow-2xl"
            style={{ background: 'var(--card)' }} onClick={(e) => e.stopPropagation()}>

            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <h2 className="font-semibold text-foreground">{editingDept ? 'Edit Role' : 'New Role'}</h2>
              <button onClick={() => setDrawerOpen(false)} className="text-muted-foreground hover:text-foreground text-lg">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              <div className={fld}>
                <label className={lbl}>Name (EN)</label>
                <input className={inp} value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Procurement Team" />
              </div>
              <div className={fld}>
                <label className={lbl}>Name (AR)</label>
                <input className={inp} dir="rtl" value={form.name_ar} onChange={(e) => setForm(p => ({ ...p, name_ar: e.target.value }))} placeholder="مثال: فريق المشتريات" />
              </div>
              <div className={fld}>
                <label className={lbl}>Description</label>
                <textarea className={inp} rows={3} value={form.description} onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))} />
              </div>
            </div>

            <div className="px-6 py-4 border-t flex justify-end gap-3" style={{ borderColor: 'var(--border)' }}>
              <Button variant="secondary" onClick={() => setDrawerOpen(false)}>Cancel</Button>
              <Button
                variant="primary"
                onClick={handleSaveForm}
                isLoading={createMutation.isPending || updateMutation.isPending}
              >
                {editingDept ? 'Save' : 'Create'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
