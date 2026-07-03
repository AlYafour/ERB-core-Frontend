'use client';

// ── Colour palette — deterministic from name hash ─────────────
// These are intentional avatar accent colors (not UI chrome), kept as-is for
// visual variety. Brand amber tones align with the design language.
const PALETTE = [
  { bg: 'rgba(201,148,58,0.12)', text: '#A07228' },
  { bg: 'var(--surface-subtle)',  text: 'var(--text-secondary)' },
  { bg: 'rgba(224,92,92,0.12)', text: '#E05C5C' },
  { bg: 'rgba(201,148,58,0.18)', text: '#B8832E' },
  { bg: 'var(--surface-app)',    text: 'var(--text-tertiary)' },
  { bg: 'rgba(201,148,58,0.08)', text: '#C9943A' },
  { bg: 'var(--border-subtle)',  text: 'var(--text-secondary)' },
  { bg: 'var(--surface-app)',    text: 'var(--text-secondary)' },
  { bg: 'rgba(224,92,92,0.08)', text: '#DC2626' },
  { bg: 'var(--surface-subtle)', text: 'var(--text-primary)' },
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
  return Math.abs(h);
}

export function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export function getAvatarColor(name: string) {
  return PALETTE[hash(name) % PALETTE.length];
}

// ── Component ─────────────────────────────────────────────────

export interface PersonCellProps {
  /** Display name — required */
  name: string;
  /** Secondary line: role, ID, email, position, etc. */
  secondary?: string | null;
  /** If provided, renders a real photo instead of initials */
  avatarUrl?: string | null;
  /** 'sm' = 28 px  |  'md' = 32 px (default) */
  size?: 'sm' | 'md';
  /** Extra class on the root element */
  className?: string;
}

export function PersonCell({
  name,
  secondary,
  avatarUrl,
  size = 'md',
  className,
}: PersonCellProps) {
  const initials = getInitials(name);
  const color    = getAvatarColor(name);
  const dim      = size === 'sm' ? 28 : 32;
  const fontSize = size === 'sm' ? 10 : 11;

  return (
    <div className={`person-cell${className ? ` ${className}` : ''}`}>
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={name}
          className="person-cell-av"
          style={{ width: dim, height: dim }}
        />
      ) : (
        <span
          className="person-cell-av person-cell-av--initials"
          style={{ width: dim, height: dim, minWidth: dim, background: color.bg, color: color.text, fontSize }}
          aria-hidden="true"
        >
          {initials}
        </span>
      )}
      <span className="person-cell-body">
        <span className="person-cell-name">{name}</span>
        {secondary && <span className="person-cell-sub">{secondary}</span>}
      </span>
    </div>
  );
}
