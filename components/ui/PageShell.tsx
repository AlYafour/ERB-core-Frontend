'use client';

import { ReactNode } from 'react';

interface PageShellProps {
  children: ReactNode;
  className?: string;
}

export function PageShell({ children, className }: PageShellProps) {
  return (
    <div
      className={className}
      style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
    >
      {children}
    </div>
  );
}
