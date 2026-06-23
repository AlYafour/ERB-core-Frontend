'use client';

import { useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { useQuery } from '@tanstack/react-query';
import { usersApi } from '@/lib/api/users';
import { User } from '@/types';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/use-auth';
import { useMyPermissions } from '@/lib/hooks/use-my-permissions';
import { Button, Badge, PageHeader, SearchInput, PageShell, WorkspaceSurface } from '@/components/ui';
import Avatar from '@/components/ui/Avatar';
import DataTable, { Column } from '@/components/ui/DataTable';
import { useTableState } from '@/lib/hooks/use-table-state';

const ROLES = [
  { value: '',                    label: 'All Roles' },
  { value: 'super_admin',         label: 'Super Admin' },
  { value: 'procurement_manager', label: 'Procurement Manager' },
  { value: 'procurement_officer', label: 'Procurement Officer' },
  { value: 'site_engineer',       label: 'Site Engineer' },
];

const ROLE_BADGE: Record<string, 'warning' | 'info' | 'success'> = {
  super_admin:          'warning',
  procurement_manager:  'info',
  procurement_officer:  'info',
  site_engineer:        'success',
};

const sel = 'form-select';

export default function UsersPage() {
  const { user: me } = useAuth();
  const { isTenantAdmin, isPlatformAdmin } = useMyPermissions();
  const isAdmin = isTenantAdmin || isPlatformAdmin;

  const { page, setPage, search, handleSearch } = useTableState();
  const [role,   setRole]   = useState('');
  const [status, setStatus] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['users', page, search, role, status],
    queryFn: () => usersApi.getAll({
      page, page_size: 20,
      search:    search || undefined,
      role:      role   || undefined,
      is_active: status === '' ? undefined : status === 'active',
    }),
    placeholderData: (prev) => prev,
  });

  const users: User[] = data?.results ?? [];
  const total = data?.count ?? 0;

  const handleRole   = (v: string) => { setRole(v);   setPage(1); };
  const handleStatus = (v: string) => { setStatus(v); setPage(1); };

  if (!isAdmin) return (
    <MainLayout>
      <div className="card" style={{ textAlign: 'center', padding: 'var(--space-20) 0' }}>
        <p style={{ color: 'var(--color-error)', fontSize: 'var(--text-sm)' }}>Access denied.</p>
      </div>
    </MainLayout>
  );

  const columns: Column<User>[] = [
    {
      key: 'user', header: 'User',
      render: u => {
        const name = [u.first_name, u.last_name].filter(Boolean).join(' ');
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <Avatar src={(u as any).avatar_url || (u as any).avatar} alt={u.username} size={36} username={u.username} />
            <div>
              <p style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-primary)', lineHeight: 'tight', margin: 0 }}>
                {name || u.username}
                {u.id === me?.id && (
                  <span style={{ marginLeft: 'var(--space-2)', fontSize: 'var(--text-xs)', fontWeight: 700, padding: '1px 6px', borderRadius: 'var(--radius-sm)', background: 'var(--sidebar-active-bg)', color: 'var(--sidebar-active-text)' }}>
                    You
                  </span>
                )}
              </p>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: 0 }}>{u.email}</p>
            </div>
          </div>
        );
      },
    },
    { key: 'username', header: 'Username', render: u => <span style={{ fontSize: 'var(--text-sm)', fontFamily: 'monospace', color: 'var(--text-primary)' }}>@{u.username}</span> },
    {
      key: 'role', header: 'Role',
      render: u => u.role
        ? <Badge variant={ROLE_BADGE[u.role] ?? 'info'}>{ROLES.find(r => r.value === u.role)?.label ?? u.role}</Badge>
        : <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>—</span>,
    },
    {
      key: 'status', header: 'Status',
      render: u => <Badge variant={u.is_active ? 'success' : 'error'}>{u.is_active ? 'Active' : 'Inactive'}</Badge>,
    },
    {
      key: 'actions', header: '',
      render: u => <Link href={`/users/${u.id}`}><Button variant="secondary" size="sm">View</Button></Link>,
    },
  ];

  return (
    <MainLayout>
      <PageShell>
        <PageHeader
          title="System Accounts"
          count={total}
          breadcrumbs={[{ label: 'System Accounts' }]}
          actions={<Link href="/hr/employees/new"><Button variant="primary">+ Add Employee</Button></Link>}
        />

        <div style={{
          padding: '10px 16px', borderRadius: 8, marginBottom: 12,
          background: 'var(--surface-subtle)', border: '1px solid var(--border-subtle)',
          fontSize: 13, color: 'var(--text-secondary)',
        }}>
          System accounts control login access and permissions. For HR profiles (department, position, attendance), go to{' '}
          <Link href="/hr/employees" style={{ color: 'var(--brand)', fontWeight: 600 }}>HR → Employees</Link>.
        </div>

        <WorkspaceSurface
          toolbar={
            <>
              <SearchInput value={search} onChange={handleSearch} placeholder="Search name, username, email..." />
              <div style={{ flex: 1 }} />
              <select className={sel} value={role} onChange={e => handleRole(e.target.value)}>
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
              <select className={sel} value={status} onChange={e => handleStatus(e.target.value)}>
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              {(search || role || status) && (
                <button
                  onClick={() => { handleSearch(''); handleRole(''); handleStatus(''); }}
                  style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', padding: '0 var(--space-2)', background: 'none', border: 'none', cursor: 'pointer' }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
                >
                  Clear
                </button>
              )}
            </>
          }
        >
          <DataTable
            surface
            columns={columns}
            data={users}
            isLoading={isLoading}
            emptyMessage="No users found."
            rowStyle={u => u.is_active ? undefined : { opacity: 0.6 }}
            page={page}
            totalCount={total}
            pageSize={20}
            hasPrev={!!data?.previous}
            hasNext={!!data?.next}
            onPageChange={setPage}
          />
        </WorkspaceSurface>
      </PageShell>
    </MainLayout>
  );
}
