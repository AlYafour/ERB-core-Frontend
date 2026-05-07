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
      <div className="flex items-center justify-center py-24">
        <p className="text-muted-foreground text-sm">Redirecting...</p>
      </div>
    </MainLayout>
  );
}
