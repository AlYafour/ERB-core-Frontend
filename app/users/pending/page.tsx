'use client';

import MainLayout from '@/components/layout/MainLayout';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '@/lib/api/users';
import { permissionsApi } from '@/lib/api/permissions';
import { User } from '@/types';
import { useAuth } from '@/lib/hooks/use-auth';
import { PERMISSIONS_QUERY_KEY } from '@/lib/hooks/use-permissions';
import { toast } from '@/lib/hooks/use-toast';
import { confirm } from '@/lib/hooks/use-toast';
import { getApiError } from '@/lib/utils/error';
import { useState } from 'react';
import { Button, Badge, PageHeader, PageShell, WorkspaceSurface, type Column } from '@/components/ui';
import DataTable from '@/components/ui/DataTable';
import SearchableDropdown from '@/components/ui/SearchableDropdown';

export default function PendingUsersPage() {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [selectedPermissionSet, setSelectedPermissionSet] = useState<Record<number, number>>({});

  const { data: pendingUsers, isLoading, error } = useQuery({
    queryKey: ['users', 'pending'],
    queryFn: async () => {
      try {
        return await usersApi.getPending();
      } catch (err: any) {
        const msg = getApiError(err, 'Failed to fetch pending users');
        toast(msg, 'error');
        throw err;
      }
    },
    refetchInterval: 30_000,
    retry: 2,
  });

  const { data: permissionSetsData } = useQuery({
    queryKey: ['permission-sets'],
    queryFn: () => permissionsApi.getAllPermissionSets({ page: 1, page_size: 1000 }),
  });

  const permissionSets = Array.isArray(permissionSetsData?.results) ? permissionSetsData!.results : [];

  const approveMutation = useMutation({
    mutationFn: ({ id, permissionSetId }: { id: number; permissionSetId?: number }) =>
      usersApi.approve(id, permissionSetId),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['users', 'pending'] });
      queryClient.invalidateQueries({ queryKey: PERMISSIONS_QUERY_KEY });
      toast(`User ${data.username} has been approved`, 'success');
      setSelectedPermissionSet(prev => { const next = { ...prev }; delete next[variables.id]; return next; });
    },
    onError: () => toast('Failed to approve user', 'error'),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: number) => usersApi.reject(id),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['users', 'pending'] });
      toast(`User ${data?.username ?? ''} has been rejected`, 'success');
    },
    onError: () => toast('Failed to reject user', 'error'),
  });

  const handleApprove = (user: User) => approveMutation.mutate({ id: user.id, permissionSetId: selectedPermissionSet[user.id] });
  const handleReject = async (user: User) => {
    if (await confirm(`Reject user "${user.username}"? This will delete the account.`)) rejectMutation.mutate(user.id);
  };

  if (currentUser?.role !== 'super_admin' && !currentUser?.is_superuser) {
    return (
      <MainLayout>
        <div className="card" style={{ borderColor: 'var(--color-error)', background: 'color-mix(in srgb, var(--color-error) 10%, transparent)' }}>
          <p style={{ color: 'var(--color-error)', fontSize: 'var(--text-sm)' }}>Access Denied. Admin access required.</p>
        </div>
      </MainLayout>
    );
  }

  const users = (pendingUsers as User[]) ?? [];

  const columns: Column<User>[] = [
    {
      key: 'username', header: 'Username',
      render: u => (
        <div>
          <div className="font-medium" style={{ color: 'var(--text-primary)' }}>{u.username}</div>
          {u.first_name && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{u.first_name} {u.last_name}</div>}
        </div>
      ),
    },
    { key: 'email',  header: 'Email',      render: u => <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{u.email}</span> },
    { key: 'role',   header: 'Role',       render: u => <Badge variant="info">{u.role}</Badge> },
    { key: 'joined', header: 'Registered', render: u => <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{u.date_joined ? new Date(u.date_joined).toLocaleDateString() : '—'}</span> },
    {
      key: 'permset', header: 'Permission Set',
      render: u => (
        <div style={{ minWidth: 200 }}>
          <SearchableDropdown
            options={permissionSets.map((ps: any) => ({ value: String(ps.id), label: ps.name }))}
            value={selectedPermissionSet[u.id] ? String(selectedPermissionSet[u.id]) : ''}
            onChange={(val) => setSelectedPermissionSet(prev => ({ ...prev, [u.id]: Number(val) }))}
            placeholder="Select permission set (optional)"
          />
        </div>
      ),
    },
    {
      key: 'actions', header: 'Actions',
      render: u => (
        <div className="flex gap-2">
          <Button variant="primary" size="sm" onClick={() => handleApprove(u)} isLoading={approveMutation.isPending}>Approve</Button>
          <Button variant="destructive" size="sm" onClick={() => handleReject(u)} isLoading={rejectMutation.isPending}>Reject</Button>
        </div>
      ),
    },
  ];

  return (
    <MainLayout>
      <PageShell>
        <PageHeader
          title="Pending Users"
          description="Review and approve new user registrations."
          count={users.length || null}
          breadcrumbs={[{ label: 'Users', href: '/users' }, { label: 'Pending' }]}
        />
        <WorkspaceSurface>
          <DataTable
            surface
            columns={columns}
            data={users}
            isLoading={isLoading}
            error={error}
            emptyMessage="No pending users at this time."
            page={1}
            totalCount={users.length}
            pageSize={1000}
            onPageChange={() => {}}
          />
        </WorkspaceSurface>
      </PageShell>
    </MainLayout>
  );
}
