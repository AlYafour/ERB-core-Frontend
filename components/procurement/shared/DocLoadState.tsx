'use client';

import MainLayout from '@/components/layout/MainLayout';
import { DocSkeleton } from './DocSkeleton';

interface Props {
  type: 'loading' | 'not-found';
  message?: string;
}

export function DocLoadState({ type, message }: Props) {
  if (type === 'loading') {
    return (
      <MainLayout>
        <DocSkeleton />
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: 'var(--surface-subtle)', border: '1px solid var(--border-subtle)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px',
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5" strokeLinecap="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>
        <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 6px' }}>Not Found</p>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
          {message ?? 'The record you are looking for does not exist.'}
        </p>
      </div>
    </MainLayout>
  );
}
