'use client';

import { ReactNode } from 'react';

interface WorkspaceSurfaceProps {
  /** Status filter tabs — renders above toolbar, flush with card edges. */
  tabs?: ReactNode;
  /** Toolbar row — search, filters, bulk actions. */
  toolbar?: ReactNode;
  /** Active filter tags — shown below toolbar when filters are applied. */
  filterTags?: ReactNode;
  /** Main content area — DataTable (surface mode), kanban, list, etc. */
  children: ReactNode;
  className?: string;
}

export function WorkspaceSurface({ tabs, toolbar, filterTags, children, className }: WorkspaceSurfaceProps) {
  return (
    <div
      className={className}
      style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--card-border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--card-shadow)',
        overflow: 'hidden',
      }}
    >
      {/* Status tabs */}
      {tabs && tabs}

      {/* Toolbar row */}
      {toolbar && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '9px 14px',
          borderBottom: '1px solid var(--border-subtle)',
          minHeight: 48,
          flexWrap: 'wrap',
        }}>
          {toolbar}
        </div>
      )}

      {/* Active filter tags */}
      {filterTags && (
        <div style={{
          padding: '6px 14px 8px',
          borderBottom: '1px solid var(--border-subtle)',
        }}>
          {filterTags}
        </div>
      )}

      {/* Main content */}
      {children}
    </div>
  );
}
