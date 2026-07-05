'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AppListPage } from '@/components/app/AppListPage';
import { useTableState } from '@/lib/hooks/use-table-state';
import { type Column } from '@/components/ui/DataTable';
import { RowActions } from '@/components/ui/RowActions';
import { Badge, Button } from '@/components/ui';
import { hrShiftsApi } from '@/lib/api/hr';
import { useMyPermissions } from '@/lib/hooks/use-my-permissions';
import { toast, confirm } from '@/lib/hooks/use-toast';
import type { HRShift } from '@/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

const WEEKDAYS = [
  { label: 'Mon', value: 0 },
  { label: 'Tue', value: 1 },
  { label: 'Wed', value: 2 },
  { label: 'Thu', value: 3 },
  { label: 'Fri', value: 4 },
  { label: 'Sat', value: 5 },
  { label: 'Sun', value: 6 },
];

const TYPE_LABELS: Record<string, string> = {
  morning:  'Morning',
  evening:  'Evening',
  night:    'Night',
  flexible: 'Flexible',
};

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  morning:  { bg: 'var(--brand-muted)', text: 'var(--brand)' },
  evening:  { bg: 'var(--border-subtle)', text: 'var(--text-secondary)' },
  night:    { bg: 'var(--surface-subtle)', text: 'var(--text-secondary)' },
  flexible: { bg: 'var(--brand-muted)', text: 'var(--brand)' },
};

function fmtTime(t: string): string {
  if (!t) return '—';
  const [h, m] = t.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12  = hour % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

function workDayLabels(days: number[]): string {
  if (!days?.length) return '—';
  return days.map(d => WEEKDAYS[d]?.label ?? d).join(' · ');
}

// ── FormState ─────────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  name:       '',
  name_ar:    '',
  shift_type: 'morning' as HRShift['shift_type'],
  start_time: '08:00',
  end_time:   '17:00',
  break_mins: 60,
  work_days:  [0, 1, 2, 3, 4] as number[],
  is_active:  true,
};
type FormState = typeof EMPTY_FORM;

function shiftToForm(s: HRShift): FormState {
  return {
    name:       s.name,
    name_ar:    s.name_ar,
    shift_type: s.shift_type,
    start_time: s.start_time.slice(0, 5),
    end_time:   s.end_time.slice(0, 5),
    break_mins: s.break_mins,
    work_days:  [...s.work_days],
    is_active:  s.is_active,
  };
}

// ── Label style ───────────────────────────────────────────────────────────────
const LABEL_STYLE: React.CSSProperties = {
  fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)',
  color: 'var(--text-secondary)', textTransform: 'uppercase',
  letterSpacing: '0.05em', display: 'block', marginBottom: 'var(--space-1-5)',
};

// ── Modal ─────────────────────────────────────────────────────────────────────
function ShiftModal({
  shift,
  onClose,
  onSave,
  isSaving,
}: {
  shift: HRShift | null;
  onClose: () => void;
  onSave: (data: FormState) => void;
  isSaving: boolean;
}) {
  const [form, setForm] = useState<FormState>(shift ? shiftToForm(shift) : EMPTY_FORM);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const toggleDay = (day: number) => {
    setForm(prev => ({
      ...prev,
      work_days: prev.work_days.includes(day)
        ? prev.work_days.filter(d => d !== day)
        : [...prev.work_days, day].sort((a, b) => a - b),
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    onSave(form);
  };

  const typeColor = TYPE_COLORS[form.shift_type] ?? TYPE_COLORS.morning;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 'var(--space-4)',
        overflowY: 'auto',
      }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="card" style={{ width: '100%', maxWidth: 560, padding: 'var(--space-6)', position: 'relative', margin: 'auto' }}>
        <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)', margin: '0 0 var(--space-5)' }}>
          {shift ? 'Edit Shift' : 'Create Shift'}
        </h2>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>

          {/* Name row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            <div>
              <label style={LABEL_STYLE}>Name <span style={{ color: 'var(--color-error)' }}>*</span></label>
              <input
                value={form.name}
                onChange={e => set('name', e.target.value)}
                placeholder="e.g. Summer, Winter, Ramadan"
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
                placeholder="اسم الوردية"
                className="form-input"
                dir="rtl"
                style={{ width: '100%', fontSize: 'var(--text-sm)' }}
              />
            </div>
          </div>

          {/* Type */}
          <div>
            <label style={LABEL_STYLE}>Shift Type</label>
            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
              {(['morning', 'evening', 'night', 'flexible'] as const).map(t => {
                const c = TYPE_COLORS[t];
                const active = form.shift_type === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => set('shift_type', t)}
                    style={{
                      padding: '5px 14px', borderRadius: 99, fontSize: 'var(--text-xs)',
                      fontWeight: 'var(--weight-semibold)', cursor: 'pointer',
                      border: active ? '2px solid currentColor' : '1px solid var(--border-default)',
                      background: active ? c.bg : 'none',
                      color: active ? c.text : 'var(--text-secondary)',
                      transition: 'all 120ms',
                    }}
                  >
                    {TYPE_LABELS[t]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Times + Break */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 110px', gap: 'var(--space-3)' }}>
            <div>
              <label style={LABEL_STYLE}>Start Time <span style={{ color: 'var(--color-error)' }}>*</span></label>
              <input
                type="time"
                value={form.start_time}
                onChange={e => set('start_time', e.target.value)}
                required
                className="form-input"
                style={{ width: '100%', fontSize: 'var(--text-sm)' }}
              />
            </div>
            <div>
              <label style={LABEL_STYLE}>End Time <span style={{ color: 'var(--color-error)' }}>*</span></label>
              <input
                type="time"
                value={form.end_time}
                onChange={e => set('end_time', e.target.value)}
                required
                className="form-input"
                style={{ width: '100%', fontSize: 'var(--text-sm)' }}
              />
            </div>
            <div>
              <label style={LABEL_STYLE}>Break (min)</label>
              <input
                type="number"
                min={0}
                max={480}
                value={form.break_mins}
                onChange={e => set('break_mins', parseInt(e.target.value, 10) || 0)}
                className="form-input"
                style={{ width: '100%', fontSize: 'var(--text-sm)' }}
              />
            </div>
          </div>

          {/* Work days */}
          <div>
            <label style={LABEL_STYLE}>Work Days</label>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              {WEEKDAYS.map(({ label, value }) => {
                const active = form.work_days.includes(value);
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => toggleDay(value)}
                    style={{
                      width: 40, height: 40, borderRadius: 'var(--radius-sm)',
                      border: active ? '2px solid var(--brand)' : '1px solid var(--border-default)',
                      background: active ? 'var(--brand)' : 'none',
                      color: active ? 'var(--card-bg)' : 'var(--text-secondary)',
                      fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)',
                      cursor: 'pointer', transition: 'all 120ms', flexShrink: 0,
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            {form.work_days.length === 0 && (
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-error)', margin: 'var(--space-1) 0 0' }}>
                Select at least one work day.
              </p>
            )}
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
              {form.is_active ? 'Active — available for group and employee assignment' : 'Inactive — hidden from assignment pickers'}
            </span>
          </label>

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', paddingTop: 'var(--space-2)', borderTop: '1px solid var(--border-subtle)' }}>
            <button type="button" onClick={onClose} disabled={isSaving}
              style={{ padding: 'var(--space-2) var(--space-4)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', background: 'none', cursor: 'pointer', fontSize: 'var(--text-sm)' }}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || !form.name.trim() || form.work_days.length === 0}
              style={{
                padding: 'var(--space-2) var(--space-5)', borderRadius: 'var(--radius-md)',
                border: 'none', background: 'var(--brand)', color: 'var(--card-bg)',
                cursor: 'pointer', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)',
                opacity: isSaving ? 0.6 : 1,
              }}
            >
              {isSaving ? 'Saving…' : shift ? 'Save Changes' : 'Create Shift'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ShiftsPage() {
  const { hasPermission } = useMyPermissions();
  const admin = hasPermission('hr.hr_employee.view');
  const queryClient = useQueryClient();

  const tableState = useTableState();
  const { search } = tableState;

  const [modalShift, setModalShift] = useState<HRShift | null | 'new'>(null);

  const { data: raw, isLoading } = useQuery({
    queryKey: ['hr-shifts'],
    queryFn: () => hrShiftsApi.getAll(),
    staleTime: 60_000,
  });

  const allShifts: HRShift[] = raw?.results ?? [];

  const filtered = !search
    ? allShifts
    : allShifts.filter(s =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        (s.name_ar && s.name_ar.includes(search))
      );

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['hr-shifts'] });

  const createMutation = useMutation({
    mutationFn: (data: FormState) => hrShiftsApi.create(data),
    onSuccess: () => { invalidate(); setModalShift(null); toast('Shift created', 'success'); },
    onError: () => toast('Failed to create shift', 'error'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: FormState }) => hrShiftsApi.update(id, data),
    onSuccess: () => { invalidate(); setModalShift(null); toast('Shift updated', 'success'); },
    onError: () => toast('Failed to update shift', 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => hrShiftsApi.delete(id),
    onSuccess: () => { invalidate(); toast('Shift deleted', 'success'); },
    onError: (err: unknown) => {
      const errTyped = err as { response?: { data?: { detail?: string }; status?: number } };
      const detail = errTyped?.response?.data?.detail ?? '';
      if (detail.toLowerCase().includes('protected') || errTyped?.response?.status === 409) {
        toast('Cannot delete — this shift has active employee assignments. Remove assignments first.', 'error');
      } else {
        toast('Failed to delete shift', 'error');
      }
    },
  });

  const handleSave = (data: FormState) => {
    if (modalShift === 'new') {
      createMutation.mutate(data);
    } else if (modalShift) {
      updateMutation.mutate({ id: modalShift.id, data });
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const columns: Column<HRShift>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (shift) => (
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {shift.name}
          </p>
          {shift.name_ar && (
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: '2px 0 0', direction: 'rtl', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {shift.name_ar}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'shift_type',
      header: 'Type',
      width: '100px',
      render: (shift) => {
        const tc = TYPE_COLORS[shift.shift_type] ?? TYPE_COLORS.morning;
        return (
          <span style={{
            display: 'inline-flex', alignItems: 'center',
            padding: '3px 10px', borderRadius: 99, fontSize: 'var(--text-xs)',
            fontWeight: 'var(--weight-semibold)',
            background: tc.bg, color: tc.text,
          }}>
            {TYPE_LABELS[shift.shift_type]}
          </span>
        );
      },
    },
    {
      key: 'start_time',
      header: 'Schedule',
      width: '160px',
      render: (shift) => (
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0, whiteSpace: 'nowrap' }}>
          {fmtTime(shift.start_time)} – {fmtTime(shift.end_time)}
        </p>
      ),
    },
    {
      key: 'break_mins',
      header: 'Break',
      width: '70px',
      render: (shift) => (
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0 }}>
          {shift.break_mins}m
        </p>
      ),
    },
    {
      key: 'work_days',
      header: 'Work Days',
      render: (shift) => (
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {workDayLabels(shift.work_days)}
        </p>
      ),
    },
    {
      key: 'is_active',
      header: 'Status',
      width: '90px',
      render: (shift) => (
        <Badge variant={shift.is_active ? 'active' : 'inactive'} size="sm">
          {shift.is_active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: '48px',
      render: (shift) => (
        <RowActions
          actions={[
            {
              label: 'Edit',
              onClick: () => setModalShift(shift),
            },
            { separator: true },
            {
              label: 'Delete',
              variant: 'danger',
              onClick: async () => {
                if (await confirm(`Delete shift "${shift.name}"?`)) {
                  deleteMutation.mutate(shift.id);
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
      title="Work Shifts"
      description="Define named work schedules (Summer, Winter, Ramadan…) and assign them to employee groups."
      breadcrumbs={[
        { label: 'Home', href: '/' },
        { label: 'HR' },
        { label: 'Work Shifts' },
      ]}
      totalCount={allShifts.length}
      createAction={
        admin ? (
          <Button variant="primary" size="sm" onClick={() => setModalShift('new')}>
            + Create Shift
          </Button>
        ) : undefined
      }
      columns={columns}
      data={filtered}
      isLoading={isLoading}
      emptyTitle="No shifts yet. Create your first shift to define work schedules for employee groups."
      tableState={tableState}
      searchPlaceholder="Search shifts…"
    >
      {/* Shift Modal */}
      {modalShift !== null && (
        <ShiftModal
          shift={modalShift === 'new' ? null : modalShift}
          onClose={() => setModalShift(null)}
          onSave={handleSave}
          isSaving={isSaving}
        />
      )}
    </AppListPage>
  );
}
