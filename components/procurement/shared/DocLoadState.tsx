'use client';

import MainLayout from '@/components/layout/MainLayout';

interface Props {
  type: 'loading' | 'not-found';
  message?: string;
}

export function DocLoadState({ type, message }: Props) {
  const text = message ?? (type === 'loading' ? 'Loading…' : 'Record not found.');
  return (
    <MainLayout>
      <div className="card empty-state">
        <p style={{ color: 'var(--text-secondary)', margin: 0 }}>{text}</p>
      </div>
    </MainLayout>
  );
}
