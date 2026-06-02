'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

export interface RowAction {
  label: string;
  href?: string;
  target?: string;
  onClick?: () => void;
  variant?: 'default' | 'danger';
  hidden?: boolean;
  separator?: true;
}

interface RowActionsProps {
  actions: RowAction[];
}

export default function RowActions({ actions }: RowActionsProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const visible = actions.filter(a => !a.hidden);

  const itemBase: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 8,
    width: '100%', padding: '7px 14px',
    fontSize: 13, fontWeight: 400,
    background: 'transparent', border: 'none',
    cursor: 'pointer', textAlign: 'left',
    transition: 'background 80ms', textDecoration: 'none',
    whiteSpace: 'nowrap',
  };

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 28, height: 28, borderRadius: 6,
          background: open ? 'var(--surface-subtle)' : 'transparent',
          border: `1px solid ${open ? 'var(--border-subtle)' : 'transparent'}`,
          cursor: 'pointer', transition: 'all 120ms',
          color: 'var(--text-secondary)',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = 'var(--surface-subtle)';
          e.currentTarget.style.borderColor = 'var(--border-subtle)';
        }}
        onMouseLeave={e => {
          if (!open) {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.borderColor = 'transparent';
          }
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="5"  r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="12" cy="19" r="2" />
        </svg>
      </button>

      {open && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 40 }}
            onClick={() => setOpen(false)}
          />
          <div style={{
            position: 'absolute', right: 0, top: '100%', marginTop: 4, zIndex: 50,
            background: 'var(--card-bg)', border: '1px solid var(--border-subtle)',
            borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.10)', minWidth: 160,
            padding: '4px 0', overflow: 'hidden',
          }}>
            {visible.map((action, i) => {
              if (action.separator) {
                return (
                  <div key={i} style={{
                    height: 1, background: 'var(--border-subtle)', margin: '4px 0',
                  }} />
                );
              }

              const color = action.variant === 'danger' ? 'var(--status-error)' : 'var(--text-primary)';
              const hoverBg = action.variant === 'danger'
                ? 'rgba(220,38,38,0.06)'
                : 'var(--surface-subtle)';

              if (action.href) {
                return (
                  <Link
                    key={i}
                    href={action.href}
                    target={action.target}
                    style={{ ...itemBase, color }}
                    onMouseEnter={e => { e.currentTarget.style.background = hoverBg; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                    onClick={() => setOpen(false)}
                  >
                    {action.label}
                  </Link>
                );
              }

              return (
                <button
                  key={i}
                  type="button"
                  style={{ ...itemBase, color }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = hoverBg; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  onClick={() => { action.onClick?.(); setOpen(false); }}
                >
                  {action.label}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
