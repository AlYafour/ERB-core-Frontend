'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppListPage } from '@/components/app/AppListPage';
import { useTableState } from '@/lib/hooks/use-table-state';
import { type Column } from '@/components/ui/DataTable';
import { type FilterField } from '@/components/ui/FilterPanel';
import { Button, Badge, PersonCell } from '@/components/ui';
import { RowActions } from '@/components/ui/RowActions';
import { hrEmployeesApi, hrEmployeeGroupsApi } from '@/lib/api/hr';
import { useAuth } from '@/lib/hooks/use-auth';
import { useMyPermissions } from '@/lib/hooks/use-my-permissions';
import { toast, confirm } from '@/lib/hooks/use-toast';
import { AssignGroupModal } from '@/components/hr/AssignGroupModal';
import { AssignManagerModal } from '@/components/hr/AssignManagerModal';
import type { HREmployee, EmployeeGroup } from '@/types';

// ── Types ──────────────────────────────────────────────────────
type GroupRec    = { id: number; code: string; name: string } | null;
type ManagerRec  = { id: number; name: string } | null;
type ActiveModal = { type: 'group' | 'manager'; emp: HREmployee } | null;

// ── Page ───────────────────────────────────────────────────────
export default function EmployeesPage() {
  const { user: me } = useAuth();
  const { hasPermission } = useMyPermissions();
  const router = useRouter();
  const qc = useQueryClient();

  const admin     = hasPermission('hr.hr_employee.view');
  const canEdit   = hasPermission('hr.hr_employee.change');
  const canDelete = hasPermission('hr.hr_employee.delete');
  const canAdd    = hasPermission('hr.hr_employee.add');

  // ── Table state (search + filters + selection via useTableState) ──
  const tableState = useTableState();
  const { search, filters, selectedItems, clearSelection } = tableState;

  // ── Modal state ────────────────────────────────────────────
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [bulkModal,   setBulkModal]   = useState<'group' | 'manager' | null>(null);

  // ── Optimistic overrides ───────────────────────────────────
  const [grpOverrides,     setGrpOverrides]     = useState<Record<number, GroupRec>>({});
  const [mgrOverrides,     setMgrOverrides]     = useState<Record<number, ManagerRec>>({});
  const [mgrFlagOverrides, setMgrFlagOverrides] = useState<Record<number, boolean>>({});
  const [activeOverrides,  setActiveOverrides]  = useState<Record<number, boolean>>({});
  const [deletedIds,       setDeletedIds]       = useState<Set<number>>(new Set());

  useEffect(() => { if (me && !admin) router.replace('/dashboard'); }, [me, admin, router]);

  // ── Data ───────────────────────────────────────────────────
  const { data: raw, isLoading, error } = useQuery({
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

  // ── Resolvers ──────────────────────────────────────────────
  const resolveIsActive  = useCallback((emp: HREmployee) =>
    emp.id in activeOverrides ? activeOverrides[emp.id] : emp.is_active, [activeOverrides]);
  const resolveIsManager = useCallback((emp: HREmployee) =>
    emp.id in mgrFlagOverrides ? mgrFlagOverrides[emp.id] : emp.is_manager, [mgrFlagOverrides]);
  const resolveGroup = useCallback((emp: HREmployee): GroupRec => {
    if (emp.id in grpOverrides) return grpOverrides[emp.id];
    return emp.employee_group != null && emp.employee_group_code != null
      ? { id: emp.employee_group, code: emp.employee_group_code, name: emp.employee_group_name ?? emp.employee_group_code }
      : null;
  }, [grpOverrides]);
  const resolveMgrName = useCallback((emp: HREmployee) =>
    emp.id in mgrOverrides ? mgrOverrides[emp.id]?.name ?? null : emp.direct_manager_name ?? null, [mgrOverrides]);
  const resolveMgrId = useCallback((emp: HREmployee) =>
    emp.id in mgrOverrides ? mgrOverrides[emp.id]?.id ?? null : emp.direct_manager ?? null, [mgrOverrides]);

  const managerCandidates = useMemo(
    () => employees.filter(e => resolveIsManager(e) && resolveIsActive(e)),
    [employees, resolveIsManager, resolveIsActive],
  );

  // ── Client-side filter + search (reads from tableState.filters) ──
  const statusFilter = (filters.status as string) ?? 'active';
  const deptFilter   = (filters.department as string) ?? '';
  const posFilter    = (filters.position as string) ?? '';
  const groupFilter  = (filters.group as string) ?? '';
  const mgrFilter    = (filters.is_manager as string) ?? '';

  const filtered = useMemo(() => {
    return employees.filter(e => {
      if (deletedIds.has(e.id)) return false;
      const isActive = resolveIsActive(e);
      if (statusFilter === 'active'   && !isActive) return false;
      if (statusFilter === 'inactive' &&  isActive) return false;
      if (deptFilter  && e.department_name !== deptFilter) return false;
      if (posFilter   && e.position_title  !== posFilter)  return false;
      if (groupFilter && String(e.employee_group) !== groupFilter) return false;
      if (mgrFilter === 'yes' && !resolveIsManager(e)) return false;
      if (mgrFilter === 'no'  &&  resolveIsManager(e)) return false;
      const q = search.toLowerCase();
      return !q || e.full_name.toLowerCase().includes(q) || e.employee_id.toLowerCase().includes(q);
    });
  }, [employees, deletedIds, resolveIsActive, search, deptFilter, posFilter, groupFilter, statusFilter, mgrFilter, resolveIsManager]);

  // ── Dynamic filter options (derived from data) ─────────────
  const departments = useMemo(
    () => Array.from(new Set(employees.map(e => e.department_name).filter(Boolean))).sort() as string[],
    [employees],
  );
  const positions = useMemo(
    () => Array.from(new Set(employees.map(e => e.position_title).filter(Boolean))).sort() as string[],
    [employees],
  );

  const noLoginCount = employees.filter(e => !deletedIds.has(e.id) && !e.user?.id).length;

  const activeEmp = activeModal?.emp ?? null;

  // ── Single mutations ───────────────────────────────────────
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
    onSuccess: (data: HREmployee, vars) => {
      const name: string | null = data?.direct_manager_name ?? null;
      setMgrOverrides(p => ({ ...p, [vars.empId]: vars.managerId !== null && name ? { id: vars.managerId, name } : null }));
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

  const activateMutation = useMutation({
    mutationFn: (id: number) => hrEmployeesApi.activate(id),
    onSuccess: (_, id) => {
      setActiveOverrides(p => ({ ...p, [id]: true }));
      toast('Employee activated', 'success');
    },
    onError: () => toast('Failed to activate', 'error'),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: number) => hrEmployeesApi.deactivate(id),
    onSuccess: (_, id) => {
      setActiveOverrides(p => ({ ...p, [id]: false }));
      if (selectedItems.has(id)) tableState.toggleSelect(id);
      toast('Employee deactivated', 'success');
    },
    onError: () => toast('Failed to deactivate', 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => hrEmployeesApi.delete(id),
    onSuccess: (_, id) => {
      setDeletedIds(prev => new Set([...prev, id]));
      if (selectedItems.has(id)) tableState.toggleSelect(id);
      toast('Employee deleted', 'success');
    },
    onError: () => toast('Failed to delete employee', 'error'),
  });

  // ── Bulk mutations ─────────────────────────────────────────
  const bulkGrpMutation = useMutation({
    mutationFn: ({ groupId, ids }: { groupId: number | null; ids: number[] }) =>
      Promise.all(ids.map(id => hrEmployeesApi.update(id, { employee_group: groupId } as Partial<HREmployee>))),
    onSuccess: (_, vars) => {
      const g = vars.groupId !== null ? groups.find(x => x.id === vars.groupId) : null;
      setGrpOverrides(prev => { const n = { ...prev }; vars.ids.forEach(id => { n[id] = g ? { id: g.id, code: g.code, name: g.name } : null; }); return n; });
      setBulkModal(null); clearSelection();
      toast(`Group ${vars.groupId ? 'assigned' : 'removed'} for ${vars.ids.length} employees`, 'success');
    },
    onError: () => toast('Failed to update some employees', 'error'),
  });

  const bulkMgrMutation = useMutation({
    mutationFn: ({ managerId, ids }: { managerId: number | null; ids: number[] }) =>
      Promise.all(ids.map(id => hrEmployeesApi.update(id, { direct_manager: managerId } as Partial<HREmployee>))),
    onSuccess: (results: HREmployee[], vars) => {
      setMgrOverrides(prev => { const n = { ...prev }; vars.ids.forEach((id, i) => { const name = results[i]?.direct_manager_name ?? null; n[id] = vars.managerId !== null && name ? { id: vars.managerId, name } : null; }); return n; });
      setBulkModal(null); clearSelection();
      toast(`Manager ${vars.managerId ? 'assigned' : 'removed'} for ${vars.ids.length} employees`, 'success');
    },
    onError: () => toast('Failed to update some employees', 'error'),
  });

  const bulkActivateMutation = useMutation({
    mutationFn: (ids: number[]) => Promise.all(ids.map(id => hrEmployeesApi.activate(id))),
    onSuccess: (_, ids) => {
      setActiveOverrides(prev => { const n = { ...prev }; ids.forEach(id => { n[id] = true; }); return n; });
      clearSelection();
      toast(`${ids.length} employees activated`, 'success');
    },
    onError: () => toast('Failed to activate some employees', 'error'),
  });

  const bulkDeactivateMutation = useMutation({
    mutationFn: (ids: number[]) => Promise.all(ids.map(id => hrEmployeesApi.deactivate(id))),
    onSuccess: (_, ids) => {
      setActiveOverrides(prev => { const n = { ...prev }; ids.forEach(id => { n[id] = false; }); return n; });
      clearSelection();
      toast(`${ids.length} employees deactivated`, 'success');
    },
    onError: () => toast('Failed to deactivate some employees', 'error'),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: number[]) => Promise.all(ids.map(id => hrEmployeesApi.delete(id))),
    onSuccess: (_, ids) => {
      setDeletedIds(prev => new Set([...prev, ...ids]));
      clearSelection();
      toast(`${ids.length} employees deleted`, 'success');
    },
    onError: () => toast('Failed to delete some employees', 'error'),
  });

  const isBulkPending = bulkGrpMutation.isPending || bulkMgrMutation.isPending ||
    bulkActivateMutation.isPending || bulkDeactivateMutation.isPending || bulkDeleteMutation.isPending;

  // ── Action handlers ────────────────────────────────────────
  const handleDelete = async (emp: HREmployee) => {
    if (await confirm(`Delete ${emp.full_name}? This cannot be undone.`))
      deleteMutation.mutate(emp.id);
  };

  const handleBulkDelete = async () => {
    const n = selectedItems.size;
    if (await confirm(`Delete ${n} employee${n !== 1 ? 's' : ''}? This cannot be undone. Linked login accounts are not deleted automatically.`))
      bulkDeleteMutation.mutate([...selectedItems]);
  };

  // ── Columns ────────────────────────────────────────────────
  const columns: Column<HREmployee>[] = [
    {
      key: 'full_name',
      header: 'Employee',
      render: emp => (
        <PersonCell
          name={emp.full_name}
          secondary={!emp.user?.id ? 'No login' : !resolveIsActive(emp) ? 'Inactive' : undefined}
          avatarUrl={emp.user?.avatar ?? null}
        />
      ),
    },
    {
      key: 'employee_id',
      header: 'ID',
      render: emp => <span className="emp-mono">{emp.employee_id}</span>,
    },
    {
      key: 'department_name',
      header: 'Department',
      render: emp => <span className="emp-meta">{emp.department_name || '—'}</span>,
    },
    {
      key: 'position_title',
      header: 'Position',
      render: emp => <span className="emp-meta">{emp.position_title || '—'}</span>,
    },
    {
      key: 'is_active',
      header: 'Status',
      render: emp => {
        const isActive = resolveIsActive(emp);
        return <Badge variant={isActive ? 'success' : 'default'}>{isActive ? 'Active' : 'Inactive'}</Badge>;
      },
    },
    {
      key: 'is_manager',
      header: 'Mgr',
      render: emp => {
        const isManager = resolveIsManager(emp);
        if (!canEdit) {
          return (
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              {isManager
                ? <Badge variant="default">Mgr</Badge>
                : <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
            </div>
          );
        }
        return (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button
              className={`emp-mgr-flag${isManager ? ' emp-mgr-flag--on' : ''}`}
              onClick={e => { e.stopPropagation(); mgrFlagMutation.mutate({ empId: emp.id, value: !isManager }); }}
              disabled={mgrFlagMutation.isPending && mgrFlagMutation.variables?.empId === emp.id}
              title={isManager ? 'Remove manager designation' : 'Mark as manager'}
            >
              {isManager ? 'Mgr' : '—'}
            </button>
          </div>
        );
      },
    },
    {
      key: 'employee_group',
      header: 'Group',
      render: emp => {
        const grp = resolveGroup(emp);
        if (!canEdit) {
          return grp
            ? <span className="emp-meta">{grp.name || grp.code}</span>
            : <span style={{ color: 'var(--text-tertiary)' }}>—</span>;
        }
        return grp ? (
          <div className="emp-group-tag">
            <button
              className="emp-group-badge"
              onClick={e => { e.stopPropagation(); setActiveModal({ type: 'group', emp }); }}
              title={grp.code}
            >
              {grp.name || grp.code}
            </button>
            <button
              className="emp-clear-btn"
              onClick={e => { e.stopPropagation(); grpMutation.mutate({ empId: emp.id, groupId: null }); }}
            >
              ✕
            </button>
          </div>
        ) : (
          <button
            className="emp-assign-btn"
            onClick={e => { e.stopPropagation(); setActiveModal({ type: 'group', emp }); }}
          >
            Assign
          </button>
        );
      },
    },
    {
      key: 'direct_manager',
      header: 'Direct Manager',
      render: emp => {
        const mgrName = resolveMgrName(emp);
        if (!canEdit) {
          return mgrName
            ? <span className="emp-meta">{mgrName}</span>
            : <span style={{ color: 'var(--text-tertiary)' }}>—</span>;
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', minWidth: 0 }}>
            {mgrName ? (
              <>
                <span className="emp-dot emp-dot--green" />
                <button
                  className="emp-manager-btn"
                  onClick={e => { e.stopPropagation(); setActiveModal({ type: 'manager', emp }); }}
                >
                  {mgrName}
                </button>
                <button
                  className="emp-clear-btn"
                  onClick={e => { e.stopPropagation(); mgrMutation.mutate({ empId: emp.id, managerId: null }); }}
                >
                  ✕
                </button>
              </>
            ) : (
              <button
                className="emp-assign-btn"
                onClick={e => { e.stopPropagation(); setActiveModal({ type: 'manager', emp }); }}
              >
                Assign
              </button>
            )}
          </div>
        );
      },
    },
    {
      key: 'actions',
      header: '',
      render: emp => {
        const isActive = resolveIsActive(emp);
        return (
          <div onClick={e => e.stopPropagation()}>
            <RowActions actions={[
              { label: 'Open Employee File', href: `/hr/employees/${emp.id}` },
              { separator: true, hidden: !canEdit && !canDelete },
              {
                label: isActive ? 'Deactivate' : 'Activate',
                onClick: () => isActive
                  ? deactivateMutation.mutate(emp.id)
                  : activateMutation.mutate(emp.id),
                hidden: !canEdit,
              },
              { separator: true, hidden: !canDelete },
              { label: 'Delete Employee', onClick: () => handleDelete(emp), variant: 'danger', hidden: !canDelete },
            ]} />
          </div>
        );
      },
    },
  ];

  // ── Filter fields ──────────────────────────────────────────
  const filterFields: FilterField[] = [
    {
      name: 'status',
      label: 'Status',
      type: 'select',
      group: 'Filters',
      options: [
        { value: 'active',   label: 'Active' },
        { value: 'inactive', label: 'Inactive' },
      ],
    },
    {
      name: 'department',
      label: 'Department',
      type: 'select',
      group: 'Filters',
      options: departments.map(d => ({ value: d, label: d })),
    },
    {
      name: 'position',
      label: 'Position',
      type: 'select',
      group: 'Filters',
      options: positions.map(p => ({ value: p, label: p })),
    },
    {
      name: 'group',
      label: 'Group',
      type: 'select',
      group: 'Filters',
      options: groups.filter(g => g.is_active).map(g => ({ value: String(g.id), label: g.name })),
    },
    {
      name: 'is_manager',
      label: 'Manager Flag',
      type: 'select',
      group: 'Filters',
      options: [
        { value: 'yes', label: 'Managers only' },
        { value: 'no',  label: 'Non-managers' },
      ],
    },
  ];

  // ── Bulk actions bar ───────────────────────────────────────
  const bulkActionsBar = selectedItems.size > 0 && (canEdit || canDelete) ? (
    <div className="emp-bulk-actions">
      {canEdit && <button className="emp-bulk-btn" onClick={() => setBulkModal('group')}   disabled={isBulkPending}>Assign Group</button>}
      {canEdit && <button className="emp-bulk-btn" onClick={() => setBulkModal('manager')} disabled={isBulkPending}>Assign Manager</button>}
      {canEdit && <button className="emp-bulk-btn" onClick={() => bulkActivateMutation.mutate([...selectedItems])}   disabled={isBulkPending}>Activate</button>}
      {canEdit && <button className="emp-bulk-btn" onClick={() => bulkDeactivateMutation.mutate([...selectedItems])} disabled={isBulkPending}>Deactivate</button>}
      {canDelete && (
        <button
          className="emp-bulk-btn"
          onClick={handleBulkDelete}
          disabled={isBulkPending}
          style={{ borderColor: 'var(--status-error)', color: 'var(--status-error)' }}
        >
          Delete
        </button>
      )}
      <button className="emp-bulk-btn emp-bulk-btn--clear" onClick={clearSelection}>Clear</button>
    </div>
  ) : undefined;

  if (!admin) return null;

  return (
    <AppListPage
      title="Employees"
      description="Manage employees, groups, and reporting lines"
      breadcrumbs={[
        { label: 'HR' },
        { label: 'Employees' },
      ]}
      showBack={false}
      totalCount={filtered.length}
      createAction={canAdd ? (
        <Link href="/hr/employees/new">
          <Button variant="primary" size="sm">+ New Employee</Button>
        </Link>
      ) : undefined}
      filterFields={filterFields}
      columns={columns}
      data={filtered}
      isLoading={isLoading}
      error={error}
      emptyTitle="No employees match your filters."
      tableState={tableState}
      selectable={canEdit || canDelete}
      bulkActions={bulkActionsBar}
      onRowClick={emp => router.push(`/hr/employees/${emp.id}`)}
      rowStyle={emp => resolveIsActive(emp) ? undefined : { opacity: 0.6 }}
      searchPlaceholder="Search name or ID…"
    >
      {/* Warning banner */}
      {!isLoading && noLoginCount > 0 && (
        <div className="proc-status-banner proc-status-banner--warning">
          <strong>{noLoginCount} employee{noLoginCount !== 1 ? 's' : ''}</strong>{' '}
          {noLoginCount === 1 ? 'has' : 'have'} no login account — approvals will not route to them.
        </div>
      )}

      {/* Single-employee modals */}
      <AssignGroupModal
        isOpen={activeModal?.type === 'group'} onClose={() => setActiveModal(null)}
        employee={activeEmp} groups={groups}
        currentId={activeEmp ? (resolveGroup(activeEmp)?.id ?? null) : null}
        onAssign={id => activeEmp && grpMutation.mutate({ empId: activeEmp.id, groupId: id })}
        onClear={() => activeEmp && grpMutation.mutate({ empId: activeEmp.id, groupId: null })}
        isLoading={grpMutation.isPending}
      />
      <AssignManagerModal
        isOpen={activeModal?.type === 'manager'} onClose={() => setActiveModal(null)}
        employee={activeEmp} candidates={managerCandidates}
        currentMgrId={activeEmp ? resolveMgrId(activeEmp) : null}
        onAssign={id => activeEmp && mgrMutation.mutate({ empId: activeEmp.id, managerId: id })}
        onClear={() => activeEmp && mgrMutation.mutate({ empId: activeEmp.id, managerId: null })}
        isLoading={mgrMutation.isPending}
      />

      {/* Bulk modals */}
      <AssignGroupModal
        isOpen={bulkModal === 'group'} onClose={() => setBulkModal(null)}
        employee={null} label={`${selectedItems.size} employees`} groups={groups} currentId={null}
        onAssign={id => bulkGrpMutation.mutate({ groupId: id, ids: [...selectedItems] })}
        onClear={() => bulkGrpMutation.mutate({ groupId: null, ids: [...selectedItems] })}
        isLoading={bulkGrpMutation.isPending}
      />
      <AssignManagerModal
        isOpen={bulkModal === 'manager'} onClose={() => setBulkModal(null)}
        employee={null} label={`${selectedItems.size} employees`} candidates={managerCandidates} currentMgrId={null}
        onAssign={id => bulkMgrMutation.mutate({ managerId: id, ids: [...selectedItems] })}
        onClear={() => bulkMgrMutation.mutate({ managerId: null, ids: [...selectedItems] })}
        isLoading={bulkMgrMutation.isPending}
      />
    </AppListPage>
  );
}
