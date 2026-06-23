'use client';

import { useState, useRef, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import MainLayout from '@/components/layout/MainLayout';
import { hrEmployeeGroupsApi, hrShiftsApi, hrEmployeesApi } from '@/lib/api/hr';
import { useAuth } from '@/lib/hooks/use-auth';
import { useMyPermissions } from '@/lib/hooks/use-my-permissions';
import { toast } from '@/lib/hooks/use-toast';
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
                background: selected ? (selected.user?.id ? '#10b981' : '#f59e0b') : '#9ca3af',
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
              const dotColor = !hasUser ? '#f59e0b' : inactive ? '#9ca3af' : '#10b981';
              return (
                <div
                  key={emp.id}
                  onClick={() => select(emp.id)}
                  style={{
                    padding: 'var(--space-2) var(--space-3)', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
                    background: isSel ? 'var(--sidebar-active-bg)' : undefined,
                    opacity: inactive ? 0.6 : 1,
                  }}
                  onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = 'var(--surface-subtle)'; }}
                  onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = 'transparent'; }}
                >
                  {/* green=active+account, grey=inactive employee, amber=no login account */}
                  <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: dotColor }} />

                  {/* Name + ID */}
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{
                      fontSize: 'var(--text-sm)',
                      fontWeight: isSel ? 'var(--weight-semibold)' : 'var(--weight-normal)',
                      color: isSel ? 'var(--sidebar-active-text)' : undefined,
                      display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {emp.full_name}
                    </span>
                    <span style={{
                      fontSize: 'var(--text-xs)',
                      color: isSel ? 'var(--sidebar-active-text)' : 'var(--text-secondary)',
                      display: 'flex', alignItems: 'center', gap: 'var(--space-1-5)',
                    }}>
                      {emp.employee_id}
                      {inactive && <span style={{ color: '#9ca3af' }}>· inactive</span>}
                      {!hasUser && !inactive && (
                        <span style={{ color: '#f59e0b', fontWeight: 'var(--weight-medium)' }}>
                          · won't route approvals
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
            <select
              value={form.default_shift ?? ''}
              onChange={e => set('default_shift', e.target.value ? parseInt(e.target.value, 10) : null)}
              className="form-input"
              style={{ width: '100%', fontSize: 'var(--text-sm)' }}
            >
              <option value="">— No default shift —</option>
              {activeShifts.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.start_time && s.end_time
                    ? ` (${fmtTime(s.start_time)} – ${fmtTime(s.end_time)})`
                    : ''}
                </option>
              ))}
            </select>
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
              <span style={{ color: '#10b981', fontWeight: 'var(--weight-semibold)' }}>●</span> Has login · routes approvals.{' '}
              <span style={{ color: '#f59e0b', fontWeight: 'var(--weight-semibold)' }}>●</span> No account · approvals won't deliver.
            </p>
          </div>

          {/* Active toggle */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', cursor: 'pointer', userSelect: 'none' }}>
            <div
              onClick={() => set('is_active', !form.is_active)}
              style={{
                width: 40, height: 22, borderRadius: 99, flexShrink: 0,
                background: form.is_active ? '#10b981' : 'var(--border-default)',
                position: 'relative', cursor: 'pointer', transition: 'background 200ms',
              }}
            >
              <div style={{
                position: 'absolute', top: 3, left: form.is_active ? 21 : 3,
                width: 16, height: 16, borderRadius: '50%', background: '#fff',
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
              style={{ padding: 'var(--space-2) var(--space-5)', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--sidebar-active-bg)', color: 'var(--sidebar-active-text)', cursor: 'pointer', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', opacity: isSaving ? 0.6 : 1 }}>
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
  const { user: me } = useAuth();
  const { hasPermission } = useMyPermissions();
  const admin = hasPermission('hr.hr_employee.view');
  const queryClient = useQueryClient();

  const [modalGroup, setModalGroup] = useState<EmployeeGroup | null | 'new'>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [search, setSearch] = useState('');

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

  const groups = search
    ? allGroups.filter(g =>
        g.name.toLowerCase().includes(search.toLowerCase()) ||
        g.code.toLowerCase().includes(search.toLowerCase()) ||
        (g.name_ar && g.name_ar.includes(search))
      )
    : allGroups;

  const shiftById = new Map(shifts.map(s => [s.id, s]));

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['hr-employee-groups'] });

  const createMutation = useMutation({
    mutationFn: (data: FormState) => hrEmployeeGroupsApi.create(data),
    onSuccess: () => { invalidate(); setModalGroup(null); toast('Group created', 'success'); },
    onError: (err: any) => toast(err?.response?.data?.code?.[0] ?? 'Failed to create group', 'error'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: FormState }) => hrEmployeeGroupsApi.update(id, data),
    onSuccess: () => { invalidate(); setModalGroup(null); toast('Group updated', 'success'); },
    onError: (err: any) => toast(err?.response?.data?.code?.[0] ?? 'Failed to update group', 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => hrEmployeeGroupsApi.delete(id),
    onSuccess: () => { invalidate(); setDeletingId(null); toast('Group deleted', 'success'); },
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

  if (!admin) {
    return (
      <MainLayout>
        <div className="card" style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
          <p style={{ color: 'var(--color-error)', margin: 0, fontSize: 'var(--text-sm)' }}>
            Admin access required.
          </p>
        </div>
      </MainLayout>
    );
  }

  // Code | Name | Name_AR | Members | Default Shift | Default Manager | Status | Actions
  const GRID = '90px 1fr 1fr 70px 130px 160px 70px 90px';

  return (
    <MainLayout>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-4)' }}>
          <div>
            <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-bold)', margin: '0 0 var(--space-1)' }}>
              Employee Groups
              {!isLoading && (
                <span style={{ marginLeft: 'var(--space-2)', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-normal)', color: 'var(--text-secondary)' }}>
                  {groups.length}{search ? ` / ${allGroups.length}` : ''} {allGroups.length === 1 ? 'group' : 'groups'}
                </span>
              )}
            </h1>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0 }}>
              Workforce categories that carry a default shift, approval policy, and reporting line.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', flexShrink: 0 }}>
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search groups…"
              style={{
                padding: '7px 12px', borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-default)', background: 'var(--input-bg)',
                fontSize: 'var(--text-sm)', color: 'var(--text-primary)',
                outline: 'none', width: 200,
              }}
            />
            <button
              onClick={() => setModalGroup('new')}
            style={{
              padding: 'var(--space-2) var(--space-4)', borderRadius: 'var(--radius-md)',
              background: 'var(--sidebar-active-bg)', color: 'var(--sidebar-active-text)',
              border: 'none', cursor: 'pointer', fontSize: 'var(--text-sm)',
              fontWeight: 'var(--weight-semibold)', whiteSpace: 'nowrap', flexShrink: 0,
            }}
          >
            + Create Group
          </button>
          </div>
        </div>

        {/* Table */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {/* Header row */}
          <div style={{
            display: 'grid', gridTemplateColumns: GRID,
            gap: 'var(--space-3)', padding: 'var(--space-3) var(--space-5)',
            borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-subtle)',
          }}>
            {['Code', 'Name', 'Name (Arabic)', 'Members', 'Default Shift', 'Default Manager', 'Status', ''].map(h => (
              <span key={h} style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {h}
              </span>
            ))}
          </div>

          {isLoading ? (
            <div style={{ padding: 'var(--space-12)', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: 'var(--text-sm)' }}>Loading…</p>
            </div>
          ) : groups.length === 0 ? (
            <div style={{ padding: 'var(--space-12)', textAlign: 'center' }}>
              <p style={{ fontSize: 'var(--text-2xl)', margin: '0 0 var(--space-3)' }}>🗂</p>
              <p style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', margin: '0 0 var(--space-1)' }}>No groups yet</p>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0 }}>
                Create your first group to start organising employees by workforce category.
              </p>
            </div>
          ) : (
            groups.map((group, idx) => {
              const isLast      = idx === groups.length - 1;
              const isDeleting  = deletingId === group.id;
              const shiftDetail = group.default_shift ? shiftById.get(group.default_shift) : null;
              const mgrEmp      = group.default_manager ? employees.find(e => e.id === group.default_manager) : null;
              const mgrHasUser  = mgrEmp ? !!mgrEmp.user?.id : null;

              return (
                <div key={group.id} style={{ borderBottom: !isLast ? '1px solid var(--border-subtle)' : 'none' }}>
                  <div style={{
                    display: 'grid', gridTemplateColumns: GRID,
                    gap: 'var(--space-3)', padding: 'var(--space-4) var(--space-5)', alignItems: 'center',
                  }}>
                    {/* Code */}
                    <span style={{
                      fontFamily: 'monospace', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)',
                      color: 'var(--sidebar-active-text)', background: 'var(--sidebar-active-bg)',
                      padding: '2px 8px', borderRadius: 'var(--radius-sm)', display: 'inline-block',
                      opacity: group.is_active ? 1 : 0.5,
                    }}>
                      {group.code}
                    </span>

                    {/* Name */}
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

                    {/* Name AR */}
                    <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', direction: 'rtl', textAlign: 'right' }}>
                      {group.name_ar || '—'}
                    </p>

                    {/* Members */}
                    <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0 }}>
                      {group.member_count} active
                    </p>

                    {/* Default Shift */}
                    <div style={{ minWidth: 0 }}>
                      {group.default_shift_name ? (
                        <>
                          <p style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {group.default_shift_name}
                          </p>
                          {shiftDetail && (
                            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: '2px 0 0', whiteSpace: 'nowrap' }}>
                              {fmtTime(shiftDetail.start_time)} – {fmtTime(shiftDetail.end_time)}
                            </p>
                          )}
                        </>
                      ) : (
                        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: 0, fontStyle: 'italic' }}>None</p>
                      )}
                    </div>

                    {/* Default Manager */}
                    <div style={{ minWidth: 0 }}>
                      {group.default_manager_name ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                          <span style={{
                            width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                            background: mgrHasUser === false ? '#f59e0b' : '#10b981',
                          }} />
                          <p style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {group.default_manager_name}
                          </p>
                        </div>
                      ) : (
                        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: 0, fontStyle: 'italic' }}>None</p>
                      )}
                    </div>

                    {/* Status */}
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      padding: '3px 8px', borderRadius: 99, fontSize: 'var(--text-xs)',
                      fontWeight: 'var(--weight-semibold)',
                      background: group.is_active ? '#d1fae5' : 'var(--surface-subtle)',
                      color: group.is_active ? '#065f46' : 'var(--text-secondary)',
                    }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: group.is_active ? '#10b981' : '#9ca3af' }} />
                      {group.is_active ? 'Active' : 'Inactive'}
                    </span>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 'var(--space-1)', justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => setModalGroup(group)}
                        style={{ padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', background: 'none', cursor: 'pointer', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeletingId(isDeleting ? null : group.id)}
                        style={{ padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', background: 'none', cursor: 'pointer', fontSize: 'var(--text-xs)', color: isDeleting ? '#dc2626' : 'var(--text-secondary)' }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {/* Inline delete confirmation */}
                  {isDeleting && (
                    <div style={{
                      padding: 'var(--space-3) var(--space-5)',
                      borderTop: '1px solid var(--border-subtle)', background: '#fef2f2',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-4)',
                    }}>
                      <div>
                        <p style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', color: '#7f1d1d', margin: 0 }}>
                          Delete {group.code}?
                        </p>
                        {group.member_count > 0 && (
                          <p style={{ fontSize: 'var(--text-xs)', color: '#991b1b', margin: '2px 0 0' }}>
                            {group.member_count} active {group.member_count === 1 ? 'employee' : 'employees'} will have their group cleared.
                          </p>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 'var(--space-2)', flexShrink: 0 }}>
                        <button
                          onClick={() => setDeletingId(null)}
                          style={{ padding: 'var(--space-1-5) var(--space-3)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)', background: 'none', cursor: 'pointer', fontSize: 'var(--text-xs)' }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => deleteMutation.mutate(group.id)}
                          disabled={deleteMutation.isPending}
                          style={{ padding: 'var(--space-1-5) var(--space-3)', borderRadius: 'var(--radius-sm)', border: 'none', background: '#dc2626', color: '#fff', cursor: 'pointer', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)', opacity: deleteMutation.isPending ? 0.6 : 1 }}
                        >
                          {deleteMutation.isPending ? 'Deleting…' : 'Confirm Delete'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Context note */}
        {!isLoading && groups.length > 0 && (
          <div style={{ padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-md)', background: 'var(--surface-subtle)', border: '1px solid var(--border-subtle)' }}>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: 0 }}>
              <strong>G4 active.</strong> Set a default manager per group — used as approval fallback when employees have no direct manager assigned. Default shift (G3) is also live. Assign employees to groups from the{' '}
              <a href="/hr/employees" style={{ color: 'var(--sidebar-active-text)', textDecoration: 'none', fontWeight: 'var(--weight-semibold)' }}>Employees page</a>.
            </p>
          </div>
        )}

      </div>

      {/* Modal */}
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
    </MainLayout>
  );
}
