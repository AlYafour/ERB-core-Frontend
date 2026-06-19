'use client';

import { ReactNode } from 'react';

interface PageShellProps {
  children: ReactNode;
  className?: string;
  compact?: boolean;
}

export function PageShell({ children, className, compact }: PageShellProps) {
  return (
    <div
      className={className}
      style={{ display: 'flex', flexDirection: 'column', gap: compact ? '12px' : '1.25rem' }}
    >
      {children}
    </div>
  );
}
