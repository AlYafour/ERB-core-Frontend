'use client';
import { ReactNode } from 'react';

interface FormActionBarProps {
  left?: ReactNode;
  right: ReactNode;
}

export default function FormActionBar({ left, right }: FormActionBarProps) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: 'var(--space-2) 0',
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
