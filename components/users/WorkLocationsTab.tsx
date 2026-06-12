'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { hrOfficeLocationsApi, hrEmployeeLocationsApi, type EmployeeLocationAssignment } from '@/lib/api/hr';
import { Button, Loader } from '@/components/ui';
import { toast } from '@/lib/hooks/use-toast';
import { getApiError } from '@/lib/utils/error';
import type { UserTabProps } from './OverviewTab';

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const thStyle = {
  textAlign: 'left' as const,
  padding: 'var(--space-2) var(--space-3)',
  fontSize: 'var(--text-xs)',
  fontWeight: 'var(--weight-semibold)' as const,
  color: 'var(--text-secondary)',
  whiteSpace: 'nowrap' as const,
  borderBottom: '1px solid var(--border-subtle)',
};

const tdStyle = {
  padding: 'var(--space-3)',
  verticalAlign: 'middle' as const,
};

export default function WorkLocationsTab({ emp, isAdmin }: UserTabProps) {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState('');
  const [removingId, setRemovingId] = useState<number | null>(null);

  const empPk = emp?.id ?? 0;

  // ── Queries ──────────────────────────────────────────────────────────────────
  const { data: assignments, isLoading } = useQuery<EmployeeLocationAssignment[]>({
    queryKey: ['emp-locations', empPk],
    queryFn: () => hrEmployeeLocationsApi.getAll(empPk),
    enabled: !!emp,
  });

  const { data: allLocations } = useQuery({
    queryKey: ['office-locations'],
    queryFn: () => hrOfficeLocationsApi.getAll({ is_active: true }),
    enabled: isAdmin && !!emp,
  });

  // ── Mutations ─────────────────────────────────────────────────────────────────
  const assignMutation = useMutation({
    mutationFn: (locationId: number) => hrEmployeeLocationsApi.assign(empPk, locationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emp-locations', empPk] });
      setSelectedId('');
      toast('Location assigned', 'success');
    },
    onError: (err) => {
      toast(getApiError(err, 'Failed to assign location'), 'error');
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (assignmentId: number) => {
      setRemovingId(assignmentId);
      return hrEmployeeLocationsApi.remove(empPk, assignmentId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emp-locations', empPk] });
      toast('Location removed', 'success');
    },
    onError: (err) => {
      toast(getApiError(err, 'Failed to remove location'), 'error');
    },
    onSettled: () => setRemovingId(null),
  });

  // ── No employee profile ───────────────────────────────────────────────────────
  if (!emp) {
    return (
      <div className="card empty-state">
        <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: 'var(--text-sm)' }}>
          No employee profile linked — set one up in the Overview tab first.
        </p>
      </div>
    );
  }

  const assignedIds = new Set((assignments ?? []).map(a => a.office_location));
  const availableLocations = (allLocations?.results ?? []).filter((loc: any) => !assignedIds.has(loc.id));

  return (
    <div className="card">

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
        <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', margin: 0 }}>
          Check-in Locations
        </h3>
        {!!assignments?.length && (
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', background: 'var(--surface-subtle)', padding: 'var(--space-0-5) var(--space-2)', borderRadius: 'var(--radius-full)' }}>
            {assignments.length} assigned
          </span>
        )}
      </div>

      {/* Admin: assign row */}
      {isAdmin && (
        <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-5)', alignItems: 'center' }}>
          <select
            className="form-select"
            style={{ flex: 1, maxWidth: 420 }}
            value={selectedId}
            onChange={e => setSelectedId(e.target.value)}
          >
            <option value="">— Select a location to assign —</option>
            {availableLocations.map((loc: any) => (
              <option key={loc.id} value={loc.id}>{loc.name}</option>
            ))}
          </select>
          <Button
            variant="primary"
            size="sm"
            isLoading={assignMutation.isPending}
            disabled={!selectedId || assignMutation.isPending}
            onClick={() => selectedId && assignMutation.mutate(Number(selectedId))}
          >
            Assign
          </Button>
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-8)' }}>
          <Loader />
        </div>
      ) : !assignments?.length ? (
        <div style={{ padding: 'var(--space-8)', textAlign: 'center', borderRadius: 'var(--radius-lg)', background: 'var(--surface-subtle)' }}>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: 'var(--text-sm)' }}>
            No check-in locations assigned yet.
          </p>
          {isAdmin && (
            <p style={{ color: 'var(--text-secondary)', margin: 'var(--space-1) 0 0', fontSize: 'var(--text-xs)' }}>
              Use the dropdown above to assign this employee's approved work sites.
            </p>
          )}
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
            <thead>
              <tr>
                <th style={thStyle}>Location</th>
                <th style={thStyle}>Coordinates</th>
                <th style={thStyle}>Radius</th>
                <th style={thStyle}>Assigned By</th>
                <th style={thStyle}>Assigned At</th>
                {isAdmin && <th style={{ ...thStyle, textAlign: 'right' as const }} />}
              </tr>
            </thead>
            <tbody>
              {assignments.map(row => (
                <tr
                  key={row.id}
                  style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background 80ms' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-subtle)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={tdStyle}>
                    <span style={{ fontWeight: 'var(--weight-medium)' }}>{row.office_location_name}</span>
                  </td>
                  <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                    {row.office_location_latitude?.toFixed(5)},&nbsp;
                    {row.office_location_longitude?.toFixed(5)}
                  </td>
                  <td style={{ ...tdStyle, color: 'var(--text-secondary)' }}>
                    {row.office_location_radius_m} m
                  </td>
                  <td style={{ ...tdStyle, color: 'var(--text-secondary)' }}>
                    {row.assigned_by_name ?? '—'}
                  </td>
                  <td style={{ ...tdStyle, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                    {fmtDate(row.assigned_at)}
                  </td>
                  {isAdmin && (
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <button
                        onClick={() => removeMutation.mutate(row.id)}
                        disabled={removingId === row.id}
                        style={{
                          fontSize: 'var(--text-xs)',
                          fontWeight: 'var(--weight-medium)',
                          color: removingId === row.id ? 'var(--text-secondary)' : 'var(--color-error)',
                          background: 'none',
                          border: 'none',
                          cursor: removingId === row.id ? 'default' : 'pointer',
                          padding: 'var(--space-1) var(--space-2)',
                          borderRadius: 'var(--radius-md)',
                        }}
                      >
                        {removingId === row.id ? '…' : 'Remove'}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
