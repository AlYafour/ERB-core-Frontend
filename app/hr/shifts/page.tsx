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
import type { HRShift, ShiftDaySchedule } from '@/types';

// ── Constants ─────────────────────────────────────────────────────────────────

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
  morning: 'Morning', evening: 'Evening', night: 'Night', flexible: 'Flexible',
};

const TYPE_STYLES: Record<string, { bg: string; color: string }> = {
  morning:  { bg: '#FFF7ED', color: '#B45309' },
  evening:  { bg: '#EFF6FF', color: '#1D6DB8' },
  night:    { bg: '#F5F3FF', color: '#6D28D9' },
  flexible: { bg: 'var(--brand-muted)', color: 'var(--brand)' },
};

function fmtTime(t: string): string {
  if (!t) return '—';
  const [h, m] = t.split(':');
  const hour = parseInt(h, 10);
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`;
}

// ── FormState ─────────────────────────────────────────────────────────────────

type DayRow = { day: number; start_time: string; end_time: string; break_mins: number };

const EMPTY_FORM = {
  name:          '',
  name_ar:       '',
  shift_type:    'morning' as HRShift['shift_type'],
  start_time:    '08:00',
  end_time:      '17:00',
  break_mins:    60,
  work_days:     [0, 1, 2, 3, 4] as number[],
  is_active:     true,
  per_day_times: false,
  day_schedules: [] as DayRow[],
};
type FormState = typeof EMPTY_FORM;

function shiftToForm(s: HRShift): FormState {
  const hasPerDay = s.day_schedules?.length > 0;
  const daySchedules: DayRow[] = hasPerDay
    ? s.work_days.map(d => {
        const found = s.day_schedules.find(ds => ds.day === d);
        return found
          ? { day: d, start_time: found.start_time.slice(0, 5), end_time: found.end_time.slice(0, 5), break_mins: found.break_mins }
          : { day: d, start_time: s.start_time.slice(0, 5), end_time: s.end_time.slice(0, 5), break_mins: s.break_mins };
      })
    : [];
  return {
    name:          s.name,
    name_ar:       s.name_ar,
    shift_type:    s.shift_type,
    start_time:    s.start_time.slice(0, 5),
    end_time:      s.end_time.slice(0, 5),
    break_mins:    s.break_mins,
    work_days:     [...s.work_days],
    is_active:     s.is_active,
    per_day_times: hasPerDay,
    day_schedules: daySchedules,
  };
}

function buildDaySchedules(form: FormState): DayRow[] {
  if (!form.per_day_times) return [];
  return form.work_days.map(d => {
    const found = form.day_schedules.find(ds => ds.day === d);
    return found ?? { day: d, start_time: form.start_time, end_time: form.end_time, break_mins: form.break_mins };
  });
}

const LABEL: React.CSSProperties = {
  fontSize: 'var(--text-xs)', fontWeight: 700,
  color: 'var(--text-secondary)', textTransform: 'uppercase',
  letterSpacing: '0.06em', display: 'block', marginBottom: 6,
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
    setForm(p => ({ ...p, [key]: value }));

  const toggleDay = (day: number) => {
    setForm(p => {
      const next = p.work_days.includes(day)
        ? p.work_days.filter(d => d !== day)
        : [...p.work_days, day].sort((a, b) => a - b);
      const nextDs = p.day_schedules.filter(ds => next.includes(ds.day));
      return { ...p, work_days: next, day_schedules: nextDs };
    });
  };

  const togglePerDay = () => {
    setForm(p => {
      const on = !p.per_day_times;
      const ds = on
        ? p.work_days.map(d => ({ day: d, start_time: p.start_time, end_time: p.end_time, break_mins: p.break_mins }))
        : [];
      return { ...p, per_day_times: on, day_schedules: ds };
    });
  };

  const updateDayRow = (day: number, patch: Partial<DayRow>) =>
    setForm(p => ({
      ...p,
      day_schedules: p.day_schedules.map(ds => ds.day === day ? { ...ds, ...patch } : ds),
    }));

  const canSave = form.name.trim().length > 0 && form.work_days.length > 0;

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width: '100%', maxWidth: 560,
        background: 'var(--surface-base)', borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-xl)', display: 'flex', flexDirection: 'column',
        maxHeight: '92vh', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '18px 22px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <h2 style={{ margin: 0, fontSize: 'var(--text-base)', fontWeight: 700 }}>
            {shift ? 'Edit Shift' : 'New Shift'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 20, lineHeight: 1, padding: 4, borderRadius: 'var(--radius-sm)' }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 22px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Name */}
          <div>
            <label style={LABEL}>Shift Name <span style={{ color: 'var(--color-error)' }}>*</span></label>
            <input
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="e.g. Summer, Winter, Ramadan"
              className="form-input"
              style={{ width: '100%', fontSize: 'var(--text-sm)' }}
            />
          </div>

          {/* Type pills */}
          <div>
            <label style={LABEL}>Type</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {(['morning', 'evening', 'night', 'flexible'] as const).map(t => {
                const active = form.shift_type === t;
                const s = TYPE_STYLES[t];
                return (
                  <button key={t} type="button" onClick={() => set('shift_type', t)}
                    style={{
                      padding: '8px 0', borderRadius: 'var(--radius-md)',
                      fontSize: 'var(--text-xs)', fontWeight: 600, cursor: 'pointer',
                      border: active ? `2px solid ${s.color}` : '1px solid var(--border-default)',
                      background: active ? s.bg : 'transparent',
                      color: active ? s.color : 'var(--text-secondary)',
                      transition: 'all 100ms',
                    }}>
                    {TYPE_LABELS[t]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Work days */}
          <div>
            <label style={LABEL}>Work Days</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
              {WEEKDAYS.map(({ label, value }) => {
                const on = form.work_days.includes(value);
                return (
                  <button key={value} type="button" onClick={() => toggleDay(value)}
                    style={{
                      padding: '7px 0', borderRadius: 'var(--radius-sm)',
                      border: on ? '2px solid var(--brand)' : '1px solid var(--border-default)',
                      background: on ? 'var(--brand)' : 'transparent',
                      color: on ? '#fff' : 'var(--text-secondary)',
                      fontSize: 'var(--text-xs)', fontWeight: 600, cursor: 'pointer',
                    }}>
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Default times — hidden when per-day is on */}
          <div style={{ display: form.per_day_times ? 'none' : undefined }}>
            <label style={LABEL}>Schedule</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 90px', gap: 10 }}>
              <div>
                <span style={{ ...LABEL, marginBottom: 4, fontSize: 10 }}>Start</span>
                <input type="time" value={form.start_time} onChange={e => set('start_time', e.target.value)}
                  className="form-input" style={{ width: '100%', fontSize: 'var(--text-sm)' }} />
              </div>
              <div>
                <span style={{ ...LABEL, marginBottom: 4, fontSize: 10 }}>End</span>
                <input type="time" value={form.end_time} onChange={e => set('end_time', e.target.value)}
                  className="form-input" style={{ width: '100%', fontSize: 'var(--text-sm)' }} />
              </div>
              <div>
                <span style={{ ...LABEL, marginBottom: 4, fontSize: 10 }}>Break (min)</span>
                <input type="number" min={0} max={480} value={form.break_mins}
                  onChange={e => set('break_mins', parseInt(e.target.value) || 0)}
                  className="form-input" style={{ width: '100%', fontSize: 'var(--text-sm)' }} />
              </div>
            </div>
          </div>

          {/* Per-day toggle */}
          {form.work_days.length > 0 && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
              <div onClick={togglePerDay} style={{ width: 38, height: 20, borderRadius: 99, flexShrink: 0, background: form.per_day_times ? 'var(--brand)' : 'var(--border-default)', position: 'relative', cursor: 'pointer', transition: 'background 180ms' }}>
                <div style={{ position: 'absolute', top: 2, left: form.per_day_times ? 19 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 180ms', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
              </div>
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                Different times per day
              </span>
            </label>
          )}

          {/* Per-day schedule table */}
          {form.per_day_times && form.work_days.length > 0 && (
            <div style={{ borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
              {/* Table header */}
              <div style={{ display: 'grid', gridTemplateColumns: '52px 1fr 1fr 80px', gap: 0, background: 'var(--surface-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
                {['Day', 'Start', 'End', 'Break'].map(h => (
                  <div key={h} style={{ padding: '6px 10px', fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</div>
                ))}
              </div>
              {/* Rows */}
              {form.work_days.map((day, i) => {
                const row = form.day_schedules.find(ds => ds.day === day) ??
                  { day, start_time: form.start_time, end_time: form.end_time, break_mins: form.break_mins };
                const isLast = i === form.work_days.length - 1;
                return (
                  <div key={day} style={{ display: 'grid', gridTemplateColumns: '52px 1fr 1fr 80px', gap: 0, borderBottom: isLast ? 'none' : '1px solid var(--border-subtle)', alignItems: 'center' }}>
                    <div style={{ padding: '8px 10px', fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {WEEKDAYS[day]?.label}
                    </div>
                    <div style={{ padding: '6px 8px 6px 0' }}>
                      <input type="time" value={row.start_time}
                        onChange={e => updateDayRow(day, { start_time: e.target.value })}
                        className="form-input" style={{ width: '100%', fontSize: 'var(--text-xs)', padding: '4px 8px' }} />
                    </div>
                    <div style={{ padding: '6px 8px 6px 0' }}>
                      <input type="time" value={row.end_time}
                        onChange={e => updateDayRow(day, { end_time: e.target.value })}
                        className="form-input" style={{ width: '100%', fontSize: 'var(--text-xs)', padding: '4px 8px' }} />
                    </div>
                    <div style={{ padding: '6px 10px 6px 0' }}>
                      <input type="number" min={0} max={480} value={row.break_mins}
                        onChange={e => updateDayRow(day, { break_mins: parseInt(e.target.value) || 0 })}
                        className="form-input" style={{ width: '100%', fontSize: 'var(--text-xs)', padding: '4px 8px' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Active toggle */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
            <div onClick={() => set('is_active', !form.is_active)} style={{ width: 38, height: 20, borderRadius: 99, flexShrink: 0, background: form.is_active ? 'var(--brand)' : 'var(--border-default)', position: 'relative', cursor: 'pointer', transition: 'background 180ms' }}>
              <div style={{ position: 'absolute', top: 2, left: form.is_active ? 19 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 180ms', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
            </div>
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
              {form.is_active ? 'Active' : 'Inactive'}
            </span>
          </label>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'flex-end', gap: 10, flexShrink: 0 }}>
          <button type="button" onClick={onClose} disabled={isSaving}
            style={{ padding: '8px 18px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', background: 'none', cursor: 'pointer', fontSize: 'var(--text-sm)' }}>
            Cancel
          </button>
          <button type="button" disabled={isSaving || !canSave}
            onClick={() => canSave && onSave({ ...form, day_schedules: buildDaySchedules(form) })}
            style={{ padding: '8px 22px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--brand)', color: '#fff', cursor: canSave ? 'pointer' : 'not-allowed', fontSize: 'var(--text-sm)', fontWeight: 600, opacity: isSaving || !canSave ? 0.55 : 1 }}>
            {isSaving ? 'Saving…' : shift ? 'Save Changes' : 'Create Shift'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Day chips (table) ─────────────────────────────────────────────────────────

function DayChips({ days }: { days: number[] }) {
  if (!days?.length) return <span style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>—</span>;
  return (
    <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
      {WEEKDAYS.map(({ label, value }) => {
        const on = days.includes(value);
        return (
          <span key={value} style={{
            fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
            background: on ? 'var(--brand)' : 'var(--surface-subtle)',
            color: on ? '#fff' : 'var(--text-tertiary)',
            opacity: on ? 1 : 0.45,
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
    mutationFn: (data: FormState) => hrShiftsApi.create({ ...data, day_schedules: data.day_schedules }),
    onSuccess: () => { invalidate(); setModalShift(null); toast('Shift created', 'success'); },
    onError: () => toast('Failed to create shift', 'error'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: FormState }) =>
      hrShiftsApi.update(id, { ...data, day_schedules: data.day_schedules }),
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
        toast('Cannot delete — shift is assigned to employees.', 'error');
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>{s.name}</span>
          {s.day_schedules?.length > 0 && (
            <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'var(--surface-subtle)', color: 'var(--text-tertiary)', fontWeight: 500 }}>
              custom days
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'shift_type',
      header: 'Type',
      width: '100px',
      render: s => {
        const st = TYPE_STYLES[s.shift_type] ?? TYPE_STYLES.morning;
        return (
          <span style={{ display: 'inline-flex', padding: '3px 10px', borderRadius: 99, fontSize: 'var(--text-xs)', fontWeight: 600, background: st.bg, color: st.color }}>
            {TYPE_LABELS[s.shift_type]}
          </span>
        );
      },
    },
    {
      key: 'start_time',
      header: 'Schedule',
      width: '160px',
      render: s => s.day_schedules?.length > 0 ? (
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>Varies per day</span>
      ) : (
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
          {fmtTime(s.start_time)} – {fmtTime(s.end_time)}
        </span>
      ),
    },
    {
      key: 'break_mins',
      header: 'Break',
      width: '70px',
      render: s => <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{s.break_mins}m</span>,
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
      selectable={true}
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
