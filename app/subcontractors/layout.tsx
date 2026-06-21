'use client';

import RouteGuard from '@/components/auth/RouteGuard';

export default function SubcontractorsLayout({ children }: { children: React.ReactNode }) {
  return (
    <RouteGuard
      requiredPermission={{ category: 'subcontractor', action: 'view' }}
      redirectTo="/dashboard"
    >
      {children}
    </RouteGuard>
  );
}
