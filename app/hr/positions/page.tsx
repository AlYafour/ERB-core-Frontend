'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppListPage } from '@/components/app/AppListPage';
import { useTableState } from '@/lib/hooks/use-table-state';
import { type Column } from '@/components/ui/DataTable';
import { RowActions } from '@/components/ui/RowActions';
import { Button, Drawer } from '@/components/ui';
import SearchableDropdown from '@/components/ui/SearchableDropdown';
import { toast, confirm } from '@/lib/hooks/use-toast';
import { useMyPermissions } from '@/lib/hooks/use-my-permissions';
import { hrPositionsApi } from '@/lib/api/hr';
import { permissionsApi } from '@/lib/api/permissions';
import { HRPosition } from '@/types';

type FormState = {
  title: string;
  title_ar: string;
  level: number;
  base_salary: string;
  default_permission_set: number | null;
};

const EMPTY_FORM: FormState = {
  title: '',
  title_ar: '',
  level: 1,
  base_salary: '',
  default_permission_set: null,
};

export default function PositionsPage() {
  const queryClient = useQueryClient();
  const { hasPermission } = useMyPermissions();
  const isAdmin = hasPermission('hr.hr_employee.view');

  const tableState = useTableState();
  const { search } = tableState;

  const [drawerOpen, setDrawerOpen]     = useState(false);
  const [editing, setEditing]           = useState<HRPosition | null>(null);
  const [form, setForm]                 = useState<FormState>(EMPTY_FORM);

  const { data: raw, isLoading, error } = useQuery({
    queryKey: ['hr-positions-all'],
    queryFn: () => hrPositionsApi.getAll({ page_size: 200 }),
    staleTime: 60_000,
  });

  const { data: rolesData } = useQuery({
    queryKey: ['permission-sets-all'],
    queryFn: () => permissionsApi.getAllPermissionSets({ page_size: 200 }),
    staleTime: 120_000,
  });

  const all      = raw?.results ?? [];
  const filtered = !search
    ? all
    : all.filter((p: HRPosition) =>
        p.title.toLowerCase().includes(search.toLowerCase()) ||
        (p.title_ar ?? '').toLowerCase().includes(search.toLowerCase()),
      );

  const roleOptions = (rolesData?.results ?? []).map(r => ({ value: r.id, label: r.name }));

  const createMutation = useMutation({
    mutationFn: (data: Partial<HRPosition>) => hrPositionsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-positions-all'] });
      setDrawerOpen(false);
      toast('Position created', 'success');
    },
    onError: () => toast('Failed to create position', 'error'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<HRPosition> }) =>
      hrPositionsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-positions-all'] });
      setDrawerOpen(false);
      toast('Position updated', 'success');
    },
    onError: () => toast('Failed to update position', 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => hrPositionsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-positions-all'] });
      toast('Position deleted', 'success');
    },
    onError: () => toast('Failed to delete position', 'error'),
  });

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDrawerOpen(true);
  };

  const openEdit = (pos: HRPosition) => {
    setEditing(pos);
    setForm({
      title: pos.title,
      title_ar: pos.title_ar,
      level: pos.level,
      base_salary: pos.base_salary ?? '',
      default_permission_set: pos.default_permission_set ?? null,
    });
    setDrawerOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) { toast('Title is required', 'error'); return; }
    const payload: Partial<HRPosition> = {
      title: form.title.trim(),
      title_ar: form.title_ar.trim(),
      level: form.level,
      base_salary: form.base_salary || null,
      default_permission_set: form.default_permission_set,
    };
    if (editing) updateMutation.mutate({ id: editing.id, data: payload });
    else createMutation.mutate(payload);
  };

  const fld = 'form-field';
  const lbl = 'form-label';

  const columns: Column<HRPosition>[] = [
    {
      key: 'title',
      header: 'Title',
      render: r => <span style={{ fontWeight: 'var(--weight-semibold)' }}>{r.title}</span>,
    },
    {
      key: 'title_ar',
      header: 'Title (AR)',
      render: r => r.title_ar
        ? <span style={{ direction: 'rtl', display: 'block' }}>{r.title_ar}</span>
        : <span style={{ color: 'var(--text-tertiary)' }}>—</span>,
    },
    {
      key: 'level',
      header: 'Level',
      render: r => <span style={{ color: 'var(--text-secondary)' }}>{r.level}</span>,
    },
    {
      key: 'default_permission_set_name',
      header: 'Default Role',
      render: r => r.default_permission_set_name
        ? (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--space-1)',
            padding: '2px 8px',
            borderRadius: 'var(--radius-full)',
            background: 'var(--color-primary-50, #eff6ff)',
            color: 'var(--color-primary-700, #1d4ed8)',
            fontSize: 'var(--text-xs)',
            fontWeight: 'var(--weight-medium)',
          }}>
            {r.default_permission_set_name}
          </span>
        )
        : <span style={{ color: 'var(--text-tertiary)' }}>No default</span>,
    },
    {
      key: 'employee_count',
      header: 'Members',
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
          { label: 'Delete', variant: 'danger', hidden: !isAdmin, onClick: async () => {
            if (await confirm(`Delete position "${r.title}"?`)) deleteMutation.mutate(r.id);
          }},
        ]} />
      ),
    },
  ];

  return (
    <AppListPage
      title="Positions"
      description="Job positions — level, salary template, and default role assignment"
      breadcrumbs={[{ label: 'HR' }, { label: 'Positions' }]}
      totalCount={all.length}
      createAction={isAdmin
        ? <Button variant="primary" size="sm" onClick={openCreate}>+ New Position</Button>
        : undefined}
      selectable={true}
      columns={columns}
      data={filtered}
      isLoading={isLoading}
      error={error}
      emptyTitle="No positions found."
      tableState={tableState}
      searchPlaceholder="Search positions..."
    >
      <Drawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editing ? 'Edit Position' : 'New Position'}
        footer={<>
          <Button variant="secondary" onClick={() => setDrawerOpen(false)}>Cancel</Button>
          <Button
            variant="primary"
            onClick={handleSave}
            isLoading={createMutation.isPending || updateMutation.isPending}
          >
            {editing ? 'Save' : 'Create'}
          </Button>
        </>}
      >
        <div className={fld}>
          <label className={lbl}>Title (EN)</label>
          <input
            className="form-input"
            value={form.title}
            onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
            placeholder="e.g. Site Engineer"
          />
        </div>

        <div className={fld} style={{ marginTop: 'var(--space-4)' }}>
          <label className={lbl}>Title (AR)</label>
          <input
            className="form-input"
            dir="rtl"
            value={form.title_ar}
            onChange={e => setForm(p => ({ ...p, title_ar: e.target.value }))}
            placeholder="مثال: مهندس موقع"
          />
        </div>

        <div className={fld} style={{ marginTop: 'var(--space-4)' }}>
          <label className={lbl}>Level</label>
          <input
            className="form-input"
            type="number"
            min={1}
            value={form.level}
            onChange={e => setForm(p => ({ ...p, level: Number(e.target.value) || 1 }))}
            placeholder="1"
          />
        </div>

        <div className={fld} style={{ marginTop: 'var(--space-4)' }}>
          <label className={lbl}>Base Salary (AED)</label>
          <input
            className="form-input"
            type="number"
            min={0}
            step="0.01"
            value={form.base_salary}
            onChange={e => setForm(p => ({ ...p, base_salary: e.target.value }))}
            placeholder="Optional salary template"
          />
        </div>

        <div className={fld} style={{ marginTop: 'var(--space-4)' }}>
          <label className={lbl}>Default Role</label>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', margin: '0 0 var(--space-2)' }}>
            Auto-assigned to any employee placed in this position.
          </p>
          <SearchableDropdown
            options={roleOptions}
            value={form.default_permission_set}
            onChange={v => setForm(p => ({ ...p, default_permission_set: v as number | null }))}
            placeholder="— No default role —"
            allowClear
          />
        </div>
      </Drawer>
    </AppListPage>
  );
}
