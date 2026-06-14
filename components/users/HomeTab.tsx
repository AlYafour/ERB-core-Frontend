'use client';

import type { UserTabProps } from './OverviewTab';
import ClockingCard from './ClockingCard';

export default function HomeTab({ emp, isSelf }: UserTabProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      <ClockingCard emp={emp} isSelf={isSelf} />
    </div>
  );
}
