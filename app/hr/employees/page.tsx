'use client';

import { useState, useEffect, useCallback } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import { hrEmployeesApi, hrEmployeeGroupsApi } from '@/lib/api/hr';
import { useAuth } from '@/lib/hooks/use-auth';
import { toast } from '@/lib/hooks/use-toast';
import type { HREmployee, EmployeeGroup } from '@/types';

// ── Helpers ───────────────────────────────────────────────────────────────────
const isAdmin = (user: any) =>
  !!(user?.role === 'admin' || user?.role === 'super_admin' ||
     user?.role === 'hr_manager' || user?.role === 'hr_secretary' ||
     user?.role === 'company_director' ||
     user?.is_staff || user?.is_superuser);

const hasLogin = (emp: HREmployee): boolean => !!(emp.user?.id);
const canApprove = (emp: HREmployee): boolean => hasLogin(emp) && emp.is_active;

type ManagerRecord = { id: number; name: string } | null;
type GroupRecord  = { id: number; code: string; name: string } | null;

// ── Page ──────────────────────────────────────────────────────────────────────
export default function EmployeesPage() {
  const { user: me } = useAuth();
  const router = useRouter();
  const admin = isAdmin(me);

  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [pickerOpenId, setPickerOpenId]         = useState<number | null>(null);
  const [pickerSearch, setPickerSearch]         = useState('');
  const [managerOverrides, setManagerOverrides] = useState<Record<number, ManagerRecord>>({});
  const [groupPickerOpenId, setGroupPickerOpenId] = useState<number | null>(null);
  const [groupOverrides, setGroupOverrides]       = useState<Record<number, GroupRecord>>({});

  // ── Data ──────────────────────────────────────────────────────────────────
  const { data: raw, isLoading } = useQuery({
    queryKey: ['hr-employees-all'],
    queryFn: () => hrEmployeesApi.getAll(),
    staleTime: 60_000,
  });

  const { data: groupsRaw } = useQuery({
    queryKey: ['hr-employee-groups'],
    queryFn: () => hrEmployeeGroupsApi.getAll(),
    staleTime: 300_000,
  });

  const employees: HREmployee[] = raw?.results ?? [];
  const groups: EmployeeGroup[] = groupsRaw?.results ?? [];

  // ── Derived filters ───────────────────────────────────────────────────────
  const departments = Array.from(
    new Set(employees.map(e => e.department_name).filter(Boolean))
  ).sort() as string[];

  const filtered = employees.filter(e => {
    if (!showInactive && !e.is_active) return false;
    if (deptFilter && e.department_name !== deptFilter) return false;
    const q = search.toLowerCase();
    if (q && !e.full_name.toLowerCase().includes(q) && !e.employee_id.toLowerCase().includes(q)) return false;
    return true;
  });

  // ── Group PATCH ────────────────────────────────────────────────────────────
  const setGroupMutation = useMutation({
    mutationFn: ({ empId, groupId }: { empId: number; groupId: number | null }) =>
      hrEmployeesApi.update(empId, { employee_group: groupId } as Partial<HREmployee>),
    onSuccess: (data: any, vars) => {
      if (vars.groupId !== null) {
        const g = groups.find(x => x.id === vars.groupId);
        setGroupOverrides(prev => ({
          ...prev,
          [vars.empId]: g ? { id: g.id, code: g.code, name: g.name } : null,
        }));
      } else {
        setGroupOverrides(prev => ({ ...prev, [vars.empId]: null }));
      }
      setGroupPickerOpenId(null);
      toast(vars.groupId !== null ? 'Group assigned' : 'Group cleared', 'success');
    },
    onError: () => toast('Failed to update group', 'error'),
  });

  const openGroupPicker = useCallback((empId: number) => {
    setGroupPickerOpenId(prev => (prev === empId ? null : empId));
    // close manager picker if open
    setPickerOpenId(null);
    setPickerSearch('');
  }, []);

  // ── Manager PATCH ──────────────────────────────────────────────────────────
  const setManagerMutation = useMutation({
    mutationFn: ({ empId, managerId }: { empId: number; managerId: number | null }) =>
      hrEmployeesApi.update(empId, { direct_manager: managerId } as Partial<HREmployee>),
    onSuccess: (data: any, vars) => {
      const name: string | null = data?.direct_manager_name ?? null;
      setManagerOverrides(prev => ({
        ...prev,
        [vars.empId]: vars.managerId !== null && name ? { id: vars.managerId, name } : null,
      }));
      setPickerOpenId(null);
      setPickerSearch('');
      toast(vars.managerId !== null ? 'Manager assigned' : 'Manager cleared', 'success');
    },
    onError: () => toast('Failed to update manager', 'error'),
  });

  const openPicker = useCallback((empId: number) => {
    setPickerOpenId(prev => (prev === empId ? null : empId));
    setPickerSearch('');
    // close group picker if open
    setGroupPickerOpenId(null);
  }, []);

  // Close picker on Escape
  useEffect(() => {
    if (pickerOpenId === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setPickerOpenId(null); setPickerSearch(''); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [pickerOpenId]);

  useEffect(() => {
    if (me && !admin) router.replace('/');
  }, [me, admin, router]);

  // ── Summary counts ────────────────────────────────────────────────────────
  const noLoginCount = employees.filter(e => !hasLogin(e)).length;

  // ── Picker candidates ─────────────────────────────────────────────────────
  const pickerCandidates = employees.filter(e => {
    if (e.id === pickerOpenId) return false;
    const q = pickerSearch.toLowerCase();
    if (!q) return true;
    return e.full_name.toLowerCase().includes(q) || e.employee_id.toLowerCase().includes(q);
  });

  if (!admin) return null;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <MainLayout>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
          <div>
            <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-bold)', margin: '0 0 var(--space-1)' }}>
              Employees
              {!isLoading && (
                <span style={{ marginLeft: 'var(--space-2)', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-normal)', color: 'var(--text-secondary)' }}>
                  {filtered.length} of {employees.length}
                </span>
              )}
            </h1>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0 }}>
              Manage employees and assign reporting lines
            </p>
          </div>
          <Link href="/hr/employees/new">
            <button style={{
              padding: 'var(--space-2) var(--space-4)', borderRadius: 'var(--radius-md)',
              background: 'var(--sidebar-active-bg)', color: 'var(--sidebar-active-text)',
              border: 'none', cursor: 'pointer', fontSize: 'var(--text-sm)',
              fontWeight: 'var(--weight-semibold)', whiteSpace: 'nowrap',
            }}>
              + New Employee
            </button>
          </Link>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name or ID…"
            className="form-input"
            style={{ width: 240, fontSize: 'var(--text-sm)' }}
          />
          <select
            value={deptFilter}
            onChange={e => setDeptFilter(e.target.value)}
            className="form-select"
            style={{ width: 200, fontSize: 'var(--text-sm)' }}
          >
            <option value="">All departments</option>
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <div style={{ display: 'flex', gap: 2, padding: 2, background: 'var(--surface-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            {(['Active', 'All'] as const).map(label => {
              const active = label === 'Active' ? !showInactive : showInactive;
              return (
                <button key={label} onClick={() => setShowInactive(label === 'All')}
                  style={{
                    padding: '4px 14px', borderRadius: 'calc(var(--radius-md) - 2px)',
                    border: 'none', cursor: 'pointer', fontSize: 'var(--text-xs)',
                    fontWeight: 'var(--weight-medium)',
                    background: active ? 'var(--card-bg)' : 'transparent',
                    color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                    boxShadow: active ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    transition: 'background 150ms',
                  }}>
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Table */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {/* Header row */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1.4fr 90px 130px 130px 80px 110px 1fr',
            gap: 'var(--space-3)', padding: 'var(--space-3) var(--space-5)',
            borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-subtle)',
          }}>
            {['Employee', 'ID', 'Department', 'Position', 'Status', 'Group', 'Direct Manager'].map(h => (
              <span key={h} style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {h}
              </span>
            ))}
          </div>

          {isLoading ? (
            <div style={{ padding: 'var(--space-12)', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: 'var(--text-sm)' }}>Loading employees…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 'var(--space-12)', textAlign: 'center' }}>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0 }}>
                No employees match your filters.
              </p>
            </div>
          ) : (
            filtered.map((emp, idx) => {
              const isPickerOpen      = pickerOpenId === emp.id;
              const isGroupPickerOpen = groupPickerOpenId === emp.id;
              const override          = managerOverrides[emp.id];
              const managerName       = override !== undefined ? override?.name ?? null : (emp.direct_manager_name ?? null);
              const hasManager        = managerName !== null;
              const groupOverride     = groupOverrides[emp.id];
              const currentGroup: GroupRecord = groupOverride !== undefined
                ? groupOverride
                : emp.employee_group != null && emp.employee_group_code != null
                  ? { id: emp.employee_group, code: emp.employee_group_code, name: emp.employee_group_name ?? '' }
                  : null;
              const isSavingManager   = setManagerMutation.isPending && setManagerMutation.variables?.empId === emp.id;
              const isSavingGroup     = setGroupMutation.isPending && setGroupMutation.variables?.empId === emp.id;
              const isLast            = idx === filtered.length - 1;

              return (
                <div key={emp.id} style={{ borderBottom: !isLast || isPickerOpen || isGroupPickerOpen ? '1px solid var(--border-subtle)' : 'none' }}>
                  {/* Main row */}
                  <div style={{
                    display: 'grid', gridTemplateColumns: '1.4fr 90px 130px 130px 80px 110px 1fr',
                    gap: 'var(--space-3)', padding: 'var(--space-3) var(--space-5)', alignItems: 'center',
                  }}>
                    {/* Name */}
                    <div style={{ minWidth: 0 }}>
                      <Link
                        href={emp.user?.id ? `/users/${emp.user.id}` : '#'}
                        style={{ textDecoration: 'none' }}
                      >
                        <p style={{
                          fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)',
                          margin: 0, color: 'var(--text-primary)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {emp.full_name}
                        </p>
                      </Link>
                      {!hasLogin(emp) && (
                        <p style={{ fontSize: 'var(--text-xs)', color: '#92400e', margin: '1px 0 0' }}>
                          No login account
                        </p>
                      )}
                    </div>

                    {/* Employee ID */}
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: 0, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {emp.employee_id}
                    </p>

                    {/* Department */}
                    <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {emp.department_name || '—'}
                    </p>

                    {/* Position */}
                    <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {emp.position_title || '—'}
                    </p>

                    {/* Status badge */}
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      padding: '3px 8px', borderRadius: 99, fontSize: 'var(--text-xs)',
                      fontWeight: 'var(--weight-semibold)',
                      background: emp.is_active ? '#d1fae5' : 'var(--surface-subtle)',
                      color: emp.is_active ? '#065f46' : 'var(--text-secondary)',
                    }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: emp.is_active ? '#10b981' : '#9ca3af' }} />
                      {emp.is_active ? 'Active' : 'Inactive'}
                    </span>

                    {/* Group cell */}
                    <div>
                      {isSavingGroup ? (
                        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: 0 }}>Saving…</p>
                      ) : currentGroup ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1-5)' }}>
                          <button
                            onClick={() => openGroupPicker(emp.id)}
                            style={{
                              fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)',
                              background: '#ede9fe', color: '#5b21b6',
                              border: 'none', borderRadius: 99, cursor: 'pointer',
                              padding: '2px 8px', fontFamily: 'monospace', whiteSpace: 'nowrap',
                            }}
                            title={currentGroup.name}
                          >
                            {currentGroup.code}
                          </button>
                          <button
                            onClick={() => setGroupMutation.mutate({ empId: emp.id, groupId: null })}
                            disabled={setGroupMutation.isPending}
                            title="Clear group"
                            style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px', flexShrink: 0, lineHeight: 1 }}
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => openGroupPicker(emp.id)}
                          style={{
                            fontSize: 'var(--text-xs)', color: 'var(--text-secondary)',
                            background: 'none', border: '1px dashed var(--border-default)',
                            borderRadius: 'var(--radius-sm)', cursor: 'pointer', padding: '3px 10px',
                          }}
                        >
                          Assign group
                        </button>
                      )}
                    </div>

                    {/* Manager cell */}
                    <div>
                      {isSavingManager ? (
                        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: 0 }}>Saving…</p>
                      ) : hasManager && managerName ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981', flexShrink: 0 }} title="Manager assigned" />
                          <button
                            onClick={() => openPicker(emp.id)}
                            style={{
                              fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)',
                              background: 'none', border: 'none', cursor: 'pointer',
                              color: 'var(--text-primary)', padding: 0, textAlign: 'left',
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              maxWidth: 160,
                            }}
                          >
                            {managerName}
                          </button>
                          <button
                            onClick={() => setManagerMutation.mutate({ empId: emp.id, managerId: null })}
                            disabled={setManagerMutation.isPending}
                            title="Clear manager"
                            style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px', flexShrink: 0, lineHeight: 1 }}
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => openPicker(emp.id)}
                          style={{
                            fontSize: 'var(--text-xs)', color: 'var(--text-secondary)',
                            background: 'none', border: '1px dashed var(--border-default)',
                            borderRadius: 'var(--radius-sm)', cursor: 'pointer', padding: '3px 10px',
                          }}
                        >
                          Assign manager
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Inline manager picker */}
                  {isPickerOpen && (
                    <div style={{
                      padding: 'var(--space-3) var(--space-5) var(--space-4)',
                      borderTop: '1px solid var(--border-subtle)',
                      background: 'var(--surface-subtle)',
                    }}>
                      <p style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-secondary)', margin: '0 0 var(--space-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Set direct manager for {emp.full_name}
                      </p>
                      <input
                        autoFocus
                        value={pickerSearch}
                        onChange={e => setPickerSearch(e.target.value)}
                        placeholder="Search by name or ID…"
                        className="form-input"
                        style={{ width: '100%', maxWidth: 360, fontSize: 'var(--text-sm)', marginBottom: 'var(--space-2-5)' }}
                      />
                      <div style={{
                        border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)',
                        background: 'var(--card-bg)', maxHeight: 280, overflowY: 'auto',
                      }}>
                        {pickerCandidates.length === 0 ? (
                          <p style={{ padding: 'var(--space-4)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0 }}>
                            No employees found.
                          </p>
                        ) : (
                          pickerCandidates.map((candidate, ci) => {
                            const eligible = canApprove(candidate);
                            const isLastCandidate = ci === pickerCandidates.length - 1;
                            return (
                              <button
                                key={candidate.id}
                                onClick={() => setManagerMutation.mutate({ empId: emp.id, managerId: candidate.id })}
                                disabled={setManagerMutation.isPending}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                                  padding: 'var(--space-2-5) var(--space-4)',
                                  border: 'none',
                                  borderBottom: !isLastCandidate ? '1px solid var(--border-subtle)' : 'none',
                                  background: 'transparent', cursor: 'pointer',
                                  textAlign: 'left', width: '100%',
                                }}
                                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-subtle)'; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                              >
                                <span
                                  title={eligible ? 'Has login — can approve' : 'No login — approvals won\'t route'}
                                  style={{
                                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                                    background: eligible ? '#10b981' : '#f59e0b',
                                  }}
                                />
                                <span style={{ flex: 1, minWidth: 0 }}>
                                  <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {candidate.full_name}
                                  </span>
                                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                                    {candidate.employee_id}
                                    {candidate.position_title ? ` · ${candidate.position_title}` : ''}
                                  </span>
                                </span>
                                {!eligible && (
                                  <span style={{
                                    fontSize: 'var(--text-xs)', color: '#92400e',
                                    background: '#fef3c7', padding: '2px 8px', borderRadius: 99,
                                    whiteSpace: 'nowrap', flexShrink: 0,
                                  }}>
                                    Won't route approvals
                                  </span>
                                )}
                              </button>
                            );
                          })
                        )}
                      </div>
                      <button
                        onClick={() => { setPickerOpenId(null); setPickerSearch(''); }}
                        style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', marginTop: 'var(--space-2)', padding: 0 }}
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  {/* Inline group picker */}
                  {isGroupPickerOpen && (
                    <div style={{
                      padding: 'var(--space-3) var(--space-5) var(--space-4)',
                      borderTop: '1px solid var(--border-subtle)',
                      background: 'var(--surface-subtle)',
                    }}>
                      <p style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-secondary)', margin: '0 0 var(--space-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Set employee group for {emp.full_name}
                      </p>
                      <div style={{
                        border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)',
                        background: 'var(--card-bg)', maxHeight: 280, overflowY: 'auto',
                      }}>
                        {groups.length === 0 ? (
                          <p style={{ padding: 'var(--space-4)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0 }}>
                            No groups defined yet.
                          </p>
                        ) : (
                          groups.filter(g => g.is_active).map((g, gi) => {
                            const isLastGroup = gi === groups.filter(x => x.is_active).length - 1;
                            const isSelected  = currentGroup?.id === g.id;
                            return (
                              <button
                                key={g.id}
                                onClick={() => setGroupMutation.mutate({ empId: emp.id, groupId: g.id })}
                                disabled={setGroupMutation.isPending || isSelected}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                                  padding: 'var(--space-2-5) var(--space-4)',
                                  border: 'none',
                                  borderBottom: !isLastGroup ? '1px solid var(--border-subtle)' : 'none',
                                  background: isSelected ? '#f5f3ff' : 'transparent',
                                  cursor: isSelected ? 'default' : 'pointer',
                                  textAlign: 'left', width: '100%',
                                }}
                                onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-subtle)'; }}
                                onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                              >
                                <span style={{
                                  fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)',
                                  background: '#ede9fe', color: '#5b21b6',
                                  borderRadius: 99, padding: '2px 8px', fontFamily: 'monospace',
                                  flexShrink: 0,
                                }}>
                                  {g.code}
                                </span>
                                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {g.name}
                                  {g.name_ar ? ` · ${g.name_ar}` : ''}
                                </span>
                                {isSelected && (
                                  <span style={{ fontSize: 'var(--text-xs)', color: '#5b21b6', flexShrink: 0 }}>✓ Current</span>
                                )}
                              </button>
                            );
                          })
                        )}
                      </div>
                      <button
                        onClick={() => setGroupPickerOpenId(null)}
                        style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', marginTop: 'var(--space-2)', padding: 0 }}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Summary notes */}
        {!isLoading && employees.length > 0 && noLoginCount > 0 && (
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)',
            padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-md)',
            background: '#fef3c7', border: '1px solid #fcd34d',
          }}>
            <span style={{ fontSize: 16, lineHeight: 1, marginTop: 1, flexShrink: 0 }}>⚠</span>
            <p style={{ fontSize: 'var(--text-sm)', color: '#92400e', margin: 0 }}>
              <strong>{noLoginCount} employee{noLoginCount !== 1 ? 's' : ''}</strong>{' '}
              {noLoginCount === 1 ? 'has' : 'have'} no login account — they can be assigned as managers but approvals
              will not route to them until a user account is created and linked.
            </p>
          </div>
        )}

      </div>
    </MainLayout>
  );
}
