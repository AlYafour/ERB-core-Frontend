'use client';

import RouteGuard from '@/components/auth/RouteGuard';

export default function QuotationRequestsLayout({ children }: { children: React.ReactNode }) {
  return (
    <RouteGuard
      requiredPermission={{ category: 'quotation_request', action: 'view' }}
      redirectTo="/dashboard"
    >
      {children}
    </RouteGuard>
  );
}
