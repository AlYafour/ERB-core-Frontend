'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { hrEmployeesApi } from '@/lib/api/hr';
import { useAuth } from '@/lib/hooks/use-auth';
import { useMyPermissions } from '@/lib/hooks/use-my-permissions';
import MainLayout from '@/components/layout/MainLayout';
import { Loader } from '@/components/ui';

export default function UserProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();
  const userId  = Number(id);
  const { user } = useAuth();
  const { isTenantAdmin, isPlatformAdmin } = useMyPermissions();
  const isAdmin = isTenantAdmin || isPlatformAdmin;
  const isSelf  = user?.id === userId;

  const { data: empData, isLoading } = useQuery({
    queryKey: ['employee-by-user', userId],
    queryFn:  () => hrEmployeesApi.getAll({ user: userId }),
    enabled:  !!userId,
  });

  const emp = empData?.results?.[0] ?? null;

  useEffect(() => {
    if (emp) router.replace(`/hr/employees/${emp.id}`);
  }, [emp, router]);

  useEffect(() => {
    // Guard: wait for auth to resolve before deciding — avoids race condition
    // where user=null (Zustand not yet hydrated) makes isSelf=false incorrectly
    if (user && !isLoading && !emp && !isSelf) {
      router.replace(isAdmin ? '/hr/employees' : '/tasks');
    }
  }, [user, isLoading, emp, isSelf, isAdmin, router]);

  if (isLoading || emp) {
    return <MainLayout><div className="card empty-state"><Loader /></div></MainLayout>;
  }

  // No HR record but viewing own profile → show basic account card
  if (isSelf && user) {
    const displayName = user.first_name
      ? `${user.first_name} ${user.last_name || ''}`.trim()
      : (user as any).username || '';
    const initials = displayName.split(' ').slice(0, 2).map((w: string) => w[0]?.toUpperCase() || '').join('');
    const roleLabel = ((user as any).role || '').replace(/_/g, ' ');

    return (
      <MainLayout>
        <div style={{ maxWidth: 560, margin: '48px auto', padding: '0 16px' }}>
          <div className="card" style={{ padding: '36px 32px', textAlign: 'center' }}>
            <div style={{
              width: 80, height: 80, borderRadius: '50%', margin: '0 auto 18px',
              background: 'var(--brand-muted)', border: '2px solid var(--border-subtle)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 28, fontWeight: 700, color: 'var(--brand)', overflow: 'hidden',
            }}>
              {(user as any).avatar_url
                ? <img src={(user as any).avatar_url} alt={displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : (initials || '?')}
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 5px' }}>{displayName}</h1>
            {roleLabel && <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: '0 0 4px', textTransform: 'capitalize' }}>{roleLabel}</p>}
            {(user as any).email && <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 24px' }}>{(user as any).email}</p>}
            <div style={{
              padding: '14px 18px', borderRadius: 10,
              background: 'var(--surface-subtle)', border: '1px solid var(--border-subtle)',
              fontSize: 13, color: 'var(--text-secondary)',
            }}>
              No HR profile has been linked to your account yet. Please contact your HR administrator.
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  return null;
}
