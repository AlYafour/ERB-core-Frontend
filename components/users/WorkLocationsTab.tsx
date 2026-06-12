'use client';

import type { UserTabProps } from './OverviewTab';

export default function WorkLocationsTab({ user, emp, isSelf, isAdmin, userId }: UserTabProps) {
  return (
    <div className="card empty-state">
      <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: 'var(--text-sm)' }}>Work Locations — coming soon.</p>
    </div>
  );
}
