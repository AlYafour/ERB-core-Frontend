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
    // Only redirect admins to the full HR employee page — not the employee themselves
    // (non-admin employees may get 403 from the HR API)
    if (emp && isAdmin && !isSelf) router.replace(`/hr/employees/${emp.id}`);
  }, [emp, isAdmin, isSelf, router]);

  useEffect(() => {
    // Redirect away only if: auth resolved + not own profile + no HR record
    if (user && !isLoading && !emp && !isSelf) {
      router.replace(isAdmin ? '/hr/employees' : '/dashboard');
    }
  }, [user, isLoading, emp, isSelf, isAdmin, router]);

  // Loader while fetching HR record
  if (isLoading) {
    return <MainLayout><div className="card empty-state"><Loader /></div></MainLayout>;
  }

  // Admin viewing someone else with HR record → redirect handled in useEffect, show loader
  if (emp && isAdmin && !isSelf) {
    return <MainLayout><div className="card empty-state"><Loader /></div></MainLayout>;
  }

  // Own profile → show profile card (with or without HR record)
  if (isSelf && user) {
    const displayName = user.first_name
      ? `${user.first_name} ${user.last_name || ''}`.trim()
      : (user as any).username || '';
    const initials = displayName.split(' ').slice(0, 2).map((w: string) => w[0]?.toUpperCase() || '').join('');
    const roleLabel = ((user as any).role || '').replace(/_/g, ' ');

    return (
      <MainLayout>
        <div style={{ maxWidth: 600, margin: '48px auto', padding: '0 16px' }}>
          <div className="card" style={{ padding: '36px 32px', textAlign: 'center' }}>
            <div style={{
              width: 88, height: 88, borderRadius: '50%', margin: '0 auto 18px',
              background: 'var(--brand-muted)', border: '2px solid var(--border-subtle)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 30, fontWeight: 700, color: 'var(--brand)', overflow: 'hidden',
            }}>
              {(user as any).avatar_url
                ? <img src={(user as any).avatar_url} alt={displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : (initials || '?')}
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 5px' }}>{displayName}</h1>
            {roleLabel && <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: '0 0 4px', textTransform: 'capitalize' }}>{roleLabel}</p>}
            {(user as any).email && <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 20px' }}>{(user as any).email}</p>}

            {emp && (
              <div style={{ textAlign: 'left', borderTop: '1px solid var(--border-subtle)', paddingTop: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px' }}>
                {emp.department_name && <div><div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 3 }}>Department</div><div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{emp.department_name}</div></div>}
                {emp.position_title  && <div><div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 3 }}>Position</div><div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{emp.position_title}</div></div>}
                {emp.employee_id     && <div><div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 3 }}>Employee ID</div><div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{emp.employee_id}</div></div>}
                {emp.join_date       && <div><div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 3 }}>Joined</div><div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{new Date(emp.join_date).toLocaleDateString('en-GB')}</div></div>}
              </div>
            )}

            {!emp && (
              <div style={{ padding: '14px 18px', borderRadius: 10, background: 'var(--surface-subtle)', border: '1px solid var(--border-subtle)', fontSize: 13, color: 'var(--text-secondary)' }}>
                No HR profile has been linked to your account yet. Please contact your HR administrator.
              </div>
            )}
          </div>
        </div>
      </MainLayout>
    );
  }

  return null;
}
