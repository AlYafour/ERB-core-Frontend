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

const TYPE_STYLES: Record<string, React.CSSProperties> = {
  morning:  { background: '#FFF7ED', color: '#C2620A' },
  evening:  { background: '#EFF6FF', color: '#1D6DB8' },
  night:    { background: '#F5F3FF', color: '#6D28D9' },
  flexible: { background: 'var(--brand-muted)', color: 'var(--brand)' },
};

function fmtTime(t: string): string {
  if (!t) return '—';
  const [h, m] = t.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12  = hour % 12 || 12;
  return `${h12}:${m} ${ampm}`;
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

const LABEL: React.CSSProperties = {
  fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)',
  color: 'var(--text-secondary)', textTransform: 'uppercase',
  letterSpacing: '0.05em', display: 'block', marginBottom: 'var(--space-1-5)',
};

// ── Modal ─────────────────────────────────────────────────────────────────────

function ShiftModal({ shift, onClose, onSave, isSaving }: {
  shift: HRShift | null;
  onClose: () => void;
  onSave: (data: FormState) => void;
  isSaving: boolean;
}) {
  const [form, setForm] = useState<FormState>(shift ? shiftToForm(shift) : EMPTY_FORM);
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const toggleDay = (day: number) =>
    setForm(prev => ({
      ...prev,
      work_days: prev.work_days.includes(day)
        ? prev.work_days.filter(d => d !== day)
        : [...prev.work_days, day].sort((a, b) => a - b),
    }));

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)' }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="card" style={{ width: '100%', maxWidth: 520, padding: 'var(--space-6)' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-5)' }}>
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)', margin: 0 }}>
            {shift ? 'Edit Shift' : 'New Shift'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 20, lineHeight: 1, padding: 4 }}>✕</button>
        </div>

        <form onSubmit={e => { e.preventDefault(); if (!form.name.trim() || !form.work_days.length) return; onSave(form); }}
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>

          {/* Name */}
          <div>
            <label style={LABEL}>Shift Name <span style={{ color: 'var(--color-error)' }}>*</span></label>
            <input
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="e.g. Summer, Winter, Ramadan"
              required
              className="form-input"
              style={{ width: '100%', fontSize: 'var(--text-sm)' }}
            />
          </div>

          {/* Type */}
          <div>
            <label style={LABEL}>Shift Type</label>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              {(['morning', 'evening', 'night', 'flexible'] as const).map(t => {
                const active = form.shift_type === t;
                const s = TYPE_STYLES[t];
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => set('shift_type', t)}
                    style={{
                      flex: 1, padding: '7px 0', borderRadius: 'var(--radius-md)',
                      fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)',
                      cursor: 'pointer', transition: 'all 120ms',
                      border: active ? '2px solid currentColor' : '1px solid var(--border-default)',
                      background: active ? s.background : 'none',
                      color: active ? s.color : 'var(--text-secondary)',
                    }}
                  >
                    {TYPE_LABELS[t]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Times + Break */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 100px', gap: 'var(--space-3)' }}>
            <div>
              <label style={LABEL}>Start <span style={{ color: 'var(--color-error)' }}>*</span></label>
              <input type="time" value={form.start_time} onChange={e => set('start_time', e.target.value)}
                required className="form-input" style={{ width: '100%', fontSize: 'var(--text-sm)' }} />
            </div>
            <div>
              <label style={LABEL}>End <span style={{ color: 'var(--color-error)' }}>*</span></label>
              <input type="time" value={form.end_time} onChange={e => set('end_time', e.target.value)}
                required className="form-input" style={{ width: '100%', fontSize: 'var(--text-sm)' }} />
            </div>
            <div>
              <label style={LABEL}>Break (min)</label>
              <input type="number" min={0} max={480} value={form.break_mins}
                onChange={e => set('break_mins', parseInt(e.target.value, 10) || 0)}
                className="form-input" style={{ width: '100%', fontSize: 'var(--text-sm)' }} />
            </div>
          </div>

          {/* Work days */}
          <div>
            <label style={LABEL}>Work Days</label>
            <div style={{ display: 'flex', gap: 'var(--space-1-5)' }}>
              {WEEKDAYS.map(({ label, value }) => {
                const active = form.work_days.includes(value);
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => toggleDay(value)}
                    style={{
                      flex: 1, height: 38, borderRadius: 'var(--radius-sm)',
                      border: active ? '2px solid var(--brand)' : '1px solid var(--border-default)',
                      background: active ? 'var(--brand)' : 'none',
                      color: active ? '#fff' : 'var(--text-secondary)',
                      fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)',
                      cursor: 'pointer', transition: 'all 120ms',
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

          {/* Active */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', cursor: 'pointer', userSelect: 'none' }}>
            <div onClick={() => set('is_active', !form.is_active)} style={{ width: 40, height: 22, borderRadius: 99, flexShrink: 0, background: form.is_active ? 'var(--brand)' : 'var(--border-default)', position: 'relative', cursor: 'pointer', transition: 'background 200ms' }}>
              <div style={{ position: 'absolute', top: 3, left: form.is_active ? 21 : 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 200ms', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
            </div>
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
              {form.is_active ? 'Active' : 'Inactive'}
            </span>
          </label>

          {/* Footer */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', paddingTop: 'var(--space-2)', borderTop: '1px solid var(--border-subtle)' }}>
            <button type="button" onClick={onClose} disabled={isSaving}
              style={{ padding: 'var(--space-2) var(--space-4)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', background: 'none', cursor: 'pointer', fontSize: 'var(--text-sm)' }}>
              Cancel
            </button>
            <button type="submit" disabled={isSaving || !form.name.trim() || form.work_days.length === 0}
              style={{ padding: 'var(--space-2) var(--space-5)', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--brand)', color: '#fff', cursor: 'pointer', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', opacity: isSaving ? 0.6 : 1 }}>
              {isSaving ? 'Saving…' : shift ? 'Save Changes' : 'Create Shift'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Day chips (table display) ──────────────────────────────────────────────────

function DayChips({ days }: { days: number[] }) {
  if (!days?.length) return <span style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)' }}>—</span>;
  return (
    <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
      {WEEKDAYS.map(({ label, value }) => {
        const on = days.includes(value);
        return (
          <span key={value} style={{
            fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4,
            background: on ? 'var(--brand)' : 'var(--surface-subtle)',
            color: on ? '#fff' : 'var(--text-tertiary)',
            opacity: on ? 1 : 0.5,
          }}>
            {label}
          </span>
        );
      })}
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
    : allShifts.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));

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
      const e = err as { response?: { data?: { detail?: string }; status?: number } };
      const detail = e?.response?.data?.detail ?? '';
      if (detail.toLowerCase().includes('protected') || e?.response?.status === 409) {
        toast('Cannot delete — shift is assigned to employees. Remove assignments first.', 'error');
      } else {
        toast('Failed to delete shift', 'error');
      }
    },
  });

  const handleSave = (data: FormState) => {
    if (modalShift === 'new') createMutation.mutate(data);
    else if (modalShift) updateMutation.mutate({ id: modalShift.id, data });
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const columns: Column<HRShift>[] = [
    {
      key: 'name',
      header: 'Shift Name',
      render: s => (
        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)' }}>
          {s.name}
        </span>
      ),
    },
    {
      key: 'shift_type',
      header: 'Type',
      width: '100px',
      render: s => {
        const st = TYPE_STYLES[s.shift_type] ?? TYPE_STYLES.morning;
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 99, fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)', ...st }}>
            {TYPE_LABELS[s.shift_type]}
          </span>
        );
      },
    },
    {
      key: 'start_time',
      header: 'Schedule',
      width: '160px',
      render: s => (
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
          {fmtTime(s.start_time)} – {fmtTime(s.end_time)}
        </span>
      ),
    },
    {
      key: 'break_mins',
      header: 'Break',
      width: '70px',
      render: s => (
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
          {s.break_mins}m
        </span>
      ),
    },
    {
      key: 'work_days',
      header: 'Work Days',
      width: '240px',
      render: s => <DayChips days={s.work_days} />,
    },
    {
      key: 'is_active',
      header: 'Status',
      width: '90px',
      render: s => <Badge variant={s.is_active ? 'active' : 'inactive'} size="sm">{s.is_active ? 'Active' : 'Inactive'}</Badge>,
    },
    {
      key: 'actions',
      header: '',
      width: '48px',
      render: s => (
        <RowActions actions={[
          { label: 'Edit', onClick: () => setModalShift(s), hidden: !admin },
          { separator: true },
          { label: 'Delete', variant: 'danger', hidden: !admin, onClick: async () => {
            if (await confirm(`Delete shift "${s.name}"?`)) deleteMutation.mutate(s.id);
          }},
        ]} />
      ),
    },
  ];

  return (
    <AppListPage
      title="Work Shifts"
      description="Define named work schedules and assign them to employee groups."
      breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'HR' }, { label: 'Work Shifts' }]}
      totalCount={allShifts.length}
      createAction={admin ? (
        <Button variant="primary" size="sm" onClick={() => setModalShift('new')}>+ Create Shift</Button>
      ) : undefined}
      columns={columns}
      data={filtered}
      isLoading={isLoading}
      emptyTitle="No shifts yet. Create your first shift to define work schedules."
      tableState={tableState}
      searchPlaceholder="Search shifts…"
    >
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
