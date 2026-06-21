'use client';

import RouteGuard from '@/components/auth/RouteGuard';

export default function HRLayout({ children }: { children: React.ReactNode }) {
  return (
    <RouteGuard
      requiredPermission={{ category: 'hr_employee', action: 'view' }}
      redirectTo="/dashboard"
    >
      {children}
    </RouteGuard>
  );
}
