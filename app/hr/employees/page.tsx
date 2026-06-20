'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import { Button, Badge, PageShell, SearchInput, PersonCell } from '@/components/ui';
import { hrEmployeesApi, hrEmployeeGroupsApi } from '@/lib/api/hr';
import { useAuth } from '@/lib/hooks/use-auth';
import { useMyPermissions } from '@/lib/hooks/use-my-permissions';
import { toast } from '@/lib/hooks/use-toast';
import { AssignGroupModal } from '@/components/hr/AssignGroupModal';
import { AssignManagerModal } from '@/components/hr/AssignManagerModal';
import type { HREmployee, EmployeeGroup } from '@/types';

// ── Types ─────────────────────────────────────────────────────
type GroupRec    = { id: number; code: string; name: string } | null;
type ManagerRec  = { id: number; name: string } | null;
type ActiveModal = { type: 'group' | 'manager'; emp: HREmployee } | null;
type SortKey     = 'full_name' | 'employee_id' | 'department' | 'position';
type SortDir     = 'asc' | 'desc';

const COLS = '36px 1.5fr 80px 130px 150px 76px 56px 150px 1fr';

const SORTABLE_HEADS: Array<{ label: string; key?: SortKey }> = [
  { label: '' },
  { label: 'Employee',       key: 'full_name' },
  { label: 'ID',             key: 'employee_id' },
  { label: 'Department',     key: 'department' },
  { label: 'Position',       key: 'position' },
  { label: 'Status' },
  { label: 'Mgr' },
  { label: 'Group' },
  { label: 'Direct Manager' },
];

// ── Sort Icon ─────────────────────────────────────────────────
function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  return (
    <svg width="9" height="9" viewBox="0 0 9 9" fill="currentColor"
      style={{ opacity: active ? 1 : 0.3, color: active ? 'var(--brand)' : 'currentColor', flexShrink: 0 }}>
      {active
        ? dir === 'asc'
          ? <path d="M4.5 1 L8 6 L1 6 Z"/>
          : <path d="M4.5 8 L1 3 L8 3 Z"/>
        : <><path d="M4.5 1 L7.5 4.5 L1.5 4.5 Z"/><path d="M4.5 8 L1.5 4.5 L7.5 4.5 Z"/></>}
    </svg>
  );
}

// ── Page ──────────────────────────────────────────────────────
export default function EmployeesPage() {
  const { user: me } = useAuth();
  const { isTenantAdmin, isPlatformAdmin } = useMyPermissions();
  const router = useRouter();
  const qc = useQueryClient();

  const admin = isTenantAdmin || isPlatformAdmin ||
    ['hr_manager', 'hr_secretary', 'company_director'].includes(me?.role ?? '');

  // ── Filter state ──────────────────────────────────────────
  const [search,       setSearch]       = useState('');
  const [deptFilter,   setDeptFilter]   = useState('');
  const [posFilter,    setPosFilter]    = useState('');
  const [groupFilter,  setGroupFilter]  = useState('');
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | ''>('active');
  const [mgrFilter,    setMgrFilter]    = useState<'yes' | 'no' | ''>('');
  const [filtersOpen,  setFiltersOpen]  = useState(false);

  // ── Sort state ────────────────────────────────────────────
  const [sortKey, setSortKey] = useState<SortKey>('full_name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // ── Selection state ───────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // ── Modal state ───────────────────────────────────────────
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [bulkModal,   setBulkModal]   = useState<'group' | 'manager' | null>(null);

  // ── Override state (optimistic updates) ───────────────────
  const [grpOverrides,     setGrpOverrides]     = useState<Record<number, GroupRec>>({});
  const [mgrOverrides,     setMgrOverrides]     = useState<Record<number, ManagerRec>>({});
  const [mgrFlagOverrides, setMgrFlagOverrides] = useState<Record<number, boolean>>({});

  useEffect(() => { if (me && !admin) router.replace('/'); }, [me, admin, router]);

  // ── Data ─────────────────────────────────────────────────
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

  const employees: HREmployee[]   = raw?.results ?? [];
  const groups:    EmployeeGroup[] = groupsRaw?.results ?? [];

  const departments = useMemo(
    () => Array.from(new Set(employees.map(e => e.department_name).filter(Boolean))).sort() as string[],
    [employees],
  );
  const positions = useMemo(
    () => Array.from(new Set(employees.map(e => e.position_title).filter(Boolean))).sort() as string[],
    [employees],
  );

  // ── Resolve helpers ───────────────────────────────────────
  const resolveIsManager = useCallback(
    (emp: HREmployee) => emp.id in mgrFlagOverrides ? mgrFlagOverrides[emp.id] : emp.is_manager,
    [mgrFlagOverrides],
  );
  const resolveGroup = useCallback((emp: HREmployee): GroupRec => {
    if (emp.id in grpOverrides) return grpOverrides[emp.id];
    return emp.employee_group != null && emp.employee_group_code != null
      ? { id: emp.employee_group, code: emp.employee_group_code, name: emp.employee_group_name ?? emp.employee_group_code }
      : null;
  }, [grpOverrides]);
  const resolveMgrName = useCallback((emp: HREmployee): string | null => {
    if (emp.id in mgrOverrides) return mgrOverrides[emp.id]?.name ?? null;
    return emp.direct_manager_name ?? null;
  }, [mgrOverrides]);
  const resolveMgrId = useCallback((emp: HREmployee): number | null => {
    if (emp.id in mgrOverrides) return mgrOverrides[emp.id]?.id ?? null;
    return emp.direct_manager ?? null;
  }, [mgrOverrides]);

  const managerCandidates = useMemo(
    () => employees.filter(e => resolveIsManager(e) && e.is_active),
    [employees, resolveIsManager],
  );

  // ── Filter + Sort ─────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = employees.filter(e => {
      if (statusFilter === 'active'   && !e.is_active) return false;
      if (statusFilter === 'inactive' && e.is_active)  return false;
      if (deptFilter  && e.department_name !== deptFilter) return false;
      if (posFilter   && e.position_title  !== posFilter)  return false;
      if (groupFilter && String(e.employee_group) !== groupFilter) return false;
      if (mgrFilter === 'yes' && !resolveIsManager(e)) return false;
      if (mgrFilter === 'no'  &&  resolveIsManager(e)) return false;
      const q = search.toLowerCase();
      return !q || e.full_name.toLowerCase().includes(q) || e.employee_id.toLowerCase().includes(q);
    });
    return [...list].sort((a, b) => {
      let va = '', vb = '';
      if (sortKey === 'full_name')   { va = a.full_name;           vb = b.full_name; }
      if (sortKey === 'employee_id') { va = a.employee_id;         vb = b.employee_id; }
      if (sortKey === 'department')  { va = a.department_name||''; vb = b.department_name||''; }
      if (sortKey === 'position')    { va = a.position_title||'';  vb = b.position_title||''; }
      return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    });
  }, [employees, search, deptFilter, posFilter, groupFilter, statusFilter, mgrFilter, sortKey, sortDir, resolveIsManager]);

  // ── Selection helpers ─────────────────────────────────────
  const allFilteredIds  = useMemo(() => filtered.map(e => e.id), [filtered]);
  const isAllSelected   = allFilteredIds.length > 0 && allFilteredIds.every(id => selectedIds.has(id));
  const isSomeSelected  = allFilteredIds.some(id => selectedIds.has(id)) && !isAllSelected;

  const toggleSelect = (id: number) => setSelectedIds(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const toggleSelectAll = () =>
    setSelectedIds(isAllSelected ? new Set() : new Set(allFilteredIds));

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const noLoginCount = employees.filter(e => !e.user?.id).length;
  const activeFilterCount = [deptFilter, posFilter, groupFilter, mgrFilter,
    statusFilter !== 'active' ? statusFilter : ''].filter(Boolean).length;

  const resetFilters = () => {
    setDeptFilter(''); setPosFilter(''); setGroupFilter('');
    setStatusFilter('active'); setMgrFilter('');
  };

  const activeEmp = activeModal?.emp ?? null;

  // ── Mutations (single) ────────────────────────────────────
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
      setMgrOverrides(p => ({
        ...p,
        [vars.empId]: vars.managerId !== null && name ? { id: vars.managerId, name } : null,
      }));
      setActiveModal(null);
      toast(vars.managerId !== null ? 'Manager assigned' : 'Manager removed', 'success');
    },
    onError: () => toast('Failed to update manager', 'error'),
  });

  const mgrFlagMutation = useMutation({
    mutationFn: ({ empId, value }: { empId: number; value: boolean }) =>
      hrEmployeesApi.update(empId, { is_manager: value } as Partial<HREmployee>),
    onSuccess: (_, vars) => {
      setMgrFlagOverrides(p => ({ ...p, [vars.empId]: vars.value }));
      toast(vars.value ? 'Marked as manager' : 'Manager flag removed', 'success');
    },
    onError: () => toast('Failed to update', 'error'),
  });

  // ── Mutations (bulk) ──────────────────────────────────────
  const bulkGrpMutation = useMutation({
    mutationFn: ({ groupId, ids }: { groupId: number | null; ids: number[] }) =>
      Promise.all(ids.map(id => hrEmployeesApi.update(id, { employee_group: groupId } as Partial<HREmployee>))),
    onSuccess: (_, vars) => {
      const g = vars.groupId !== null ? groups.find(x => x.id === vars.groupId) : null;
      setGrpOverrides(prev => {
        const next = { ...prev };
        vars.ids.forEach(id => { next[id] = g ? { id: g.id, code: g.code, name: g.name } : null; });
        return next;
      });
      setBulkModal(null);
      setSelectedIds(new Set());
      toast(`Group ${vars.groupId ? 'assigned' : 'removed'} for ${vars.ids.length} employees`, 'success');
    },
    onError: () => toast('Failed to update some employees', 'error'),
  });

  const bulkMgrMutation = useMutation({
    mutationFn: ({ managerId, ids }: { managerId: number | null; ids: number[] }) =>
      Promise.all(ids.map(id => hrEmployeesApi.update(id, { direct_manager: managerId } as Partial<HREmployee>))),
    onSuccess: (results: any[], vars) => {
      setMgrOverrides(prev => {
        const next = { ...prev };
        vars.ids.forEach((id, i) => {
          const name: string | null = results[i]?.direct_manager_name ?? null;
          next[id] = vars.managerId !== null && name ? { id: vars.managerId, name } : null;
        });
        return next;
      });
      setBulkModal(null);
      setSelectedIds(new Set());
      toast(`Manager ${vars.managerId ? 'assigned' : 'removed'} for ${vars.ids.length} employees`, 'success');
    },
    onError: () => toast('Failed to update some employees', 'error'),
  });

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
                  {!isLoading && (
                    <span className="proc-lhc-count">
                      {filtered.length !== employees.length
                        ? `${filtered.length} / ${employees.length}`
                        : employees.length}
                    </span>
                  )}
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
                <button
                  className={`proc-cmd-btn${activeFilterCount > 0 ? ' proc-cmd-btn--active' : ''}`}
                  onClick={() => setFiltersOpen(o => !o)}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
                  </svg>
                  Filters
                  {activeFilterCount > 0 && (
                    <span className="proc-cmd-filter-badge">{activeFilterCount}</span>
                  )}
                </button>
              </div>
            </div>

            {/* Filter panel */}
            {filtersOpen && (
              <div className="emp-filter-panel">
                <div className="emp-filter-grid">
                  <div className="emp-filter-field">
                    <label className="emp-filter-label">Status</label>
                    <select className="proc-adv-select" value={statusFilter}
                      onChange={e => setStatusFilter(e.target.value as any)}>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="">All</option>
                    </select>
                  </div>
                  <div className="emp-filter-field">
                    <label className="emp-filter-label">Department</label>
                    <select className="proc-adv-select" value={deptFilter}
                      onChange={e => setDeptFilter(e.target.value)}>
                      <option value="">All departments</option>
                      {departments.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div className="emp-filter-field">
                    <label className="emp-filter-label">Position</label>
                    <select className="proc-adv-select" value={posFilter}
                      onChange={e => setPosFilter(e.target.value)}>
                      <option value="">All positions</option>
                      {positions.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div className="emp-filter-field">
                    <label className="emp-filter-label">Group</label>
                    <select className="proc-adv-select" value={groupFilter}
                      onChange={e => setGroupFilter(e.target.value)}>
                      <option value="">All groups</option>
                      {groups.filter(g => g.is_active).map(g =>
                        <option key={g.id} value={String(g.id)}>{g.name}</option>
                      )}
                    </select>
                  </div>
                  <div className="emp-filter-field">
                    <label className="emp-filter-label">Manager flag</label>
                    <select className="proc-adv-select" value={mgrFilter}
                      onChange={e => setMgrFilter(e.target.value as any)}>
                      <option value="">All</option>
                      <option value="yes">Managers only</option>
                      <option value="no">Non-managers</option>
                    </select>
                  </div>
                  {activeFilterCount > 0 && (
                    <div className="emp-filter-field emp-filter-field--reset">
                      <button className="emp-filter-reset" onClick={resetFilters}>
                        Reset all filters
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Bulk action bar */}
            {selectedIds.size > 0 && (
              <div className="emp-bulk-bar">
                <span className="emp-bulk-count">
                  {selectedIds.size} employee{selectedIds.size !== 1 ? 's' : ''} selected
                </span>
                <div className="emp-bulk-actions">
                  <button className="emp-bulk-btn"
                    onClick={() => setBulkModal('group')}
                    disabled={bulkGrpMutation.isPending || bulkMgrMutation.isPending}>
                    Assign Group
                  </button>
                  <button className="emp-bulk-btn"
                    onClick={() => setBulkModal('manager')}
                    disabled={bulkGrpMutation.isPending || bulkMgrMutation.isPending}>
                    Assign Manager
                  </button>
                  <button className="emp-bulk-btn emp-bulk-btn--clear"
                    onClick={() => setSelectedIds(new Set())}>
                    Clear selection
                  </button>
                </div>
              </div>
            )}

            {/* Table */}
            <div className="proc-list-table-wrap">
              <div style={{ minWidth: 900 }}>

                {/* Header */}
                <div className="emp-cols emp-thead" style={{ gridTemplateColumns: COLS }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <input
                      type="checkbox"
                      className="emp-cb"
                      checked={isAllSelected}
                      ref={el => { if (el) el.indeterminate = isSomeSelected; }}
                      onChange={toggleSelectAll}
                    />
                  </div>
                  {SORTABLE_HEADS.slice(1).map(h => h.key ? (
                    <button
                      key={h.label}
                      className={`emp-thead-cell emp-sort-btn${sortKey === h.key ? ' emp-sort-btn--active' : ''}`}
                      onClick={() => handleSort(h.key!)}
                    >
                      {h.label}
                      <SortIcon active={sortKey === h.key} dir={sortDir} />
                    </button>
                  ) : (
                    <span key={h.label} className="emp-thead-cell">{h.label}</span>
                  ))}
                </div>

                {/* Rows */}
                {isLoading ? (
                  <div className="emp-state-msg">Loading employees…</div>
                ) : filtered.length === 0 ? (
                  <div className="emp-state-msg">No employees match your filters.</div>
                ) : filtered.map(emp => {
                  const grp        = resolveGroup(emp);
                  const mgrName    = resolveMgrName(emp);
                  const isManager  = resolveIsManager(emp);
                  const isSelected = selectedIds.has(emp.id);

                  return (
                    <div
                      key={emp.id}
                      className={`emp-cols emp-row${isSelected ? ' emp-row--selected' : ''}`}
                      style={{ gridTemplateColumns: COLS }}
                    >
                      {/* Checkbox */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="emp-cb"
                          checked={isSelected}
                          onChange={() => toggleSelect(emp.id)}
                        />
                      </div>

                      {/* Name / PersonCell */}
                      <div style={{ minWidth: 0 }}>
                        <a href={emp.user?.id ? `/users/${emp.user.id}` : undefined}
                          style={{ textDecoration: 'none' }}>
                          <PersonCell
                            name={emp.full_name}
                            secondary={!emp.user?.id ? 'No login' : undefined}
                            avatarUrl={emp.user?.avatar ?? null}
                          />
                        </a>
                      </div>

                      <p className="emp-mono">{emp.employee_id}</p>
                      <p className="emp-meta">{emp.department_name || '—'}</p>
                      <p className="emp-meta">{emp.position_title  || '—'}</p>

                      {/* Status */}
                      <Badge variant={emp.is_active ? 'success' : 'default'}>
                        {emp.is_active ? 'Active' : 'Inactive'}
                      </Badge>

                      {/* Mgr flag */}
                      <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <button
                          className={`emp-mgr-flag${isManager ? ' emp-mgr-flag--on' : ''}`}
                          onClick={() => mgrFlagMutation.mutate({ empId: emp.id, value: !isManager })}
                          disabled={mgrFlagMutation.isPending && mgrFlagMutation.variables?.empId === emp.id}
                          title={isManager ? 'Remove manager designation' : 'Mark as manager'}
                        >
                          {isManager ? 'Mgr' : '—'}
                        </button>
                      </div>

                      {/* Group */}
                      <div>
                        {grp ? (
                          <div className="emp-group-tag">
                            <button className="emp-group-badge"
                              onClick={() => setActiveModal({ type: 'group', emp })} title={grp.code}>
                              {grp.name || grp.code}
                            </button>
                            <button className="emp-clear-btn"
                              onClick={() => grpMutation.mutate({ empId: emp.id, groupId: null })}>
                              ✕
                            </button>
                          </div>
                        ) : (
                          <button className="emp-assign-btn"
                            onClick={() => setActiveModal({ type: 'group', emp })}>
                            Assign
                          </button>
                        )}
                      </div>

                      {/* Manager */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', minWidth: 0 }}>
                        {mgrName ? (
                          <>
                            <span className="emp-dot emp-dot--green" />
                            <button className="emp-manager-btn"
                              onClick={() => setActiveModal({ type: 'manager', emp })}>
                              {mgrName}
                            </button>
                            <button className="emp-clear-btn"
                              onClick={() => mgrMutation.mutate({ empId: emp.id, managerId: null })}>
                              ✕
                            </button>
                          </>
                        ) : (
                          <button className="emp-assign-btn"
                            onClick={() => setActiveModal({ type: 'manager', emp })}>
                            Assign
                          </button>
                        )}
                      </div>
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
              {noLoginCount === 1 ? 'has' : 'have'} no login account — approvals will not route to them.
            </div>
          )}
        </div>
      </PageShell>

      {/* ── Single-employee modals ── */}
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
        candidates={managerCandidates}
        currentMgrId={activeEmp ? resolveMgrId(activeEmp) : null}
        onAssign={id => activeEmp && mgrMutation.mutate({ empId: activeEmp.id, managerId: id })}
        onClear={() => activeEmp && mgrMutation.mutate({ empId: activeEmp.id, managerId: null })}
        isLoading={mgrMutation.isPending}
      />

      {/* ── Bulk modals ── */}
      <AssignGroupModal
        isOpen={bulkModal === 'group'}
        onClose={() => setBulkModal(null)}
        employee={null}
        label={`${selectedIds.size} employees`}
        groups={groups}
        currentId={null}
        onAssign={id => bulkGrpMutation.mutate({ groupId: id, ids: [...selectedIds] })}
        onClear={() => bulkGrpMutation.mutate({ groupId: null, ids: [...selectedIds] })}
        isLoading={bulkGrpMutation.isPending}
      />
      <AssignManagerModal
        isOpen={bulkModal === 'manager'}
        onClose={() => setBulkModal(null)}
        employee={null}
        label={`${selectedIds.size} employees`}
        candidates={managerCandidates}
        currentMgrId={null}
        onAssign={id => bulkMgrMutation.mutate({ managerId: id, ids: [...selectedIds] })}
        onClear={() => bulkMgrMutation.mutate({ managerId: null, ids: [...selectedIds] })}
        isLoading={bulkMgrMutation.isPending}
      />
    </MainLayout>
  );
}
