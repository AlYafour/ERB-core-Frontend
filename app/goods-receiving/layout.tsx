'use client';

import RouteGuard from '@/components/auth/RouteGuard';

export default function GoodsReceivingLayout({ children }: { children: React.ReactNode }) {
  return (
    <RouteGuard
      requiredPermission={{ category: 'goods_receiving', action: 'view' }}
      redirectTo="/dashboard"
    >
      {children}
    </RouteGuard>
  );
}
