'use client';

import { ReactNode } from 'react';

interface PageToolbarProps {
  search?: ReactNode;
  actions?: ReactNode;      /* bulk actions, primary buttons */
  filters?: ReactNode;      /* FilterPanel trigger */
  filterTags?: ReactNode;   /* FilterTags row — rendered below toolbar */
  children?: ReactNode;     /* extra content in the toolbar row */
}

export default function PageToolbar({
  search,
  actions,
  filters,
  filterTags,
  children,
}: PageToolbarProps) {
  const hasToolbar = search || actions || filters || children;

  return (
    <div style={{ marginBottom: 16 }}>
      {hasToolbar && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 14px',
          background: 'var(--card-bg)',
          border: '1px solid var(--card-border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--card-shadow)',
        }}>
          {search}
          {children}
          <div style={{ flex: 1 }} />
          {actions && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {actions}
            </div>
          )}
          {filters}
        </div>
      )}
      {filterTags && (
        <div style={{ marginTop: 8 }}>
          {filterTags}
        </div>
      )}
    </div>
  );
}
