'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/use-auth';
import { useMyPermissions } from '@/lib/hooks/use-my-permissions';
import { useMyEmployeeRecord } from '@/lib/hooks/use-my-employee-record';
import MainLayout from '@/components/layout/MainLayout';
import { Loader } from '@/components/ui/Loader';

export default function HRLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { isTenantAdmin, isPlatformAdmin, hasPermission, isLoading: permLoading } = useMyPermissions();
  const { emp, isLoading: empLoading } = useMyEmployeeRecord();

  const isLoading = authLoading || permLoading || empLoading;

  // Allow access if: admin, has explicit permission, OR is a regular employee (self-service)
  const hasAccess = isTenantAdmin || isPlatformAdmin
    || hasPermission('hr_employee.view')
    || !!emp;

  useEffect(() => {
    if (!isLoading && user && !hasAccess) {
      router.replace('/dashboard');
    }
  }, [isLoading, user, hasAccess, router]);

  if (authLoading || (isLoading && !user)) {
    return (
      <MainLayout>
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <Loader />
        </div>
      </MainLayout>
    );
  }

  if (!isLoading && !hasAccess) return null;

  return <>{children}</>;
}
