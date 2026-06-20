'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { hrEmployeesApi } from '@/lib/api/hr';
import MainLayout from '@/components/layout/MainLayout';
import { Loader } from '@/components/ui';

export default function UserProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();
  const userId  = Number(id);

  const { data: empData, isLoading } = useQuery({
    queryKey: ['employee-by-user', userId],
    queryFn:  () => hrEmployeesApi.getAll({ user: userId }),
    enabled:  !!userId,
  });

  const emp = empData?.results?.[0] ?? null;

  useEffect(() => {
    if (emp) router.replace(`/hr/employees/${emp.id}`);
  }, [emp, router]);

  if (!isLoading && !emp) {
    router.replace('/hr/employees');
    return null;
  }

  return (
    <MainLayout>
      <div className="card empty-state"><Loader /></div>
    </MainLayout>
  );
}
