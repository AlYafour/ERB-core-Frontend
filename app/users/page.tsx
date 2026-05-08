'use client';

import { useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { useQuery } from '@tanstack/react-query';
import { usersApi } from '@/lib/api/users';
import { User } from '@/types';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/use-auth';
import { Button, TextField, Badge, Loader } from '@/components/ui';
import Avatar from '@/components/ui/Avatar';

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

  const [search,   setSearch]   = useState('');
  const [role,     setRole]     = useState('');
  const [status,   setStatus]   = useState('');
  const [page,     setPage]     = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['users', page, search, role, status],
    queryFn: () => usersApi.getAll({
      page,
      page_size: 20,
      search:    search  || undefined,
      role:      role    || undefined,
      is_active: status === '' ? undefined : status === 'active',
    }),
    placeholderData: (prev) => prev,
  });

  const users: User[] = data?.results ?? [];
  const total = data?.count ?? 0;
  const totalPages = Math.ceil(total / 20);

  const handleSearch = (v: string) => { setSearch(v); setPage(1); };
  const handleRole   = (v: string) => { setRole(v);   setPage(1); };
  const handleStatus = (v: string) => { setStatus(v); setPage(1); };

  if (!isAdmin) return (
    <MainLayout>
      <div className="card text-center py-20">
        <p className="text-destructive text-sm">Access denied.</p>
      </div>
    </MainLayout>
  );

  return (
    <MainLayout>
      <div className="space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Users</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {total > 0 ? `${total} user${total !== 1 ? 's' : ''}` : 'No users'}
            </p>
          </div>
          <Link href="/hr/employees/new">
            <Button variant="primary">+ New User</Button>
          </Link>
        </div>

        {/* Filters */}
        <div className="card flex items-center gap-3 flex-wrap">
          <TextField
            placeholder="Search name, username, email..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="flex-1 min-w-[220px] max-w-sm"
          />
          <select className={sel} value={role} onChange={(e) => handleRole(e.target.value)}>
            {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          <select className={sel} value={status} onChange={(e) => handleStatus(e.target.value)}>
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          {(search || role || status) && (
            <button
              onClick={() => { setSearch(''); setRole(''); setStatus(''); setPage(1); }}
              className="text-sm text-muted-foreground hover:text-foreground px-2"
            >
              Clear
            </button>
          )}
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="card text-center py-16"><Loader className="mx-auto" /></div>
        ) : users.length === 0 ? (
          <div className="card text-center py-16">
            <p className="text-muted-foreground">No users found.</p>
          </div>
        ) : (
          <div className="card p-0 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b" style={{ borderColor: 'var(--border)' }}>User</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b" style={{ borderColor: 'var(--border)' }}>Username</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b" style={{ borderColor: 'var(--border)' }}>Role</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b" style={{ borderColor: 'var(--border)' }}>Status</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b" style={{ borderColor: 'var(--border)' }}></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const name = [u.first_name, u.last_name].filter(Boolean).join(' ');
                  const roleLabel = ROLES.find(r => r.value === u.role)?.label ?? u.role;
                  return (
                    <tr
                      key={u.id}
                      className="border-b hover:bg-muted/30 transition-colors"
                      style={{ borderColor: 'var(--border)', opacity: u.is_active ? 1 : 0.6 }}
                    >
                      {/* Avatar + name + email */}
                      <td className="px-4 py-3">
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
                      </td>

                      {/* Username */}
                      <td className="px-4 py-3">
                        <span className="text-sm font-mono text-foreground">@{u.username}</span>
                      </td>

                      {/* Role */}
                      <td className="px-4 py-3">
                        {u.role ? (
                          <Badge variant={ROLE_BADGE[u.role] ?? 'info'}>
                            {roleLabel}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <Badge variant={u.is_active ? 'success' : 'error'}>
                          {u.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>

                      {/* Action */}
                      <td className="px-4 py-3 text-right">
                        <Link href={`/users/${u.id}`}>
                          <Button variant="secondary" size="sm">View</Button>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between card">
            <p className="text-sm text-muted-foreground">
              Page {page} of {totalPages} · {total} total
            </p>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setPage(p => p - 1)} disabled={page === 1}>Previous</Button>
              <Button variant="secondary" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages}>Next</Button>
            </div>
          </div>
        )}

      </div>
    </MainLayout>
  );
}
