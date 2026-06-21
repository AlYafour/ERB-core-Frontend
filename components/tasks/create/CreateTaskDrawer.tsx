'use client';

import { useState, useRef, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { TaskType, TaskPriority, TaskDetail } from '@/types';
import { tasksApi, teamsApi, taskAttachmentsApi } from '@/lib/api/tasks';
import { usersApi } from '@/lib/api/users';
import { useAuth } from '@/lib/hooks/use-auth';
import { BRAND, BRAND_HEX, PRIORITY_CONFIG, TYPE_LABEL } from '../shared/constants';
import { toast } from '@/lib/hooks/use-toast';
import { getApiError } from '@/lib/utils/error';
import { CloseButton } from '../detail/_shared';

interface Props {
  onClose: () => void;
}

// ── Avatar helpers ─────────────────────────────────────────────────────────

function getInitials(first: string, last: string, username: string): string {
  if (first && last) return (first[0] + last[0]).toUpperCase();
  if (first) return first.slice(0, 2).toUpperCase();
  return (username || '?').slice(0, 2).toUpperCase();
}

function getAvatarColor(str: string): string {
  const palette = [
    '#c2410c', '#b45309', '#15803d', '#0e7490', '#1d4ed8',
    '#6d28d9', '#7c3aed', '#a21caf', '#be185d', '#0f766e',
  ];
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return palette[Math.abs(h) % palette.length];
}

// ── Small Avatar circle ────────────────────────────────────────────────────

function Avatar({ inits, color, size = 26 }: { inits: string; color: string; size?: number }) {
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: size, height: size, borderRadius: '50%',
        background: color + '20', color, flexShrink: 0,
        fontSize: Math.round(size * 0.38), fontWeight: 700, letterSpacing: '-0.03em',
        border: `1.5px solid ${color}30`,
      }}
    >
      {inits}
    </span>
  );
}

// ── Chevron icon ───────────────────────────────────────────────────────────

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="13" height="13" viewBox="0 0 24 24" fill="none"
      style={{
        flexShrink: 0, color: 'var(--text-tertiary)',
        transition: 'transform .15s', transform: open ? 'rotate(180deg)' : 'none',
      }}
    >
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── SearchableCombobox ─────────────────────────────────────────────────────

interface ComboItem {
  id: number;
  label: string;
  sublabel?: string;
  inits: string;
  color: string;
}

interface ComboboxProps {
  items: ComboItem[];
  value: number | null;
  onChange: (id: number | null) => void;
  placeholder: string;
  clearLabel?: string;
}

function SearchableCombobox({ items, value, onChange, placeholder, clearLabel = '— None —' }: ComboboxProps) {
  const [open, setOpen]     = useState(false);
  const [query, setQuery]   = useState('');
  const [cursor, setCursor] = useState<number | null>(null);
  const containerRef        = useRef<HTMLDivElement>(null);
  const inputRef            = useRef<HTMLInputElement>(null);
  const listRef             = useRef<HTMLDivElement>(null);

  const selected = items.find((i) => i.id === value) ?? null;

  const filtered = query.trim()
    ? items.filter((i) =>
        i.label.toLowerCase().includes(query.toLowerCase()) ||
        (i.sublabel ?? '').toLowerCase().includes(query.toLowerCase()),
      )
    : items;

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  function openDrop() {
    setOpen(true);
    setQuery('');
    setCursor(null);
    setTimeout(() => inputRef.current?.focus(), 10);
  }

  function pick(id: number | null) {
    onChange(id);
    setOpen(false);
    setQuery('');
    setCursor(null);
  }

  function scrollItem(id: number) {
    listRef.current?.querySelector(`[data-cbid="${id}"]`)?.scrollIntoView({ block: 'nearest' });
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { setOpen(false); setQuery(''); return; }
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDrop(); }
      return;
    }
    const len = filtered.length;
    if (!len) return;
    const cur = cursor !== null ? filtered.findIndex((i) => i.id === cursor) : -1;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = filtered[(cur + 1) % len];
      setCursor(next.id); scrollItem(next.id);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = filtered[(cur - 1 + len) % len];
      setCursor(prev.id); scrollItem(prev.id);
    } else if (e.key === 'Enter' && cursor !== null) {
      e.preventDefault();
      pick(cursor);
    }
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }} onKeyDown={onKeyDown}>

      {/* ── Trigger ─────────────────────────── */}
      <button
        type="button"
        onClick={() => open ? (setOpen(false), setQuery('')) : openDrop()}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          width: '100%', textAlign: 'left', padding: '8px 10px',
          background: 'var(--surface-subtle)',
          border: `1.5px solid ${open ? BRAND : 'var(--border-subtle)'}`,
          borderRadius: 8, cursor: 'pointer', transition: 'border-color .15s',
          minHeight: 40,
        }}
      >
        {selected ? (
          <>
            <Avatar inits={selected.inits} color={selected.color} size={24} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{
                fontSize: 13, fontWeight: 500, color: 'var(--text-primary)',
                display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {selected.label}
              </span>
              {selected.sublabel && (
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                  {selected.sublabel}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); pick(null); }}
              aria-label="Clear"
              style={{
                padding: '2px 5px', lineHeight: 1, fontSize: 16,
                color: 'var(--text-tertiary)', background: 'none',
                border: 'none', cursor: 'pointer', flexShrink: 0, borderRadius: 4,
              }}
            >
              ×
            </button>
          </>
        ) : (
          <>
            <span style={{ flex: 1, fontSize: 13, color: 'var(--text-tertiary)' }}>
              {placeholder}
            </span>
            <Chevron open={open} />
          </>
        )}
      </button>

      {/* ── Dropdown ────────────────────────── */}
      {open && (
        <div
          style={{
            position: 'absolute', top: 'calc(100% + 5px)', left: 0, right: 0,
            background: '#fff', border: '1.5px solid var(--border-subtle)',
            borderRadius: 10, boxShadow: '0 8px 28px rgba(0,0,0,.15)',
            zIndex: 1200, overflow: 'hidden',
          }}
        >
          {/* Search */}
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 7, background: '#fff',
              padding: '8px 10px', borderBottom: '1px solid var(--border-subtle)',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--text-tertiary)', flexShrink: 0 }}>
              <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2" />
              <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => { setQuery(e.target.value); setCursor(null); }}
              placeholder="Search…"
              style={{
                flex: 1, border: 'none', outline: 'none',
                background: 'transparent', fontSize: 13, color: 'var(--text-primary)',
              }}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                style={{
                  fontSize: 15, color: 'var(--text-tertiary)',
                  background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1,
                }}
              >
                ×
              </button>
            )}
          </div>

          {/* Items */}
          <div ref={listRef} style={{ maxHeight: 226, overflowY: 'auto' }}>

            <button
              type="button"
              onClick={() => pick(null)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                width: '100%', padding: '8px 12px', background: '#fff', border: 'none',
                cursor: 'pointer', fontSize: 12, color: 'var(--text-tertiary)',
                borderBottom: '1px solid var(--border-subtle)', textAlign: 'left',
              }}
            >
              {clearLabel}
            </button>

            {filtered.length === 0 && (
              <p style={{
                margin: 0, padding: '18px 12px', fontSize: 13,
                color: 'var(--text-tertiary)', textAlign: 'center',
              }}>
                {query ? `No results for "${query}"` : 'No items'}
              </p>
            )}

            {filtered.map((item) => {
              const isSelected = value === item.id;
              const isHovered  = cursor === item.id;
              return (
                <button
                  key={item.id}
                  data-cbid={item.id}
                  type="button"
                  onClick={() => pick(item.id)}
                  onMouseEnter={() => setCursor(item.id)}
                  onMouseLeave={() => setCursor(null)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    width: '100%', padding: '8px 12px', border: 'none',
                    cursor: 'pointer', textAlign: 'left', transition: 'background .1s',
                    background: isSelected
                      ? `${BRAND_HEX}10`
                      : isHovered
                      ? '#f5f5f4'
                      : '#fff',
                  }}
                >
                  <Avatar inits={item.inits} color={item.color} size={30} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      margin: 0, fontSize: 13, color: 'var(--text-primary)',
                      fontWeight: isSelected ? 600 : 400,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {item.label}
                    </p>
                    {item.sublabel && (
                      <p style={{ margin: 0, fontSize: 11, color: 'var(--text-tertiary)' }}>
                        {item.sublabel}
                      </p>
                    )}
                  </div>
                  {isSelected && (
                    <span style={{ color: BRAND, fontSize: 14, fontWeight: 800, flexShrink: 0 }}>✓</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Form layout helpers ────────────────────────────────────────────────────

function SectionHead({ label }: { label: string }) {
  return (
    <div className="form-section__head">
      <span className="form-section__label">{label}</span>
      <div className="form-section__line" />
    </div>
  );
}

function FieldRow({ label, required, aside, children }: {
  label: string;
  required?: boolean;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="form-field">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <label className="field-label" style={{ margin: 0 }}>
          {label}
          {required && <span className="field-required">*</span>}
        </label>
        {aside}
      </div>
      {children}
    </div>
  );
}

// ── CreateTaskDrawer ───────────────────────────────────────────────────────

export function CreateTaskDrawer({ onClose }: Props) {
  const qc           = useQueryClient();
  const { user: me } = useAuth();

  const [title,            setTitle]            = useState('');
  const [description,      setDescription]      = useState('');
  const [taskType,         setTaskType]         = useState<TaskType>('task');
  const [priority,         setPriority]         = useState<TaskPriority>('medium');
  const [assignTo,         setAssignTo]         = useState<number | null>(null);
  const [assignTeam,       setAssignTeam]       = useState<number | null>(null);
  const [dueDate,          setDueDate]          = useState('');
  const [requiresApproval, setRequiresApproval] = useState(true);
  const [files,            setFiles]            = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: usersRaw = [] } = useQuery({
    queryKey: ['users-mini'],
    queryFn: () => usersApi.getAll({ page_size: 200 }).then((r) => r.results || []),
  });

  const { data: teamsRaw } = useQuery({
    queryKey: ['teams'],
    queryFn: () => teamsApi.getAll(),
  });
  const teamsAll = (teamsRaw ?? []) as import('@/types').Team[];

  // When a team is selected, scope assignees to its members only
  const selectedTeam = assignTeam ? teamsAll.find(t => t.id === assignTeam) : null;
  const assigneePool = selectedTeam
    ? selectedTeam.members.map(m => m.user_detail)
    : (usersRaw as { id: number; username: string; first_name?: string; last_name?: string; role?: string }[]);

  const toComboItem = (u: { id: number; username: string; first_name?: string; last_name?: string; full_name?: string; role?: string }): ComboItem => {
    const first = u.first_name ?? '';
    const last  = u.last_name  ?? '';
    const label = u.full_name || (first && last ? `${first} ${last}` : u.username);
    return {
      id:       u.id,
      label,
      sublabel: u.role ? `@${u.username} · ${u.role}` : `@${u.username}`,
      inits:    getInitials(first, last, u.username),
      color:    getAvatarColor(label),
    };
  };

  // If selected team changed, clear assignTo if not in new team's members
  const validAssigneeIds = selectedTeam
    ? new Set(selectedTeam.members.map(m => m.user_detail.id))
    : null;
  const effectiveAssignTo = validAssigneeIds && assignTo !== null && !validAssigneeIds.has(assignTo)
    ? null
    : assignTo;

  const userItems: ComboItem[] = assigneePool.map(toComboItem);

  const teamItems: ComboItem[] = (teamsAll as {
    id: number; name: string; member_count?: number;
  }[]).map((t) => ({
    id:       t.id,
    label:    t.name,
    sublabel: t.member_count != null
      ? `${t.member_count} member${t.member_count !== 1 ? 's' : ''}`
      : undefined,
    inits: t.name.slice(0, 2).toUpperCase(),
    color: getAvatarColor(t.name),
  }));

  const create = useMutation({
    mutationFn: async () => {
      const task = await tasksApi.create({
        title:             title.trim(),
        description:       description.trim() || undefined,
        task_type:         taskType,
        priority,
        requires_approval: requiresApproval,
        due_date:          dueDate || undefined,
        assigned_to:       effectiveAssignTo ?? undefined,
        assigned_team:     assignTeam ?? undefined,
      } as unknown as Partial<TaskDetail>);
      if (files.length > 0) {
        await Promise.all(files.map((f) => taskAttachmentsApi.upload(task.id, f)));
      }
      return task;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['task-stats'] });
      onClose();
    },
    onError: (err: unknown) => toast(getApiError(err, 'Failed to create task'), 'error'),
  });

  const canSubmit = title.trim().length > 0 && !create.isPending;

  // ⌘/Ctrl + Enter to submit from anywhere in the drawer
  function handleKeyDown(e: React.KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && canSubmit) create.mutate();
  }

  const meId = (me as { id?: number } | null)?.id ?? null;

  return (
    <div
      className="task-drawer-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="task-drawer-panel task-drawer-panel--sm" onKeyDown={handleKeyDown}>

        {/* Header */}
        <div className="task-drawer-header">
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              New Task
            </h2>
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: '3px 0 0' }}>
              Fill in the details below
              {' · '}
              <kbd style={{
                fontSize: 11, background: 'var(--surface-subtle)', color: 'var(--text-secondary)',
                padding: '1px 5px', borderRadius: 4, border: '1px solid var(--border-subtle)',
                fontFamily: 'inherit',
              }}>
                ⌘↵
              </kbd>
              {' '}to create
            </p>
          </div>
          <CloseButton onClick={onClose} />
        </div>

        {/* Body */}
        <div className="task-drawer-body">

          {/* ── Task Details ─────────────────────────────────── */}
          <div className="form-section">
            <SectionHead label="Task Details" />

            <FieldRow label="Title" required>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What needs to be done?"
                maxLength={500}
                autoFocus
                className="task-input"
              />
              {title.length > 400 && (
                <p style={{
                  fontSize: 11, margin: '3px 0 0', textAlign: 'right',
                  color: title.length > 480 ? '#dc2626' : 'var(--text-tertiary)',
                }}>
                  {title.length} / 500
                </p>
              )}
            </FieldRow>

            <FieldRow label="Description">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add context, instructions, or notes…"
                rows={3}
                className="task-input task-input--textarea"
              />
            </FieldRow>
          </div>

          {/* ── Classification ───────────────────────────────── */}
          <div className="form-section">
            <SectionHead label="Classification" />

            <FieldRow label="Task Type">
              <div className="pill-group">
                {(Object.keys(TYPE_LABEL) as TaskType[]).map((val) => {
                  const active = taskType === val;
                  return (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setTaskType(val)}
                      className="pill-btn"
                      {...(active ? { 'data-active': '' } : {})}
                      style={active ? { border: `1.5px solid ${BRAND}`, background: `${BRAND_HEX}12`, color: BRAND } : {}}
                    >
                      {TYPE_LABEL[val]}
                    </button>
                  );
                })}
              </div>
            </FieldRow>

            <FieldRow label="Priority">
              <div className="pill-group">
                {(['critical', 'high', 'medium', 'low'] as TaskPriority[]).map((p) => {
                  const pc     = PRIORITY_CONFIG[p];
                  const active = priority === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPriority(p)}
                      className="pill-btn"
                      {...(active ? { 'data-active': '' } : {})}
                      style={active ? { border: `1.5px solid ${pc.color}`, background: pc.bg, color: pc.color } : {}}
                    >
                      {pc.label}
                    </button>
                  );
                })}
              </div>
            </FieldRow>
          </div>

          {/* ── Assignment ───────────────────────────────────── */}
          <div className="form-section">
            <SectionHead label="Assignment" />

            <FieldRow
              label={selectedTeam ? `Assign to person (${userItems.length} team members)` : 'Assign to person'}
              aside={
                meId && effectiveAssignTo !== meId ? (
                  <button
                    type="button"
                    onClick={() => setAssignTo(meId)}
                    style={{
                      fontSize: 11, fontWeight: 600, color: BRAND,
                      background: 'none', border: 'none', cursor: 'pointer',
                      padding: 0, textDecoration: 'underline', textUnderlineOffset: 2,
                    }}
                  >
                    Assign to me
                  </button>
                ) : null
              }
            >
              <SearchableCombobox
                items={userItems}
                value={effectiveAssignTo}
                onChange={setAssignTo}
                placeholder={selectedTeam ? `Search ${userItems.length} team members…` : 'Search and select a person…'}
                clearLabel="— Unassigned —"
              />
            </FieldRow>

            <FieldRow label="Assign to team">
              <SearchableCombobox
                items={teamItems}
                value={assignTeam}
                onChange={setAssignTeam}
                placeholder="Search and select a team…"
                clearLabel="— No team —"
              />
            </FieldRow>
          </div>

          {/* ── Scheduling ───────────────────────────────────── */}
          <div className="form-section">
            <SectionHead label="Scheduling" />
            <FieldRow label="Due date & time">
              <input
                type="datetime-local"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="task-input"
              />
            </FieldRow>
          </div>

          {/* ── Settings ─────────────────────────────────────── */}
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

          {/* ── Attachments ──────────────────────────────────── */}
          <div className="form-section">
            <SectionHead label="Attachments" />
            <input
              ref={fileInputRef}
              type="file"
              multiple
              style={{ display: 'none' }}
              onChange={(e) => {
                const picked = Array.from(e.target.files ?? []);
                setFiles((prev) => {
                  const existing = new Set(prev.map((f) => f.name + f.size));
                  return [...prev, ...picked.filter((f) => !existing.has(f.name + f.size))];
                });
                e.target.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                width: '100%', padding: '9px 12px',
                border: '1.5px dashed var(--border-default)',
                borderRadius: 8, background: 'var(--surface-subtle)',
                color: 'var(--text-secondary)', fontSize: 13,
                cursor: 'pointer', transition: 'border-color .15s, color .15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = BRAND; e.currentTarget.style.color = BRAND; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
              </svg>
              Attach files
            </button>
            {files.length > 0 && (
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {files.map((f, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '6px 10px', borderRadius: 6,
                      background: 'var(--surface-subtle)', border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-tertiary)', flexShrink: 0 }}>
                      <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/><polyline points="13 2 13 9 20 9"/>
                    </svg>
                    <span style={{ flex: 1, fontSize: 12, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {f.name}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)', flexShrink: 0 }}>
                      {f.size < 1024 * 1024
                        ? `${(f.size / 1024).toFixed(0)} KB`
                        : `${(f.size / (1024 * 1024)).toFixed(1)} MB`}
                    </span>
                    <button
                      type="button"
                      onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                      style={{
                        flexShrink: 0, padding: '2px 5px', lineHeight: 1, fontSize: 15,
                        color: 'var(--text-tertiary)', background: 'none',
                        border: 'none', cursor: 'pointer', borderRadius: 4,
                      }}
                      aria-label="Remove file"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
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
