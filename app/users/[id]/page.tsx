'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { hrEmployeesApi } from '@/lib/api/hr';
import { useAuth } from '@/lib/hooks/use-auth';
import { useMyPermissions } from '@/lib/hooks/use-my-permissions';
import MainLayout from '@/components/layout/MainLayout';
import { Loader } from '@/components/ui';

export default function UserProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();
  const userId  = Number(id);
  const { user } = useAuth();
  const { isTenantAdmin, isPlatformAdmin } = useMyPermissions();
  const isAdmin = isTenantAdmin || isPlatformAdmin;

  const { data: empData, isLoading } = useQuery({
    queryKey: ['employee-by-user', userId],
    queryFn:  () => hrEmployeesApi.getAll({ user: userId }),
    enabled:  !!userId,
  });

  const emp = empData?.results?.[0] ?? null;

  useEffect(() => {
    if (emp) {
      router.replace(`/hr/employees/${emp.id}`);
    }
  }, [emp, router]);

  useEffect(() => {
    if (!isLoading && !emp) {
      // Admins: go to the HR list to add/view employees
      // Regular employees: go to their tasks page (avoid the admin-only HR list)
      router.replace(isAdmin ? '/hr/employees' : '/tasks');
    }
  }, [isLoading, emp, isAdmin, router]);

  return (
    <MainLayout>
      <div className="card empty-state"><Loader /></div>
    </MainLayout>
  );
}
