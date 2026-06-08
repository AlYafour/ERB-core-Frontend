'use client';
import { useState } from 'react';
import { Button } from '@/components/ui';

const OwnerIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const CommercialIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

const ConsultantIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="20" height="14" rx="2" />
    <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
    <line x1="12" y1="12" x2="12" y2="16" />
    <line x1="10" y1="14" x2="14" y2="14" />
  </svg>
);

const TYPES = [
  {
    value: 'owner',
    label: 'Owner',
    description: 'Individual with direct property ownership rights and personal identification documents',
    Icon: OwnerIcon,
  },
  {
    value: 'commercial',
    label: 'Commercial',
    description: 'Business entity or commercial organization operating under a valid trade license',
    Icon: CommercialIcon,
  },
  {
    value: 'consultant',
    label: 'Consultant',
    description: 'Professional consulting or advisory firm registered with relevant authorities',
    Icon: ConsultantIcon,
  },
];

interface CustomerTypeSelectorProps {
  onConfirm: (type: string) => void;
}

export default function CustomerTypeSelector({ onConfirm }: CustomerTypeSelectorProps) {
  const [selected, setSelected] = useState('');

  return (
    <div className="card">
      <div style={{ marginBottom: 'var(--space-5)' }}>
        <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-primary)', margin: '0 0 var(--space-1)' }}>
          Select Customer Type
        </h2>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0 }}>
          The customer type determines the required information and documentation for this record.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
        {TYPES.map(({ value, label, description, Icon }) => {
          const isSelected = selected === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setSelected(value)}
              style={{
                position: 'relative',
                display: 'flex', flexDirection: 'column', gap: 'var(--space-3)',
                textAlign: 'left', padding: 'var(--space-5)',
                borderRadius: 'var(--radius-lg)',
                border: isSelected ? '2px solid var(--brand)' : '2px solid var(--border-subtle)',
                background: isSelected ? 'var(--brand-subtle)' : 'var(--surface-subtle)',
                cursor: 'pointer',
              }}
            >
              {isSelected && (
                <div style={{
                  position: 'absolute', top: 12, right: 12,
                  width: 20, height: 20, borderRadius: '50%',
                  background: 'var(--brand)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="2 6 5 9 10 3" />
                  </svg>
                </div>
              )}

              <div style={{
                width: 42, height: 42, borderRadius: 'var(--radius-md)',
                background: isSelected ? 'var(--brand-muted)' : 'var(--card-bg)',
                border: `1px solid ${isSelected ? 'var(--brand-muted)' : 'var(--border-subtle)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: isSelected ? 'var(--brand)' : 'var(--text-tertiary)',
                flexShrink: 0,
              }}>
                <Icon />
              </div>

              <div>
                <p style={{ fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-sm)', color: 'var(--text-primary)', margin: 0 }}>
                  {label}
                </p>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: 'var(--space-1) 0 0', lineHeight: 1.55 }}>
                  {description}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--border-subtle)' }}>
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', margin: 0 }}>
          {selected ? `Selected: ${TYPES.find(t => t.value === selected)?.label}` : 'No type selected yet'}
        </p>
        <Button variant="primary" disabled={!selected} onClick={() => selected && onConfirm(selected)}>
          Continue
        </Button>
      </div>
    </div>
  );
}
