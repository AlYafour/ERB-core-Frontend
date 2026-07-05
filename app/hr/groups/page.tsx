'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AppListPage } from '@/components/app/AppListPage';
import { useTableState } from '@/lib/hooks/use-table-state';
import { type Column } from '@/components/ui/DataTable';
import { RowActions } from '@/components/ui/RowActions';
import { Badge, Button } from '@/components/ui';
import SearchableDropdown from '@/components/ui/SearchableDropdown';
import { hrEmployeeGroupsApi, hrShiftsApi, hrEmployeesApi } from '@/lib/api/hr';
import { useMyPermissions } from '@/lib/hooks/use-my-permissions';
import { toast, confirm } from '@/lib/hooks/use-toast';
import type { EmployeeGroup, HRShift, HREmployee } from '@/types';

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
  default_shift:   null as number | null,
  default_manager: null as number | null,
};
type FormState = typeof EMPTY_FORM;

const LABEL_STYLE: React.CSSProperties = {
  fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)',
  color: 'var(--text-secondary)', textTransform: 'uppercase',
  letterSpacing: '0.05em', display: 'block', marginBottom: 'var(--space-1-5)',
};

// ── Manager Picker ─────────────────────────────────────────────────────────────
function ManagerPicker({
  value,
  onChange,
  employees,
  fallbackName,
}: {
  value: number | null;
  onChange: (id: number | null) => void;
  employees: HREmployee[];
  fallbackName?: string | null;
}) {
  const [search, setSearch]   = useState('');
  const [open, setOpen]       = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const selected = value ? employees.find(e => e.id === value) : null;
  const label    = selected?.full_name ?? (value && fallbackName ? fallbackName : null);

  const filtered = employees.filter(e =>
    !search ||
    e.full_name.toLowerCase().includes(search.toLowerCase()) ||
    e.employee_id.toLowerCase().includes(search.toLowerCase())
  );

  const select = (id: number | null) => {
    onChange(id);
    setOpen(false);
    setSearch('');
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => { setOpen(o => !o); setSearch(''); }}
        className="form-input"
        style={{
          width: '100%', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: 'var(--space-2)',
          cursor: 'pointer', textAlign: 'left', fontSize: 'var(--text-sm)',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', minWidth: 0, flex: 1, overflow: 'hidden' }}>
          {label ? (
            <>
              <span style={{
                width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                background: selected ? (selected.user?.id ? 'var(--brand)' : 'var(--color-error)') : 'var(--text-tertiary)',
              }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
            </>
          ) : (
            <span style={{ color: 'var(--text-secondary)' }}>— No default manager —</span>
          )}
        </span>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', flexShrink: 0 }}>▾</span>
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 200,
          background: 'var(--surface-default)', border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-md)', boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          overflow: 'hidden',
        }}>
          {/* Search input */}
          <div style={{ padding: 'var(--space-2)', borderBottom: '1px solid var(--border-subtle)' }}>
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or ID…"
              className="form-input"
              style={{ width: '100%', fontSize: 'var(--text-sm)', padding: 'var(--space-1-5) var(--space-2-5)' }}
            />
          </div>

          {/* Option list */}
          <div style={{ maxHeight: 220, overflowY: 'auto' }}>
            {/* Clear option */}
            <div
              onClick={() => select(null)}
              style={{
                padding: 'var(--space-2) var(--space-3)', cursor: 'pointer',
                fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', fontStyle: 'italic',
                background: value === null ? 'var(--surface-subtle)' : undefined,
                borderBottom: '1px solid var(--border-subtle)',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-subtle)')}
              onMouseLeave={e => (e.currentTarget.style.background = value === null ? 'var(--surface-subtle)' : 'transparent')}
            >
              — No default manager —
            </div>

            {filtered.length === 0 ? (
              <div style={{ padding: 'var(--space-3)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', textAlign: 'center' }}>
                No employees found
              </div>
            ) : filtered.map(emp => {
              const hasUser  = !!emp.user?.id;
              const inactive = !emp.is_active;
              const isSel    = emp.id === value;
              const dotColor = !hasUser ? 'var(--color-error)' : inactive ? 'var(--text-tertiary)' : 'var(--brand)';
              return (
                <div
                  key={emp.id}
                  onClick={() => select(emp.id)}
                  style={{
                    padding: 'var(--space-2) var(--space-3)', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
                    background: isSel ? 'var(--brand)' : undefined,
                    opacity: inactive ? 0.6 : 1,
                  }}
                  onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = 'var(--surface-subtle)'; }}
                  onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = 'transparent'; }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: dotColor }} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{
                      fontSize: 'var(--text-sm)',
                      fontWeight: isSel ? 'var(--weight-semibold)' : 'var(--weight-normal)',
                      color: isSel ? 'var(--card-bg)' : undefined,
                      display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {emp.full_name}
                    </span>
                    <span style={{
                      fontSize: 'var(--text-xs)',
                      color: isSel ? 'var(--card-bg)' : 'var(--text-secondary)',
                      display: 'flex', alignItems: 'center', gap: 'var(--space-1-5)',
                    }}>
                      {emp.employee_id}
                      {inactive && <span style={{ color: 'var(--text-tertiary)' }}>· inactive</span>}
                      {!hasUser && !inactive && (
                        <span style={{ color: 'var(--color-error)', fontWeight: 'var(--weight-medium)' }}>
                          · won&apos;t route approvals
                        </span>
                      )}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────
function GroupModal({
  group,
  shifts,
  employees,
  onClose,
  onSave,
  isSaving,
}: {
  group: EmployeeGroup | null;
  shifts: HRShift[];
  employees: HREmployee[];
  onClose: () => void;
  onSave: (data: FormState) => void;
  isSaving: boolean;
}) {
  const [form, setForm] = useState<FormState>(
    group
      ? {
          name:            group.name,
          name_ar:         group.name_ar,
          code:            group.code,
          description:     group.description,
          is_active:       group.is_active,
          default_shift:   group.default_shift   ?? null,
          default_manager: group.default_manager ?? null,
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

          {/* Default Manager */}
          <div>
            <label style={LABEL_STYLE}>Default Manager</label>
            <ManagerPicker
              value={form.default_manager}
              onChange={id => set('default_manager', id)}
              employees={employees}
              fallbackName={group?.default_manager_name}
            />
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: 'var(--space-1) 0 0' }}>
              Approval fallback when an employee has no direct manager.{' '}
              <span style={{ color: 'var(--brand)', fontWeight: 'var(--weight-semibold)' }}>●</span> Has login · routes approvals.{' '}
              <span style={{ color: 'var(--color-error)', fontWeight: 'var(--weight-semibold)' }}>●</span> No account · approvals won&apos;t deliver.
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
              style={{ padding: 'var(--space-2) var(--space-5)', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--brand)', color: 'var(--card-bg)', cursor: 'pointer', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', opacity: isSaving ? 0.6 : 1 }}>
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

  const { data: employeesRaw } = useQuery({
    queryKey: ['hr-employees-all'],
    queryFn: () => hrEmployeesApi.getAll(),
    staleTime: 120_000,
  });

  const allGroups: EmployeeGroup[] = raw?.results ?? [];
  const shifts: HRShift[]          = shiftsRaw?.results ?? [];
  const employees: HREmployee[]    = employeesRaw?.results ?? [];

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
          color: 'var(--card-bg)', background: 'var(--brand)',
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
          {group.description && (
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {group.description}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'name_ar',
      header: 'Name (Arabic)',
      render: (group) => (
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', direction: 'rtl', textAlign: 'right' }}>
          {group.name_ar || '—'}
        </p>
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
      width: '140px',
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
      key: 'default_manager_name',
      header: 'Default Manager',
      width: '160px',
      render: (group) => {
        const mgrEmp     = group.default_manager ? employees.find(e => e.id === group.default_manager) : null;
        const mgrHasUser = mgrEmp ? !!mgrEmp.user?.id : null;
        return group.default_manager_name ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
              background: mgrHasUser === false ? 'var(--color-error)' : 'var(--brand)',
            }} />
            <p style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {group.default_manager_name}
            </p>
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
      description="Workforce categories that carry a default shift, approval policy, and reporting line."
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
      {/* Context note */}
      {!isLoading && allGroups.length > 0 && (
        <div style={{ marginTop: 'var(--space-3)', padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-md)', background: 'var(--surface-subtle)', border: '1px solid var(--border-subtle)' }}>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: 0 }}>
            <strong>G4 active.</strong> Set a default manager per group — used as approval fallback when employees have no direct manager assigned. Default shift (G3) is also live. Assign employees to groups from the{' '}
            <Link href="/hr/employees" style={{ color: 'var(--brand)', textDecoration: 'none', fontWeight: 'var(--weight-semibold)' }}>Employees page</Link>.
          </p>
        </div>
      )}

      {/* Group Modal */}
      {modalGroup !== null && (
        <GroupModal
          group={modalGroup === 'new' ? null : modalGroup}
          shifts={shifts}
          employees={employees}
          onClose={() => setModalGroup(null)}
          onSave={handleSave}
          isSaving={isSaving}
        />
      )}
    </AppListPage>
  );
}
