'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';

export default function NewUserPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/hr/employees/new');
  }, [router]);

  return (
    <MainLayout>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-24) 0' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>Redirecting...</p>
      </div>
    </MainLayout>
  );
}
