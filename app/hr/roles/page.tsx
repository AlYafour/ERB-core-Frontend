'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppListPage } from '@/components/app/AppListPage';
import { useTableState } from '@/lib/hooks/use-table-state';
import { type Column } from '@/components/ui/DataTable';
import { RowActions } from '@/components/ui/RowActions';
import { Button, Drawer, Badge } from '@/components/ui';
import { toast, confirm } from '@/lib/hooks/use-toast';
import { useMyPermissions } from '@/lib/hooks/use-my-permissions';
import { hrRolesApi } from '@/lib/api/hr';
import { HRTenantRole } from '@/types';

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

  const tableState = useTableState();
  const { search } = tableState;

  const [drawerOpen,  setDrawerOpen]  = useState(false);
  const [editingRole, setEditingRole] = useState<HRTenantRole | null>(null);
  const [form,        setForm]        = useState<FormState>(EMPTY_FORM);

  const { data: raw, isLoading, error } = useQuery({
    queryKey: ['hr-tenant-roles'],
    queryFn: () => hrRolesApi.getAll({ page_size: 200 }),
    staleTime: 60_000,
  });

  const all      = raw?.results ?? [];
  const filtered = !search
    ? all
    : all.filter((r: HRTenantRole) =>
        r.name.toLowerCase().includes(search.toLowerCase()) ||
        (r.description ?? '').toLowerCase().includes(search.toLowerCase()),
      );

  const createMutation = useMutation({
    mutationFn: (d: Partial<HRTenantRole>) => hrRolesApi.create(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-tenant-roles'] });
      setDrawerOpen(false);
      toast('Role created', 'success');
    },
    onError: () => toast('Failed to create role', 'error'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<HRTenantRole> }) =>
      hrRolesApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-tenant-roles'] });
      setDrawerOpen(false);
      toast('Role updated', 'success');
    },
    onError: () => toast('Failed to update role', 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => hrRolesApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-tenant-roles'] });
      toast('Role deleted', 'success');
    },
    onError: () => toast('Failed to delete role', 'error'),
  });

  const openCreate = () => { setEditingRole(null); setForm(EMPTY_FORM); setDrawerOpen(true); };
  const openEdit   = (r: HRTenantRole) => {
    setEditingRole(r);
    setForm({ name: r.name, name_ar: r.name_ar, description: r.description, level: r.level, is_active: r.is_active });
    setDrawerOpen(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) { toast('Name is required', 'error'); return; }
    if (editingRole) updateMutation.mutate({ id: editingRole.id, data: form });
    else createMutation.mutate(form);
  };

  const columns: Column<HRTenantRole>[] = [
    {
      key: 'name',
      header: 'Name',
      render: r => (
        <div>
          <span style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--text-primary)' }}>{r.name}</span>
          {r.name_ar && (
            <span style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', direction: 'rtl', marginTop: 2 }}>
              {r.name_ar}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'description',
      header: 'Description',
      render: r => r.description
        ? <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>{r.description}</span>
        : <span style={{ color: 'var(--text-tertiary)' }}>—</span>,
    },
    {
      key: 'level',
      header: 'Level',
      render: r => (
        <span style={{ color: 'var(--text-secondary)' }}>Level {r.level}</span>
      ),
    },
    {
      key: 'permission_set_name',
      header: 'Permission Set',
      render: r => r.permission_set_name
        ? (
          <span style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--brand)',
            background: 'var(--brand-subtle)',
            padding: '1px 7px',
            borderRadius: '99px',
            fontWeight: 'var(--weight-medium)',
          }}>
            {r.permission_set_name}
          </span>
        )
        : <span style={{ color: 'var(--text-tertiary)' }}>—</span>,
    },
    {
      key: 'is_active',
      header: 'Status',
      render: r => (
        <Badge variant={r.is_active ? 'success' : 'default'}>
          {r.is_active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'employee_count',
      header: 'Employees',
      render: r => (
        <span style={{ color: 'var(--text-secondary)' }}>
          {r.employee_count} {r.employee_count === 1 ? 'employee' : 'employees'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: r => (
        <RowActions actions={[
          { label: 'Edit', onClick: () => openEdit(r), hidden: !isAdmin },
          {
            label: 'Delete',
            variant: 'danger',
            hidden: !isAdmin,
            onClick: async () => {
              if (r.employee_count > 0) {
                toast(
                  `Cannot delete — ${r.employee_count} employee${r.employee_count !== 1 ? 's' : ''} assigned to this role`,
                  'error',
                );
                return;
              }
              if (await confirm(`Delete role "${r.name}"? This cannot be undone.`))
                deleteMutation.mutate(r.id);
            },
          },
        ]} />
      ),
    },
  ];

  return (
    <AppListPage
      title="Roles"
      description="Define roles for your organisation — each role maps to a permission set that controls what employees can see and do."
      breadcrumbs={[{ label: 'HR' }, { label: 'Settings', href: '/hr/settings' }, { label: 'Roles' }]}
      totalCount={all.length}
      createAction={isAdmin
        ? <Button variant="primary" size="sm" onClick={openCreate}>+ New Role</Button>
        : undefined}
      onRowClick={(r) => openEdit(r)}
      selectable={true}
      columns={columns}
      data={filtered}
      isLoading={isLoading}
      error={error}
      emptyTitle="No roles defined yet. Create your first role to get started."
      tableState={tableState}
      searchPlaceholder="Search roles..."
      rowStyle={r => r.is_active ? undefined : { opacity: 0.6 }}
    >
      <Drawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editingRole ? `Edit Role — ${editingRole.name}` : 'New Role'}
        footer={<>
          <Button variant="secondary" onClick={() => setDrawerOpen(false)}>Cancel</Button>
          <Button
            variant="primary"
            onClick={handleSave}
            isLoading={createMutation.isPending || updateMutation.isPending}
          >
            {editingRole ? 'Save' : 'Create'}
          </Button>
        </>}
      >
        <div className="form-field">
          <label className="form-label">Name (EN) *</label>
          <input
            className="form-input"
            value={form.name}
            placeholder="e.g. Marketing Manager"
            onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
          />
        </div>
        <div className="form-field" style={{ marginTop: 'var(--space-4)' }}>
          <label className="form-label">Name (AR)</label>
          <input
            className="form-input"
            dir="rtl"
            value={form.name_ar}
            placeholder="مثال: مدير التسويق"
            onChange={e => setForm(p => ({ ...p, name_ar: e.target.value }))}
          />
        </div>
        <div className="form-field" style={{ marginTop: 'var(--space-4)' }}>
          <label className="form-label">Description</label>
          <textarea
            className="form-textarea"
            rows={3}
            value={form.description}
            placeholder="What does this role do?"
            onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
          />
        </div>
        <div className="form-field" style={{ marginTop: 'var(--space-4)' }}>
          <label className="form-label">Seniority Level</label>
          <input
            className="form-input"
            type="number"
            min={1}
            max={100}
            value={form.level}
            onChange={e => setForm(p => ({ ...p, level: Number(e.target.value) }))}
          />
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: 4 }}>
            Higher number = more senior. Used for display ordering only.
          </p>
        </div>
        <div className="form-field" style={{ marginTop: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <input
            type="checkbox"
            id="role-active"
            checked={form.is_active}
            onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))}
            style={{ width: 15, height: 15, accentColor: 'var(--brand)', cursor: 'pointer' }}
          />
          <label htmlFor="role-active" style={{ fontSize: 'var(--text-sm)', cursor: 'pointer', userSelect: 'none' }}>
            Active — employees can be assigned to this role
          </label>
        </div>
        {!editingRole && (
          <div style={{
            marginTop: 'var(--space-5)',
            padding: 'var(--space-3) var(--space-4)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--surface-inset)',
            border: '1px solid var(--border-subtle)',
          }}>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
              <strong>Tip:</strong> After creating the role, link it to a Permission Set from Django Admin or ask your platform administrator to assign permissions. Employees assigned to this role will inherit those permissions automatically.
            </p>
          </div>
        )}
      </Drawer>
    </AppListPage>
  );
}
