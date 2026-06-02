'use client';

import type { CSSProperties } from 'react';
import type { TaskStatus } from '@/types';
import { STATUS_CONFIG } from './constants';

export function StatusBadge({ status }: { status: TaskStatus }) {
  const { label, color, bg, border } = STATUS_CONFIG[status];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '3px 9px',
        borderRadius: 99,
        background: bg,
        color,
        fontSize: 11,
        fontWeight: 600,
        border: `1px solid ${border}`,
        whiteSpace: 'nowrap',
      } as CSSProperties}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: color,
          flexShrink: 0,
        }}
      />
      {label}
    </span>
  );
}
