'use client';

import React from 'react';
import { Button } from '@/components/ui';

export interface BulkAction {
  key: string;
  label: string;
  variant?: 'primary' | 'secondary' | 'destructive';
  icon?: React.ReactNode;
  onClick: () => void;
  isLoading?: boolean;
  disabled?: boolean;
}

interface BulkBarProps {
  selectedCount: number;
  totalCount: number;
  actions: BulkAction[];
  onClearSelection: () => void;
  onSelectAllVisible?: () => void;
  allVisibleSelected?: boolean;
}

export function BulkBar({
  selectedCount,
  totalCount,
  actions,
  onClearSelection,
  onSelectAllVisible,
  allVisibleSelected,
}: BulkBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div
      role="toolbar"
      aria-label={`${selectedCount} items selected`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 14px',
        borderBottom: '1px solid var(--border-subtle)',
        background: 'var(--brand-subtle)',
        flexWrap: 'wrap',
        minHeight: 44,
        animation: 'slideDown 120ms ease-out',
      }}
    >
      {/* Checkbox icon */}
      <span style={{
        width: 20, height: 20, borderRadius: 4,
        background: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>

      <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--brand)', minWidth: 80 }}>
        {selectedCount} selected
      </span>

      {/* Select all visible */}
      {onSelectAllVisible && !allVisibleSelected && (
        <button
          type="button"
          onClick={onSelectAllVisible}
          style={{
            fontSize: 'var(--text-xs)', fontWeight: 500,
            color: 'var(--brand)', background: 'none', border: 'none',
            cursor: 'pointer', padding: '2px 6px', borderRadius: 4,
            textDecoration: 'underline', textUnderlineOffset: 2,
          }}
        >
          Select all {totalCount}
        </button>
      )}

      <div style={{ flex: 1 }} />

      {/* Actions */}
      {actions.map(action => (
        <Button
          key={action.key}
          variant={action.variant ?? 'secondary'}
          size="sm"
          onClick={action.onClick}
          disabled={action.disabled || action.isLoading}
          aria-label={action.label}
        >
          {action.isLoading ? 'Loading…' : (
            <>
              {action.icon && <span style={{ marginRight: 4 }}>{action.icon}</span>}
              {action.label}
            </>
          )}
        </Button>
      ))}

      {/* Clear */}
      <button
        type="button"
        onClick={onClearSelection}
        aria-label="Clear selection"
        style={{
          background: 'none', border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-md)', padding: '4px 10px',
          fontSize: 'var(--text-xs)', fontWeight: 500,
          color: 'var(--text-secondary)', cursor: 'pointer',
        }}
      >
        Clear
      </button>
    </div>
  );
}
