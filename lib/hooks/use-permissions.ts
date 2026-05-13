import { useQuery, useQueryClient } from '@tanstack/react-query';
import { permissionsApi } from '@/lib/api/permissions';
import { useAuthStore } from '@/lib/store/auth-store';

export const PERMISSIONS_QUERY_KEY = ['user-permissions', 'me'] as const;

export function usePermissions() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const { data, isLoading } = useQuery({
    queryKey: PERMISSIONS_QUERY_KEY,
    queryFn: () => permissionsApi.getMyPermissions(),
    enabled: isAuthenticated && !!user,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const permissions = data?.permissions ?? [];
  const permissionSet = data?.permission_set ?? null;

  const isAdmin = !!(user?.is_superuser || user?.is_staff);

  const hasPermission = (category: string, action: string): boolean => {
    if (user?.is_superuser) return true;
    return permissions.some((p) => p.category === category && p.action === action);
  };

  const hasAnyPermission = (checks: Array<{ category: string; action: string }>): boolean =>
    checks.some((c) => hasPermission(c.category, c.action));

  const hasAllPermissions = (checks: Array<{ category: string; action: string }>): boolean =>
    checks.every((c) => hasPermission(c.category, c.action));

  return {
    permissions,
    permissionSet,
    isLoading: isAuthenticated ? isLoading : false,
    isAdmin,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
  };
}

export function useHasPermission(category: string, action: string): boolean {
  const { hasPermission } = usePermissions();
  return hasPermission(category, action);
}

/** Call this after any permission change to force a fresh fetch. */
export function useInvalidatePermissions() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: PERMISSIONS_QUERY_KEY });
}
