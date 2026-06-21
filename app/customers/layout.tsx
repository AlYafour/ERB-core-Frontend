'use client';

import RouteGuard from '@/components/auth/RouteGuard';

export default function CustomersLayout({ children }: { children: React.ReactNode }) {
  return (
    <RouteGuard
      requiredPermission={{ category: 'customer', action: 'view' }}
      redirectTo="/dashboard"
    >
      {children}
    </RouteGuard>
  );
}
