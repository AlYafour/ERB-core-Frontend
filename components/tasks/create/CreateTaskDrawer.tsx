'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { TaskType, TaskPriority, TaskDetail } from '@/types';
import { tasksApi, teamsApi } from '@/lib/api/tasks';
import { usersApi } from '@/lib/api/users';
import { BRAND, BRAND_HEX, PRIORITY_CONFIG } from '../shared/constants';
import { toast } from '@/lib/hooks/use-toast';
import { getApiError } from '@/lib/utils/error';
import { CloseButton } from '../detail/_shared';

interface Props {
  onClose: () => void;
}

function SectionHead({ label }: { label: string }) {
  return (
    <div className="form-section__head">
      <span className="form-section__label">{label}</span>
      <div className="form-section__line" />
    </div>
  );
}

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <label className="field-label">
      {label}
      {required && <span className="field-required">*</span>}
    </label>
  );
}

export function CreateTaskDrawer({ onClose }: Props) {
  const qc = useQueryClient();

  const [title,            setTitle]            = useState('');
  const [description,      setDescription]      = useState('');
  const [taskType,         setTaskType]         = useState<TaskType>('task');
  const [priority,         setPriority]         = useState<TaskPriority>('medium');
  const [assignTo,         setAssignTo]         = useState('');
  const [assignTeam,       setAssignTeam]       = useState('');
  const [dueDate,          setDueDate]          = useState('');
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
        title:            title.trim(),
        description:      description.trim() || undefined,
        task_type:        taskType,
        priority,
        requires_approval: requiresApproval,
        due_date:         dueDate || undefined,
        assigned_to:      assignTo   ? Number(assignTo)   : undefined,
        assigned_team:    assignTeam ? Number(assignTeam) : undefined,
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
      className="task-drawer-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="task-drawer-panel task-drawer-panel--sm">
        {/* Header */}
        <div className="task-drawer-header">
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Create Task
            </h2>
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 3 }}>
              Fill in the details below
            </p>
          </div>
          <CloseButton onClick={onClose} />
        </div>

        {/* Body */}
        <div className="task-drawer-body">

          {/* ── Task Details ─────────────────────────────────────── */}
          <div className="form-section">
            <SectionHead label="Task Details" />
            <div className="form-field">
              <FieldLabel label="Title" required />
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What needs to be done?"
                autoFocus
                className="task-input"
              />
            </div>
            <div className="form-field">
              <FieldLabel label="Description" />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add context, instructions, or notes…"
                rows={3}
                className="task-input task-input--textarea"
              />
            </div>
          </div>

          {/* ── Classification ───────────────────────────────────── */}
          <div className="form-section">
            <SectionHead label="Classification" />

            <div className="form-field">
              <FieldLabel label="Task Type" />
              <div className="pill-group">
                {([
                  ['task',    'Task'],
                  ['request', 'Request'],
                  ['issue',   'Issue'],
                  ['followup','Follow-up'],
                ] as [TaskType, string][]).map(([val, lbl]) => {
                  const active = taskType === val;
                  return (
                    <button
                      key={val}
                      onClick={() => setTaskType(val)}
                      className="pill-btn"
                      {...(active ? { 'data-active': '' } : {})}
                      style={active ? {
                        border: `1.5px solid ${BRAND}`,
                        background: `${BRAND_HEX}12`,
                        color: BRAND,
                      } : {}}
                    >
                      {lbl}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="form-field">
              <FieldLabel label="Priority" />
              <div className="pill-group">
                {(['critical', 'high', 'medium', 'low'] as TaskPriority[]).map((p) => {
                  const pc     = PRIORITY_CONFIG[p];
                  const active = priority === p;
                  return (
                    <button
                      key={p}
                      onClick={() => setPriority(p)}
                      className="pill-btn"
                      {...(active ? { 'data-active': '' } : {})}
                      style={active ? {
                        border: `1.5px solid ${pc.color}`,
                        background: pc.bg,
                        color: pc.color,
                      } : {}}
                    >
                      {p === 'critical' ? 'Crit.' : p.charAt(0).toUpperCase() + p.slice(1)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── Assignment ───────────────────────────────────────── */}
          <div className="form-section">
            <SectionHead label="Assignment" />
            <div className="form-field">
              <FieldLabel label="Assign to person" />
              <select value={assignTo} onChange={(e) => setAssignTo(e.target.value)} className="task-input">
                <option value="">— Unassigned —</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.first_name && u.last_name ? `${u.first_name} ${u.last_name}` : u.username}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <FieldLabel label="Assign to team" />
              <select value={assignTeam} onChange={(e) => setAssignTeam(e.target.value)} className="task-input">
                <option value="">— No team —</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* ── Scheduling ───────────────────────────────────────── */}
          <div className="form-section">
            <SectionHead label="Scheduling" />
            <div className="form-field">
              <FieldLabel label="Due date & time" />
              <input
                type="datetime-local"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="task-input"
              />
            </div>
          </div>

          {/* ── Settings ─────────────────────────────────────────── */}
          <div className="form-section">
            <SectionHead label="Settings" />
            <label
              className="approval-toggle"
              style={{
                background: requiresApproval ? `${BRAND_HEX}08` : 'var(--surface-subtle)',
                border: `1.5px solid ${requiresApproval ? BRAND_HEX + '35' : 'var(--border-subtle)'}`,
              }}
            >
              <input
                type="checkbox"
                checked={requiresApproval}
                onChange={(e) => setRequiresApproval(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: BRAND, flexShrink: 0, cursor: 'pointer', marginTop: 1 }}
              />
              <div>
                <p className="approval-toggle__title">Requires approval</p>
                <p className="approval-toggle__desc">
                  Task must be reviewed and approved before closing
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="task-drawer-footer">
          <button
            onClick={() => create.mutate()}
            disabled={!canSubmit}
            className="task-btn task-btn--primary task-btn--full"
            style={{
              opacity: canSubmit ? 1 : 0.5,
              boxShadow: canSubmit ? `0 4px 14px ${BRAND_HEX}35` : 'none',
            }}
          >
            {create.isPending ? 'Creating…' : 'Create Task'}
          </button>
          <button
            onClick={onClose}
            className="task-btn task-btn--secondary"
            style={{ padding: '11px 22px', fontSize: 14 }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
