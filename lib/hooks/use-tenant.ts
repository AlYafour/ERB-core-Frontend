import { useQuery } from '@tanstack/react-query';
import { tenantApi } from '@/lib/api/tenants';
import { useAuthStore } from '@/lib/store/auth-store';

export function useTenantInfo() {
  const { isAuthenticated, tenantId } = useAuthStore();
  return useQuery({
    queryKey: ['tenant', 'me'],
    queryFn: tenantApi.me,
    enabled: isAuthenticated && !!tenantId,
    staleTime: 5 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

