'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { hrEmployeesApi } from '@/lib/api/hr';
import MainLayout from '@/components/layout/MainLayout';

export default function UserRedirectPage() {
  const router = useRouter();
  const params = useParams();
  const userId = Number(params.id);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['employee-by-user', userId],
    queryFn: () => hrEmployeesApi.getAll({ user: userId }),
    enabled: !!userId,
  });

  useEffect(() => {
    if (!data) return;
    const employee = data.results?.[0];
    if (employee) {
      router.replace(`/hr/employees/${employee.id}`);
    } else {
      router.replace(`/hr/employees/new?user_id=${userId}`);
    }
  }, [data, router, userId]);

  useEffect(() => {
    if (isError) router.replace(`/hr/employees/new?user_id=${userId}`);
  }, [isError, router, userId]);

  return (
    <MainLayout>
      <div className="flex items-center justify-center py-24">
        <p className="text-muted-foreground text-sm">
          {isLoading ? 'Loading...' : 'Redirecting...'}
        </p>
      </div>
    </MainLayout>
  );
}
