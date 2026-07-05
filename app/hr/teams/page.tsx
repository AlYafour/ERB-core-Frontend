'use client';

import { useState, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AppListPage } from '@/components/app/AppListPage';
import { useTableState } from '@/lib/hooks/use-table-state';
import { type Column } from '@/components/ui/DataTable';
import { RowActions } from '@/components/ui/RowActions';
import { Badge, Button } from '@/components/ui';
import SearchableDropdown from '@/components/ui/SearchableDropdown';
import { hrWorkTeamsApi, hrEmployeeGroupsApi, hrEmployeesApi } from '@/lib/api/hr';
import { useMyPermissions } from '@/lib/hooks/use-my-permissions';
import { toast, confirm } from '@/lib/hooks/use-toast';
import type { WorkTeam, EmployeeGroup, HREmployee } from '@/types';

// ── FormState ─────────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  name:           '',
  name_ar:        '',
  code:           '',
  description:    '',
  employee_group: null as number | null,
  supervisor:     null as number | null,
  is_active:      true,
};
type FormState = typeof EMPTY_FORM;

const LABEL: React.CSSProperties = {
  fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)',
  color: 'var(--text-secondary)', textTransform: 'uppercase',
  letterSpacing: '0.05em', display: 'block', marginBottom: 'var(--space-1-5)',
};

// ── Modal ─────────────────────────────────────────────────────────────────────

function TeamModal({
  team, groups, employees, onClose, onSave, isSaving,
}: {
  team: WorkTeam | null;
  groups: EmployeeGroup[];
  employees: HREmployee[];
  onClose: () => void;
  onSave: (data: FormState) => void;
  isSaving: boolean;
}) {
  const [form, setForm] = useState<FormState>(
    team ? {
      name:           team.name,
      name_ar:        team.name_ar,
      code:           team.code,
      description:    team.description,
      employee_group: team.employee_group,
      supervisor:     team.supervisor,
      is_active:      team.is_active,
    } : EMPTY_FORM,
  );
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm(p => ({ ...p, [k]: v }));

  const groupOptions = useMemo(() => [
    { value: '__none__', label: '— No group —', searchText: 'none' },
    ...groups.filter(g => g.is_active).map(g => ({ value: g.id, label: `${g.code} — ${g.name}`, searchText: `${g.code} ${g.name}` })),
  ], [groups]);

  const supervisorOptions = useMemo(() => [
    { value: '__none__', label: '— No supervisor —', searchText: 'none' },
    ...employees
      .filter(e => e.is_active)
      .map(e => ({ value: e.id, label: e.full_name, searchText: `${e.full_name} ${e.employee_id}` })),
  ], [employees]);

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 'var(--space-8) var(--space-4)', overflowY: 'auto' }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="card" style={{ width: '100%', maxWidth: 500, padding: 'var(--space-6)' }}>
        <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)', margin: '0 0 var(--space-5)' }}>
          {team ? 'Edit Team' : 'Create Work Team'}
        </h2>

        <form onSubmit={e => { e.preventDefault(); if (!form.name.trim()) return; onSave(form); }}
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>

          {/* Name */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            <div>
              <label style={LABEL}>Name <span style={{ color: 'var(--color-error)' }}>*</span></label>
              <input value={form.name} onChange={e => set('name', e.target.value)} required
                placeholder="e.g. Site Team A" className="form-input" style={{ width: '100%', fontSize: 'var(--text-sm)' }} />
            </div>
            <div>
              <label style={LABEL}>Name (Arabic)</label>
              <input value={form.name_ar} onChange={e => set('name_ar', e.target.value)}
                placeholder="الاسم بالعربية" className="form-input" dir="rtl" style={{ width: '100%', fontSize: 'var(--text-sm)' }} />
            </div>
          </div>

          {/* Code */}
          <div>
            <label style={LABEL}>Code</label>
            <input value={form.code}
              onChange={e => set('code', e.target.value.toUpperCase())}
              onBlur={e => set('code', e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '').trim())}
              placeholder="e.g. SITE_A_T1 (optional)"
              className="form-input" autoComplete="off"
              style={{ width: '100%', fontFamily: 'monospace', fontSize: 'var(--text-sm)' }} maxLength={30} />
          </div>

          {/* Group */}
          <div>
            <label style={LABEL}>Employee Category</label>
            <SearchableDropdown
              options={groupOptions}
              value={form.employee_group ?? '__none__'}
              onChange={v => set('employee_group', v === '__none__' ? null : v as number)}
              allowClear={false}
              placeholder="— No group —"
            />
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: 'var(--space-1) 0 0' }}>
              Which operational category this team belongs to (e.g. SITE).
            </p>
          </div>

          {/* Supervisor */}
          <div>
            <label style={LABEL}>Supervisor <span style={{ color: 'var(--color-error)' }}>*</span></label>
            <SearchableDropdown
              options={supervisorOptions}
              value={form.supervisor ?? '__none__'}
              onChange={v => set('supervisor', v === '__none__' ? null : v as number)}
              allowClear={false}
              placeholder="— Choose supervisor —"
            />
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: 'var(--space-1) 0 0' }}>
              All employees with this person as their Direct Manager will appear as team members.
            </p>
          </div>

          {/* Description */}
          <div>
            <label style={LABEL}>Description</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)}
              placeholder="Optional notes about this team" className="form-input" rows={2}
              style={{ width: '100%', fontSize: 'var(--text-sm)', resize: 'vertical' }} />
          </div>

          {/* Active toggle */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', cursor: 'pointer', userSelect: 'none' }}>
            <div onClick={() => set('is_active', !form.is_active)} style={{ width: 40, height: 22, borderRadius: 99, flexShrink: 0, background: form.is_active ? 'var(--brand)' : 'var(--border-default)', position: 'relative', cursor: 'pointer', transition: 'background 200ms' }}>
              <div style={{ position: 'absolute', top: 3, left: form.is_active ? 21 : 3, width: 16, height: 16, borderRadius: '50%', background: 'var(--primary-foreground)', transition: 'left 200ms', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
            </div>
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)' }}>
              {form.is_active ? 'Active' : 'Inactive'}
            </span>
          </label>

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', paddingTop: 'var(--space-2)', borderTop: '1px solid var(--border-subtle)' }}>
            <button type="button" onClick={onClose} disabled={isSaving}
              style={{ padding: 'var(--space-2) var(--space-4)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', background: 'none', cursor: 'pointer', fontSize: 'var(--text-sm)' }}>
              Cancel
            </button>
            <button type="submit" disabled={isSaving || !form.name.trim() || !form.supervisor}
              style={{ padding: 'var(--space-2) var(--space-5)', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--brand)', color: 'var(--primary-foreground)', cursor: 'pointer', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', opacity: isSaving || !form.supervisor ? 0.5 : 1 }}>
              {isSaving ? 'Saving…' : team ? 'Save Changes' : 'Create Team'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Members Drawer ─────────────────────────────────────────────────────────────

function MembersDrawer({ team, onClose }: { team: WorkTeam; onClose: () => void }) {
  const { data: members = [], isLoading } = useQuery({
    queryKey: ['hr-team-members', team.id],
    queryFn: () => hrWorkTeamsApi.getMembers(team.id),
    staleTime: 30_000,
  });

  return (
    <div style={{ position: 'fixed', top: 'var(--navbar-height)', right: 0, bottom: 0, left: 0, zIndex: 45, display: 'flex' }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ flex: 1, background: 'rgba(0,0,0,0.35)' }} onMouseDown={onClose} />
      <div style={{ width: 380, background: 'var(--surface-base)', boxShadow: '-4px 0 24px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: 'var(--space-5) var(--space-5) var(--space-4)', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
            <div>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Team Members</p>
              <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-bold)', margin: 0 }}>{team.name}</h3>
              {team.supervisor_name && (
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: '4px 0 0' }}>
                  Supervisor: <strong>{team.supervisor_name}</strong>
                </p>
              )}
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 18, lineHeight: 1, padding: 4 }}>✕</button>
          </div>
        </div>

        {/* Members list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-3)' }}>
          {isLoading ? (
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', padding: 'var(--space-4)', textAlign: 'center' }}>Loading…</p>
          ) : members.length === 0 ? (
            <div style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0 }}>No members yet.</p>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', margin: 'var(--space-2) 0 0' }}>
                Assign <strong>{team.supervisor_name ?? 'the supervisor'}</strong> as Direct Manager to employees to add them here.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
              {members.map(emp => (
                <div key={emp.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-2-5) var(--space-3)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--brand)', color: 'var(--primary-foreground)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', flexShrink: 0 }}>
                    {emp.full_name.slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emp.full_name}</p>
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: '1px 0 0' }}>
                      {emp.employee_id}{emp.position_title ? ` · ${emp.position_title}` : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ padding: 'var(--space-3) var(--space-4)', borderTop: '1px solid var(--border-subtle)', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
          {members.length} active {members.length === 1 ? 'member' : 'members'}
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function WorkTeamsPage() {
  const { hasPermission } = useMyPermissions();
  const admin = hasPermission('hr.hr_employee.view');
  const queryClient = useQueryClient();
  const tableState = useTableState();
  const { search } = tableState;

  const [modalTeam, setModalTeam]       = useState<WorkTeam | null | 'new'>(null);
  const [membersTeam, setMembersTeam]   = useState<WorkTeam | null>(null);

  const { data: teamsRaw, isLoading } = useQuery({
    queryKey: ['hr-work-teams'],
    queryFn: () => hrWorkTeamsApi.getAll(),
    staleTime: 60_000,
  });

  const { data: groupsRaw } = useQuery({
    queryKey: ['hr-employee-groups'],
    queryFn: () => hrEmployeeGroupsApi.getAll(),
    staleTime: 120_000,
  });

  const { data: employeesRaw } = useQuery({
    queryKey: ['hr-employees-all'],
    queryFn: () => hrEmployeesApi.getAll(),
    staleTime: 120_000,
  });

  const allTeams: WorkTeam[]       = teamsRaw?.results ?? [];
  const groups: EmployeeGroup[]    = groupsRaw?.results ?? [];
  const employees: HREmployee[]    = employeesRaw?.results ?? [];

  const filtered = !search
    ? allTeams
    : allTeams.filter(t =>
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        (t.name_ar && t.name_ar.includes(search)) ||
        (t.code && t.code.toLowerCase().includes(search.toLowerCase())) ||
        (t.supervisor_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (t.employee_group_name ?? '').toLowerCase().includes(search.toLowerCase())
      );

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['hr-work-teams'] });

  const createMutation = useMutation({
    mutationFn: (data: FormState) => hrWorkTeamsApi.create(data),
    onSuccess: () => { invalidate(); setModalTeam(null); toast('Team created', 'success'); },
    onError: () => toast('Failed to create team', 'error'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: FormState }) => hrWorkTeamsApi.update(id, data),
    onSuccess: () => { invalidate(); setModalTeam(null); toast('Team updated', 'success'); },
    onError: () => toast('Failed to update team', 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => hrWorkTeamsApi.delete(id),
    onSuccess: () => { invalidate(); toast('Team deleted', 'success'); },
    onError: () => toast('Failed to delete team', 'error'),
  });

  const handleSave = (data: FormState) => {
    if (modalTeam === 'new') createMutation.mutate(data);
    else if (modalTeam) updateMutation.mutate({ id: modalTeam.id, data });
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const columns: Column<WorkTeam>[] = [
    {
      key: 'name',
      header: 'Team',
      render: t => (
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</p>
          {t.name_ar && (
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: '2px 0 0', direction: 'rtl', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name_ar}</p>
          )}
          {t.code && (
            <span style={{ fontFamily: 'monospace', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{t.code}</span>
          )}
        </div>
      ),
    },
    {
      key: 'employee_group_name',
      header: 'Category',
      width: '110px',
      render: t => t.employee_group_name ? (
        <span style={{ fontFamily: 'monospace', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', color: 'var(--primary-foreground)', background: 'var(--brand)', padding: '2px 7px', borderRadius: 'var(--radius-sm)' }}>
          {groups.find(g => g.id === t.employee_group)?.code ?? t.employee_group_name}
        </span>
      ) : <span style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)' }}>—</span>,
    },
    {
      key: 'supervisor_name',
      header: 'Supervisor',
      width: '180px',
      render: t => t.supervisor_name ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: 'var(--brand)' }} />
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.supervisor_name}</span>
        </div>
      ) : <span style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)' }}>—</span>,
    },
    {
      key: 'member_count',
      header: 'Members',
      width: '80px',
      render: t => (
        <button
          onClick={() => setMembersTeam(t)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 'var(--text-sm)', color: t.member_count > 0 ? 'var(--brand)' : 'var(--text-secondary)', fontWeight: t.member_count > 0 ? 'var(--weight-semibold)' : 'var(--weight-normal)', textDecoration: t.member_count > 0 ? 'underline' : 'none', textUnderlineOffset: 2 }}
        >
          {t.member_count} {t.member_count === 1 ? 'member' : 'members'}
        </button>
      ),
    },
    {
      key: 'is_active',
      header: 'Status',
      width: '90px',
      render: t => <Badge variant={t.is_active ? 'active' : 'inactive'} size="sm">{t.is_active ? 'Active' : 'Inactive'}</Badge>,
    },
    {
      key: 'actions',
      header: '',
      width: '48px',
      render: t => (
        <RowActions actions={[
          { label: 'View Members', onClick: () => setMembersTeam(t) },
          { label: 'Edit', onClick: () => setModalTeam(t), hidden: !admin },
          { separator: true },
          { label: 'Delete', variant: 'danger', hidden: !admin, onClick: async () => {
            if (await confirm(`Delete team "${t.name}"?`)) deleteMutation.mutate(t.id);
          }},
        ]} />
      ),
    },
  ];

  return (
    <AppListPage
      title="Work Teams"
      description="Named sub-units within a category. Membership is derived from the Direct Manager field on each employee."
      breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'HR' }, { label: 'Work Teams' }]}
      totalCount={allTeams.length}
      createAction={admin ? (
        <Button variant="primary" size="sm" onClick={() => setModalTeam('new')}>+ Create Team</Button>
      ) : undefined}
      selectable={true}
      columns={columns}
      data={filtered}
      isLoading={isLoading}
      emptyTitle="No teams yet. Create a team and assign a supervisor to get started."
      tableState={tableState}
      searchPlaceholder="Search teams…"
    >
      {modalTeam !== null && (
        <TeamModal
          team={modalTeam === 'new' ? null : modalTeam}
          groups={groups}
          employees={employees}
          onClose={() => setModalTeam(null)}
          onSave={handleSave}
          isSaving={isSaving}
        />
      )}

      {membersTeam && (
        <MembersDrawer team={membersTeam} onClose={() => setMembersTeam(null)} />
      )}
    </AppListPage>
  );
}
