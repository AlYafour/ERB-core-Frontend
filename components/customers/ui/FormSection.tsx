'use client';
import { ReactNode } from 'react';

interface FormSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
}

export default function FormSection({ title, description, children }: FormSectionProps) {
  return (
    <div className="card">
      <h2 className="section-title">{title}</h2>
      {description && (
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: '-var(--space-2) 0 var(--space-4)' }}>
          {description}
        </p>
      )}
      <div className="form-grid">
        {children}
      </div>
    </div>
  );
}
