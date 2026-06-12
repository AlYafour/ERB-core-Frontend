'use client';

import { useState } from 'react';
import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/hooks/use-auth';
import MainLayout from '@/components/layout/MainLayout';
import {
  Button,
  Drawer,
  Loader,
  PageHeader,
  PageShell,
  SearchInput,
  SearchableDropdown,
} from '@/components/ui';
import {
  hrEmployeesApi,
  hrOfficeLocationsApi,
  hrEmployeeLocationsApi,
  type EmployeeLocationAssignment,
} from '@/lib/api/hr';
import { toast } from '@/lib/hooks/use-toast';
import { getApiError } from '@/lib/utils/error';

const PAGE_SIZE = 20;

const th: React.CSSProperties = {
  textAlign: 'left',
  padding: 'var(--space-3) var(--space-4)',
  fontSize: 'var(--text-xs)',
  fontWeight: 'var(--weight-semibold)',
  color: 'var(--text-secondary)',
  whiteSpace: 'nowrap',
  borderBottom: '1px solid var(--border-subtle)',
};

const td: React.CSSProperties = {
  padding: 'var(--space-3) var(--space-4)',
  verticalAlign: 'top',
  fontSize: 'var(--text-sm)',
};

export default function EmployeeLocationsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const isAdmin = !!(
    user?.role === 'super_admin' ||
    user?.is_staff ||
    user?.is_superuser
  );

  const [search, setSearch]           = useState('');
  const [page, setPage]               = useState(1);
  const [drawerOpen, setDrawerOpen]   = useState(false);
  const [formEmpId, setFormEmpId]     = useState<number | null>(null);
  const [formLocId, setFormLocId]     = useState<number | null>(null);

  // ── Employees for the table (paginated + searchable) ──────────────────────
  const { data: empData, isLoading: loadingEmps } = useQuery({
    queryKey: ['hr-emp-loc-table', page, search],
    queryFn:  () => hrEmployeesApi.getAll({ page, search: search || undefined, page_size: PAGE_SIZE } as any),
    enabled:  isAdmin,
  });

  const employees = empData?.results ?? [];

  // ── Per-employee location assignments (parallel, max 20 per page) ─────────
  const locationResults = useQueries({
    queries: employees.map(emp => ({
      queryKey: ['emp-locations', emp.id],
      queryFn:  () => hrEmployeeLocationsApi.getAll(emp.id),
      staleTime: 30_000,
      enabled:  isAdmin,
    })),
  });

  // ── All employees for drawer dropdown ─────────────────────────────────────
  const { data: allEmpData } = useQuery({
    queryKey: ['hr-emp-loc-all'],
    queryFn:  () => hrEmployeesApi.getAll({ page_size: 200 } as any),
    enabled:  isAdmin,
    staleTime: 5 * 60_000,
  });

  // ── Office locations for drawer dropdown ──────────────────────────────────
  const { data: allLocData } = useQuery({
    queryKey: ['office-locations'],
    queryFn:  () => hrOfficeLocationsApi.getAll({ is_active: true }),
    enabled:  isAdmin,
    staleTime: 5 * 60_000,
  });

  // ── Mutations ─────────────────────────────────────────────────────────────
  const assignMutation = useMutation({
    mutationFn: ({ empId, locId }: { empId: number; locId: number }) =>
      hrEmployeeLocationsApi.assign(empId, locId),
    onSuccess: (_, { empId }) => {
      queryClient.invalidateQueries({ queryKey: ['emp-locations', empId] });
      closeDrawer();
      toast('Location assigned successfully', 'success');
    },
    onError: (err) =>
      toast(getApiError(err, 'Failed to assign location'), 'error'),
  });

  const removeMutation = useMutation({
    mutationFn: ({ empId, assignId }: { empId: number; assignId: number }) =>
      hrEmployeeLocationsApi.remove(empId, assignId),
    onSuccess: (_, { empId }) => {
      queryClient.invalidateQueries({ queryKey: ['emp-locations', empId] });
      toast('Location removed', 'success');
    },
    onError: (err) =>
      toast(getApiError(err, 'Failed to remove location'), 'error'),
  });

  // ── Helpers ───────────────────────────────────────────────────────────────
  const openDrawer = (empId?: number) => {
    setFormEmpId(empId ?? null);
    setFormLocId(null);
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setFormEmpId(null);
    setFormLocId(null);
  };

  const handleSearch = (val: string) => {
    setSearch(val);
    setPage(1);
  };

  // ── Guard renders ─────────────────────────────────────────────────────────
  if (!user) {
    return (
      <MainLayout>
        <div className="card empty-state"><Loader /></div>
      </MainLayout>
    );
  }

  if (!isAdmin) {
    return (
      <MainLayout>
        <div className="card empty-state">
          <p style={{ color: 'var(--color-error)', margin: 0 }}>
            Access denied. This page is for administrators only.
          </p>
        </div>
      </MainLayout>
    );
  }

  // ── Derived values ────────────────────────────────────────────────────────
  const totalCount = empData?.count ?? 0;

  const rows = employees.map((emp, i) => ({
    emp,
    assignments: (locationResults[i]?.data ?? []) as EmployeeLocationAssignment[],
    loadingLocs: locationResults[i]?.isLoading ?? false,
  }));

  const empOptions = (allEmpData?.results ?? []).map(e => ({
    value: e.id,
    label: `${e.employee_id} — ${e.full_name || ''}`.trim(),
  }));

  const locOptions = (allLocData?.results ?? []).map((l: any) => ({
    value: l.id,
    label: l.name,
  }));

  return (
    <MainLayout>
      <PageShell>
        <PageHeader
          title="Employee Work Locations"
          count={totalCount}
          breadcrumbs={[{ label: 'HR' }, { label: 'Employee Locations' }]}
          actions={
            <Button variant="primary" size="sm" onClick={() => openDrawer()}>
              + Assign Location
            </Button>
          }
        />

        <div style={{ marginBottom: 'var(--space-4)' }}>
          <SearchInput
            value={search}
            onChange={handleSearch}
            placeholder="Search by employee name or number..."
            width={360}
          />
        </div>

        {loadingEmps ? (
          <div className="card empty-state"><Loader /></div>
        ) : rows.length === 0 ? (
          <div className="card empty-state">
            <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: 'var(--text-sm)' }}>
              {search
                ? 'No employees match your search.'
                : 'No employee geolocations assigned yet.'}
            </p>
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
                <thead>
                  <tr>
                    <th style={th}>Employee No.</th>
                    <th style={th}>Employee Name</th>
                    <th style={th}>Assigned Locations</th>
                    <th style={{ ...th, textAlign: 'right' }} />
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ emp, assignments, loadingLocs }) => (
                    <tr
                      key={emp.id}
                      style={{ borderBottom: '1px solid var(--border-subtle)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-subtle)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ ...td, fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                        {emp.employee_id}
                      </td>
                      <td style={{ ...td, fontWeight: 'var(--weight-medium)' }}>
                        {emp.full_name || '—'}
                      </td>
                      <td style={td}>
                        {loadingLocs ? (
                          <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-xs)' }}>
                            Loading…
                          </span>
                        ) : assignments.length === 0 ? (
                          <span style={{ color: 'var(--text-secondary)' }}>—</span>
                        ) : (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1-5)' }}>
                            {assignments.map(a => (
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
                                  fontWeight: 'var(--weight-medium)',
                                }}
                              >
                                {a.office_location_name}
                                <button
                                  onClick={() =>
                                    removeMutation.mutate({ empId: emp.id, assignId: a.id })
                                  }
                                  title={`Remove ${a.office_location_name}`}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    padding: '0 2px',
                                    lineHeight: 1,
                                    color: 'currentColor',
                                    opacity: 0.6,
                                    fontSize: '1rem',
                                  }}
                                  onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                                  onMouseLeave={e => (e.currentTarget.style.opacity = '0.6')}
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td style={{ ...td, textAlign: 'right' }}>
                        <button
                          onClick={() => openDrawer(emp.id)}
                          style={{
                            fontSize: 'var(--text-xs)',
                            fontWeight: 'var(--weight-medium)',
                            color: 'var(--sidebar-active-text)',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
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

            {totalCount > PAGE_SIZE && (
              <div
                style={{
                  padding: 'var(--space-3) var(--space-4)',
                  borderTop: '1px solid var(--border-subtle)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                  {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, totalCount)} of {totalCount}
                </span>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setPage(p => p - 1)}
                    disabled={page <= 1}
                  >
                    Prev
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setPage(p => p + 1)}
                    disabled={page * PAGE_SIZE >= totalCount}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Assign Location Drawer */}
        <Drawer
          isOpen={drawerOpen}
          onClose={closeDrawer}
          title="Assign Check-in Location"
          size="sm"
          footer={
            <>
              <Button variant="secondary" onClick={closeDrawer}>
                Cancel
              </Button>
              <Button
                variant="primary"
                isLoading={assignMutation.isPending}
                disabled={!formEmpId || !formLocId || assignMutation.isPending}
                onClick={() => {
                  if (formEmpId && formLocId)
                    assignMutation.mutate({ empId: formEmpId, locId: formLocId });
                }}
              >
                Assign
              </Button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
            <div className="form-field">
              <label className="form-label">Employee</label>
              <SearchableDropdown
                options={empOptions}
                value={formEmpId}
                onChange={v => setFormEmpId(v as number | null)}
                placeholder="Select employee..."
                searchPlaceholder="Search by name or ID..."
              />
            </div>
            <div className="form-field">
              <label className="form-label">Check-in Location (Geofence)</label>
              <SearchableDropdown
                options={locOptions}
                value={formLocId}
                onChange={v => setFormLocId(v as number | null)}
                placeholder="Select location..."
                searchPlaceholder="Search locations..."
              />
            </div>
          </div>
        </Drawer>

      </PageShell>
    </MainLayout>
  );
}
