'use client';
import { ReactNode } from 'react';

interface FormActionBarProps {
  left?: ReactNode;
  right: ReactNode;
}

export default function FormActionBar({ left, right }: FormActionBarProps) {
  return (
    <div style={{
      position: 'sticky',
      bottom: 0,
      zIndex: 20,
      background: 'var(--navbar-bg)',
      borderTop: '1px solid var(--border-subtle)',
      boxShadow: '0 -4px 16px -4px rgb(28 20 20 / 0.08)',
      padding: 'var(--space-3) var(--space-5)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      borderRadius: '0 0 var(--radius-lg) var(--radius-lg)',
    }}>
      <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
        {left}
      </div>
      <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
        {right}
      </div>
    </div>
  );
}
