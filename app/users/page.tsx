'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '@/lib/api/users';
import { hrEmployeesApi } from '@/lib/api/hr';
import { permissionsApi } from '@/lib/api/permissions';
import { PermissionSet } from '@/types';
import { User, HREmployee, HREmployeeUser } from '@/types';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/use-auth';
import { toast } from '@/lib/hooks/use-toast';
import { confirm } from '@/lib/hooks/use-toast';
import { Button, TextField, Badge, Loader } from '@/components/ui';
import Avatar from '@/components/ui/Avatar';
import { useT } from '@/lib/i18n/useT';

/* ─── Constants ──────────────────────────────────────────────────── */
const ROLE_BADGE: Record<string, 'warning' | 'info' | 'success' | 'error'> = {
  super_admin:          'warning',
  procurement_manager:  'info',
  procurement_officer:  'info',
  site_engineer:        'success',
};

const ROLE_LABEL: Record<string, string> = {
  super_admin:         'Super Admin',
  procurement_manager: 'Proc. Manager',
  procurement_officer: 'Proc. Officer',
  site_engineer:       'Site Engineer',
};

const EMP_TYPE_COLOR: Record<string, string> = {
  full_time: '#10b981',
  part_time: '#f59e0b',
  contract:  '#3b82f6',
  intern:    '#8b5cf6',
};

const EMP_TYPE_LABEL: Record<string, string> = {
  full_time: 'Full Time',
  part_time: 'Part Time',
  contract:  'Contract',
  intern:    'Intern',
};

/* ─── Inline Permission Set Picker ──────────────────────────────── */
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
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '3px 10px', borderRadius: 6, cursor: 'pointer',
          fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
          border: current ? '1px solid var(--brand-orange)' : '1px dashed var(--border-primary)',
          background: current ? 'var(--brand-orange-light)' : 'var(--bg-secondary)',
          color: current ? 'var(--brand-orange)' : 'var(--text-secondary)',
        }}
      >
        {isPending ? '…' : (current?.name ?? 'No Role')}
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '110%', left: 0, zIndex: 300,
          minWidth: 210, background: 'var(--card-bg)',
          border: '1px solid var(--border-primary)',
          borderRadius: 10, boxShadow: '0 8px 28px rgba(0,0,0,.13)',
          padding: 6,
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.8px', padding: '4px 8px 6px' }}>
            Assign Permission Set
          </div>
          <button
            onClick={() => { onAssign(userId, null); setOpen(false); }}
            style={pickerItemStyle(!current)}
          >
            — No Role
          </button>
          {sets.map(s => (
            <button key={s.id} onClick={() => { onAssign(userId, s.id); setOpen(false); }}
              style={pickerItemStyle(current?.id === s.id)}
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

function pickerItemStyle(active: boolean): React.CSSProperties {
  return {
    width: '100%', textAlign: 'left', padding: '7px 10px',
    borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12,
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    background: active ? 'var(--brand-orange-light)' : 'transparent',
    color: active ? 'var(--brand-orange)' : 'var(--text-primary)',
    fontWeight: active ? 700 : 400,
  };
}

/* ─── Account Status Badge ───────────────────────────────────────── */
function AccountBadge({ hasAccount }: { hasAccount: boolean }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
      color:  hasAccount ? '#15803d' : '#92400e',
      background: hasAccount ? '#f0fdf4' : '#fffbeb',
      border: `1px solid ${hasAccount ? '#86efac' : '#fcd34d'}`,
    }}>
      {hasAccount ? '● System Account' : '○ No Account'}
    </span>
  );
}

/* ─── Stat card ──────────────────────────────────────────────────── */
function StatCard({ label, value, sub, color, onClick }: {
  label: string; value: number | string; sub?: string; color: string; onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        flex: 1, minWidth: 150,
        background: 'var(--card-bg)', border: '1px solid var(--border-primary)',
        borderRadius: 12, padding: '14px 18px',
        borderTop: `3px solid ${color}`,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'box-shadow .15s',
      }}
      onMouseEnter={e => onClick && ((e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(0,0,0,.08)')}
      onMouseLeave={e => onClick && ((e.currentTarget as HTMLDivElement).style.boxShadow = 'none')}
    >
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────────────── */
type Tab = 'staff' | 'unlinked';

export default function PeoplePage() {
  const [tab, setTab] = useState<Tab>('staff');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const t = useT();
  const isAdmin = currentUser?.role === 'super_admin' || currentUser?.is_superuser || currentUser?.is_staff;

  /* ─── Queries ── */
  const { data: empData, isLoading: loadingEmps } = useQuery({
    queryKey: ['hr-employees', page, search],
    queryFn: () => hrEmployeesApi.getAll({ page, search, page_size: 50 } as any),
  });

  /* Fetch ALL users (unpaginated, for matching + permission_set) */
  const { data: usersData } = useQuery({
    queryKey: ['users-all-for-people'],
    queryFn: () => usersApi.getAll({ page_size: 500 } as any),
    staleTime: 60_000,
  });

  const { data: setsData } = useQuery({
    queryKey: ['permission-sets-all'],
    queryFn: () => permissionsApi.getAllPermissionSets({ page_size: 100 }),
    staleTime: 120_000,
  });
  const permissionSets = setsData?.results ?? [];

  /* Build lookup: userId → User (for permission_set) */
  const userById = useMemo<Record<number, User>>(() => {
    const map: Record<number, User> = {};
    (usersData?.results ?? []).forEach((u: User) => { map[u.id] = u; });
    return map;
  }, [usersData]);

  /* Employees linked to a user account */
  const employees: HREmployee[] = empData?.results ?? [];

  /* Users with NO employee record */
  const linkedUserIds = useMemo(
    () => new Set(employees.map(e => e.user?.id).filter(Boolean)),
    [employees]
  );
  const unlinkedUsers = useMemo(
    () => (usersData?.results ?? []).filter((u: User) => !linkedUserIds.has(u.id)),
    [usersData, linkedUserIds]
  );

  /* Filtered unlinked users by search */
  const filteredUnlinked = useMemo(() => {
    if (!search) return unlinkedUsers;
    const q = search.toLowerCase();
    return unlinkedUsers.filter((u: User) =>
      u.username.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      [u.first_name, u.last_name].join(' ').toLowerCase().includes(q)
    );
  }, [unlinkedUsers, search]);

  /* ─── Stats ── */
  const totalEmployees  = empData?.count ?? 0;
  const activeEmployees = employees.filter(e => e.is_active).length;
  const withAccount     = employees.filter(e => !!e.user?.id).length;
  const noRole          = employees.filter(e => e.user?.id && !userById[e.user.id]?.permission_set).length;

  /* ─── Mutations ── */
  const assignRoleMutation = useMutation({
    mutationFn: ({ userId, permissionSetId }: { userId: number; permissionSetId: number | null }) =>
      permissionsApi.assignPermissionSetToUser(userId, permissionSetId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-all-for-people'] });
      toast('Permission set updated', 'success');
    },
    onError: () => toast('Failed to update permission set', 'error'),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      usersApi.setActive(id, isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-all-for-people'] });
      queryClient.invalidateQueries({ queryKey: ['hr-employees'] });
      toast('Status updated', 'success');
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: usersApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-all-for-people'] });
      toast('User deleted', 'success');
    },
  });

  /* ─── Access guard ── */
  if (!isAdmin) {
    return (
      <MainLayout>
        <div className="card border-destructive bg-destructive/10">
          <p className="text-destructive text-sm">{t('toast', 'accessDenied')}</p>
        </div>
      </MainLayout>
    );
  }

  /* ─── Tab style helper ── */
  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '8px 20px', cursor: 'pointer', border: 'none',
    borderBottom: active ? '2px solid var(--brand-orange)' : '2px solid transparent',
    background: 'none', fontWeight: active ? 700 : 400,
    color: active ? 'var(--brand-orange)' : 'var(--text-secondary)',
    fontSize: 14, transition: 'all .15s',
  });

  return (
    <MainLayout>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              People &amp; Access
            </h1>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
              All employees and their system accounts in one place
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Link href="/settings/permissions">
              <Button variant="secondary">Permission Sets</Button>
            </Link>
            <Link href="/hr/employees/new">
              <Button variant="primary">+ Add Employee</Button>
            </Link>
          </div>
        </div>

        {/* ── Stats ── */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <StatCard label="Total Staff"      value={totalEmployees}  sub="employee records"         color="#3b82f6" onClick={() => { setTab('staff'); setSearch(''); }} />
          <StatCard label="Active"           value={activeEmployees} sub="currently employed"        color="#10b981" />
          <StatCard label="With Accounts"    value={withAccount}     sub="can log into the system"   color="#f97316" />
          <StatCard label="No Role Assigned" value={noRole}          sub="need a permission set"     color="#ef4444" onClick={() => setTab('staff')} />
          <StatCard label="Unlinked Accounts" value={unlinkedUsers.length} sub="no HR record"        color="#8b5cf6" onClick={() => setTab('unlinked')} />
        </div>

        {/* ── Tabs ── */}
        <div style={{ borderBottom: '1px solid var(--border-primary)', display: 'flex', gap: 4 }}>
          <button style={tabStyle(tab === 'staff')}    onClick={() => { setTab('staff');    setSearch(''); setPage(1); }}>
            All Staff
            <span style={{ marginLeft: 6, fontSize: 11, background: 'var(--bg-secondary)', padding: '1px 7px', borderRadius: 10 }}>
              {totalEmployees}
            </span>
          </button>
          <button style={tabStyle(tab === 'unlinked')} onClick={() => { setTab('unlinked'); setSearch(''); }}>
            Unlinked Accounts
            {unlinkedUsers.length > 0 && (
              <span style={{ marginLeft: 6, fontSize: 11, background: '#ef444420', color: '#ef4444', padding: '1px 7px', borderRadius: 10, fontWeight: 700 }}>
                {unlinkedUsers.length}
              </span>
            )}
          </button>
        </div>

        {/* ── Search ── */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <TextField
            type="text"
            placeholder={tab === 'staff' ? 'Search by name, employee ID, position…' : 'Search by username or email…'}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="flex-1 max-w-lg"
          />
          {tab === 'staff' && (
            <Link href="/users/pending">
              <Button variant="secondary" size="sm">Pending Approvals</Button>
            </Link>
          )}
        </div>

        {/* ═══════════════════════════════════════
            Tab: All Staff
        ═══════════════════════════════════════ */}
        {tab === 'staff' && (
          <>
            {loadingEmps ? (
              <div className="card text-center py-12"><Loader className="mx-auto mb-3" /><p className="text-muted-foreground">Loading…</p></div>
            ) : !employees.length ? (
              <div className="card text-center py-12"><p className="text-muted-foreground">No employees found</p></div>
            ) : (
              <div className="card p-0 overflow-hidden">
                <div className="overflow-x-auto">
                  <table>
                    <thead>
                      <tr>
                        <th style={{ width: 110 }}>Emp. ID</th>
                        <th>Person</th>
                        <th>Department / Position</th>
                        <th>System Account</th>
                        <th>Role</th>
                        <th>Permission Set</th>
                        <th>Type</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {employees.map((emp) => {
                        const linkedUser = emp.user?.id ? userById[emp.user.id] : null;
                        const hasAccount = !!emp.user?.id;

                        return (
                          <tr key={emp.id} style={{ opacity: emp.is_active ? 1 : 0.55 }}>
                            {/* Employee ID */}
                            <td>
                              <span style={{
                                fontFamily: 'monospace', fontSize: 12, fontWeight: 700,
                                color: 'var(--brand-orange)', background: 'var(--brand-orange-light)',
                                padding: '3px 8px', borderRadius: 5,
                              }}>
                                {emp.employee_id}
                              </span>
                            </td>

                            {/* Person */}
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <Avatar
                                  src={emp.avatar || emp.user?.avatar || undefined}
                                  alt={emp.full_name}
                                  size={36}
                                  username={emp.full_name || emp.user?.username}
                                />
                                <div>
                                  <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>
                                    {emp.full_name || [emp.user?.full_name].filter(Boolean).join(' ') || '—'}
                                  </div>
                                  <AccountBadge hasAccount={hasAccount} />
                                </div>
                              </div>
                            </td>

                            {/* Department / Position */}
                            <td>
                              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                                {emp.department_name || '—'}
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                                {emp.position_title || '—'}
                              </div>
                            </td>

                            {/* System Account */}
                            <td>
                              {hasAccount ? (
                                <div>
                                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                                    {emp.user.username}
                                  </div>
                                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                                    {emp.user.email}
                                  </div>
                                </div>
                              ) : (
                                <Link href="/hr/employees/new">
                                  <button style={{
                                    fontSize: 11, fontWeight: 600, padding: '4px 10px',
                                    borderRadius: 6, border: '1px dashed var(--border-primary)',
                                    background: 'transparent', color: 'var(--text-secondary)',
                                    cursor: 'pointer',
                                  }}>
                                    + Add Employee
                                  </button>
                                </Link>
                              )}
                            </td>

                            {/* Role */}
                            <td>
                              {hasAccount ? (
                                <Badge variant={ROLE_BADGE[emp.user.role] ?? 'info'}>
                                  {ROLE_LABEL[emp.user.role] ?? emp.user.role}
                                </Badge>
                              ) : (
                                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>—</span>
                              )}
                            </td>

                            {/* Permission Set */}
                            <td>
                              {hasAccount && linkedUser ? (
                                <RolePicker
                                  userId={emp.user.id}
                                  current={linkedUser.permission_set}
                                  sets={permissionSets}
                                  onAssign={(uid, sid) => assignRoleMutation.mutate({ userId: uid, permissionSetId: sid })}
                                  isPending={assignRoleMutation.isPending && assignRoleMutation.variables?.userId === emp.user.id}
                                />
                              ) : (
                                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>—</span>
                              )}
                            </td>

                            {/* Employment Type */}
                            <td>
                              <span style={{
                                fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 5,
                                color: EMP_TYPE_COLOR[emp.employment_type] ?? '#64748b',
                                background: (EMP_TYPE_COLOR[emp.employment_type] ?? '#64748b') + '18',
                                border: `1px solid ${(EMP_TYPE_COLOR[emp.employment_type] ?? '#64748b')}44`,
                              }}>
                                {EMP_TYPE_LABEL[emp.employment_type] ?? emp.employment_type}
                              </span>
                            </td>

                            {/* Status */}
                            <td>
                              <Badge variant={emp.is_active ? 'success' : 'error'}>
                                {emp.is_active ? 'Active' : 'Inactive'}
                              </Badge>
                            </td>

                            {/* Actions */}
                            <td>
                              <div style={{ display: 'flex', gap: 5 }}>
                                <Link href={`/hr/employees/${emp.id}`}>
                                  <Button variant="view" size="sm">HR</Button>
                                </Link>
                                {hasAccount && (
                                  <Link href={`/users/view/${emp.user.id}`}>
                                    <Button variant="edit" size="sm">Account</Button>
                                  </Link>
                                )}
                                {hasAccount && emp.user.id !== currentUser?.id && (
                                  <Button
                                    variant={linkedUser?.is_active ? 'secondary' : 'success'}
                                    size="sm"
                                    onClick={() => toggleActiveMutation.mutate({ id: emp.user.id, isActive: !linkedUser?.is_active })}
                                    disabled={toggleActiveMutation.isPending}
                                  >
                                    {linkedUser?.is_active ? 'Disable' : 'Enable'}
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Pagination */}
            {empData && empData.count > 50 && (
              <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  Showing {(page - 1) * 50 + 1}–{Math.min(page * 50, empData.count)} of {empData.count}
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button variant="secondary" onClick={() => setPage(p => p - 1)} disabled={!empData.previous || page === 1}>Previous</Button>
                  <Button variant="secondary" onClick={() => setPage(p => p + 1)} disabled={!empData.next}>Next</Button>
                </div>
              </div>
            )}
          </>
        )}

        {/* ═══════════════════════════════════════
            Tab: Unlinked Accounts
        ═══════════════════════════════════════ */}
        {tab === 'unlinked' && (
          <>
            {/* Info banner */}
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 16px',
              background: '#fffbeb', border: '1px solid #fcd34d', borderLeft: '3px solid #f59e0b',
              borderRadius: '0 8px 8px 0', fontSize: 13,
            }}>
              <span style={{ color: '#92400e', fontWeight: 700, flexShrink: 0 }}>⚠ Note:</span>
              <span style={{ color: '#78350f' }}>
                These accounts can log in but have no HR employee record linked.
                Create an employee profile for each person or delete the account if it's not needed.
              </span>
            </div>

            {!filteredUnlinked.length ? (
              <div className="card text-center py-12">
                <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
                  {search ? 'No matching accounts found' : '✓ All accounts are linked to employee records'}
                </p>
              </div>
            ) : (
              <div className="card p-0 overflow-hidden">
                <div className="overflow-x-auto">
                  <table>
                    <thead>
                      <tr>
                        <th>Account</th>
                        <th>Full Name</th>
                        <th>Role</th>
                        <th>Permission Set</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUnlinked.map((u: User) => (
                        <tr key={u.id}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <Avatar src={u.avatar_url} alt={u.username} size={34} username={u.username} />
                              <div>
                                <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>
                                  {u.username}
                                  {u.id === currentUser?.id && (
                                    <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: 'var(--brand-orange)', background: 'var(--brand-orange-light)', padding: '1px 5px', borderRadius: 4 }}>You</span>
                                  )}
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{u.email}</div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span style={{ fontSize: 13 }}>
                              {[u.first_name, u.last_name].filter(Boolean).join(' ') || '—'}
                            </span>
                          </td>
                          <td>
                            <Badge variant={ROLE_BADGE[u.role] ?? 'info'}>
                              {ROLE_LABEL[u.role] ?? u.role}
                            </Badge>
                          </td>
                          <td>
                            <RolePicker
                              userId={u.id}
                              current={u.permission_set}
                              sets={permissionSets}
                              onAssign={(uid, sid) => assignRoleMutation.mutate({ userId: uid, permissionSetId: sid })}
                              isPending={assignRoleMutation.isPending && assignRoleMutation.variables?.userId === u.id}
                            />
                          </td>
                          <td>
                            <Badge variant={u.is_active ? 'success' : 'error'}>
                              {u.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 5 }}>
                              <Link href={`/hr/employees/new`}>
                                <Button variant="secondary" size="sm">+ HR Profile</Button>
                              </Link>
                              <Link href={`/users/view/${u.id}`}>
                                <Button variant="view" size="sm">View</Button>
                              </Link>
                              {u.id !== currentUser?.id && currentUser?.is_superuser && (
                                <Button
                                  variant="delete"
                                  size="sm"
                                  onClick={async () => {
                                    if (await confirm('Delete this user account?')) deleteUserMutation.mutate(u.id);
                                  }}
                                  disabled={deleteUserMutation.isPending}
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
            )}
          </>
        )}
      </div>
    </MainLayout>
  );
}
