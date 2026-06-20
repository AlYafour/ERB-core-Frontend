'use client';

// ── Colour palette — deterministic from name hash ─────────────
const PALETTE = [
  { bg: '#dbeafe', text: '#1d4ed8' },
  { bg: '#dcfce7', text: '#15803d' },
  { bg: '#fce7f3', text: '#be185d' },
  { bg: '#fef3c7', text: '#b45309' },
  { bg: '#ede9fe', text: '#6d28d9' },
  { bg: '#ffedd5', text: '#c2410c' },
  { bg: '#e0f2fe', text: '#0369a1' },
  { bg: '#ecfdf5', text: '#065f46' },
  { bg: '#fdf4ff', text: '#86198f' },
  { bg: '#fff7ed', text: '#9a3412' },
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
