'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/hooks/use-auth';
import { useMyPermissions } from '@/lib/hooks/use-my-permissions';
import MainLayout from '@/components/layout/MainLayout';
import {
  Button,
  Drawer,
  Loader,
  PageHeader,
  PageShell,
  SearchInput,
} from '@/components/ui';
import {
  hrEmployeesApi,
  hrOfficeLocationsApi,
  hrEmployeeLocationsApi,
  hrAllAssignmentsApi,
  type EmployeeAssignmentFlat,
} from '@/lib/api/hr';
import { toast } from '@/lib/hooks/use-toast';
import { getApiError } from '@/lib/utils/error';

const th: React.CSSProperties = {
  textAlign: 'left',
  padding: 'var(--space-3) var(--space-4)',
  fontSize: 'var(--text-xs)',
  fontWeight: 600,
  color: 'var(--text-secondary)',
  whiteSpace: 'nowrap',
  borderBottom: '1px solid var(--border-subtle)',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};
const td: React.CSSProperties = {
  padding: 'var(--space-3) var(--space-4)',
  verticalAlign: 'top',
  fontSize: 'var(--text-sm)',
};

interface GroupedRow {
  employee_pk:      number;
  employee_name:    string;
  employee_id_code: string;
  assignments:      EmployeeAssignmentFlat[];
}

export default function EmployeeLocationsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { hasPermission } = useMyPermissions();
  const isAdmin = hasPermission('hr.hr_attendance.view');

  // ── Table state ──────────────────────────────────────────────────────────
  const [tableSearch, setTableSearch] = useState('');

  // ── Drawer state ─────────────────────────────────────────────────────────
  const [drawerOpen, setDrawerOpen]         = useState(false);
  const [empSearchTerm, setEmpSearchTerm]   = useState('');
  const [debouncedEmpSearch, setDebounced]  = useState('');
  const [selectedEmp, setSelectedEmp]       = useState<{ id: number; full_name: string; employee_id: string } | null>(null);
  const [selectedLocIds, setSelectedLocIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    const t = setTimeout(() => setDebounced(empSearchTerm), 300);
    return () => clearTimeout(t);
  }, [empSearchTerm]);

  // ── Single flat assignments query ─────────────────────────────────────────
  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ['hr-emp-assignments'],
    queryFn:  hrAllAssignmentsApi.getAll,
    enabled:  isAdmin,
    staleTime: 30_000,
  });

  // ── Drawer: search-as-you-type employee picker ───────────────────────────
  const { data: empSearchData, isLoading: searchingEmps } = useQuery({
    queryKey: ['emp-search-drawer', debouncedEmpSearch],
    queryFn:  () =>
      hrEmployeesApi.getAll({ search: debouncedEmpSearch, page_size: 10 }),
    enabled:  isAdmin && debouncedEmpSearch.length >= 2,
    staleTime: 30_000,
  });

  // ── Office locations for multi-select ────────────────────────────────────
  const { data: officeLocsData } = useQuery({
    queryKey: ['hr-office-locations', 'active'],
    queryFn:  () => hrOfficeLocationsApi.getAll({ is_active: true }),
    enabled:  isAdmin,
    staleTime: 60_000,
  });
  const officeLocs: Array<{ id: number; name: string; address?: string; radius_m?: number }> = officeLocsData?.results ?? [];

  // ── Mutations ─────────────────────────────────────────────────────────────
  const assignMutation = useMutation({
    mutationFn: async ({ empId, locIds }: { empId: number; locIds: number[] }) => {
      let assigned = 0, duplicates = 0, failed = 0;
      for (const locId of locIds) {
        try {
          await hrEmployeeLocationsApi.assign(empId, locId);
          assigned++;
        } catch (err: unknown) {
          if ((err as { response?: { status?: number } })?.response?.status === 400) duplicates++;
          else failed++;
        }
      }
      return { assigned, duplicates, failed };
    },
    onSuccess: ({ assigned, duplicates, failed }, { empId }) => {
      queryClient.invalidateQueries({ queryKey: ['hr-emp-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['emp-locations', empId] });
      closeDrawer();
      if (failed > 0) {
        toast(`${assigned} assigned, ${duplicates} already existed, ${failed} failed`, 'error');
      } else if (assigned === 0 && duplicates > 0) {
        toast('All selected locations are already assigned to this employee', 'success');
      } else if (duplicates > 0) {
        toast(`${assigned} assigned (${duplicates} already existed, skipped)`, 'success');
      } else {
        toast(`${assigned} location${assigned !== 1 ? 's' : ''} assigned`, 'success');
      }
    },
    onError: err => toast(getApiError(err, 'Assignment failed'), 'error'),
  });

  const removeMutation = useMutation({
    mutationFn: ({ empId, assignId }: { empId: number; assignId: number }) =>
      hrEmployeeLocationsApi.remove(empId, assignId),
    onSuccess: (_, { empId }) => {
      queryClient.invalidateQueries({ queryKey: ['hr-emp-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['emp-locations', empId] });
      toast('Location removed', 'success');
    },
    onError: err => toast(getApiError(err, 'Failed to remove'), 'error'),
  });

  // ── Helpers ───────────────────────────────────────────────────────────────
  const closeDrawer = () => {
    setDrawerOpen(false);
    setSelectedEmp(null);
    setEmpSearchTerm('');
    setDebounced('');
    setSelectedLocIds(new Set());
  };

  const openDrawer = (emp?: { id: number; full_name: string; employee_id: string }) => {
    setSelectedEmp(emp ?? null);
    setEmpSearchTerm('');
    setDebounced('');
    setSelectedLocIds(new Set());
    setDrawerOpen(true);
  };

  const toggleLoc = (id: number) => {
    setSelectedLocIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // ── Derived: group assignments by employee, filter client-side ────────────
  // Must be declared before early returns to satisfy rules-of-hooks.
  const grouped = useMemo<GroupedRow[]>(() => {
    const map = new Map<number, GroupedRow>();
    for (const a of assignments) {
      if (!map.has(a.employee_pk)) {
        map.set(a.employee_pk, {
          employee_pk:      a.employee_pk,
          employee_name:    a.employee_name,
          employee_id_code: a.employee_id_code,
          assignments:      [],
        });
      }
      map.get(a.employee_pk)!.assignments.push(a);
    }
    return Array.from(map.values());
  }, [assignments]);

  const filteredRows = useMemo<GroupedRow[]>(() => {
    if (!tableSearch) return grouped;
    const q = tableSearch.toLowerCase();
    return grouped.filter(r =>
      r.employee_name.toLowerCase().includes(q) ||
      r.employee_id_code.toLowerCase().includes(q)
    );
  }, [grouped, tableSearch]);

  // ── Guards ────────────────────────────────────────────────────────────────
  if (!user) return <MainLayout><div className="card empty-state"><Loader /></div></MainLayout>;
  if (!isAdmin) return (
    <MainLayout>
      <div className="card empty-state">
        <p style={{ color: 'var(--color-error)', margin: 0 }}>
          Access denied. This page is for administrators only.
        </p>
      </div>
    </MainLayout>
  );

  const alreadyAssignedIds = new Set<number>(
    selectedEmp
      ? assignments
          .filter(a => a.employee_pk === selectedEmp.id)
          .map(a => a.office_location)
      : []
  );

  const showTrueEmpty = !isLoading && grouped.length === 0;
  const showNoMatch   = !isLoading && grouped.length > 0 && filteredRows.length === 0;

  return (
    <MainLayout>
      <PageShell>
        <PageHeader
          title="Employee Work Locations"
          breadcrumbs={[{ label: 'HR' }, { label: 'Employee Locations' }]}
          actions={
            <Button variant="primary" size="sm" onClick={() => openDrawer()}>
              + Add Assignment
            </Button>
          }
        />

        <div style={{ marginBottom: 'var(--space-4)' }}>
          <SearchInput
            value={tableSearch}
            onChange={setTableSearch}
            placeholder="Search by employee name or number..."
            width={360}
          />
        </div>

        {isLoading ? (
          <div className="card empty-state"><Loader /></div>

        ) : showTrueEmpty ? (
          <div className="card empty-state">
            <p className="empty-state-title">No employee geolocations assigned yet</p>
            <p className="empty-state-desc">
              Use {'"'}+ Add Assignment{'"'} to link employees to their approved check-in sites.
            </p>
          </div>

        ) : showNoMatch ? (
          <div className="card empty-state">
            <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: 'var(--text-sm)' }}>
              No assigned employees match &quot;{tableSearch}&quot;.
            </p>
          </div>

        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={th}>Employee No.</th>
                    <th style={th}>Employee Name</th>
                    <th style={th}>Assigned Locations</th>
                    <th style={{ ...th, textAlign: 'right' }} />
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map(row => (
                    <tr
                      key={row.employee_pk}
                      style={{ borderBottom: '1px solid var(--border-subtle)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-subtle)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ ...td, fontFamily: 'monospace', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {row.employee_id_code}
                      </td>
                      <td style={{ ...td, fontWeight: 600 }}>
                        {row.employee_name || '—'}
                      </td>
                      <td style={td}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1-5)' }}>
                          {row.assignments.map(a => (
                            <span
                              key={a.id}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                background: 'var(--sidebar-active-bg)',
                                color: 'var(--sidebar-active-text)',
                                borderRadius: 'var(--radius-full)',
                                padding: '2px 6px 2px 10px',
                                fontSize: 'var(--text-xs)',
                                fontWeight: 500,
                              }}
                            >
                              {a.office_location_name}
                              <button
                                onClick={() => removeMutation.mutate({ empId: row.employee_pk, assignId: a.id })}
                                title={`Remove ${a.office_location_name}`}
                                style={{
                                  background: 'none', border: 'none', cursor: 'pointer',
                                  padding: '0 2px', lineHeight: 1,
                                  color: 'currentColor', opacity: 0.55,
                                  fontSize: '1rem', transition: 'opacity 100ms',
                                }}
                                onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                                onMouseLeave={e => (e.currentTarget.style.opacity = '0.55')}
                              >×</button>
                            </span>
                          ))}
                        </div>
                      </td>
                      <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button
                          onClick={() => openDrawer({
                            id:          row.employee_pk,
                            full_name:   row.employee_name,
                            employee_id: row.employee_id_code,
                          })}
                          style={{
                            fontSize: 'var(--text-xs)', fontWeight: 500,
                            color: 'var(--sidebar-active-text)',
                            background: 'none', border: 'none', cursor: 'pointer',
                          }}
                        >
                          + Add
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Assign Drawer ───────────────────────────────────────────────── */}
        <Drawer
          isOpen={drawerOpen}
          onClose={closeDrawer}
          title="Assign Check-in Location"
          size="md"
          footer={
            <>
              <Button variant="secondary" onClick={closeDrawer}>Cancel</Button>
              <Button
                variant="primary"
                isLoading={assignMutation.isPending}
                disabled={!selectedEmp || selectedLocIds.size === 0 || assignMutation.isPending}
                onClick={() => {
                  if (selectedEmp && selectedLocIds.size > 0)
                    assignMutation.mutate({ empId: selectedEmp.id, locIds: Array.from(selectedLocIds) });
                }}
              >
                Assign {selectedLocIds.size > 0 ? `(${selectedLocIds.size})` : ''}
              </Button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>

            {/* Employee picker — search-as-you-type */}
            <div className="form-field">
              <label className="form-label">Employee</label>

              {selectedEmp ? (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: 'var(--space-2) var(--space-3)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--surface-subtle)',
                }}>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{selectedEmp.full_name}</span>
                    <span style={{ marginLeft: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                      {selectedEmp.employee_id}
                    </span>
                  </div>
                  <button
                    onClick={() => setSelectedEmp(null)}
                    title="Change employee"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--text-lg)', color: 'var(--text-secondary)', lineHeight: 1, padding: '0 var(--space-1)' }}
                  >×</button>
                </div>
              ) : (
                <div>
                  <input
                    className="form-input"
                    autoFocus
                    value={empSearchTerm}
                    onChange={e => setEmpSearchTerm(e.target.value)}
                    placeholder="Type name or employee number…"
                  />

                  {empSearchTerm.length > 0 && empSearchTerm.length < 2 && (
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: 'var(--space-1) 0 0' }}>
                      Type at least 2 characters to search
                    </p>
                  )}

                  {debouncedEmpSearch.length >= 2 && (
                    <div style={{
                      marginTop: 'var(--space-1)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--card-bg)',
                      boxShadow: 'var(--shadow-md)',
                      overflow: 'hidden',
                      maxHeight: 240,
                      overflowY: 'auto',
                    }}>
                      {searchingEmps ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-4)' }}>
                          <Loader />
                        </div>
                      ) : (empSearchData?.results ?? []).length === 0 ? (
                        <p style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', margin: 0 }}>
                          No employees found for &quot;{debouncedEmpSearch}&quot;
                        </p>
                      ) : (
                        empSearchData!.results.map(emp => (
                          <button
                            key={emp.id}
                            onClick={() => { setSelectedEmp(emp); setEmpSearchTerm(''); }}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                              width: '100%', padding: 'var(--space-2-5) var(--space-4)',
                              background: 'none', border: 'none', cursor: 'pointer',
                              textAlign: 'left',
                              borderBottom: '1px solid var(--border-subtle)',
                              transition: 'background 80ms',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-subtle)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                          >
                            <span style={{ fontFamily: 'monospace', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', flexShrink: 0, minWidth: 72 }}>
                              {emp.employee_id}
                            </span>
                            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>
                              {emp.full_name}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Location multi-select */}
            <div className="form-field">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 'var(--space-2)' }}>
                <label className="form-label" style={{ margin: 0 }}>Check-in Locations</label>
                {selectedLocIds.size > 0 && (
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--sidebar-active-text)', fontWeight: 600 }}>
                    {selectedLocIds.size} selected
                  </span>
                )}
              </div>

              {officeLocs.length === 0 ? (
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0 }}>
                  No active geofences configured. Add check-in points in HR Settings first.
                </p>
              ) : (
                <div style={{
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  overflow: 'hidden',
                  maxHeight: 280,
                  overflowY: 'auto',
                }}>
                  {officeLocs.map((loc, idx) => {
                    const checked    = selectedLocIds.has(loc.id);
                    const alreadyHas = alreadyAssignedIds.has(loc.id);
                    return (
                      <label
                        key={loc.id}
                        style={{
                          display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)',
                          padding: 'var(--space-2-5) var(--space-3)',
                          cursor: 'pointer',
                          borderBottom: idx < officeLocs.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                          background: checked ? 'var(--sidebar-active-bg)' : 'transparent',
                          transition: 'background 80ms',
                          opacity: alreadyHas ? 0.5 : 1,
                        }}
                        onMouseEnter={e => { if (!checked) e.currentTarget.style.background = 'var(--surface-subtle)'; }}
                        onMouseLeave={e => { if (!checked) e.currentTarget.style.background = 'transparent'; }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleLoc(loc.id)}
                          style={{ marginTop: 2, flexShrink: 0, cursor: 'pointer' }}
                        />
                        <div style={{ minWidth: 0 }}>
                          <div style={{
                            fontSize: 'var(--text-sm)',
                            fontWeight: checked ? 600 : 400,
                            color: checked ? 'var(--sidebar-active-text)' : 'var(--text-primary)',
                          }}>
                            {loc.name}
                            {alreadyHas && (
                              <span style={{ marginLeft: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', fontWeight: 400 }}>
                                (already assigned)
                              </span>
                            )}
                          </div>
                          {loc.address && (
                            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: 2 }}>
                              {loc.address}
                            </div>
                          )}
                          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: 1 }}>
                            {loc.radius_m} m radius
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        </Drawer>
      </PageShell>
    </MainLayout>
  );
}
