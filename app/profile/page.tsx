'use client';

import { useEffect } from 'react';
import { useAuth } from '@/lib/hooks/use-auth';
import { useMyEmployeeRecord } from '@/lib/hooks/use-my-employee-record';
import { useRouter } from 'next/navigation';

export default function ProfileRedirect() {
  const { user } = useAuth();
  const { emp, isLoading } = useMyEmployeeRecord();
  const router = useRouter();

  useEffect(() => {
    if (!user?.id || isLoading) return;
    router.replace(emp?.id ? `/hr/employees/${emp.id}` : `/hr/employees`);
  }, [user?.id, emp?.id, isLoading]);

  return null;
}
