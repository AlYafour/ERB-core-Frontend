import { usePermissions } from './use-permissions';
import { useMyPermissions } from './use-my-permissions';

export function useProcPermissions() {
  const { hasPermission } = usePermissions();
  const { isTenantAdmin, isPlatformAdmin } = useMyPermissions();
  const isAdmin = isTenantAdmin || isPlatformAdmin;

  const can = (mod: string, action: string): boolean =>
    isAdmin || (hasPermission(mod, action) ?? false);

  return { isAdmin, can };
}
