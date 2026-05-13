'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

interface FormSectionProps {
  title?: string;
  description?: string;
  children: ReactNode;
  columns?: 1 | 2 | 3 | 4;
  className?: string;
  noBorder?: boolean;
}

export default function FormSection({
  title,
  description,
  children,
  columns = 2,
  className,
  noBorder = false,
}: FormSectionProps) {
  const gridCols = {
    1: '1fr',
    2: 'repeat(2, 1fr)',
    3: 'repeat(3, 1fr)',
    4: 'repeat(4, 1fr)',
  }[columns];

  return (
    <div
      className={cn(className)}
      style={{
        paddingBottom: 24,
        marginBottom: noBorder ? 0 : 24,
        borderBottom: noBorder ? 'none' : '1px solid var(--border-subtle)',
      }}
    >
      {(title || description) && (
        <div style={{ marginBottom: 16 }}>
          {title && (
            <h3 style={{
              fontSize: 'var(--text-sm)',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              margin: 0,
              letterSpacing: '0.01em',
            }}>
              {title}
            </h3>
          )}
          {description && (
            <p style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--text-tertiary)',
              margin: '4px 0 0',
              lineHeight: 1.5,
            }}>
              {description}
            </p>
          )}
        </div>
      )}
      <div style={{
        display: 'grid',
        gridTemplateColumns: gridCols,
        gap: 16,
      }}>
        {children}
      </div>
    </div>
  );
}

/* Span helper — use inside FormSection to span multiple columns */
export function ColSpan({
  children,
  span = 2,
  className,
}: {
  children: ReactNode;
  span?: number;
  className?: string;
}) {
  return (
    <div className={cn(className)} style={{ gridColumn: `span ${span}` }}>
      {children}
    </div>
  );
}
