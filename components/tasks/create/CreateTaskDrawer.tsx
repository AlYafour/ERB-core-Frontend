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

const INPUT_STYLE = {
  width: '100%',
  padding: '9px 12px',
  borderRadius: 8,
  border: '1px solid var(--border-subtle)',
  fontSize: 13,
  background: 'var(--surface-subtle)',
  color: 'var(--text-primary)',
  boxSizing: 'border-box' as const,
  outline: 'none',
  fontFamily: 'inherit',
  transition: 'border-color 0.15s',
};

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label
        style={{
          display: 'block',
          fontSize: 11,
          fontWeight: 700,
          color: 'var(--text-tertiary)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          marginBottom: 6,
        }}
      >
        {label}
        {required && <span style={{ color: '#EF4444', marginLeft: 2 }}>*</span>}
      </label>
      {children}
    </div>
  );
}

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
    onError: (err: unknown) => {
      toast(getApiError(err, 'Failed to create task'), 'error');
    },
  });

  const canSubmit = title.trim().length > 0 && !create.isPending;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        justifyContent: 'flex-end',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 480,
          background: 'var(--card-bg)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-4px 0 40px rgba(0,0,0,0.15)',
          animation: 'slideInRight 0.2s ease',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0,
          }}
        >
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>New Task</h2>
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
              Fill in the details below to create a new task
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: '1px solid var(--border-subtle)',
              background: 'var(--surface-subtle)',
              cursor: 'pointer',
              fontSize: 18,
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ×
          </button>
        </div>

        {/* Form body */}
        <div style={{ flex: 1, padding: '22px 24px', overflowY: 'auto' }}>
          <Field label="Title" required>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              autoFocus
              style={INPUT_STYLE}
              onFocus={(e) => (e.currentTarget.style.borderColor = BRAND)}
              onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
            />
          </Field>

          <Field label="Description">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional details, context, or instructions…"
              rows={3}
              style={{ ...INPUT_STYLE, resize: 'vertical', lineHeight: 1.5 }}
              onFocus={(e) => (e.currentTarget.style.borderColor = BRAND)}
              onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
            />
          </Field>

          {/* Type + Priority */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'var(--text-tertiary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  marginBottom: 6,
                }}
              >
                Type
              </label>
              <select
                value={taskType}
                onChange={(e) => setTaskType(e.target.value as TaskType)}
                style={INPUT_STYLE}
              >
                <option value="task">Task</option>
                <option value="request">Request</option>
                <option value="issue">Issue</option>
                <option value="followup">Follow-up</option>
              </select>
            </div>
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'var(--text-tertiary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  marginBottom: 6,
                }}
              >
                Priority
              </label>
              <div style={{ display: 'flex', gap: 6 }}>
                {(['critical', 'high', 'medium', 'low'] as TaskPriority[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPriority(p)}
                    style={{
                      flex: 1,
                      padding: '7px 0',
                      borderRadius: 7,
                      fontSize: 10,
                      fontWeight: 700,
                      cursor: 'pointer',
                      textTransform: 'capitalize',
                      border: `1.5px solid ${priority === p ? PRIORITY_CONFIG[p].color : 'var(--border-subtle)'}`,
                      background: priority === p ? PRIORITY_CONFIG[p].bg : 'transparent',
                      color: priority === p ? PRIORITY_CONFIG[p].color : 'var(--text-tertiary)',
                      transition: 'all 0.15s',
                    }}
                  >
                    {p === 'critical' ? 'Crit.' : p.charAt(0).toUpperCase() + p.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <Field label="Assign to">
            <select
              value={assignTo}
              onChange={(e) => setAssignTo(e.target.value)}
              style={INPUT_STYLE}
            >
              <option value="">— Unassigned —</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.first_name && u.last_name ? `${u.first_name} ${u.last_name}` : u.username}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Assign to team">
            <select
              value={assignTeam}
              onChange={(e) => setAssignTeam(e.target.value)}
              style={INPUT_STYLE}
            >
              <option value="">— No team —</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Due date & time">
            <input
              type="datetime-local"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              style={INPUT_STYLE}
              onFocus={(e) => (e.currentTarget.style.borderColor = BRAND)}
              onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
            />
          </Field>

          {/* Requires approval toggle */}
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              cursor: 'pointer',
              padding: '12px 14px',
              background: 'var(--surface-subtle)',
              borderRadius: 9,
              border: `1.5px solid ${requiresApproval ? BRAND_HEX + '40' : 'var(--border-subtle)'}`,
              transition: 'border-color 0.15s',
            }}
          >
            <input
              type="checkbox"
              checked={requiresApproval}
              onChange={(e) => setRequiresApproval(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: BRAND, flexShrink: 0, cursor: 'pointer' }}
            />
            <div>
              <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                Requires approval
              </p>
              <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>
                Task must be reviewed and approved before closing
              </p>
            </div>
          </label>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            gap: 10,
            flexShrink: 0,
          }}
        >
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
              fontWeight: 600,
              cursor: canSubmit ? 'pointer' : 'not-allowed',
              opacity: canSubmit ? 1 : 0.5,
              transition: 'opacity 0.15s',
            }}
          >
            {create.isPending ? 'Creating…' : 'Create Task'}
          </button>
          <button
            onClick={onClose}
            style={{
              padding: '11px 22px',
              borderRadius: 9,
              border: '1px solid var(--border-subtle)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
