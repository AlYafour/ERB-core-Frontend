'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

export interface RowAction {
  label?: string;
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

export function RowActions({ actions }: RowActionsProps) {
  const [open, setOpen] = useState(false);
  const [dropPos, setDropPos] = useState<{ top: number; right: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const visible = actions.filter(a => !a.hidden);
  const hasItems = visible.some(a => !a.separator);
  if (!hasItems) return null;

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (open) {
      setOpen(false);
    } else {
      const btn = btnRef.current;
      if (btn) {
        const rect = btn.getBoundingClientRect();
        setDropPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
      }
      setOpen(true);
    }
  };

  const handleClose = () => setOpen(false);

  return (
    <div style={{ display: 'inline-block' }}>
      <button
        ref={btnRef}
        type="button"
        onClick={handleToggle}
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

      {open && dropPos && (
        <DropMenu
          ref={menuRef}
          top={dropPos.top}
          right={dropPos.right}
          items={visible}
          onClose={handleClose}
        />
      )}
    </div>
  );
}

import { forwardRef } from 'react';

const DropMenu = forwardRef<HTMLDivElement, {
  top: number; right: number;
  items: RowAction[];
  onClose: () => void;
}>(function DropMenu({ top, right, items, onClose }, ref) {
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if ((ref as React.RefObject<HTMLDivElement>).current?.contains(e.target as Node)) return;
      onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose, ref]);

  const itemBase: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 8,
    width: '100%', padding: '8px 14px',
    fontSize: 13, fontWeight: 400,
    background: 'transparent', border: 'none',
    cursor: 'pointer', textAlign: 'left',
    transition: 'background 80ms', textDecoration: 'none',
    whiteSpace: 'nowrap',
  };

  return (
    <>
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
        onClick={(e) => { e.stopPropagation(); onClose(); }}
      />
      <div
        ref={ref}
        style={{
          position: 'fixed',
          top, right,
          zIndex: 9999,
          background: 'var(--card-bg)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 8,
          boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
          minWidth: 160,
          padding: '4px 0',
          overflow: 'hidden',
        }}
      >
        {items.map((action, i) => {
          if (action.separator) {
            return <div key={i} style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 0' }} />;
          }
          const color = action.variant === 'danger' ? 'var(--status-error)' : 'var(--text-primary)';
          const hoverBg = action.variant === 'danger' ? 'rgba(220,38,38,0.06)' : 'var(--surface-subtle)';

          if (action.href) {
            return (
              <Link
                key={i}
                href={action.href}
                target={action.target}
                style={{ ...itemBase, color }}
                onMouseEnter={e => { e.currentTarget.style.background = hoverBg; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                onClick={(e) => { e.stopPropagation(); onClose(); }}
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
              onClick={(e) => { e.stopPropagation(); action.onClick?.(); onClose(); }}
            >
              {action.label}
            </button>
          );
        })}
      </div>
    </>
  );
});
