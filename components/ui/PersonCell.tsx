'use client';

// Person cell = name (+ optional secondary line). No avatar / initials circle —
// people are shown by name across the whole app, never a photo or a coloured
// letter bubble.

export function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

// ── Component ─────────────────────────────────────────────────

export interface PersonCellProps {
  /** Display name — required */
  name: string;
  /** Secondary line: role, ID, email, position, etc. */
  secondary?: string | null;
  /** Retained for API compatibility; person photos are no longer rendered. */
  avatarUrl?: string | null;
  /** Retained for API compatibility; kept for call-site parity. */
  size?: 'sm' | 'md';
  /** Extra class on the root element */
  className?: string;
}

export function PersonCell({
  name,
  secondary,
  className,
}: PersonCellProps) {
  return (
    <div className={`person-cell${className ? ` ${className}` : ''}`}>
      <span className="person-cell-body">
        <span className="person-cell-name">{name}</span>
        {secondary && <span className="person-cell-sub">{secondary}</span>}
      </span>
    </div>
  );
}
