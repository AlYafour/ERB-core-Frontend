'use client';

import RouteGuard from '@/components/auth/RouteGuard';

export default function PurchaseQuotationsLayout({ children }: { children: React.ReactNode }) {
  return (
    <RouteGuard
      requiredPermission={{ category: 'purchase_quotation', action: 'view' }}
      redirectTo="/dashboard"
    >
      {children}
    </RouteGuard>
  );
}
