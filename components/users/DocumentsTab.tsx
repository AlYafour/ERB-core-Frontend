'use client';

import type { UserTabProps } from './OverviewTab';

export default function DocumentsTab({ user, emp, isSelf, isAdmin, userId }: UserTabProps) {
  return (
    <div className="card empty-state">
      <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: 'var(--text-sm)' }}>Documents — coming soon.</p>
    </div>
  );
}
