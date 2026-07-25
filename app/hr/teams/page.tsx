'use client';

import { useState, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AppListPage } from '@/components/app/AppListPage';
import { useTableState } from '@/lib/hooks/use-table-state';
import { type Column } from '@/components/ui/DataTable';
import { RowActions } from '@/components/ui/RowActions';
import { Badge, Button } from '@/components/ui';
import SearchableDropdown from '@/components/ui/SearchableDropdown';
import {
  hrWorkTeamsApi, hrEmployeeGroupsApi, hrEmployeesApi,
  hrDepartmentsApi, hrOfficeLocationsApi,
  hrTeamTypesApi, hrWorkTeamMembersApi,
} from '@/lib/api/hr';
import { projectsApi } from '@/lib/api/projects';
import { useMyPermissions } from '@/lib/hooks/use-my-permissions';
import { toast, confirm } from '@/lib/hooks/use-toast';
import type {
  WorkTeam, EmployeeGroup, HREmployee, HRDepartment,
  OfficeLocation, WorkTeamMember, TeamType, Project,
} from '@/types';

// ── Local types ───────────────────────────────────────────────────────────────

type TeamStatus = 'active' | 'inactive' | 'closed';
type MemberStatus = 'active' | 'inactive' | 'suspended';

// ── Team FormState ────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  name:           '',
  name_ar:        '',
  code:           '',
  description:    '',
  employee_group: null as number | null,
  supervisor:     null as number | null,
  department:     null as number | null,
  project:        null as number | null,
  location:       null as number | null,
  parent_team:    null as number | null,
  main_manager:   null as number | null,
  team_type:      null as number | null,
  status:         'active' as TeamStatus,
};
type FormState = typeof EMPTY_FORM;

// ── Member FormState ──────────────────────────────────────────────────────────

const EMPTY_MEMBER_FORM = {
  employee:   null as number | null,
  role:       '',
  status:     'active' as MemberStatus,
  is_primary: false,
  start_date: new Date().toISOString().slice(0, 10),
  end_date:   '',
};
type MemberFormState = typeof EMPTY_MEMBER_FORM;

// ── Transfer FormState ────────────────────────────────────────────────────────

const EMPTY_TRANSFER = {
  new_team:       null as number | null,
  effective_date: new Date().toISOString().slice(0, 10),
};
type TransferState = typeof EMPTY_TRANSFER;

// ── Shared style helpers ──────────────────────────────────────────────────────

const LABEL: React.CSSProperties = {
  fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)',
  color: 'var(--text-secondary)', textTransform: 'uppercase',
  letterSpacing: '0.05em', display: 'block', marginBottom: 'var(--space-1-5)',
};

const FORM_INPUT: React.CSSProperties = { width: '100%', fontSize: 'var(--text-sm)' };

function noneOpt(label: string) {
  return { value: '__none__', label, searchText: 'none' } as const;
}

// ── TeamModal ─────────────────────────────────────────────────────────────────

function TeamModal({
  team, groups, employees, departments, officeLocations, projects, teamTypes, allTeams, onClose, onSave, isSaving,
}: {
  team: WorkTeam | null;
  groups: EmployeeGroup[];
  employees: HREmployee[];
  departments: HRDepartment[];
  officeLocations: OfficeLocation[];
  projects: Project[];
  teamTypes: TeamType[];
  allTeams: WorkTeam[];
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
      department:     team.department ?? null,
      project:        team.project ?? null,
      location:       team.location ?? null,
      parent_team:    team.parent_team ?? null,
      main_manager:   team.main_manager ?? null,
      team_type:      team.team_type ?? null,
      status:         team.status ?? (team.is_active ? 'active' : 'inactive'),
    } : EMPTY_FORM,
  );

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm(p => ({ ...p, [k]: v }));

  const groupOptions = useMemo(() => [
    noneOpt('— No group —'),
    ...groups.filter(g => g.is_active).map(g => ({ value: g.id, label: `${g.code} — ${g.name}`, searchText: `${g.code} ${g.name}` })),
  ], [groups]);

  const supervisorOptions = useMemo(() => [
    noneOpt('— No supervisor —'),
    ...employees
      .filter(e => e.is_active)
      .map(e => ({ value: e.id, label: e.full_name, searchText: `${e.full_name} ${e.employee_id}` })),
  ], [employees]);

  const departmentOptions = useMemo(() => [
    noneOpt('— No department —'),
    ...departments.map(d => ({ value: d.id, label: d.name, searchText: d.name })),
  ], [departments]);

  const projectOptions = useMemo(() => [
    noneOpt('— No project —'),
    ...projects
      .filter(p => p.is_active)
      .map(p => ({ value: p.id, label: `${p.code} — ${p.name}`, searchText: `${p.code} ${p.name}` })),
  ], [projects]);

  const locationOptions = useMemo(() => [
    noneOpt('— No location —'),
    ...officeLocations
      .filter(l => l.is_active)
      .map(l => ({ value: l.id, label: l.name, searchText: l.name })),
  ], [officeLocations]);

  const parentOptions = useMemo(() => [
    noneOpt('— No parent —'),
    ...allTeams
      .filter(t => t.id !== team?.id)
      .map(t => ({ value: t.id, label: t.name, searchText: `${t.name} ${t.code}` })),
  ], [allTeams, team]);

  const managerOptions = useMemo(() => [
    noneOpt('— No manager —'),
    ...employees
      .filter(e => e.is_active && e.is_manager)
      .map(e => ({ value: e.id, label: e.full_name, searchText: `${e.full_name} ${e.employee_id}` })),
  ], [employees]);

  const teamTypeOptions = useMemo(() => [
    noneOpt('— No type —'),
    ...teamTypes
      .filter(t => t.is_active)
      .map(t => ({ value: t.id, label: t.name, searchText: `${t.name} ${t.code}` })),
  ], [teamTypes]);

  const statusOptions = [
    { value: 'active',   label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
    { value: 'closed',   label: 'Closed' },
  ];

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 'var(--space-8) var(--space-4)', overflowY: 'auto' }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="card" style={{ width: '100%', maxWidth: 640, padding: 'var(--space-6)' }}>
        <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)', margin: '0 0 var(--space-5)' }}>
          {team ? 'Edit Team' : 'Create Work Team'}
        </h2>

        <form
          onSubmit={e => { e.preventDefault(); if (!form.name.trim()) return; onSave(form); }}
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}
        >
          {/* Name row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            <div>
              <label style={LABEL}>Name <span style={{ color: 'var(--color-error)' }}>*</span></label>
              <input value={form.name} onChange={e => set('name', e.target.value)} required
                placeholder="e.g. Site Team A" className="form-input" style={FORM_INPUT} />
            </div>
            <div>
              <label style={LABEL}>Name (Arabic)</label>
              <input value={form.name_ar} onChange={e => set('name_ar', e.target.value)}
                placeholder="الاسم بالعربية" className="form-input" dir="rtl" style={FORM_INPUT} />
            </div>
          </div>

          {/* Code + Status row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            <div>
              <label style={LABEL}>Code</label>
              <input
                value={form.code}
                onChange={e => set('code', e.target.value.toUpperCase())}
                onBlur={e => set('code', e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '').trim())}
                placeholder="e.g. SITE_A_T1 (optional)"
                className="form-input" autoComplete="off"
                style={{ ...FORM_INPUT, fontFamily: 'monospace' }} maxLength={30}
              />
            </div>
            <div>
              <label style={LABEL}>Status</label>
              <select
                value={form.status}
                onChange={e => set('status', e.target.value as TeamStatus)}
                className="form-input"
                style={FORM_INPUT}
              >
                {statusOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          {/* Employee Category + Supervisor */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            <div>
              <label style={LABEL}>Employee Category</label>
              <SearchableDropdown
                options={groupOptions}
                value={form.employee_group ?? '__none__'}
                onChange={v => set('employee_group', v === '__none__' ? null : v as number)}
                allowClear={false}
                placeholder="— No group —"
              />
            </div>
            <div>
              <label style={LABEL}>Supervisor <span style={{ color: 'var(--color-error)' }}>*</span></label>
              <SearchableDropdown
                options={supervisorOptions}
                value={form.supervisor ?? '__none__'}
                onChange={v => set('supervisor', v === '__none__' ? null : v as number)}
                allowClear={false}
                placeholder="— Choose supervisor —"
              />
            </div>
          </div>

          {/* Department + Team Type */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            <div>
              <label style={LABEL}>Department</label>
              <SearchableDropdown
                options={departmentOptions}
                value={form.department ?? '__none__'}
                onChange={v => set('department', v === '__none__' ? null : v as number)}
                allowClear={false}
                placeholder="— No department —"
              />
            </div>
            <div>
              <label style={LABEL}>Team Type</label>
              <SearchableDropdown
                options={teamTypeOptions}
                value={form.team_type ?? '__none__'}
                onChange={v => set('team_type', v === '__none__' ? null : v as number)}
                allowClear={false}
                placeholder="— No type —"
              />
            </div>
          </div>

          {/* Project + Location */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            <div>
              <label style={LABEL}>Project</label>
              <SearchableDropdown
                options={projectOptions}
                value={form.project ?? '__none__'}
                onChange={v => set('project', v === '__none__' ? null : v as number)}
                allowClear={false}
                placeholder="— No project —"
              />
            </div>
            <div>
              <label style={LABEL}>Location</label>
              <SearchableDropdown
                options={locationOptions}
                value={form.location ?? '__none__'}
                onChange={v => set('location', v === '__none__' ? null : v as number)}
                allowClear={false}
                placeholder="— No location —"
              />
            </div>
          </div>

          {/* Parent Team + Main Manager */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            <div>
              <label style={LABEL}>Parent Team</label>
              <SearchableDropdown
                options={parentOptions}
                value={form.parent_team ?? '__none__'}
                onChange={v => set('parent_team', v === '__none__' ? null : v as number)}
                allowClear={false}
                placeholder="— No parent —"
              />
            </div>
            <div>
              <label style={LABEL}>Main Manager</label>
              <SearchableDropdown
                options={managerOptions}
                value={form.main_manager ?? '__none__'}
                onChange={v => set('main_manager', v === '__none__' ? null : v as number)}
                allowClear={false}
                placeholder="— No manager —"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label style={LABEL}>Description</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)}
              placeholder="Optional notes about this team" className="form-input" rows={2}
              style={{ width: '100%', fontSize: 'var(--text-sm)', resize: 'vertical' }} />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', paddingTop: 'var(--space-2)', borderTop: '1px solid var(--border-subtle)' }}>
            <button type="button" onClick={onClose} disabled={isSaving}
              style={{ padding: 'var(--space-2) var(--space-4)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', background: 'none', cursor: 'pointer', fontSize: 'var(--text-sm)' }}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || !form.name.trim()}
              style={{ padding: 'var(--space-2) var(--space-5)', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--brand)', color: 'var(--primary-foreground)', cursor: 'pointer', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', opacity: isSaving || !form.name.trim() ? 0.5 : 1 }}
            >
              {isSaving ? 'Saving…' : team ? 'Save Changes' : 'Create Team'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── AddMemberModal ────────────────────────────────────────────────────────────

function AddMemberModal({
  teamId, employees, onClose, onSave, isSaving,
}: {
  teamId: number;
  employees: HREmployee[];
  onClose: () => void;
  onSave: (data: MemberFormState) => void;
  isSaving: boolean;
}) {
  const [form, setForm] = useState<MemberFormState>({ ...EMPTY_MEMBER_FORM });
  const set = <K extends keyof MemberFormState>(k: K, v: MemberFormState[K]) =>
    setForm(p => ({ ...p, [k]: v }));

  const empOptions = useMemo(() => [
    noneOpt('— Select employee —'),
    ...employees
      .filter(e => e.is_active)
      .map(e => ({ value: e.id, label: e.full_name, searchText: `${e.full_name} ${e.employee_id}` })),
  ], [employees]);

  const memberStatusOptions: { value: MemberStatus; label: string }[] = [
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
    { value: 'suspended', label: 'Suspended' },
  ];

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 55, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 'var(--space-8) var(--space-4)', overflowY: 'auto' }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="card" style={{ width: '100%', maxWidth: 480, padding: 'var(--space-6)' }}>
        <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)', margin: '0 0 var(--space-5)' }}>Add Team Member</h2>

        <form
          onSubmit={e => { e.preventDefault(); if (!form.employee) return; onSave(form); }}
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}
        >
          <div>
            <label style={LABEL}>Employee <span style={{ color: 'var(--color-error)' }}>*</span></label>
            <SearchableDropdown
              options={empOptions}
              value={form.employee ?? '__none__'}
              onChange={v => set('employee', v === '__none__' ? null : v as number)}
              allowClear={false}
              placeholder="— Select employee —"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            <div>
              <label style={LABEL}>Role</label>
              <input value={form.role} onChange={e => set('role', e.target.value)}
                placeholder="e.g. Site Lead" className="form-input" style={FORM_INPUT} />
            </div>
            <div>
              <label style={LABEL}>Status</label>
              <select value={form.status} onChange={e => set('status', e.target.value as MemberStatus)}
                className="form-input" style={FORM_INPUT}>
                {memberStatusOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            <div>
              <label style={LABEL}>Start Date</label>
              <input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)}
                className="form-input" style={FORM_INPUT} />
            </div>
            <div>
              <label style={LABEL}>End Date (optional)</label>
              <input type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)}
                className="form-input" style={FORM_INPUT} />
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer', userSelect: 'none', fontSize: 'var(--text-sm)' }}>
            <input
              type="checkbox"
              checked={form.is_primary}
              onChange={e => set('is_primary', e.target.checked)}
              style={{ width: 16, height: 16, cursor: 'pointer' }}
            />
            Primary assignment
          </label>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', paddingTop: 'var(--space-2)', borderTop: '1px solid var(--border-subtle)' }}>
            <button type="button" onClick={onClose} disabled={isSaving}
              style={{ padding: 'var(--space-2) var(--space-4)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', background: 'none', cursor: 'pointer', fontSize: 'var(--text-sm)' }}>
              Cancel
            </button>
            <button type="submit" disabled={isSaving || !form.employee}
              style={{ padding: 'var(--space-2) var(--space-5)', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--brand)', color: 'var(--primary-foreground)', cursor: 'pointer', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', opacity: isSaving || !form.employee ? 0.5 : 1 }}>
              {isSaving ? 'Adding…' : 'Add Member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── TransferModal ─────────────────────────────────────────────────────────────

function TransferModal({
  member, allTeams, currentTeamId, onClose, onTransfer, isSaving,
}: {
  member: WorkTeamMember;
  allTeams: WorkTeam[];
  currentTeamId: number;
  onClose: () => void;
  onTransfer: (data: TransferState) => void;
  isSaving: boolean;
}) {
  const [form, setForm] = useState<TransferState>({ ...EMPTY_TRANSFER });
  const set = <K extends keyof TransferState>(k: K, v: TransferState[K]) =>
    setForm(p => ({ ...p, [k]: v }));

  const teamOptions = useMemo(() => [
    noneOpt('— Select target team —'),
    ...allTeams
      .filter(t => t.id !== currentTeamId)
      .map(t => ({ value: t.id, label: t.name, searchText: `${t.name} ${t.code ?? ''}` })),
  ], [allTeams, currentTeamId]);

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 55, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 'var(--space-8) var(--space-4)', overflowY: 'auto' }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="card" style={{ width: '100%', maxWidth: 420, padding: 'var(--space-6)' }}>
        <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)', margin: '0 0 var(--space-1)' }}>Transfer Member</h2>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: '0 0 var(--space-5)' }}>
          Moving <strong>{member.employee_name}</strong> to a different team.
        </p>

        <form
          onSubmit={e => { e.preventDefault(); if (!form.new_team) return; onTransfer(form); }}
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}
        >
          <div>
            <label style={LABEL}>Target Team <span style={{ color: 'var(--color-error)' }}>*</span></label>
            <SearchableDropdown
              options={teamOptions}
              value={form.new_team ?? '__none__'}
              onChange={v => set('new_team', v === '__none__' ? null : v as number)}
              allowClear={false}
              placeholder="— Select target team —"
            />
          </div>

          <div>
            <label style={LABEL}>Effective Date <span style={{ color: 'var(--color-error)' }}>*</span></label>
            <input type="date" value={form.effective_date} onChange={e => set('effective_date', e.target.value)}
              className="form-input" style={FORM_INPUT} required />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', paddingTop: 'var(--space-2)', borderTop: '1px solid var(--border-subtle)' }}>
            <button type="button" onClick={onClose} disabled={isSaving}
              style={{ padding: 'var(--space-2) var(--space-4)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', background: 'none', cursor: 'pointer', fontSize: 'var(--text-sm)' }}>
              Cancel
            </button>
            <button type="submit" disabled={isSaving || !form.new_team}
              style={{ padding: 'var(--space-2) var(--space-5)', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--brand)', color: 'var(--primary-foreground)', cursor: 'pointer', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', opacity: isSaving || !form.new_team ? 0.5 : 1 }}>
              {isSaving ? 'Transferring…' : 'Transfer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── MembersDrawer ─────────────────────────────────────────────────────────────

function memberStatusVariant(status: MemberStatus): 'active' | 'inactive' | 'warning' {
  if (status === 'active') return 'active';
  if (status === 'suspended') return 'warning';
  return 'inactive';
}

function MembersDrawer({
  team, allTeams, employees, admin, onClose,
}: {
  team: WorkTeam;
  allTeams: WorkTeam[];
  employees: HREmployee[];
  admin: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [transferMember, setTransferMember] = useState<WorkTeamMember | null>(null);

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['hr-team-members', team.id],
    queryFn: () => hrWorkTeamMembersApi.getWorkTeamMembers({ work_team_id: team.id }),
    staleTime: 30_000,
  });

  const invalidateMembers = () => {
    queryClient.invalidateQueries({ queryKey: ['hr-team-members', team.id] });
    queryClient.invalidateQueries({ queryKey: ['hr-work-teams'] });
  };

  const addMutation = useMutation({
    mutationFn: (data: MemberFormState) =>
      hrWorkTeamMembersApi.createWorkTeamMember({
        work_team: team.id,
        employee: data.employee!,
        role: data.role,
        status: data.status,
        is_primary: data.is_primary,
        start_date: data.start_date,
        end_date: data.end_date || null,
      }),
    onSuccess: () => { invalidateMembers(); setAddOpen(false); toast('Member added', 'success'); },
    onError:   () => toast('Failed to add member', 'error'),
  });

  const transferMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: { new_team_id: number; effective_date?: string } }) =>
      hrWorkTeamMembersApi.transferTeamMember(id, payload),
    onSuccess: () => { invalidateMembers(); setTransferMember(null); toast('Member transferred', 'success'); },
    onError:   () => toast('Failed to transfer member', 'error'),
  });

  const removeMutation = useMutation({
    mutationFn: (id: number) => hrWorkTeamMembersApi.deleteWorkTeamMember(id),
    onSuccess: () => { invalidateMembers(); toast('Member removed', 'success'); },
    onError:   () => toast('Failed to remove member', 'error'),
  });

  const handleRemove = async (m: WorkTeamMember) => {
    if (await confirm(`Remove ${m.employee_name} from this team?`)) {
      removeMutation.mutate(m.id);
    }
  };

  const formatDate = (d: string | null | undefined) =>
    d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  return (
    <>
      <div
        style={{ position: 'fixed', top: 'var(--navbar-height, 0px)', right: 0, bottom: 0, left: 0, zIndex: 45, display: 'flex' }}
        onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div style={{ flex: 1, background: 'rgba(0,0,0,0.35)' }} onMouseDown={onClose} />
        <div style={{ width: 640, maxWidth: '95vw', background: 'var(--surface-base)', boxShadow: '-4px 0 24px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Header */}
          <div style={{ padding: 'var(--space-5)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-3)', flexShrink: 0 }}>
            <div>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Team Members</p>
              <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-bold)', margin: 0 }}>{team.name}</h3>
              {team.supervisor_name && (
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: '4px 0 0' }}>
                  Supervisor: <strong>{team.supervisor_name}</strong>
                </p>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              {admin && (
                <button
                  onClick={() => setAddOpen(true)}
                  style={{ padding: 'var(--space-1-5) var(--space-3)', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--brand)', color: 'var(--primary-foreground)', cursor: 'pointer', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', whiteSpace: 'nowrap' }}
                >
                  + Add Member
                </button>
              )}
              <button
                onClick={onClose}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 18, lineHeight: 1, padding: 4 }}
              >
                ✕
              </button>
            </div>
          </div>

          {/* Members table */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {isLoading ? (
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', padding: 'var(--space-6)', textAlign: 'center' }}>Loading…</p>
            ) : members.length === 0 ? (
              <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0 }}>No members yet.</p>
                {admin && (
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', margin: 'var(--space-2) 0 0' }}>
                    Use the Add Member button to assign employees to this team.
                  </p>
                )}
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
                  <thead>
                    <tr style={{ background: 'var(--surface-raised)' }}>
                      {['Employee', 'Role', 'Status', 'Primary', 'Start', 'End', ''].map(h => (
                        <th key={h} style={{ padding: 'var(--space-2-5) var(--space-3)', textAlign: 'left', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-subtle)', whiteSpace: 'nowrap' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {members.map(m => (
                      <tr key={m.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: 'var(--space-2-5) var(--space-3)' }}>
                          <p style={{ margin: 0, fontWeight: 'var(--weight-medium)', whiteSpace: 'nowrap' }}>{m.employee_name}</p>
                          {m.employee_id && (
                            <p style={{ margin: '1px 0 0', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{m.employee_id}</p>
                          )}
                        </td>
                        <td style={{ padding: 'var(--space-2-5) var(--space-3)', color: m.role ? 'var(--text-primary)' : 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                          {m.role || '—'}
                        </td>
                        <td style={{ padding: 'var(--space-2-5) var(--space-3)' }}>
                          <Badge variant={memberStatusVariant(m.status)} size="sm" style={{ textTransform: 'capitalize' }}>
                            {m.status}
                          </Badge>
                        </td>
                        <td style={{ padding: 'var(--space-2-5) var(--space-3)', textAlign: 'center' }}>
                          {m.is_primary ? (
                            <span style={{ fontSize: 'var(--text-xs)', background: 'var(--brand)', color: 'var(--primary-foreground)', padding: '1px 6px', borderRadius: 'var(--radius-sm)', fontWeight: 'var(--weight-semibold)' }}>Yes</span>
                          ) : (
                            <span style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)' }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: 'var(--space-2-5) var(--space-3)', whiteSpace: 'nowrap', color: 'var(--text-secondary)', fontSize: 'var(--text-xs)' }}>
                          {formatDate(m.start_date)}
                        </td>
                        <td style={{ padding: 'var(--space-2-5) var(--space-3)', whiteSpace: 'nowrap', color: 'var(--text-secondary)', fontSize: 'var(--text-xs)' }}>
                          {formatDate(m.end_date)}
                        </td>
                        <td style={{ padding: 'var(--space-2-5) var(--space-3)' }}>
                          {admin && (
                            <div style={{ display: 'flex', gap: 'var(--space-1-5)' }}>
                              <button
                                onClick={() => setTransferMember(m)}
                                title="Transfer to another team"
                                style={{ padding: 'var(--space-1) var(--space-2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)', background: 'none', cursor: 'pointer', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}
                              >
                                Transfer
                              </button>
                              <button
                                onClick={() => handleRemove(m)}
                                disabled={removeMutation.isPending}
                                title="Remove from team"
                                style={{ padding: 'var(--space-1) var(--space-2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-error)', background: 'none', cursor: 'pointer', fontSize: 'var(--text-xs)', color: 'var(--color-error)', whiteSpace: 'nowrap', opacity: removeMutation.isPending ? 0.5 : 1 }}
                              >
                                Remove
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ padding: 'var(--space-3) var(--space-5)', borderTop: '1px solid var(--border-subtle)', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', flexShrink: 0 }}>
            {members.length} {members.length === 1 ? 'member' : 'members'}
          </div>
        </div>
      </div>

      {addOpen && (
        <AddMemberModal
          teamId={team.id}
          employees={employees}
          onClose={() => setAddOpen(false)}
          onSave={data => addMutation.mutate(data)}
          isSaving={addMutation.isPending}
        />
      )}

      {transferMember && (
        <TransferModal
          member={transferMember}
          allTeams={allTeams}
          currentTeamId={team.id}
          onClose={() => setTransferMember(null)}
          onTransfer={data =>
            transferMutation.mutate({ id: transferMember.id, payload: { new_team_id: data.new_team!, effective_date: data.effective_date } })
          }
          isSaving={transferMutation.isPending}
        />
      )}
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function WorkTeamsPage() {
  const { hasPermission } = useMyPermissions();
  // `admin` gates every write action on this management page (create/edit/delete
  // team + add/remove members). It must require the WRITE permission the backend
  // enforces (hr_employee.create), not 'view' which regular employees hold.
  const admin = hasPermission('hr.hr_employee.create');
  const queryClient = useQueryClient();
  const tableState = useTableState();
  const { search } = tableState;

  const [modalTeam,   setModalTeam]   = useState<WorkTeam | null | 'new'>(null);
  const [membersTeam, setMembersTeam] = useState<WorkTeam | null>(null);

  // ── Queries ──

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

  const { data: departmentsRaw } = useQuery({
    queryKey: ['hr-departments'],
    queryFn: () => hrDepartmentsApi.getAll({ page_size: 200 }),
    staleTime: 120_000,
  });

  const { data: officeLocationsRaw } = useQuery({
    queryKey: ['hr-office-locations'],
    queryFn: () => hrOfficeLocationsApi.getAll({ is_active: true }),
    staleTime: 120_000,
  });

  const { data: projectsRaw } = useQuery({
    queryKey: ['projects-all'],
    queryFn: () => projectsApi.getAll({ page_size: 200, is_active: true }),
    staleTime: 120_000,
  });

  const { data: teamTypesRaw } = useQuery({
    queryKey: ['hr-team-types'],
    queryFn: () => hrTeamTypesApi.getAll(),
    staleTime: 120_000,
  });

  const allTeams: WorkTeam[]          = teamsRaw?.results          ?? [];
  const groups: EmployeeGroup[]        = groupsRaw?.results          ?? [];
  const employees: HREmployee[]        = employeesRaw?.results        ?? [];
  const departments: HRDepartment[]    = departmentsRaw?.results      ?? [];
  const officeLocations: OfficeLocation[] = officeLocationsRaw?.results ?? [];
  const projects: Project[]            = projectsRaw?.results          ?? [];
  const teamTypes: TeamType[]          = teamTypesRaw?.results          ?? [];

  // ── Filtered list ──

  const filtered = !search
    ? allTeams
    : allTeams.filter(t =>
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        (t.name_ar && t.name_ar.includes(search)) ||
        (t.code && t.code.toLowerCase().includes(search.toLowerCase())) ||
        (t.supervisor_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (t.employee_group_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (t.department_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (t.project_name ?? '').toLowerCase().includes(search.toLowerCase()),
      );

  // ── Mutations ──

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['hr-work-teams'] });

  const createMutation = useMutation({
    mutationFn: (data: FormState) =>
      hrWorkTeamsApi.create({ ...data, is_active: data.status === 'active' }),
    onSuccess: () => { invalidate(); setModalTeam(null); toast('Team created', 'success'); },
    onError:   () => toast('Failed to create team', 'error'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: FormState }) =>
      hrWorkTeamsApi.update(id, { ...data, is_active: data.status === 'active' }),
    onSuccess: () => { invalidate(); setModalTeam(null); toast('Team updated', 'success'); },
    onError:   () => toast('Failed to update team', 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => hrWorkTeamsApi.delete(id),
    onSuccess: () => { invalidate(); toast('Team deleted', 'success'); },
    onError:   () => toast('Failed to delete team', 'error'),
  });

  const handleSave = (data: FormState) => {
    if (modalTeam === 'new') createMutation.mutate(data);
    else if (modalTeam) updateMutation.mutate({ id: modalTeam.id, data });
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  // ── Status badge helper ──

  function teamStatusBadge(t: WorkTeam) {
    const s = t.status ?? (t.is_active ? 'active' : 'inactive');
    if (s === 'active')   return <Badge variant="active"   size="sm">Active</Badge>;
    if (s === 'closed')   return <Badge variant="inactive" size="sm" style={{ opacity: 0.7 }}>Closed</Badge>;
    return <Badge variant="inactive" size="sm">Inactive</Badge>;
  }

  // ── Member count badge ──

  function memberCountBadge(t: WorkTeam) {
    const count = t.member_count ?? 0;
    return (
      <button
        onClick={() => setMembersTeam(t)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          fontSize: 'var(--text-sm)',
          color: count > 0 ? 'var(--brand)' : 'var(--text-secondary)',
          fontWeight: count > 0 ? 'var(--weight-semibold)' : 'var(--weight-normal)',
          textDecoration: count > 0 ? 'underline' : 'none',
          textUnderlineOffset: 2,
        }}
      >
        {count} {count === 1 ? 'member' : 'members'}
      </button>
    );
  }

  // ── Columns ──

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
      width: '90px',
      render: memberCountBadge,
    },
    {
      key: 'is_active',
      header: 'Status',
      width: '90px',
      render: teamStatusBadge,
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
          departments={departments}
          officeLocations={officeLocations}
          projects={projects}
          teamTypes={teamTypes}
          allTeams={allTeams}
          onClose={() => setModalTeam(null)}
          onSave={handleSave}
          isSaving={isSaving}
        />
      )}

      {membersTeam && (
        <MembersDrawer
          team={membersTeam}
          allTeams={allTeams}
          employees={employees}
          admin={admin}
          onClose={() => setMembersTeam(null)}
        />
      )}
    </AppListPage>
  );
}
