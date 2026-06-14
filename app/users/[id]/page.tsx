'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { usersApi } from '@/lib/api/users';
import { hrEmployeesApi, hrDepartmentsApi, hrPositionsApi, hrLocationsApi } from '@/lib/api/hr';
import MainLayout from '@/components/layout/MainLayout';
import Link from 'next/link';
import { Loader, Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui';
import { useAuth } from '@/lib/hooks/use-auth';
import OverviewTab from '@/components/users/OverviewTab';
import HomeTab from '@/components/users/HomeTab';
import AttendanceTab from '@/components/users/AttendanceTab';
import RequestsTab from '@/components/users/RequestsTab';
import DocumentsTab from '@/components/users/DocumentsTab';

export default function UserProfilePage() {
  const { id } = useParams<{ id: string }>();
  const userId = Number(id);

  // ── A4: Access guard ──────────────────────────────────────────────────────
  const { user: me } = useAuth();
  const isAdmin = !!(me?.role === 'admin' || me?.role === 'super_admin' || me?.is_staff || me?.is_superuser);
  const isSelf  = !!me && me.id === userId;
  const canView = isSelf || isAdmin;

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: user, isLoading: uLoading } = useQuery({
    queryKey: ['user', userId],
    queryFn:  () => usersApi.getById(userId),
    enabled:  !!userId && canView,
  });

  const { data: empData, isLoading: eLoading } = useQuery({
    queryKey: ['employee-by-user', userId],
    queryFn:  () => hrEmployeesApi.getAll({ user: userId }),
    enabled:  !!userId && canView,
  });

  const { data: depts }     = useQuery({ queryKey: ['hr-depts'],         queryFn: () => hrDepartmentsApi.getAll({ page: 1 }) });
  const { data: positions } = useQuery({ queryKey: ['hr-positions'],     queryFn: () => hrPositionsApi.getAll({ page: 1 }) });
  const { data: locations } = useQuery({ queryKey: ['hr-locations-all'], queryFn: () => hrLocationsApi.getAll({ page_size: 200 } as any) });

  const emp = empData?.results?.[0] ?? null;
  const displayName = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.username || '—';

  // ── A4: Guard renders ─────────────────────────────────────────────────────
  if (!me) return (
    <MainLayout>
      <div className="card empty-state"><Loader /></div>
    </MainLayout>
  );

  if (!canView) return (
    <MainLayout>
      <div className="card empty-state">
        <p style={{ color: 'var(--color-error)', margin: 0 }}>Access denied.</p>
      </div>
    </MainLayout>
  );

  // ── Loading / Error ────────────────────────────────────────────────────────
  if (uLoading || eLoading) return (
    <MainLayout>
      <div className="card empty-state">
        <Loader />
      </div>
    </MainLayout>
  );

  if (!user) return (
    <MainLayout>
      <div className="card empty-state">
        <p style={{ color: 'var(--color-error)', margin: 0 }}>User not found.</p>
      </div>
    </MainLayout>
  );

  const tabProps = { user, emp, depts, positions, locations, isSelf, isAdmin, userId };

  return (
    <MainLayout>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>

        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
          <Link href="/users">
            <button style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}>← Users</button>
          </Link>
          <span style={{ color: 'var(--text-secondary)' }}>/</span>
          <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-bold)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>{displayName}</h1>
        </div>

        {/* Tab bar + content */}
        <Tabs defaultValue={isSelf ? 'home' : 'overview'}>
          <TabsList>
            {isSelf && <TabsTrigger value="home">Home</TabsTrigger>}
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="attendance">Attendance</TabsTrigger>
            <TabsTrigger value="requests">Requests</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
          </TabsList>

          {isSelf && (
            <TabsContent value="home">
              <HomeTab {...tabProps} />
            </TabsContent>
          )}
          <TabsContent value="overview">
            <OverviewTab {...tabProps} />
          </TabsContent>
          <TabsContent value="attendance">
            <AttendanceTab {...tabProps} />
          </TabsContent>
          <TabsContent value="requests">
            <RequestsTab {...tabProps} />
          </TabsContent>
          <TabsContent value="documents">
            <DocumentsTab {...tabProps} />
          </TabsContent>
        </Tabs>

      </div>
    </MainLayout>
  );
}
