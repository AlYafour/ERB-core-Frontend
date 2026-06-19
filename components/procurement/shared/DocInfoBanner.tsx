'use client';

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
    <div className="card" style={{
      backgroundColor: isWarning ? 'var(--warning-bg, #fffbeb)' : 'var(--info-banner-bg)',
      borderColor: isWarning ? 'var(--warning-border, #fcd34d)' : 'var(--info-banner-border)',
      borderWidth: 1,
      borderStyle: 'solid',
    }}>
      <p style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', color: isWarning ? '#92400e' : 'var(--info-banner-text)', margin: '0 0 var(--space-2)' }}>
        {title}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-2)', fontSize: 'var(--text-sm)' }}>
        {fields.map((f, i) => (
          <div key={i}>
            <span style={{ color: 'var(--info-banner-text)' }}>{f.label}: </span>
            <span style={{ fontWeight: 'var(--weight-medium)', color: 'var(--text-primary)' }}>{f.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
