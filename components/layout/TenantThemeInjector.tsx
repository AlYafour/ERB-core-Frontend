'use client';

import { useEffect } from 'react';
import { useTenantInfo } from '@/lib/hooks/use-tenant';
import { applyTenantTheme } from '@/lib/utils/tenant-theme';

export default function TenantThemeInjector() {
  const { data } = useTenantInfo();
  const primary = data?.branding?.primary_color;

  useEffect(() => {
    // Apply default gold until tenant color loads; switch when API responds
    applyTenantTheme(primary?.startsWith('#') ? primary : '#C9943A');
  }, [primary]);

  return null;
}
