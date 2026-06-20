'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import { Button, Badge, PageShell, SearchInput } from '@/components/ui';
import { hrEmployeesApi, hrEmployeeGroupsApi } from '@/lib/api/hr';
import { useAuth } from '@/lib/hooks/use-auth';
import { useMyPermissions } from '@/lib/hooks/use-my-permissions';
import { toast } from '@/lib/hooks/use-toast';
import { AssignGroupModal } from '@/components/hr/AssignGroupModal';
import { AssignManagerModal } from '@/components/hr/AssignManagerModal';
import type { HREmployee, EmployeeGroup } from '@/types';

// ── Types ─────────────────────────────────────────────────────
type GroupRec   = { id: number; code: string; name: string } | null;
type ManagerRec = { id: number; name: string } | null;
type ActiveModal = { type: 'group' | 'manager'; emp: HREmployee } | null;

const COLS  = '1.5fr 88px 140px 160px 76px 160px 1fr';
const HEADS = ['Employee', 'ID', 'Department', 'Position', 'Status', 'Group', 'Direct Manager'];

// ── Page ──────────────────────────────────────────────────────
export default function EmployeesPage() {
  const { user: me } = useAuth();
  const { isTenantAdmin, isPlatformAdmin } = useMyPermissions();
  const router = useRouter();
  const admin = isTenantAdmin || isPlatformAdmin ||
    ['hr_manager', 'hr_secretary', 'company_director'].includes(me?.role ?? '');

  const [search,       setSearch]       = useState('');
  const [deptFilter,   setDeptFilter]   = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [activeModal,  setActiveModal]  = useState<ActiveModal>(null);
  const [grpOverrides, setGrpOverrides] = useState<Record<number, GroupRec>>({});
  const [mgrOverrides, setMgrOverrides] = useState<Record<number, ManagerRec>>({});

  useEffect(() => { if (me && !admin) router.replace('/'); }, [me, admin, router]);

  // ── Data ────────────────────────────────────────────────────
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

  const noLoginCount = employees.filter(e => !e.user?.id).length;

  // ── Mutations ────────────────────────────────────────────────
  const grpMutation = useMutation({
    mutationFn: ({ empId, groupId }: { empId: number; groupId: number | null }) =>
      hrEmployeesApi.update(empId, { employee_group: groupId } as Partial<HREmployee>),
    onSuccess: (_, vars) => {
      const g = vars.groupId !== null ? groups.find(x => x.id === vars.groupId) : null;
      setGrpOverrides(p => ({ ...p, [vars.empId]: g ? { id: g.id, code: g.code, name: g.name } : null }));
      setActiveModal(null);
      toast(vars.groupId !== null ? 'Group assigned' : 'Group removed', 'success');
    },
    onError: () => toast('Failed to update group', 'error'),
  });

  const mgrMutation = useMutation({
    mutationFn: ({ empId, managerId }: { empId: number; managerId: number | null }) =>
      hrEmployeesApi.update(empId, { direct_manager: managerId } as Partial<HREmployee>),
    onSuccess: (data: any, vars) => {
      const name: string | null = data?.direct_manager_name ?? null;
      setMgrOverrides(p => ({ ...p, [vars.empId]: vars.managerId !== null && name ? { id: vars.managerId, name } : null }));
      setActiveModal(null);
      toast(vars.managerId !== null ? 'Manager assigned' : 'Manager removed', 'success');
    },
    onError: () => toast('Failed to update manager', 'error'),
  });

  const resolveGroup = (emp: HREmployee): GroupRec => {
    if (emp.id in grpOverrides) return grpOverrides[emp.id];
    return emp.employee_group != null && emp.employee_group_code != null
      ? { id: emp.employee_group, code: emp.employee_group_code, name: emp.employee_group_name ?? emp.employee_group_code }
      : null;
  };

  const resolveMgrName = (emp: HREmployee): string | null => {
    if (emp.id in mgrOverrides) return mgrOverrides[emp.id]?.name ?? null;
    return emp.direct_manager_name ?? null;
  };

  const resolveMgrId = (emp: HREmployee): number | null => {
    if (emp.id in mgrOverrides) return mgrOverrides[emp.id]?.id ?? null;
    return emp.direct_manager ?? null;
  };

  const activeEmp = activeModal?.emp ?? null;

  if (!admin) return null;

  return (
    <MainLayout>
      <PageShell compact>
        <div className="proc-list-page">

          {/* ── Header ── */}
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
                <p className="proc-lhc-desc">Manage employees, groups, and reporting lines</p>
              </div>
              <div className="proc-lhc-right">
                <Link href="/hr/employees/new">
                  <Button variant="primary">+ New Employee</Button>
                </Link>
              </div>
            </div>
          </div>

          {/* ── Surface ── */}
          <div className="proc-list-surface">

            {/* Command bar */}
            <div className="proc-cmd">
              <div className="proc-cmd-search-wrap">
                <SearchInput value={search} onChange={setSearch} placeholder="Search name or ID…" width="100%" />
              </div>
              <div className="proc-cmd-right">
                <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
                  className="proc-adv-select" style={{ minWidth: 180 }}>
                  <option value="">All departments</option>
                  {departments.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <div className="emp-toggle">
                  {(['Active', 'All'] as const).map(label => {
                    const on = label === 'Active' ? !showInactive : showInactive;
                    return (
                      <button key={label} onClick={() => setShowInactive(label === 'All')}
                        className={`emp-toggle-btn${on ? ' emp-toggle-btn--active' : ''}`}>
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="proc-list-table-wrap">
              <div style={{ minWidth: 860 }}>

                <div className="emp-cols emp-thead" style={{ gridTemplateColumns: COLS }}>
                  {HEADS.map(h => <span key={h} className="emp-thead-cell">{h}</span>)}
                </div>

                {isLoading ? (
                  <div className="emp-state-msg">Loading employees…</div>
                ) : filtered.length === 0 ? (
                  <div className="emp-state-msg">No employees match your filters.</div>
                ) : filtered.map(emp => {
                  const grp     = resolveGroup(emp);
                  const mgrName = resolveMgrName(emp);

                  return (
                    <div key={emp.id} className="emp-cols emp-row" style={{ gridTemplateColumns: COLS }}>

                      {/* Name */}
                      <div style={{ minWidth: 0 }}>
                        <Link href={emp.user?.id ? `/users/${emp.user.id}` : '#'} className="emp-name">
                          {emp.full_name}
                        </Link>
                        {!emp.user?.id && <span className="emp-sub">No login</span>}
                      </div>

                      <p className="emp-mono">{emp.employee_id}</p>
                      <p className="emp-meta">{emp.department_name || '—'}</p>
                      <p className="emp-meta">{emp.position_title  || '—'}</p>

                      {/* Status */}
                      <Badge variant={emp.is_active ? 'success' : 'default'}>
                        {emp.is_active ? 'Active' : 'Inactive'}
                      </Badge>

                      {/* Group */}
                      <div>
                        {grp ? (
                          <div className="emp-group-tag">
                            <button className="emp-group-badge" onClick={() => setActiveModal({ type: 'group', emp })} title={grp.code}>
                              {grp.name || grp.code}
                            </button>
                            <button className="emp-clear-btn" onClick={() => grpMutation.mutate({ empId: emp.id, groupId: null })}>✕</button>
                          </div>
                        ) : (
                          <button className="emp-assign-btn" onClick={() => setActiveModal({ type: 'group', emp })}>
                            Assign group
                          </button>
                        )}
                      </div>

                      {/* Manager */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', minWidth: 0 }}>
                        {mgrName ? (
                          <>
                            <span className="emp-dot emp-dot--green" />
                            <button className="emp-manager-btn" onClick={() => setActiveModal({ type: 'manager', emp })}>
                              {mgrName}
                            </button>
                            <button className="emp-clear-btn" onClick={() => mgrMutation.mutate({ empId: emp.id, managerId: null })}>✕</button>
                          </>
                        ) : (
                          <button className="emp-assign-btn" onClick={() => setActiveModal({ type: 'manager', emp })}>
                            Assign manager
                          </button>
                        )}
                      </div>

                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── Warning ── */}
          {!isLoading && noLoginCount > 0 && (
            <div className="proc-status-banner proc-status-banner--warning">
              <strong>{noLoginCount} employee{noLoginCount !== 1 ? 's' : ''}</strong>{' '}
              {noLoginCount === 1 ? 'has' : 'have'} no login account — approvals will not route to them.
            </div>
          )}
        </div>
      </PageShell>

      {/* ── Modals (outside PageShell to avoid z-index clipping) ── */}
      <AssignGroupModal
        isOpen={activeModal?.type === 'group'}
        onClose={() => setActiveModal(null)}
        employee={activeEmp}
        groups={groups}
        currentId={activeEmp ? (resolveGroup(activeEmp)?.id ?? null) : null}
        onAssign={id => activeEmp && grpMutation.mutate({ empId: activeEmp.id, groupId: id })}
        onClear={() => activeEmp && grpMutation.mutate({ empId: activeEmp.id, groupId: null })}
        isLoading={grpMutation.isPending}
      />
      <AssignManagerModal
        isOpen={activeModal?.type === 'manager'}
        onClose={() => setActiveModal(null)}
        employee={activeEmp}
        candidates={employees}
        currentMgrId={activeEmp ? resolveMgrId(activeEmp) : null}
        onAssign={id => activeEmp && mgrMutation.mutate({ empId: activeEmp.id, managerId: id })}
        onClear={() => activeEmp && mgrMutation.mutate({ empId: activeEmp.id, managerId: null })}
        isLoading={mgrMutation.isPending}
      />
    </MainLayout>
  );
}
