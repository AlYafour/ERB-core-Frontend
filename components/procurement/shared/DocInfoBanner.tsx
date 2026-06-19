'use client';
import React from 'react';

interface Field {
  label: string;
  value: React.ReactNode;
}

interface Props {
  title: string;
  fields: Field[];
  variant?: 'info' | 'warning';
}

export function DocInfoBanner({ title, fields, variant = 'info' }: Props) {
  const isWarning = variant === 'warning';
  return (
    <div style={{
      padding: '10px 16px',
      borderRadius: 10,
      border: `1px solid ${isWarning ? 'rgba(217,119,6,0.3)' : 'var(--status-info-border)'}`,
      background: isWarning ? 'rgba(255,251,235,0.8)' : 'var(--status-info-bg)',
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: '12px 24px',
    }}>
      <span style={{
        fontSize: 10,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: isWarning ? '#92400e' : 'var(--brand)',
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}>{title}</span>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 24px', flex: 1 }}>
        {fields.map((f, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontSize: 'var(--text-xs)', color: isWarning ? '#92400e' : 'var(--text-secondary)', flexShrink: 0 }}>{f.label}:</span>
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-primary)' }}>{f.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
