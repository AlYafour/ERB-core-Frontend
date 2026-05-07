'use client';

import { useState, useRef, useEffect } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '@/lib/api/users';
import { permissionsApi, PermissionSet } from '@/lib/api/permissions';
import { User } from '@/types';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/use-auth';
import { toast } from '@/lib/hooks/use-toast';
import { confirm } from '@/lib/hooks/use-toast';
import FilterPanel, { FilterField } from '@/components/ui/FilterPanel';
import FilterTags from '@/components/ui/FilterTags';
import { Button, TextField, Checkbox, Loader, Badge } from '@/components/ui';
import Avatar from '@/components/ui/Avatar';
import { useT } from '@/lib/i18n/useT';

/* ─── Constants ──────────────────────────────────────────────────── */
const ROLE_LABELS: Record<string, string> = {
  site_engineer:        'Site Engineer',
  procurement_manager:  'Procurement Manager',
  procurement_officer:  'Procurement Officer',
  super_admin:          'Super Admin',
};

const ROLE_BADGE: Record<string, 'warning' | 'info' | 'success' | 'error'> = {
  super_admin:          'warning',
  procurement_manager:  'info',
  procurement_officer:  'info',
  site_engineer:        'success',
};

/* Modules a role can access by default */
const ROLE_MODULES: Record<string, { label: string; color: string }[]> = {
  super_admin:         [{ label: 'Procurement', color: '#3b82f6' }, { label: 'HR', color: '#f97316' }],
  procurement_manager: [{ label: 'Procurement', color: '#3b82f6' }, { label: 'HR', color: '#f97316' }],
  procurement_officer: [{ label: 'Procurement', color: '#3b82f6' }, { label: 'HR', color: '#f97316' }],
  site_engineer:       [{ label: 'Procurement', color: '#3b82f6' }, { label: 'HR', color: '#f97316' }],
};

/* ─── Inline Role Picker ─────────────────────────────────────────── */
function RolePicker({
  userId,
  current,
  sets,
  onAssign,
  isPending,
}: {
  userId: number;
  current: PermissionSet | null | undefined;
  sets: PermissionSet[];
  onAssign: (userId: number, setId: number | null) => void;
  isPending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '3px 10px', borderRadius: 6, cursor: 'pointer',
          fontSize: 12, fontWeight: 600,
          border: current ? '1px solid var(--brand-orange)' : '1px dashed var(--border-primary)',
          background: current ? 'var(--brand-orange-light)' : 'var(--bg-secondary)',
          color: current ? 'var(--brand-orange)' : 'var(--text-secondary)',
          transition: 'all .15s',
        }}
      >
        {isPending ? '…' : (current?.name ?? 'No Role')}
        <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
          <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
        </svg>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '110%', left: 0, zIndex: 200,
          minWidth: 200, background: 'var(--card-bg)',
          border: '1px solid var(--border-primary)',
          borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.12)',
          padding: 6, overflow: 'hidden',
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.8px', padding: '4px 8px 6px' }}>
            Assign Permission Set
          </div>
          {/* Clear */}
          <button
            onClick={() => { onAssign(userId, null); setOpen(false); }}
            style={{
              width: '100%', textAlign: 'left', padding: '7px 10px',
              borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12,
              background: !current ? 'var(--brand-orange-light)' : 'transparent',
              color: !current ? 'var(--brand-orange)' : 'var(--text-secondary)',
              fontWeight: !current ? 700 : 400,
            }}
          >
            — No Role
          </button>
          {sets.map(s => (
            <button
              key={s.id}
              onClick={() => { onAssign(userId, s.id); setOpen(false); }}
              style={{
                width: '100%', textAlign: 'left', padding: '7px 10px',
                borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12,
                background: current?.id === s.id ? 'var(--brand-orange-light)' : 'transparent',
                color: current?.id === s.id ? 'var(--brand-orange)' : 'var(--text-primary)',
                fontWeight: current?.id === s.id ? 700 : 400,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}
            >
              <span>{s.name}</span>
              {current?.id === s.id && <span style={{ fontSize: 10 }}>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Module chips ───────────────────────────────────────────────── */
function ModuleChips({ role }: { role: string }) {
  const modules = ROLE_MODULES[role] ?? [{ label: 'HR', color: '#f97316' }];
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {modules.map(m => (
        <span key={m.label} style={{
          fontSize: 10, fontWeight: 700, padding: '2px 7px',
          borderRadius: 4, letterSpacing: '.3px',
          color: m.color, background: m.color + '18',
          border: `1px solid ${m.color}44`,
        }}>
          {m.label}
        </span>
      ))}
    </div>
  );
}

/* ─── Stat card ──────────────────────────────────────────────────── */
function StatCard({ label, value, sub, color }: { label: string; value: number | string; sub?: string; color: string }) {
  return (
    <div style={{
      flex: 1, minWidth: 140,
      background: 'var(--card-bg)',
      border: '1px solid var(--border-primary)',
      borderRadius: 12, padding: '14px 18px',
      borderTop: `3px solid ${color}`,
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────────────── */
export default function UsersPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Record<string, any>>({});
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const t = useT();

  /* ─── Queries ── */
  const { data, isLoading, error } = useQuery({
    queryKey: ['users', page, search, filters],
    queryFn: () => usersApi.getAll({ page, search, ...filters }),
  });

  const { data: permissionSetsData } = useQuery({
    queryKey: ['permission-sets', ''],
    queryFn: () => permissionsApi.getAllPermissionSets({ page_size: 100 }),
  });
  const permissionSets = permissionSetsData?.results ?? [];

  /* ─── Mutations ── */
  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      usersApi.setActive(id, isActive),
    onSuccess: (_, { isActive }) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast(isActive ? 'User activated' : 'User deactivated', 'success');
    },
    onError: () => toast('Failed to update user status', 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: usersApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast('User deleted', 'success');
    },
    onError: () => toast('Failed to delete user', 'error'),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      await Promise.all(ids.filter(id => id !== currentUser?.id).map(id => usersApi.delete(id)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setSelectedItems(new Set());
      toast(`${selectedItems.size} user(s) deleted`, 'success');
    },
    onError: () => toast('Failed to delete users', 'error'),
  });

  const assignRoleMutation = useMutation({
    mutationFn: ({ userId, permissionSetId }: { userId: number; permissionSetId: number | null }) =>
      permissionsApi.assignPermissionSetToUser(userId, permissionSetId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['user-permission-summary'] });
      toast('Permission set updated', 'success');
    },
    onError: () => toast('Failed to update permission set', 'error'),
  });

  /* ─── Filter fields ── */
  const filterFields: FilterField[] = [
    { name: 'username',    label: 'Username',   type: 'text',    group: 'User Info' },
    { name: 'email',       label: 'Email',      type: 'text',    group: 'User Info' },
    { name: 'first_name',  label: 'First Name', type: 'text',    group: 'User Info' },
    { name: 'last_name',   label: 'Last Name',  type: 'text',    group: 'User Info' },
    {
      name: 'role', label: 'Role', type: 'select', group: 'Role & Status',
      options: [
        { value: 'site_engineer',       label: 'Site Engineer' },
        { value: 'procurement_manager', label: 'Procurement Manager' },
        { value: 'procurement_officer', label: 'Procurement Officer' },
        { value: 'super_admin',         label: 'Super Admin' },
      ],
    },
    { name: 'is_staff',  label: 'Is Staff',  type: 'boolean', group: 'Role & Status' },
    { name: 'is_active', label: 'Is Active', type: 'boolean', group: 'Role & Status' },
    { name: 'date_joined_after',  label: 'Joined From', type: 'date', group: 'Dates' },
    { name: 'date_joined_before', label: 'Joined To',   type: 'date', group: 'Dates' },
  ];

  /* ─── Handlers ── */
  const handleDelete = async (id: number) => {
    if (id === currentUser?.id) { toast('Cannot delete your own account', 'warning'); return; }
    if (await confirm('Delete this user?')) deleteMutation.mutate(id);
  };

  const handleBulkDelete = async () => {
    if (!selectedItems.size) return;
    if (await confirm(`Delete ${selectedItems.size} user(s)?`)) {
      bulkDeleteMutation.mutate(Array.from(selectedItems));
    }
  };

  const toggleSelect = (id: number, checked: boolean) => {
    if (id === currentUser?.id) return;
    const s = new Set(selectedItems);
    checked ? s.add(id) : s.delete(id);
    setSelectedItems(s);
  };

  const currentIds = data?.results?.filter((u: User) => u.id !== currentUser?.id).map((u: User) => u.id) ?? [];
  const allSelected  = currentIds.length > 0 && currentIds.every(id => selectedItems.has(id));
  const someSelected = currentIds.some(id => selectedItems.has(id)) && !allSelected;

  /* ─── Stats ── */
  const total   = data?.count ?? 0;
  const active  = data?.results?.filter((u: User) => u.is_active).length ?? 0;
  const admins  = data?.results?.filter((u: User) => u.role === 'super_admin').length ?? 0;
  const noRole  = data?.results?.filter((u: User) => !u.permission_set).length ?? 0;

  const isSuperuser = currentUser?.is_superuser ?? false;
  if (!isSuperuser && currentUser?.role !== 'super_admin' && !currentUser?.is_staff) {
    return (
      <MainLayout>
        <div className="card border-destructive bg-destructive/10">
          <p className="text-destructive text-sm">{t('toast', 'accessDenied')}</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-5">

        {/* ── Page header ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 'var(--font-2xl)', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              Users & Access Control
            </h1>
            <p style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)', margin: '4px 0 0' }}>
              Manage user accounts, roles, and module access
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {selectedItems.size > 0 && (
              <Button variant="destructive" onClick={handleBulkDelete} isLoading={bulkDeleteMutation.isPending}>
                Delete {selectedItems.size} selected
              </Button>
            )}
            <Link href="/users/pending">
              <Button variant="secondary">Pending Approvals</Button>
            </Link>
            <Link href="/settings/permissions">
              <Button variant="secondary">Permission Sets</Button>
            </Link>
            <Link href="/users/new">
              <Button variant="primary">+ Add User</Button>
            </Link>
          </div>
        </div>

        {/* ── Stats row ── */}
        {data && (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <StatCard label="Total Users"     value={total}  sub="registered accounts"    color="#3b82f6" />
            <StatCard label="Active"          value={active} sub={`${total - active} inactive`} color="#10b981" />
            <StatCard label="Super Admins"    value={admins} sub="full access"             color="#f97316" />
            <StatCard label="No Role Assigned" value={noRole} sub="need permission set"   color="#ef4444" />
          </div>
        )}

        {/* ── Search & Filters ── */}
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <TextField
            type="text"
            placeholder="Search by name, username, email…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="flex-1 max-w-md"
          />
          <FilterPanel
            fields={filterFields}
            filters={filters}
            onFilterChange={(f) => { setFilters(f); setPage(1); }}
            onReset={() => { setFilters({}); setPage(1); }}
            saveKey="users"
          />
        </div>

        {Object.keys(filters).length > 0 && (
          <FilterTags
            filters={filters}
            fields={filterFields}
            onRemoveFilter={(k) => { const f = { ...filters }; delete f[k]; setFilters(f); setPage(1); }}
            onClearAll={() => { setFilters({}); setPage(1); }}
          />
        )}

        {/* ── Table ── */}
        {isLoading ? (
          <div className="card text-center py-12"><Loader className="mx-auto mb-4" /><p className="text-muted-foreground">Loading…</p></div>
        ) : error ? (
          <div className="card border-destructive bg-destructive/10"><p className="text-destructive text-sm">Failed to load users</p></div>
        ) : !data?.results?.length ? (
          <div className="card text-center py-12"><p className="text-muted-foreground">No users found</p></div>
        ) : (
          <>
            <div className="card p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 44 }}>
                        <Checkbox
                          checked={allSelected}
                          ref={(el) => { if (el) el.indeterminate = someSelected; }}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedItems(new Set(currentIds));
                            else setSelectedItems(new Set());
                          }}
                        />
                      </th>
                      <th>User</th>
                      <th>Full Name</th>
                      <th>Role</th>
                      <th>Permission Set</th>
                      <th>Module Access</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.results.map((user: User) => (
                      <tr key={user.id} style={{ opacity: user.is_active ? 1 : 0.6 }}>
                        {/* Checkbox */}
                        <td>
                          {user.id !== currentUser?.id && (
                            <Checkbox
                              checked={selectedItems.has(user.id)}
                              onChange={(e) => toggleSelect(user.id, e.target.checked)}
                            />
                          )}
                        </td>

                        {/* User */}
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <Avatar src={user.avatar_url} alt={user.username} size={34} username={user.username} />
                            <div>
                              <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
                                {user.username}
                                {user.id === currentUser?.id && (
                                  <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: 'var(--brand-orange)', background: 'var(--brand-orange-light)', padding: '1px 5px', borderRadius: 4 }}>
                                    You
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{user.email}</div>
                            </div>
                          </div>
                        </td>

                        {/* Full Name */}
                        <td>
                          <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                            {[user.first_name, user.last_name].filter(Boolean).join(' ') || '—'}
                          </div>
                          {user.job_title && (
                            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{user.job_title}</div>
                          )}
                        </td>

                        {/* Role */}
                        <td>
                          <Badge variant={ROLE_BADGE[user.role] ?? 'info'}>
                            {ROLE_LABELS[user.role] ?? user.role}
                          </Badge>
                        </td>

                        {/* Permission Set — inline picker */}
                        <td>
                          {isSuperuser || currentUser?.is_staff ? (
                            <RolePicker
                              userId={user.id}
                              current={user.permission_set}
                              sets={permissionSets}
                              onAssign={(uid, sid) => assignRoleMutation.mutate({ userId: uid, permissionSetId: sid })}
                              isPending={assignRoleMutation.isPending && assignRoleMutation.variables?.userId === user.id}
                            />
                          ) : (
                            <span style={{ fontSize: 12, color: user.permission_set ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                              {user.permission_set?.name ?? 'No Role'}
                            </span>
                          )}
                        </td>

                        {/* Module Access */}
                        <td><ModuleChips role={user.role} /></td>

                        {/* Status */}
                        <td>
                          <Badge variant={user.is_active ? 'success' : 'error'}>
                            {user.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>

                        {/* Actions */}
                        <td>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <Link href={`/users/view/${user.id}`}>
                              <Button variant="view" size="sm">View</Button>
                            </Link>
                            <Link href={`/users/${user.id}`}>
                              <Button variant="edit" size="sm">Edit</Button>
                            </Link>
                            {user.id !== currentUser?.id && isSuperuser && (
                              <Button
                                variant={user.is_active ? 'secondary' : 'success'}
                                size="sm"
                                onClick={() => toggleActiveMutation.mutate({ id: user.id, isActive: !user.is_active })}
                                disabled={toggleActiveMutation.isPending}
                              >
                                {user.is_active ? 'Deactivate' : 'Activate'}
                              </Button>
                            )}
                            {user.id !== currentUser?.id && isSuperuser && (
                              <Button
                                variant="delete"
                                size="sm"
                                onClick={() => handleDelete(user.id)}
                                disabled={deleteMutation.isPending}
                              >
                                Delete
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
            {data.count > 50 && (
              <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  Showing {(page - 1) * 50 + 1}–{Math.min(page * 50, data.count)} of {data.count}
                  {selectedItems.size > 0 && <strong style={{ marginLeft: 8 }}> · {selectedItems.size} selected</strong>}
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button variant="secondary" onClick={() => setPage(p => p - 1)} disabled={!data.previous}>Previous</Button>
                  <Button variant="secondary" onClick={() => setPage(p => p + 1)} disabled={!data.next}>Next</Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </MainLayout>
  );
}
