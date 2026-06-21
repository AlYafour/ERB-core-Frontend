'use client';

import RouteGuard from '@/components/auth/RouteGuard';

export default function PurchaseInvoicesLayout({ children }: { children: React.ReactNode }) {
  return (
    <RouteGuard
      requiredPermission={{ category: 'purchase_invoice', action: 'view' }}
      redirectTo="/dashboard"
    >
      {children}
    </RouteGuard>
  );
}
