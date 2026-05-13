'use client';
import { ReactNode } from 'react';

interface FormSectionProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  children: ReactNode;
}

export default function FormSection({ title, description, icon, children }: FormSectionProps) {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      {/* Section header */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)',
        paddingBottom: 'var(--space-4)', borderBottom: '1px solid var(--border-subtle)',
      }}>
        {icon && (
          <div style={{
            width: 34, height: 34, borderRadius: 'var(--radius-md)',
            background: 'var(--brand-subtle)', border: '1px solid var(--brand-muted)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--brand)', flexShrink: 0,
          }}>
            {icon}
          </div>
        )}
        <div>
          <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-primary)', margin: 0 }}>
            {title}
          </h3>
          {description && (
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 'var(--space-1) 0 0', lineHeight: 1.5 }}>
              {description}
            </p>
          )}
        </div>
      </div>

      {/* Section fields grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-4)' }}>
        {children}
      </div>
    </div>
  );
}
