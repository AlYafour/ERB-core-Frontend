/**
 * Design system token layer — TypeScript surface over CSS custom properties.
 * All values reference var(--…) so they inherit light/dark theme automatically.
 * Use these constants in inline styles instead of hardcoded hex values.
 */

// ── Priority ──────────────────────────────────────────────────────────────────
export const priority = {
  critical: { color: 'var(--priority-critical)', bg: 'var(--priority-critical-bg)', border: 'var(--priority-critical-border)' },
  high:     { color: 'var(--priority-high)',     bg: 'var(--priority-high-bg)',     border: 'var(--priority-high-border)' },
  medium:   { color: 'var(--priority-medium)',   bg: 'var(--priority-medium-bg)',   border: 'var(--priority-medium-border)' },
  low:      { color: 'var(--priority-low)',      bg: 'var(--priority-low-bg)',      border: 'var(--priority-low-border)' },
} as const;

// ── Task status ───────────────────────────────────────────────────────────────
export const taskStatus = {
  draft:       { color: 'var(--task-draft)',       bg: 'var(--task-draft-bg)',       border: 'var(--task-draft-border)' },
  assigned:    { color: 'var(--task-assigned)',    bg: 'var(--task-assigned-bg)',    border: 'var(--task-assigned-border)' },
  accepted:    { color: 'var(--task-accepted)',    bg: 'var(--task-accepted-bg)',    border: 'var(--task-accepted-border)' },
  in_progress: { color: 'var(--task-in_progress)', bg: 'var(--task-in_progress-bg)', border: 'var(--task-in_progress-border)' },
  submitted:   { color: 'var(--task-submitted)',   bg: 'var(--task-submitted-bg)',   border: 'var(--task-submitted-border)' },
  review:      { color: 'var(--task-review)',      bg: 'var(--task-review-bg)',      border: 'var(--task-review-border)' },
  approved:    { color: 'var(--task-approved)',    bg: 'var(--task-approved-bg)',    border: 'var(--task-approved-border)' },
  rejected:    { color: 'var(--task-rejected)',    bg: 'var(--task-rejected-bg)',    border: 'var(--task-rejected-border)' },
  closed:      { color: 'var(--task-closed)',      bg: 'var(--task-closed-bg)',      border: 'var(--task-closed-border)' },
} as const;

