'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AppListPage } from '@/components/app/AppListPage';
import { useTableState } from '@/lib/hooks/use-table-state';
import { type Column } from '@/components/ui/DataTable';
import { RowActions } from '@/components/ui/RowActions';
import { Badge, Button } from '@/components/ui';
import SearchableDropdown from '@/components/ui/SearchableDropdown';
import { hrEmployeeGroupsApi, hrShiftsApi } from '@/lib/api/hr';
import { useMyPermissions } from '@/lib/hooks/use-my-permissions';
import { toast, confirm } from '@/lib/hooks/use-toast';
import type { EmployeeGroup, HRShift } from '@/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtTime(t: string): string {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  return `${hour % 12 || 12}:${m} ${ampm}`;
}

// ── FormState ─────────────────────────────────────────────────────────────────
const EMPTY_FORM = {
  name: '',
  name_ar: '',
  code: '',
  description: '',
  is_active: true,
  default_shift: null as number | null,
};
type FormState = typeof EMPTY_FORM;

const LABEL_STYLE: React.CSSProperties = {
  fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)',
  color: 'var(--text-secondary)', textTransform: 'uppercase',
  letterSpacing: '0.05em', display: 'block', marginBottom: 'var(--space-1-5)',
};

// ── Modal ─────────────────────────────────────────────────────────────────────
function GroupModal({
  group,
  shifts,
  onClose,
  onSave,
  isSaving,
}: {
  group: EmployeeGroup | null;
  shifts: HRShift[];
  onClose: () => void;
  onSave: (data: FormState) => void;
  isSaving: boolean;
}) {
  const [form, setForm] = useState<FormState>(
    group
      ? {
          name:          group.name,
          name_ar:       group.name_ar,
          code:          group.code,
          description:   group.description,
          is_active:     group.is_active,
          default_shift: group.default_shift ?? null,
        }
      : EMPTY_FORM,
  );

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.code.trim()) return;
    onSave(form);
  };

  const activeShifts = shifts.filter(s => s.is_active);

  const shiftOptions = useMemo(() => [
    { value: '__none__', label: '— No default shift —', searchText: 'none' },
    ...activeShifts.map(s => ({
      value: s.id,
      label: s.start_time && s.end_time ? `${s.name} (${fmtTime(s.start_time)} – ${fmtTime(s.end_time)})` : s.name,
      searchText: s.name,
    })),
  ], [activeShifts]);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: 'var(--space-8) var(--space-4)',
        overflowY: 'auto',
      }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="card" style={{ width: '100%', maxWidth: 520, padding: 'var(--space-6)', position: 'relative' }}>
        <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)', margin: '0 0 var(--space-5)' }}>
          {group ? 'Edit Group' : 'Create Employee Group'}
        </h2>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>

          {/* Code */}
          <div>
            <label style={LABEL_STYLE}>
              Code <span style={{ color: 'var(--color-error)' }}>*</span>
            </label>
            <input
              value={form.code}
              onChange={e => set('code', e.target.value.toUpperCase())}
              onBlur={e => set('code', e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '').trim())}
              placeholder="e.g. SITE, OFFICE, MAINTENANCE"
              required
              autoComplete="off"
              spellCheck={false}
              className="form-input"
              style={{ width: '100%', fontFamily: 'monospace', fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-sm)' }}
              maxLength={30}
            />
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: 'var(--space-1) 0 0' }}>
              Uppercase letters, numbers, underscores only. Used by the approval engine — cannot change once assigned.
            </p>
          </div>

          {/* Name */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            <div>
              <label style={LABEL_STYLE}>Name <span style={{ color: 'var(--color-error)' }}>*</span></label>
              <input
                value={form.name}
                onChange={e => set('name', e.target.value)}
                placeholder="e.g. Site Workers"
                required
                className="form-input"
                style={{ width: '100%', fontSize: 'var(--text-sm)' }}
              />
            </div>
            <div>
              <label style={LABEL_STYLE}>Name (Arabic)</label>
              <input
                value={form.name_ar}
                onChange={e => set('name_ar', e.target.value)}
                placeholder="الاسم بالعربية"
                className="form-input"
                dir="rtl"
                style={{ width: '100%', fontSize: 'var(--text-sm)' }}
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label style={LABEL_STYLE}>Description</label>
            <textarea
              value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder="Optional — describe what this group covers"
              className="form-input"
              rows={2}
              style={{ width: '100%', fontSize: 'var(--text-sm)', resize: 'vertical' }}
            />
          </div>

          {/* Default Shift */}
          <div>
            <label style={LABEL_STYLE}>Default Shift</label>
            <SearchableDropdown
              options={shiftOptions}
              value={form.default_shift ?? '__none__'}
              onChange={v => set('default_shift', v === '__none__' ? null : v as number)}
              allowClear={false}
              placeholder="— No default shift —"
            />
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: 'var(--space-1) 0 0' }}>
              Group members inherit this shift. Individual overrides apply in a later phase.
            </p>
          </div>

          {/* Active toggle */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', cursor: 'pointer', userSelect: 'none' }}>
            <div
              onClick={() => set('is_active', !form.is_active)}
              style={{
                width: 40, height: 22, borderRadius: 99, flexShrink: 0,
                background: form.is_active ? 'var(--brand)' : 'var(--border-default)',
                position: 'relative', cursor: 'pointer', transition: 'background 200ms',
              }}
            >
              <div style={{
                position: 'absolute', top: 3, left: form.is_active ? 21 : 3,
                width: 16, height: 16, borderRadius: '50%', background: 'var(--primary-foreground)',
                transition: 'left 200ms', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }} />
            </div>
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)' }}>
              {form.is_active ? 'Active — employees can be assigned to this group' : 'Inactive — hidden from assignment pickers'}
            </span>
          </label>

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', paddingTop: 'var(--space-2)', borderTop: '1px solid var(--border-subtle)' }}>
            <button type="button" onClick={onClose} disabled={isSaving}
              style={{ padding: 'var(--space-2) var(--space-4)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', background: 'none', cursor: 'pointer', fontSize: 'var(--text-sm)' }}>
              Cancel
            </button>
            <button type="submit" disabled={isSaving || !form.name.trim() || !form.code.trim()}
              style={{ padding: 'var(--space-2) var(--space-5)', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--brand)', color: 'var(--primary-foreground)', cursor: 'pointer', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', opacity: isSaving ? 0.6 : 1 }}>
              {isSaving ? 'Saving…' : group ? 'Save Changes' : 'Create Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function EmployeeGroupsPage() {
  const { hasPermission } = useMyPermissions();
  const admin = hasPermission('hr.hr_employee.view');
  const queryClient = useQueryClient();

  const tableState = useTableState();
  const { search } = tableState;

  const [modalGroup, setModalGroup] = useState<EmployeeGroup | null | 'new'>(null);

  const { data: raw, isLoading } = useQuery({
    queryKey: ['hr-employee-groups'],
    queryFn: () => hrEmployeeGroupsApi.getAll(),
    staleTime: 60_000,
  });

  const { data: shiftsRaw } = useQuery({
    queryKey: ['hr-shifts'],
    queryFn: () => hrShiftsApi.getAll(),
    staleTime: 120_000,
  });

  const allGroups: EmployeeGroup[] = raw?.results ?? [];
  const shifts: HRShift[]          = shiftsRaw?.results ?? [];

  const filtered = !search
    ? allGroups
    : allGroups.filter(g =>
        g.name.toLowerCase().includes(search.toLowerCase()) ||
        g.code.toLowerCase().includes(search.toLowerCase()) ||
        (g.name_ar && g.name_ar.includes(search))
      );

  const shiftById = new Map(shifts.map(s => [s.id, s]));

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['hr-employee-groups'] });

  const createMutation = useMutation({
    mutationFn: (data: FormState) => hrEmployeeGroupsApi.create(data),
    onSuccess: () => { invalidate(); setModalGroup(null); toast('Group created', 'success'); },
    onError: (err: unknown) => toast((err as { response?: { data?: { code?: string[] } } })?.response?.data?.code?.[0] ?? 'Failed to create group', 'error'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: FormState }) => hrEmployeeGroupsApi.update(id, data),
    onSuccess: () => { invalidate(); setModalGroup(null); toast('Group updated', 'success'); },
    onError: (err: unknown) => toast((err as { response?: { data?: { code?: string[] } } })?.response?.data?.code?.[0] ?? 'Failed to update group', 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => hrEmployeeGroupsApi.delete(id),
    onSuccess: () => { invalidate(); toast('Group deleted', 'success'); },
    onError: () => toast('Failed to delete group', 'error'),
  });

  const handleSave = (data: FormState) => {
    if (modalGroup === 'new') {
      createMutation.mutate(data);
    } else if (modalGroup) {
      updateMutation.mutate({ id: modalGroup.id, data });
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const columns: Column<EmployeeGroup>[] = [
    {
      key: 'code',
      header: 'Code',
      width: '90px',
      render: (group) => (
        <span style={{
          fontFamily: 'monospace', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)',
          color: 'var(--primary-foreground)', background: 'var(--brand)',
          padding: '2px 8px', borderRadius: 'var(--radius-sm)', display: 'inline-block',
          opacity: group.is_active ? 1 : 0.5,
        }}>
          {group.code}
        </span>
      ),
    },
    {
      key: 'name',
      header: 'Name',
      render: (group) => (
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {group.name}
          </p>
          {group.name_ar && (
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', direction: 'rtl' }}>
              {group.name_ar}
            </p>
          )}
          {group.description && (
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {group.description}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'member_count',
      header: 'Members',
      width: '80px',
      render: (group) => (
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0 }}>
          {group.member_count} active
        </p>
      ),
    },
    {
      key: 'default_shift_name',
      header: 'Default Shift',
      width: '160px',
      render: (group) => {
        const shiftDetail = group.default_shift ? shiftById.get(group.default_shift) : null;
        return group.default_shift_name ? (
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {group.default_shift_name}
            </p>
            {shiftDetail && (
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: '2px 0 0', whiteSpace: 'nowrap' }}>
                {fmtTime(shiftDetail.start_time)} – {fmtTime(shiftDetail.end_time)}
              </p>
            )}
          </div>
        ) : (
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: 0, fontStyle: 'italic' }}>None</p>
        );
      },
    },
    {
      key: 'is_active',
      header: 'Status',
      width: '90px',
      render: (group) => (
        <Badge variant={group.is_active ? 'active' : 'inactive'} size="sm">
          {group.is_active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: '48px',
      render: (group) => (
        <RowActions
          actions={[
            {
              label: 'Edit',
              onClick: () => setModalGroup(group),
            },
            { separator: true },
            {
              label: 'Delete',
              variant: 'danger',
              onClick: async () => {
                if (await confirm(`Delete group "${group.name}" (${group.code})?`)) {
                  deleteMutation.mutate(group.id);
                }
              },
            },
          ]}
        />
      ),
    },
  ];

  return (
    <AppListPage
      title="Employee Groups"
      description="Workforce categories that carry a default shift and approval policy."
      breadcrumbs={[
        { label: 'Home', href: '/' },
        { label: 'HR' },
        { label: 'Employee Groups' },
      ]}
      totalCount={allGroups.length}
      createAction={
        admin ? (
          <Button variant="primary" size="sm" onClick={() => setModalGroup('new')}>
            + Create Group
          </Button>
        ) : undefined
      }
      columns={columns}
      data={filtered}
      isLoading={isLoading}
      emptyTitle="No groups yet. Create your first group to start organising employees by workforce category."
      tableState={tableState}
      searchPlaceholder="Search groups…"
    >
      {!isLoading && allGroups.length > 0 && (
        <div style={{ marginTop: 'var(--space-3)', padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-md)', background: 'var(--surface-subtle)', border: '1px solid var(--border-subtle)' }}>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: 0 }}>
            Approval routing uses the <strong>Direct Manager</strong> field on each employee — assign it from the{' '}
            <Link href="/hr/employees" style={{ color: 'var(--brand)', textDecoration: 'none', fontWeight: 'var(--weight-semibold)' }}>Employees page</Link>.
          </p>
        </div>
      )}

      {modalGroup !== null && (
        <GroupModal
          group={modalGroup === 'new' ? null : modalGroup}
          shifts={shifts}
          onClose={() => setModalGroup(null)}
          onSave={handleSave}
          isSaving={isSaving}
        />
      )}
    </AppListPage>
  );
}
