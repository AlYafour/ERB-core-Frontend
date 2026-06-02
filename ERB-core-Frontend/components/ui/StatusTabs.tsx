'use client';

export interface StatusTabOption {
  value: string;
  label: string;
  count?: number;
}

interface StatusTabsProps {
  options: StatusTabOption[];
  value: string; // '' = All
  onChange: (value: string) => void;
}

export default function StatusTabs({ options, value, onChange }: StatusTabsProps) {
  const all: StatusTabOption[] = [{ value: '', label: 'All' }, ...options];

  return (
    <div style={{
      display: 'flex',
      borderBottom: '1px solid var(--border-subtle)',
      paddingLeft: 14,
      overflowX: 'auto',
      scrollbarWidth: 'none',
    }}>
      {all.map(opt => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(active && opt.value !== '' ? '' : opt.value)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '9px 12px',
              fontSize: 'var(--text-sm)',
              fontWeight: active ? 600 : 400,
              color: active ? 'var(--brand)' : 'var(--text-secondary)',
              background: 'transparent',
              border: 'none',
              borderBottom: active ? '2px solid var(--brand)' : '2px solid transparent',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'color 100ms, border-color 100ms',
              marginBottom: -1,
              outline: 'none',
              flexShrink: 0,
            }}
            onMouseEnter={e => { if (!active) e.currentTarget.style.color = 'var(--text-primary)'; }}
            onMouseLeave={e => { if (!active) e.currentTarget.style.color = 'var(--text-secondary)'; }}
          >
            {opt.label}
            {opt.count !== undefined && opt.count > 0 && (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: 18,
                height: 18,
                padding: '0 5px',
                borderRadius: 9,
                background: active ? 'rgba(124,45,58,0.12)' : 'var(--surface-subtle)',
                fontSize: 11,
                fontWeight: 600,
                color: active ? 'var(--brand)' : 'var(--text-tertiary)',
                transition: 'background 100ms, color 100ms',
              }}>
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
