import { useQuery } from '@tanstack/react-query';
import { hrEmployeesApi } from '@/lib/api/hr';
import { useAuth } from './use-auth';
import type { HREmployee } from '@/types';

/**
 * Returns the current authenticated user's own HR employee record (if any).
 * Non-admins can access their own record — the backend filters by user=request.user.
 * Returns null if the user has no linked HR employee record.
 */
export function useMyEmployeeRecord() {
  const { user } = useAuth();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['my-employee-record', user?.id],
    queryFn: () => hrEmployeesApi.getAll({ user: user!.id }),
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const emp: HREmployee | null = (data as any)?.results?.[0] ?? null;

  return { emp, isLoading, isError, hasRecord: !!emp };
}
