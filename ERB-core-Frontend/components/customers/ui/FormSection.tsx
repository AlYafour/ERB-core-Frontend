'use client';
import { ReactNode } from 'react';

interface FormSectionProps {
  title: string;
  children: ReactNode;
}

export default function FormSection({ title, children }: FormSectionProps) {
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{
        padding: 'var(--space-3) var(--card-padding)',
        background: 'var(--surface-inset)',
        borderBottom: '1px solid var(--border-subtle)',
      }}>
        <h3 style={{
          fontSize: 'var(--text-xs)',
          fontWeight: 'var(--weight-semibold)',
          color: 'var(--text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          margin: 0,
        }}>
          {title}
        </h3>
      </div>
      <div style={{
        padding: 'var(--card-padding)',
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 'var(--space-4)',
      }}>
        {children}
      </div>
    </div>
  );
}
