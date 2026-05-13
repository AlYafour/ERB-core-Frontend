import type { TaskStatus, TaskPriority } from '@/types';

export const BRAND = 'var(--brand)';
export const BRAND_HEX = '#F97316'; // for alpha compositing (var() can't be suffixed)

export const STATUS_CONFIG: Record<TaskStatus, { label: string; color: string; bg: string; border: string }> = {
  draft:       { label: 'Draft',        color: '#64748B', bg: '#F1F5F9', border: '#CBD5E1' },
  assigned:    { label: 'Assigned',     color: '#3B82F6', bg: '#EFF6FF', border: '#BFDBFE' },
  accepted:    { label: 'Accepted',     color: '#8B5CF6', bg: '#F5F3FF', border: '#DDD6FE' },
  in_progress: { label: 'In Progress',  color: '#F59E0B', bg: '#FFFBEB', border: '#FDE68A' },
  submitted:   { label: 'Submitted',    color: '#10B981', bg: '#ECFDF5', border: '#A7F3D0' },
  review:      { label: 'Under Review', color: '#F97316', bg: '#FFF7ED', border: '#FED7AA' },
  approved:    { label: 'Approved',     color: '#16A34A', bg: '#DCFCE7', border: '#86EFAC' },
  rejected:    { label: 'Rejected',     color: '#EF4444', bg: '#FEF2F2', border: '#FECACA' },
  closed:      { label: 'Closed',       color: '#94A3B8', bg: '#F8FAFC', border: '#E2E8F0' },
};

export const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string; bg: string; levels: number }> = {
  critical: { label: 'Critical', color: '#EF4444', bg: '#FEF2F2', levels: 4 },
  high:     { label: 'High',     color: '#F97316', bg: '#FFF7ED', levels: 3 },
  medium:   { label: 'Medium',   color: '#EAB308', bg: '#FEFCE8', levels: 2 },
  low:      { label: 'Low',      color: '#94A3B8', bg: '#F8FAFC', levels: 1 },
};

export const TYPE_LABEL: Record<string, string> = {
  task: 'Task',
  request: 'Request',
  issue: 'Issue',
  followup: 'Follow-up',
};

export const KANBAN_COLS: TaskStatus[] = ['assigned', 'in_progress', 'review', 'approved'];

export const SCOPE_TABS = [
  { value: '',         label: 'All Tasks' },
  { value: 'mine',     label: 'Assigned to Me' },
  { value: 'created',  label: 'Created by Me' },
  { value: 'team',     label: 'My Team' },
  { value: 'watching', label: 'Watching' },
];

export function fmtDate(dt: string | null, mode: 'date' | 'dt' = 'date') {
  if (!dt) return '—';
  const d = new Date(dt);
  const date = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  if (mode === 'dt') return date + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return date;
}

export function isOverdue(t: { due_date: string | null; status: string }) {
  return Boolean(t.due_date && !['approved', 'closed'].includes(t.status) && new Date(t.due_date) < new Date());
}

export function fmtFileSize(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
}
