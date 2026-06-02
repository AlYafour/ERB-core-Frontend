/**
 * Design system token layer — TypeScript surface over CSS custom properties.
 * All values reference var(--…) so they inherit light/dark theme automatically.
 * Use these constants in inline styles instead of hardcoded hex values.
 */

// ── Brand ─────────────────────────────────────────────────────────────────────
export const brand = {
  default:  'var(--brand)',
  hover:    'var(--brand-hover)',
  active:   'var(--brand-active)',
  subtle:   'var(--brand-subtle)',
  muted:    'var(--brand-muted)',
  hex:      '#7C2D3A', // for rgba() compositing only — do NOT use for solid fills
} as const;

// ── Text ──────────────────────────────────────────────────────────────────────
export const text = {
  primary:   'var(--text-primary)',
  secondary: 'var(--text-secondary)',
  tertiary:  'var(--text-tertiary)',
  disabled:  'var(--text-disabled)',
  inverse:   'var(--text-inverse)',
  brand:     'var(--text-brand)',
} as const;

// ── Surfaces ──────────────────────────────────────────────────────────────────
export const surface = {
  app:     'var(--surface-app)',
  base:    'var(--surface-base)',
  raised:  'var(--surface-raised)',
  overlay: 'var(--surface-overlay)',
  subtle:  'var(--surface-subtle)',
  inset:   'var(--surface-inset)',
} as const;

// ── Borders ───────────────────────────────────────────────────────────────────
export const border = {
  subtle:  'var(--border-subtle)',
  default: 'var(--border-default)',
  strong:  'var(--border-strong)',
  brand:   'var(--border-brand)',
  focus:   'var(--border-focus)',
} as const;

// ── Shadows ───────────────────────────────────────────────────────────────────
export const shadow = {
  xs: 'var(--shadow-xs)',
  sm: 'var(--shadow-sm)',
  md: 'var(--shadow-md)',
  lg: 'var(--shadow-lg)',
  xl: 'var(--shadow-xl)',
} as const;

// ── Status ────────────────────────────────────────────────────────────────────
export const status = {
  success:        { color: 'var(--status-success)',        bg: 'var(--status-success-bg)',        border: 'var(--status-success-border)' },
  warning:        { color: 'var(--status-warning)',        bg: 'var(--status-warning-bg)',        border: 'var(--status-warning-border)' },
  error:          { color: 'var(--status-error)',          bg: 'var(--status-error-bg)',          border: 'var(--status-error-border)' },
  info:           { color: 'var(--status-info)',           bg: 'var(--status-info-bg)',           border: 'var(--status-info-border)' },
} as const;

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

// ── Radius ────────────────────────────────────────────────────────────────────
export const radius = {
  xs:   'var(--radius-xs)',
  sm:   'var(--radius-sm)',
  md:   'var(--radius-md)',
  lg:   'var(--radius-lg)',
  xl:   'var(--radius-xl)',
  '2xl':'var(--radius-2xl)',
  full: 'var(--radius-full)',
} as const;

// ── Typography ────────────────────────────────────────────────────────────────
export const fontSize = {
  xs:   'var(--text-xs)',
  sm:   'var(--text-sm)',
  base: 'var(--text-base)',
  md:   'var(--text-md)',
  lg:   'var(--text-lg)',
  xl:   'var(--text-xl)',
  '2xl':'var(--text-2xl)',
  '3xl':'var(--text-3xl)',
  '4xl':'var(--text-4xl)',
} as const;

export const fontWeight = {
  normal:   'var(--weight-normal)',
  medium:   'var(--weight-medium)',
  semibold: 'var(--weight-semibold)',
  bold:     'var(--weight-bold)',
} as const;

// ── Animation ─────────────────────────────────────────────────────────────────
export const transition = {
  fast: 'var(--transition-fast)',
  base: 'var(--transition-base)',
  slow: 'var(--transition-slow)',
} as const;

export const ease = {
  spring: 'var(--ease-spring)',
  out:    'var(--ease-out)',
  in:     'var(--ease-in)',
} as const;

// ── Spacing ───────────────────────────────────────────────────────────────────
export const space = {
  0:  'var(--space-0)',
  1:  'var(--space-1)',
  2:  'var(--space-2)',
  3:  'var(--space-3)',
  4:  'var(--space-4)',
  5:  'var(--space-5)',
  6:  'var(--space-6)',
  7:  'var(--space-7)',
  8:  'var(--space-8)',
  10: 'var(--space-10)',
  12: 'var(--space-12)',
  16: 'var(--space-16)',
} as const;
