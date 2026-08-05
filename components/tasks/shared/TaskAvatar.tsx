'use client';

import type { CSSProperties } from 'react';

interface Props {
  name: string;
  url?: string | null;
  size?: number;
}

export function TaskAvatar({ name, url, size = 28 }: Props) {
  const initials = (name || '?')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const sz: CSSProperties = { width: size, height: size, fontSize: size * 0.38 };

  if (url) {
    return (
      <img
        src={url}
        alt={name}
        style={{ ...sz, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
      />
    );
  }

  return (
    <div
      style={{
        ...sz,
        borderRadius: '50%',
        background: 'var(--brand)',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );
}
