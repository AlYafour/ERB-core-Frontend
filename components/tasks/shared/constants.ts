import type { TaskStatus, TaskPriority } from '@/types';
import { taskStatus, priority as priorityTokens } from '@/lib/design-system/tokens';

export const BRAND = 'var(--brand)';
export const BRAND_HEX = '#7C2D3A'; // for rgba() compositing only — do NOT use for solid fills

export const STATUS_CONFIG: Record<TaskStatus, { label: string; color: string; bg: string; border: string }> = {
  draft:       { label: 'Draft',        ...taskStatus.draft },
  assigned:    { label: 'Assigned',     ...taskStatus.assigned },
  accepted:    { label: 'Accepted',     ...taskStatus.accepted },
  in_progress: { label: 'In Progress',  ...taskStatus.in_progress },
  submitted:   { label: 'Submitted',    ...taskStatus.submitted },
  review:      { label: 'Under Review', ...taskStatus.review },
  approved:    { label: 'Approved',     ...taskStatus.approved },
  rejected:    { label: 'Rejected',     ...taskStatus.rejected },
  closed:      { label: 'Closed',       ...taskStatus.closed },
};

export const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string; bg: string; border: string; levels: number }> = {
  critical: { label: 'Critical', ...priorityTokens.critical, levels: 4 },
  high:     { label: 'High',     ...priorityTokens.high,     levels: 3 },
  medium:   { label: 'Medium',   ...priorityTokens.medium,   levels: 2 },
  low:      { label: 'Low',      ...priorityTokens.low,      levels: 1 },
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
