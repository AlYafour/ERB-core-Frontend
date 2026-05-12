'use client';

import { useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { useQuery } from '@tanstack/react-query';
import { usersApi } from '@/lib/api/users';
import { User } from '@/types';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/use-auth';
import { Button, TextField, Badge } from '@/components/ui';
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

const sel = 'px-3 py-2 rounded-md border text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 h-[38px]';

export default function UsersPage() {
  const { user: me } = useAuth();
  const isAdmin = me?.role === 'super_admin' || me?.is_staff || me?.is_superuser;

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
      <div className="card text-center py-20">
        <p className="text-destructive text-sm">Access denied.</p>
      </div>
    </MainLayout>
  );

  const columns: Column<User>[] = [
    {
      key: 'user', header: 'User',
      render: u => {
        const name = [u.first_name, u.last_name].filter(Boolean).join(' ');
        return (
          <div className="flex items-center gap-3">
            <Avatar src={(u as any).avatar_url || (u as any).avatar} alt={u.username} size={36} username={u.username} />
            <div>
              <p className="text-sm font-semibold text-foreground leading-tight">
                {name || u.username}
                {u.id === me?.id && (
                  <span className="ml-2 text-xs font-bold px-1.5 py-0.5 rounded"
                    style={{ background: 'var(--sidebar-active-bg)', color: 'var(--sidebar-active-text)' }}>
                    You
                  </span>
                )}
              </p>
              <p className="text-xs text-muted-foreground">{u.email}</p>
            </div>
          </div>
        );
      },
    },
    { key: 'username', header: 'Username', render: u => <span className="text-sm font-mono text-foreground">@{u.username}</span> },
    {
      key: 'role', header: 'Role',
      render: u => u.role
        ? <Badge variant={ROLE_BADGE[u.role] ?? 'info'}>{ROLES.find(r => r.value === u.role)?.label ?? u.role}</Badge>
        : <span className="text-xs text-muted-foreground">—</span>,
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
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Users</h1>
            <p className="text-sm text-muted-foreground mt-1">{total > 0 ? `${total} user${total !== 1 ? 's' : ''}` : 'No users'}</p>
          </div>
          <Link href="/hr/employees/new"><Button variant="primary">+ New User</Button></Link>
        </div>

        <div className="card flex items-center gap-3 flex-wrap">
          <TextField
            placeholder="Search name, username, email..."
            value={search}
            onChange={e => handleSearch(e.target.value)}
            className="flex-1 min-w-[220px] max-w-sm"
          />
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
              className="text-sm text-muted-foreground hover:text-foreground px-2"
            >
              Clear
            </button>
          )}
        </div>

        <DataTable
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
      </div>
    </MainLayout>
  );
}
