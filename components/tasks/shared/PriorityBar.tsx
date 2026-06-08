'use client';

import type { TaskPriority } from '@/types';
import { PRIORITY_CONFIG } from './constants';

export function PriorityBar({ priority }: { priority: TaskPriority }) {
  const { color, label, levels } = PRIORITY_CONFIG[priority];
  const barHeights = [5, 7, 10, 13];

  return (
    <span
      title={label}
      style={{ display: 'inline-flex', alignItems: 'flex-end', gap: 2, flexShrink: 0 }}
    >
      {[1, 2, 3, 4].map((l) => (
        <span
          key={l}
          style={{
            width: 3,
            height: barHeights[l - 1],
            borderRadius: 2,
            background: l <= levels ? color : 'var(--border-subtle)',
            transition: 'background 0.15s',
          }}
        />
      ))}
    </span>
  );
}
