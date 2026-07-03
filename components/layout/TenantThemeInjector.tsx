'use client';

import { useEffect } from 'react';
import { useTenantInfo } from '@/lib/hooks/use-tenant';
import { applyTenantTheme } from '@/lib/utils/tenant-theme';

export default function TenantThemeInjector() {
  const { data } = useTenantInfo();
  const primary = data?.branding?.primary_color;

  useEffect(() => {
    if (primary && primary.startsWith('#')) {
      applyTenantTheme(primary);
    }
  }, [primary]);

  return null;
}
