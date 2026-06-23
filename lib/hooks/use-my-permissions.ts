import { useQuery } from '@tanstack/react-query';
import { useAuth } from './use-auth';
import { useAuthStore } from '@/lib/store/auth-store';
import apiClient from '@/lib/api/client';

export interface MyPermissionsData {
  user_id: number;
  primary_role: string;
  roles: string[];
  is_platform_admin: boolean;
  is_tenant_admin: boolean;
  all_permissions: boolean;
  permissions: Record<string, true>;
  modules: string[];
}

export const MY_AUTH_PERMISSIONS_QUERY_KEY = ['my-auth-permissions'] as const;

/**
 * Unified permission source — single source of truth for all frontend access checks.
 *
 * isTenantAdmin / isPlatformAdmin are derived synchronously from the user object
 * so page guards have zero loading flicker.
 *
 * hasPermission(key) / hasModule(mod) use GET /api/auth/my-permissions/ (React Query,
 * cached for the session lifetime). Admins short-circuit to true without waiting for data.
 *
 * displayRole surfaces 'Company Admin' instead of the stale 'Super Admin' PermissionSet name.
 */
export function useMyPermissions() {
  const { user } = useAuth();
  const storeIsPlatformAdmin = useAuthStore((s) => s.isPlatformAdmin);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  // Derived directly from user object — no API call, no loading flicker on guards
  const isTenantAdmin = user?.role === 'admin' || !!user?.is_superuser;
  const isPlatformAdmin = storeIsPlatformAdmin || !!user?.is_superuser;

  const { data, isLoading } = useQuery<MyPermissionsData>({
    queryKey: MY_AUTH_PERMISSIONS_QUERY_KEY,
    queryFn: async () => {
      const res = await apiClient.get('/auth/my-permissions/');
      return res.data;
    },
    enabled: isAuthenticated && !!user,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    retry: false,
  });

  // Fixes stale 'Super Admin' PermissionSet name displayed to company admins
  const displayRole = isTenantAdmin || isPlatformAdmin
    ? 'Company Admin'
    : (data?.primary_role ?? user?.role ?? '');

  function hasPermission(key: string): boolean {
    if (isTenantAdmin || isPlatformAdmin) return true;
    return data?.permissions[key] === true;
  }

  function hasModule(mod: string): boolean {
    if (isTenantAdmin || isPlatformAdmin) return true;
    return data?.modules.includes(mod) ?? false;
  }

  return { isTenantAdmin, isPlatformAdmin, displayRole, hasPermission, hasModule, data, isLoading };
}
