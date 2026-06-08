import { permissionsApi } from '@/lib/api/permissions';

export interface PermissionCheck {
  category: string;
  action: string;
}

let cachedPermissions: Array<{ category: string; action: string }> | null = null;
let permissionsCacheTime: number | null = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Get current user's permissions (with caching)
 */
export async function getMyPermissions(): Promise<Array<{ category: string; action: string }>> {
  const now = Date.now();
  
  // Return cached permissions if still valid
  if (cachedPermissions && permissionsCacheTime && (now - permissionsCacheTime) < CACHE_DURATION) {
    return cachedPermissions;
  }
  
  try {
    const data = await permissionsApi.getMyPermissions();
    cachedPermissions = data.permissions;
    permissionsCacheTime = now;
    return cachedPermissions;
  } catch (error) {
    console.error('Failed to fetch permissions:', error);
    return [];
  }
}

/**
 * Check if user has a specific permission
 */
export async function hasPermission(category: string, action: string): Promise<boolean> {
  const permissions = await getMyPermissions();
  return permissions.some((p) => p.category === category && p.action === action);
}

/**
 * Check multiple permissions at once
 */
export async function checkPermissions(
  checks: PermissionCheck[]
): Promise<Array<{ category: string; action: string; has_permission: boolean }>> {
  try {
    const response = await permissionsApi.checkPermissions(checks);
    return response.results;
  } catch (error) {
    console.error('Failed to check permissions:', error);
    // Fallback: check locally
    const permissions = await getMyPermissions();
    return checks.map((check) => ({
      ...check,
      has_permission: permissions.some(
        (p) => p.category === check.category && p.action === check.action
      ),
    }));
  }
}

/**
 * Clear permissions cache (call after permission changes)
 */
export function clearPermissionsCache(): void {
  cachedPermissions = null;
  permissionsCacheTime = null;
}

// Re-export for convenience
export { getMyPermissions as getPermissions };

