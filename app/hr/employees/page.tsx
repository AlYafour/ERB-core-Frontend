'use client';

import { useState, useEffect, useCallback } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import { Button, Badge, PageShell, SearchInput } from '@/components/ui';
import { hrEmployeesApi, hrEmployeeGroupsApi } from '@/lib/api/hr';
import { useAuth } from '@/lib/hooks/use-auth';
import { useMyPermissions } from '@/lib/hooks/use-my-permissions';
import { toast } from '@/lib/hooks/use-toast';
import type { HREmployee, EmployeeGroup } from '@/types';

const hasLogin  = (e: HREmployee) => !!(e.user?.id);
const canRoute  = (e: HREmployee) => hasLogin(e) && e.is_active;

type ManagerRec = { id: number; name: string } | null;
type GroupRec   = { id: number; code: string; name: string } | null;

const COLS = '1.5fr 88px 128px 148px 76px 140px 1fr';
const HEADS = ['Employee', 'ID', 'Department', 'Position', 'Status', 'Group', 'Direct Manager'];

export default function EmployeesPage() {
  const { user: me } = useAuth();
  const { isTenantAdmin, isPlatformAdmin } = useMyPermissions();
  const router = useRouter();
  const admin = isTenantAdmin || isPlatformAdmin ||
    ['hr_manager', 'hr_secretary', 'company_director'].includes(me?.role ?? '');

  const [search,        setSearch]        = useState('');
  const [deptFilter,    setDeptFilter]    = useState('');
  const [showInactive,  setShowInactive]  = useState(false);
  const [mgrPickerId,   setMgrPickerId]   = useState<number | null>(null);
  const [mgrSearch,     setMgrSearch]     = useState('');
  const [grpPickerId,   setGrpPickerId]   = useState<number | null>(null);
  const [mgrOverrides,  setMgrOverrides]  = useState<Record<number, ManagerRec>>({});
  const [grpOverrides,  setGrpOverrides]  = useState<Record<number, GroupRec>>({});

  useEffect(() => { if (me && !admin) router.replace('/'); }, [me, admin, router]);

  useEffect(() => {
    if (mgrPickerId === null) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') { setMgrPickerId(null); setMgrSearch(''); } };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [mgrPickerId]);

  // ── Data ──────────────────────────────────────────────────────
  const { data: raw, isLoading } = useQuery({
    queryKey: ['hr-employees-all'],
    queryFn:  () => hrEmployeesApi.getAll(),
    staleTime: 60_000,
  });
  const { data: groupsRaw } = useQuery({
    queryKey: ['hr-employee-groups'],
    queryFn:  () => hrEmployeeGroupsApi.getAll(),
    staleTime: 300_000,
  });

  const employees: HREmployee[]  = raw?.results ?? [];
  const groups: EmployeeGroup[]  = groupsRaw?.results ?? [];
  const departments = Array.from(new Set(employees.map(e => e.department_name).filter(Boolean))).sort() as string[];

  const filtered = employees.filter(e => {
    if (!showInactive && !e.is_active) return false;
    if (deptFilter && e.department_name !== deptFilter) return false;
    const q = search.toLowerCase();
    return !q || e.full_name.toLowerCase().includes(q) || e.employee_id.toLowerCase().includes(q);
  });

  const noLoginCount = employees.filter(e => !hasLogin(e)).length;

  // ── Mutations ─────────────────────────────────────────────────
  const grpMutation = useMutation({
    mutationFn: ({ empId, groupId }: { empId: number; groupId: number | null }) =>
      hrEmployeesApi.update(empId, { employee_group: groupId } as Partial<HREmployee>),
    onSuccess: (_, vars) => {
      const g = vars.groupId !== null ? groups.find(x => x.id === vars.groupId) : null;
      setGrpOverrides(prev => ({ ...prev, [vars.empId]: g ? { id: g.id, code: g.code, name: g.name } : null }));
      setGrpPickerId(null);
      toast(vars.groupId !== null ? 'Group assigned' : 'Group cleared', 'success');
    },
    onError: () => toast('Failed to update group', 'error'),
  });

  const mgrMutation = useMutation({
    mutationFn: ({ empId, managerId }: { empId: number; managerId: number | null }) =>
      hrEmployeesApi.update(empId, { direct_manager: managerId } as Partial<HREmployee>),
    onSuccess: (data: any, vars) => {
      const name: string | null = data?.direct_manager_name ?? null;
      setMgrOverrides(prev => ({ ...prev, [vars.empId]: vars.managerId !== null && name ? { id: vars.managerId, name } : null }));
      setMgrPickerId(null); setMgrSearch('');
      toast(vars.managerId !== null ? 'Manager assigned' : 'Manager cleared', 'success');
    },
    onError: () => toast('Failed to update manager', 'error'),
  });

  const openGrpPicker = useCallback((id: number) => {
    setGrpPickerId(p => p === id ? null : id);
    setMgrPickerId(null); setMgrSearch('');
  }, []);

  const openMgrPicker = useCallback((id: number) => {
    setMgrPickerId(p => p === id ? null : id);
    setMgrSearch('');
    setGrpPickerId(null);
  }, []);

  const mgrCandidates = employees.filter(e => {
    if (e.id === mgrPickerId) return false;
    const q = mgrSearch.toLowerCase();
    return !q || e.full_name.toLowerCase().includes(q) || e.employee_id.toLowerCase().includes(q);
  });

  if (!admin) return null;

  // ── Render ────────────────────────────────────────────────────
  return (
    <MainLayout>
      <PageShell compact>
        <div className="proc-list-page">

          {/* ── Header card ── */}
          <div className="proc-list-header-card">
            <div className="proc-lhc-nav">
              <div className="proc-list-nav-crumb">
                <span className="proc-list-nav-current">HR / Employees</span>
              </div>
            </div>
            <div className="proc-lhc-body">
              <div className="proc-lhc-left">
                <div className="proc-lhc-title-row">
                  <h1 className="proc-lhc-title">Employees</h1>
                  {!isLoading && <span className="proc-lhc-count">{filtered.length} of {employees.length}</span>}
                </div>
                <p className="proc-lhc-desc">Manage employees and assign reporting lines</p>
              </div>
              <div className="proc-lhc-right">
                <Link href="/hr/employees/new">
                  <Button variant="primary">+ New Employee</Button>
                </Link>
              </div>
            </div>
          </div>

          {/* ── Main surface ── */}
          <div className="proc-list-surface">

            {/* Command bar */}
            <div className="proc-cmd">
              <div className="proc-cmd-search-wrap">
                <SearchInput value={search} onChange={setSearch} placeholder="Search name or ID…" width="100%" />
              </div>
              <div className="proc-cmd-right">
                <select
                  value={deptFilter}
                  onChange={e => setDeptFilter(e.target.value)}
                  className="proc-adv-select"
                  style={{ minWidth: 180 }}
                >
                  <option value="">All departments</option>
                  {departments.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <div className="emp-toggle">
                  {(['Active', 'All'] as const).map(label => {
                    const active = label === 'Active' ? !showInactive : showInactive;
                    return (
                      <button key={label} onClick={() => setShowInactive(label === 'All')}
                        className={`emp-toggle-btn${active ? ' emp-toggle-btn--active' : ''}`}>
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="proc-list-table-wrap">
              <div style={{ minWidth: 800 }}>

                {/* Table head */}
                <div className={`emp-cols emp-thead`} style={{ gridTemplateColumns: COLS }}>
                  {HEADS.map(h => <span key={h} className="emp-thead-cell">{h}</span>)}
                </div>

                {/* Body */}
                {isLoading ? (
                  <div style={{ padding: 'var(--space-12)', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
                    Loading employees…
                  </div>
                ) : filtered.length === 0 ? (
                  <div style={{ padding: 'var(--space-12)', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
                    No employees match your filters.
                  </div>
                ) : filtered.map(emp => {
                  const mgrOpen   = mgrPickerId === emp.id;
                  const grpOpen   = grpPickerId === emp.id;
                  const mgrOver   = mgrOverrides[emp.id];
                  const managerName = mgrOver !== undefined ? mgrOver?.name ?? null : (emp.direct_manager_name ?? null);
                  const grpOver   = grpOverrides[emp.id];
                  const curGroup: GroupRec = grpOver !== undefined
                    ? grpOver
                    : emp.employee_group != null && emp.employee_group_code != null
                      ? { id: emp.employee_group, code: emp.employee_group_code, name: emp.employee_group_name ?? emp.employee_group_code }
                      : null;
                  const savingMgr = mgrMutation.isPending && mgrMutation.variables?.empId === emp.id;
                  const savingGrp = grpMutation.isPending && grpMutation.variables?.empId === emp.id;

                  return (
                    <div key={emp.id}>
                      {/* Main row */}
                      <div className={`emp-cols emp-row`} style={{ gridTemplateColumns: COLS }}>

                        {/* Name */}
                        <div style={{ minWidth: 0 }}>
                          <Link href={emp.user?.id ? `/users/${emp.user.id}` : '#'} className="emp-name">
                            {emp.full_name}
                          </Link>
                          {!hasLogin(emp) && <span className="emp-sub">No login account</span>}
                        </div>

                        <p className="emp-mono">{emp.employee_id}</p>
                        <p className="emp-meta">{emp.department_name || '—'}</p>
                        <p className="emp-meta">{emp.position_title || '—'}</p>

                        {/* Status */}
                        <Badge variant={emp.is_active ? 'success' : 'default'}>
                          {emp.is_active ? 'Active' : 'Inactive'}
                        </Badge>

                        {/* Group */}
                        <div>
                          {savingGrp ? (
                            <span className="emp-saving">Saving…</span>
                          ) : curGroup ? (
                            <div className="emp-group-tag">
                              <button className="emp-group-badge" onClick={() => openGrpPicker(emp.id)} title={curGroup.code}>
                                {curGroup.name || curGroup.code}
                              </button>
                              <button className="emp-clear-btn" onClick={() => grpMutation.mutate({ empId: emp.id, groupId: null })} title="Clear group">✕</button>
                            </div>
                          ) : (
                            <button className="emp-assign-btn" onClick={() => openGrpPicker(emp.id)}>Assign group</button>
                          )}
                        </div>

                        {/* Manager */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', minWidth: 0 }}>
                          {savingMgr ? (
                            <span className="emp-saving">Saving…</span>
                          ) : managerName ? (
                            <>
                              <span className="emp-dot emp-dot--green" title="Manager assigned" />
                              <button className="emp-manager-btn" onClick={() => openMgrPicker(emp.id)}>{managerName}</button>
                              <button className="emp-clear-btn" onClick={() => mgrMutation.mutate({ empId: emp.id, managerId: null })} title="Clear manager">✕</button>
                            </>
                          ) : (
                            <button className="emp-assign-btn" onClick={() => openMgrPicker(emp.id)}>Assign manager</button>
                          )}
                        </div>
                      </div>

                      {/* Group picker */}
                      {grpOpen && (
                        <div className="emp-picker">
                          <p className="emp-picker-title">Set employee group for {emp.full_name}</p>
                          <div className="emp-picker-list">
                            {groups.filter(g => g.is_active).length === 0 ? (
                              <p style={{ padding: 'var(--space-4)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0 }}>No groups defined yet.</p>
                            ) : groups.filter(g => g.is_active).map(g => {
                              const selected = curGroup?.id === g.id;
                              return (
                                <button key={g.id} disabled={grpMutation.isPending || selected}
                                  onClick={() => grpMutation.mutate({ empId: emp.id, groupId: g.id })}
                                  className={`emp-picker-item${selected ? ' emp-picker-item--selected' : ''}`}
                                >
                                  <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)', background: 'rgba(109,40,217,0.1)', color: '#6d28d9', borderRadius: 99, padding: '1px 7px', fontFamily: 'monospace', flexShrink: 0 }}>
                                    {g.code}
                                  </span>
                                  <span style={{ flex: 1, fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left' }}>
                                    {g.name}{g.name_ar ? ` · ${g.name_ar}` : ''}
                                  </span>
                                  {selected && <span style={{ fontSize: 'var(--text-xs)', color: '#6d28d9', flexShrink: 0 }}>✓ Current</span>}
                                </button>
                              );
                            })}
                          </div>
                          <button className="emp-picker-cancel" onClick={() => setGrpPickerId(null)}>Cancel</button>
                        </div>
                      )}

                      {/* Manager picker */}
                      {mgrOpen && (
                        <div className="emp-picker">
                          <p className="emp-picker-title">Set direct manager for {emp.full_name}</p>
                          <SearchInput value={mgrSearch} onChange={setMgrSearch} placeholder="Search by name or ID…" width="100%" />
                          <div className="emp-picker-list" style={{ marginTop: 'var(--space-2)' }}>
                            {mgrCandidates.length === 0 ? (
                              <p style={{ padding: 'var(--space-4)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0 }}>No employees found.</p>
                            ) : mgrCandidates.map(c => (
                              <button key={c.id} disabled={mgrMutation.isPending}
                                onClick={() => mgrMutation.mutate({ empId: emp.id, managerId: c.id })}
                                className="emp-picker-item"
                              >
                                <span className={`emp-dot ${canRoute(c) ? 'emp-dot--green' : 'emp-dot--amber'}`}
                                  title={canRoute(c) ? 'Has login — approvals route' : 'No login — approvals won\'t route'} />
                                <span style={{ flex: 1, minWidth: 0 }}>
                                  <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.full_name}</span>
                                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{c.employee_id}{c.position_title ? ` · ${c.position_title}` : ''}</span>
                                </span>
                                {!canRoute(c) && <span className="emp-no-login-tag">Won't route</span>}
                              </button>
                            ))}
                          </div>
                          <button className="emp-picker-cancel" onClick={() => { setMgrPickerId(null); setMgrSearch(''); }}>Cancel</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── Warning banner ── */}
          {!isLoading && noLoginCount > 0 && (
            <div className="proc-status-banner proc-status-banner--warning">
              <strong>{noLoginCount} employee{noLoginCount !== 1 ? 's' : ''}</strong>{' '}
              {noLoginCount === 1 ? 'has' : 'have'} no login account — approvals will not route to them until a user account is linked.
            </div>
          )}

        </div>
      </PageShell>
    </MainLayout>
  );
}
