'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePermissions } from '@/lib/hooks/use-permissions';
import { useAuth } from '@/lib/hooks/use-auth';
import MainLayout from '@/components/layout/MainLayout';
import { Loader } from '@/components/ui';

interface RouteGuardProps {
  children: React.ReactNode;
  requiredPermission: { category: string; action: string };
  redirectTo?: string;
  fallback?: React.ReactNode;
}

export default function RouteGuard({
  children,
  requiredPermission,
  redirectTo,
  fallback,
}: RouteGuardProps) {
  const router = useRouter();
  const { hasPermission, isLoading: permissionsLoading } = usePermissions();
  const { user, isLoading: authLoading } = useAuth();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    if (authLoading || permissionsLoading) {
      return;
    }

    if (!user) {
      if (redirectTo) {
        router.push(redirectTo);
      } else {
        router.push('/login');
      }
      return;
    }

    const hasAccess = hasPermission(
      requiredPermission.category,
      requiredPermission.action
    );

    setIsAuthorized(hasAccess ?? false);

    if (!hasAccess && redirectTo) {
      router.push(redirectTo);
    }
  }, [user, authLoading, permissionsLoading, hasPermission, requiredPermission, redirectTo, router]);

  // Show loading while checking permissions
  if (authLoading || permissionsLoading || isAuthorized === null) {
    return (
      <MainLayout>
        <div className="card" style={{ textAlign: 'center', padding: 'var(--spacing-12)' }}>
          <Loader className="mx-auto mb-4" />
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Checking permissions...</p>
        </div>
      </MainLayout>
    );
  }

  // Not authorized - show fallback or default error
  if (!isAuthorized) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <MainLayout>
        <div className="card" style={{ textAlign: 'center', padding: 'var(--spacing-12)' }}>
          <h2
            style={{
              fontSize: 'var(--font-xl)',
              fontWeight: 'var(--font-weight-semibold)',
              color: 'var(--text-primary)',
              margin: 0,
              marginBottom: 'var(--spacing-2)',
            }}
          >
            Access Denied
          </h2>
          <p style={{ color: 'var(--text-secondary)', margin: 0, marginBottom: 'var(--spacing-4)' }}>
            You do not have permission to access this page.
          </p>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: 'var(--font-sm)' }}>
            Required permission: {requiredPermission.category}.{requiredPermission.action}
          </p>
        </div>
      </MainLayout>
    );
  }

  // Authorized - render children
  return <>{children}</>;
}

