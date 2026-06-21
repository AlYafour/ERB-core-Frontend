'use client';

import RouteGuard from '@/components/auth/RouteGuard';

export default function PurchaseOrdersLayout({ children }: { children: React.ReactNode }) {
  return (
    <RouteGuard
      requiredPermission={{ category: 'purchase_order', action: 'view' }}
      redirectTo="/dashboard"
    >
      {children}
    </RouteGuard>
  );
}
