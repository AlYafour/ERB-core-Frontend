'use client';

import type { UserTabProps } from './OverviewTab';

export default function RequestsTab({ user, emp, isSelf, isAdmin, userId }: UserTabProps) {
  return (
    <div className="card empty-state">
      <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: 'var(--text-sm)' }}>Requests — coming soon.</p>
    </div>
  );
}
