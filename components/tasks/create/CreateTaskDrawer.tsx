'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { TaskType, TaskPriority, TaskDetail } from '@/types';
import { tasksApi, teamsApi } from '@/lib/api/tasks';
import { usersApi } from '@/lib/api/users';
import { BRAND, BRAND_HEX, PRIORITY_CONFIG } from '../shared/constants';
import { toast } from '@/lib/hooks/use-toast';
import { getApiError } from '@/lib/utils/error';

interface Props {
  onClose: () => void;
}

// ─── Small shared input style ──────────────────────────────────────────────────

const INPUT: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  borderRadius: 8,
  border: '1px solid var(--border-subtle)',
  fontSize: 13,
  background: 'var(--surface-subtle)',
  color: 'var(--text-primary)',
  boxSizing: 'border-box',
  outline: 'none',
  fontFamily: 'inherit',
  transition: 'border-color 0.15s',
};

function onFocusBrand(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
  e.currentTarget.style.borderColor = BRAND;
}
function onBlurSubtle(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
  e.currentTarget.style.borderColor = 'var(--border-subtle)';
}

// ─── Section header ────────────────────────────────────────────────────────────

function SectionHead({ label, icon }: { label: string; icon: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 14 }}>
      <span style={{
        width: 24, height: 24, borderRadius: 6,
        background: `${BRAND_HEX}15`, border: `1px solid ${BRAND_HEX}25`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        {icon}
      </span>
      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
    </div>
  );
}

// ─── Field label ───────────────────────────────────────────────────────────────

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <label style={{
      display: 'block', fontSize: 11, fontWeight: 700,
      color: 'var(--text-tertiary)', textTransform: 'uppercase',
      letterSpacing: '0.06em', marginBottom: 6,
    }}>
      {label}
      {required && <span style={{ color: '#EF4444', marginLeft: 2 }}>*</span>}
    </label>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export function CreateTaskDrawer({ onClose }: Props) {
  const qc = useQueryClient();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [taskType, setTaskType] = useState<TaskType>('task');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [assignTo, setAssignTo] = useState('');
  const [assignTeam, setAssignTeam] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [requiresApproval, setRequiresApproval] = useState(true);

  const { data: users = [] } = useQuery({
    queryKey: ['users-mini'],
    queryFn: () => usersApi.getAll({ page_size: 200 }).then((r) => r.results || []),
  });

  const { data: teamsRaw } = useQuery({
    queryKey: ['teams'],
    queryFn: () => teamsApi.getAll(),
  });
  const teams = teamsRaw ?? [];

  const create = useMutation({
    mutationFn: () =>
      tasksApi.create({
        title: title.trim(),
        description: description.trim() || undefined,
        task_type: taskType,
        priority,
        requires_approval: requiresApproval,
        due_date: dueDate || undefined,
        assigned_to: assignTo ? Number(assignTo) : undefined,
        assigned_team: assignTeam ? Number(assignTeam) : undefined,
      } as unknown as Partial<TaskDetail>),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['task-stats'] });
      onClose();
    },
    onError: (err: unknown) => toast(getApiError(err, 'Failed to create task'), 'error'),
  });

  const canSubmit = title.trim().length > 0 && !create.isPending;

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.45)', display: 'flex', justifyContent: 'flex-end' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width: '100%',
        maxWidth: 500,
        background: 'var(--card-bg)',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '-6px 0 48px rgba(0,0,0,0.18)',
        animation: 'slideInRight 0.2s var(--ease-spring)',
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 22px 16px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
        }}>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Create Task</h2>
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 3 }}>
              Fill in the details below
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border-subtle)',
              background: 'var(--surface-subtle)', cursor: 'pointer', fontSize: 18,
              color: 'var(--text-secondary)', display: 'flex', alignItems: 'center',
              justifyContent: 'center', transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#FEF2F2'; e.currentTarget.style.color = '#EF4444'; e.currentTarget.style.borderColor = '#FECACA'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--surface-subtle)'; e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 22px' }}>

          {/* ── Basic info ──────────────────────────────────────── */}
          <SectionHead label="Task Details" icon={
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={BRAND} strokeWidth="2.5" strokeLinecap="round">
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
              <rect x="9" y="3" width="6" height="4" rx="1"/>
            </svg>
          } />

          <div style={{ marginBottom: 14 }}>
            <FieldLabel label="Title" required />
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              autoFocus
              style={INPUT}
              onFocus={onFocusBrand}
              onBlur={onBlurSubtle}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <FieldLabel label="Description" />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add context, instructions, or notes…"
              rows={3}
              style={{ ...INPUT, resize: 'vertical', lineHeight: 1.55 }}
              onFocus={onFocusBrand as unknown as React.FocusEventHandler<HTMLTextAreaElement>}
              onBlur={onBlurSubtle as unknown as React.FocusEventHandler<HTMLTextAreaElement>}
            />
          </div>

          {/* ── Classification ───────────────────────────────────── */}
          <SectionHead label="Classification" icon={
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={BRAND} strokeWidth="2.5" strokeLinecap="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
          } />

          {/* Type */}
          <div style={{ marginBottom: 14 }}>
            <FieldLabel label="Task Type" />
            <div style={{ display: 'flex', gap: 6 }}>
              {([
                ['task', 'Task'],
                ['request', 'Request'],
                ['issue', 'Issue'],
                ['followup', 'Follow-up'],
              ] as [TaskType, string][]).map(([val, lbl]) => (
                <button
                  key={val}
                  onClick={() => setTaskType(val)}
                  style={{
                    flex: 1,
                    padding: '7px 4px',
                    borderRadius: 8,
                    border: `1.5px solid ${taskType === val ? BRAND : 'var(--border-subtle)'}`,
                    background: taskType === val ? `${BRAND_HEX}12` : 'transparent',
                    color: taskType === val ? BRAND : 'var(--text-tertiary)',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.12s',
                  }}
                >
                  {lbl}
                </button>
              ))}
            </div>
          </div>

          {/* Priority */}
          <div style={{ marginBottom: 20 }}>
            <FieldLabel label="Priority" />
            <div style={{ display: 'flex', gap: 6 }}>
              {(['critical', 'high', 'medium', 'low'] as TaskPriority[]).map((p) => {
                const pc = PRIORITY_CONFIG[p];
                const active = priority === p;
                return (
                  <button
                    key={p}
                    onClick={() => setPriority(p)}
                    style={{
                      flex: 1,
                      padding: '8px 4px',
                      borderRadius: 8,
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer',
                      textTransform: 'capitalize',
                      border: `1.5px solid ${active ? pc.color : 'var(--border-subtle)'}`,
                      background: active ? pc.bg : 'transparent',
                      color: active ? pc.color : 'var(--text-tertiary)',
                      transition: 'all 0.12s',
                    }}
                  >
                    {p === 'critical' ? 'Crit.' : p.charAt(0).toUpperCase() + p.slice(1)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Assignment ───────────────────────────────────────── */}
          <SectionHead label="Assignment" icon={
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={BRAND} strokeWidth="2.5" strokeLinecap="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          } />

          <div style={{ marginBottom: 14 }}>
            <FieldLabel label="Assign to person" />
            <select
              value={assignTo}
              onChange={(e) => setAssignTo(e.target.value)}
              style={INPUT}
              onFocus={onFocusBrand as unknown as React.FocusEventHandler<HTMLSelectElement>}
              onBlur={onBlurSubtle as unknown as React.FocusEventHandler<HTMLSelectElement>}
            >
              <option value="">— Unassigned —</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.first_name && u.last_name ? `${u.first_name} ${u.last_name}` : u.username}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 20 }}>
            <FieldLabel label="Assign to team" />
            <select
              value={assignTeam}
              onChange={(e) => setAssignTeam(e.target.value)}
              style={INPUT}
              onFocus={onFocusBrand as unknown as React.FocusEventHandler<HTMLSelectElement>}
              onBlur={onBlurSubtle as unknown as React.FocusEventHandler<HTMLSelectElement>}
            >
              <option value="">— No team —</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          {/* ── Scheduling ───────────────────────────────────────── */}
          <SectionHead label="Scheduling" icon={
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={BRAND} strokeWidth="2.5" strokeLinecap="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          } />

          <div style={{ marginBottom: 20 }}>
            <FieldLabel label="Due date & time" />
            <input
              type="datetime-local"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              style={INPUT}
              onFocus={onFocusBrand}
              onBlur={onBlurSubtle}
            />
          </div>

          {/* ── Settings ─────────────────────────────────────────── */}
          <SectionHead label="Settings" icon={
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={BRAND} strokeWidth="2.5" strokeLinecap="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
            </svg>
          } />

          <label
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 11,
              cursor: 'pointer',
              padding: '13px 15px',
              background: requiresApproval ? `${BRAND_HEX}08` : 'var(--surface-subtle)',
              borderRadius: 10,
              border: `1.5px solid ${requiresApproval ? BRAND_HEX + '35' : 'var(--border-subtle)'}`,
              transition: 'all 0.15s',
            }}
          >
            <input
              type="checkbox"
              checked={requiresApproval}
              onChange={(e) => setRequiresApproval(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: BRAND, flexShrink: 0, cursor: 'pointer', marginTop: 1 }}
            />
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                Requires approval
              </p>
              <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 3, lineHeight: 1.5 }}>
                Task must be reviewed and approved before closing
              </p>
            </div>
          </label>
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 22px',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          gap: 9,
          flexShrink: 0,
          background: 'var(--surface-subtle)',
        }}>
          <button
            onClick={() => create.mutate()}
            disabled={!canSubmit}
            style={{
              flex: 1,
              padding: '11px',
              borderRadius: 9,
              border: 'none',
              background: BRAND,
              color: '#fff',
              fontSize: 14,
              fontWeight: 700,
              cursor: canSubmit ? 'pointer' : 'not-allowed',
              opacity: canSubmit ? 1 : 0.5,
              transition: 'opacity 0.15s, transform 0.1s',
              boxShadow: canSubmit ? `0 4px 14px ${BRAND_HEX}35` : 'none',
            }}
            onMouseEnter={(e) => { if (canSubmit) e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; }}
          >
            {create.isPending ? 'Creating…' : 'Create Task'}
          </button>
          <button
            onClick={onClose}
            style={{
              padding: '11px 22px',
              borderRadius: 9,
              border: '1px solid var(--border-subtle)',
              background: 'var(--card-bg)',
              color: 'var(--text-secondary)',
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-subtle)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--card-bg)')}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
