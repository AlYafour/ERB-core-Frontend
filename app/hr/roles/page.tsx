'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import MainLayout from '@/components/layout/MainLayout';
import { Button, Loader, PageHeader, SearchInput, Drawer, PageShell, Badge } from '@/components/ui';
import { hrRolesApi } from '@/lib/api/hr';
import { HRTenantRole } from '@/types';
import { toast, confirm } from '@/lib/hooks/use-toast';
import { useMyPermissions } from '@/lib/hooks/use-my-permissions';

type FormState = {
  name: string;
  name_ar: string;
  description: string;
  level: number;
  is_active: boolean;
};

const EMPTY_FORM: FormState = { name: '', name_ar: '', description: '', level: 1, is_active: true };

export default function TenantRolesPage() {
  const qc = useQueryClient();
  const { isTenantAdmin, isPlatformAdmin } = useMyPermissions();
  const isAdmin = isTenantAdmin || isPlatformAdmin;

  const [search,      setSearch]      = useState('');
  const [drawerOpen,  setDrawerOpen]  = useState(false);
  const [editingRole, setEditingRole] = useState<HRTenantRole | null>(null);
  const [form,        setForm]        = useState<FormState>(EMPTY_FORM);

  const { data, isLoading } = useQuery({
    queryKey: ['hr-tenant-roles', search],
    queryFn: () => hrRolesApi.getAll({ search }),
    staleTime: 60_000,
  });

  const createMutation = useMutation({
    mutationFn: (d: Partial<HRTenantRole>) => hrRolesApi.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hr-tenant-roles'] }); setDrawerOpen(false); toast('Role created', 'success'); },
    onError: () => toast('Failed to create role', 'error'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<HRTenantRole> }) => hrRolesApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hr-tenant-roles'] }); setDrawerOpen(false); toast('Role updated', 'success'); },
    onError: () => toast('Failed to update role', 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: hrRolesApi.delete,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hr-tenant-roles'] }); toast('Role deleted', 'success'); },
    onError: () => toast('Failed to delete role', 'error'),
  });

  const openCreate = () => { setEditingRole(null); setForm(EMPTY_FORM); setDrawerOpen(true); };
  const openEdit   = (r: HRTenantRole) => { setEditingRole(r); setForm({ name: r.name, name_ar: r.name_ar, description: r.description, level: r.level, is_active: r.is_active }); setDrawerOpen(true); };

  const handleSave = () => {
    if (!form.name.trim()) { toast('Name is required', 'error'); return; }
    if (editingRole) updateMutation.mutate({ id: editingRole.id, data: form });
    else createMutation.mutate(form);
  };

  const handleDelete = async (r: HRTenantRole) => {
    if (r.employee_count > 0) {
      toast(`Cannot delete — ${r.employee_count} employee${r.employee_count !== 1 ? 's' : ''} assigned to this role`, 'error');
      return;
    }
    if (await confirm(`Delete role "${r.name}"? This cannot be undone.`))
      deleteMutation.mutate(r.id);
  };

  const roles = data?.results ?? [];

  return (
    <MainLayout>
      <PageShell>
        <PageHeader
          title="Roles"
          description="Define roles for your organisation — each role maps to a permission set that controls what employees can see and do."
          count={roles.length}
          breadcrumbs={[{ label: 'HR' }, { label: 'Settings', href: '/hr/settings' }, { label: 'Roles' }]}
          actions={isAdmin ? <Button variant="primary" onClick={openCreate}>+ New Role</Button> : undefined}
        />

        <SearchInput placeholder="Search roles…" value={search} onChange={setSearch} />

        {isLoading ? <Loader /> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--space-3)', marginTop: 'var(--space-3)' }}>
            {roles.length === 0 && (
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', gridColumn: '1 / -1', textAlign: 'center', padding: 'var(--space-8) 0' }}>
                No roles defined yet. Create your first role to get started.
              </p>
            )}
            {roles.map((role: HRTenantRole) => (
              <div key={role.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', opacity: role.is_active ? 1 : 0.6 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', margin: 0, color: 'var(--text-primary)' }}>
                      {role.name}
                    </p>
                    {role.name_ar && (
                      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: '2px 0 0', direction: 'rtl' }}>
                        {role.name_ar}
                      </p>
                    )}
                  </div>
                  {isAdmin && (
                    <div style={{ display: 'flex', gap: 'var(--space-1)', flexShrink: 0 }}>
                      <button onClick={() => openEdit(role)} style={{ fontSize: 'var(--text-xs)', padding: '2px var(--space-2)', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)', background: 'var(--surface-subtle)', border: 'none', cursor: 'pointer' }}>Edit</button>
                      <button onClick={() => handleDelete(role)} style={{ fontSize: 'var(--text-xs)', padding: '2px var(--space-2)', borderRadius: 'var(--radius-sm)', color: 'var(--status-error)', background: 'var(--surface-subtle)', border: 'none', cursor: 'pointer' }}>Del</button>
                    </div>
                  )}
                </div>

                {role.description && (
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                    {role.description}
                  </p>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginTop: 'auto', paddingTop: 'var(--space-1)', flexWrap: 'wrap' }}>
                  <Badge variant={role.is_active ? 'success' : 'default'}>{role.is_active ? 'Active' : 'Inactive'}</Badge>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                    Level {role.level}
                  </span>
                  {role.permission_set_name && (
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--brand)', background: 'var(--brand-subtle)', padding: '1px 7px', borderRadius: '99px', fontWeight: 'var(--weight-medium)' }}>
                      {role.permission_set_name}
                    </span>
                  )}
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginLeft: 'auto' }}>
                    {role.employee_count} {role.employee_count === 1 ? 'employee' : 'employees'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </PageShell>

      <Drawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editingRole ? `Edit Role — ${editingRole.name}` : 'New Role'}
        footer={<>
          <Button variant="secondary" onClick={() => setDrawerOpen(false)}>Cancel</Button>
          <Button variant="primary" onClick={handleSave} isLoading={createMutation.isPending || updateMutation.isPending}>
            {editingRole ? 'Save' : 'Create'}
          </Button>
        </>}
      >
        <div className="form-field">
          <label className="form-label">Name (EN) *</label>
          <input className="form-input" value={form.name} placeholder="e.g. Marketing Manager"
            onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
        </div>
        <div className="form-field" style={{ marginTop: 'var(--space-4)' }}>
          <label className="form-label">Name (AR)</label>
          <input className="form-input" dir="rtl" value={form.name_ar} placeholder="مثال: مدير التسويق"
            onChange={e => setForm(p => ({ ...p, name_ar: e.target.value }))} />
        </div>
        <div className="form-field" style={{ marginTop: 'var(--space-4)' }}>
          <label className="form-label">Description</label>
          <textarea className="form-textarea" rows={3} value={form.description}
            placeholder="What does this role do?"
            onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
        </div>
        <div className="form-field" style={{ marginTop: 'var(--space-4)' }}>
          <label className="form-label">Seniority Level</label>
          <input className="form-input" type="number" min={1} max={100} value={form.level}
            onChange={e => setForm(p => ({ ...p, level: Number(e.target.value) }))} />
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: 4 }}>
            Higher number = more senior. Used for display ordering only.
          </p>
        </div>
        <div className="form-field" style={{ marginTop: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <input type="checkbox" id="role-active" checked={form.is_active}
            onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))}
            style={{ width: 15, height: 15, accentColor: 'var(--brand)', cursor: 'pointer' }} />
          <label htmlFor="role-active" style={{ fontSize: 'var(--text-sm)', cursor: 'pointer', userSelect: 'none' }}>
            Active — employees can be assigned to this role
          </label>
        </div>
        {!editingRole && (
          <div style={{ marginTop: 'var(--space-5)', padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-md)', background: 'var(--surface-inset)', border: '1px solid var(--border-subtle)' }}>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
              <strong>Tip:</strong> After creating the role, link it to a Permission Set from Django Admin or ask your platform administrator to assign permissions. Employees assigned to this role will inherit those permissions automatically.
            </p>
          </div>
        )}
      </Drawer>
    </MainLayout>
  );
}
