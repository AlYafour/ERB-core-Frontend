'use client';

import { useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import MainLayout from '@/components/layout/MainLayout';
import { hrEmployeesApi, hrDepartmentsApi, hrPositionsApi } from '@/lib/api/hr';
import { usersApi } from '@/lib/api/users';
import { useAuth } from '@/lib/hooks/use-auth';
import { useMyPermissions } from '@/lib/hooks/use-my-permissions';
import { toast } from '@/lib/hooks/use-toast';
import { Button, Badge, PageShell, PageHeader, Drawer, Loader } from '@/components/ui';
import { rolesApi, Role, UserRoles, AdditionalRoleAssignment } from '@/lib/api/roles';
import { HREmployee } from '@/types';

// ── Helpers ────────────────────────────────────────────────────────────────────

function calcAge(dob: string | null): string {
  if (!dob) return '—';
  const age = new Date().getFullYear() - new Date(dob).getFullYear();
  return `${age} Years Old`;
}

function calcPeriod(joinDate: string): string {
  const start = new Date(joinDate);
  const now   = new Date();
  let y = now.getFullYear() - start.getFullYear();
  let m = now.getMonth()    - start.getMonth();
  let d = now.getDate()     - start.getDate();
  if (d < 0) { m--; d += 30; }
  if (m < 0) { y--; m += 12; }
  const parts: string[] = [];
  if (y > 0) parts.push(`${y} year${y > 1 ? 's' : ''}`);
  if (m > 0) parts.push(`${m} month${m > 1 ? 's' : ''}`);
  if (d > 0) parts.push(`${d} day${d > 1 ? 's' : ''}`);
  return parts.join(', ') || '< 1 day';
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

const empTypeLabel: Record<string, string> = {
  full_time: 'Full Time', part_time: 'Part Time', contract: 'Contract', intern: 'Intern',
};

const ROLES = [
  { value: 'site_engineer',       label: 'Site Engineer' },
  { value: 'procurement_manager', label: 'Procurement Manager' },
  { value: 'procurement_officer', label: 'Procurement Officer' },
  { value: 'super_admin',         label: 'Super Admin' },
];

const TABS = [
  'Profile', 'Roles', 'Bank Accounts', 'Family Info', 'Documents', 'Competencies',
  'Insurance', 'Air Ticket', 'Timeoff Setup', 'Assets', 'Projects', 'Contracts',
];

// ── Form field classes (design system) ────────────────────────────────────────
const inp = 'form-input';
const ta  = 'form-textarea';
const sel = 'form-select';
const fld = 'form-field';
const lbl = 'form-label';

// ── Sub-components ─────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <div className="info-label">{label}</div>
      <div className="info-value">{value || '—'}</div>
    </div>
  );
}

function SectionHead({ title, onEdit, isAdmin }: { title: string; onEdit?: () => void; isAdmin?: boolean }) {
  return (
    <div className="section-head">
      <h3 className="section-head-title">{title}</h3>
      {isAdmin && onEdit && (
        <button onClick={onEdit} className="section-edit-btn">Edit</button>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

// ── Roles Tab ─────────────────────────────────────────────────────────────────

function RolesTab({ empUserId, isAdmin }: { empUserId?: number; isAdmin: boolean }) {
  const queryClient = useQueryClient();

  const { data: userRoles, isLoading } = useQuery({
    queryKey: ['user-roles', empUserId],
    queryFn: () => rolesApi.getUserRoles(empUserId!),
    enabled: !!empUserId,
    staleTime: 60_000,
  });

  const { data: allRoles = [] } = useQuery({
    queryKey: ['roles'],
    queryFn: () => rolesApi.getAll(),
    enabled: isAdmin,
    staleTime: 300_000,
  });

  const assignMutation = useMutation({
    mutationFn: ({ roleId, roleType }: { roleId: number; roleType: 'primary' | 'additional' }) =>
      rolesApi.assignToUser(roleId, empUserId!, roleType),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-roles', empUserId] });
      toast('Role assigned', 'success');
    },
    onError: (err: any) => toast(err?.response?.data?.detail ?? 'Failed to assign role', 'error'),
  });

  const unassignMutation = useMutation({
    mutationFn: ({ roleId, roleType }: { roleId: number; roleType: 'primary' | 'additional' }) =>
      rolesApi.unassignFromUser(roleId, empUserId!, roleType),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-roles', empUserId] });
      toast('Role removed', 'success');
    },
    onError: (err: any) => toast(err?.response?.data?.detail ?? 'Failed to remove role', 'error'),
  });

  if (!empUserId) return <p style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>No linked user account.</p>;
  if (isLoading) return <Loader />;
  if (!userRoles) return null;

  const additionalRoleIds = new Set(userRoles.additional_roles.map((a) => a.role.id));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>

      {/* Primary role */}
      <div className="card">
        <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: 'var(--space-3)' }}>Primary Role</h3>
        {userRoles.primary_role ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: userRoles.primary_role.color || 'var(--border-subtle)', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{userRoles.primary_role.name}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Level {userRoles.primary_role.level} · {userRoles.primary_role.permissions_count} permissions</div>
            </div>
            {isAdmin && (
              <Button
                variant="ghost"
                size="sm"
                style={{ color: 'var(--error)' }}
                disabled={unassignMutation.isPending}
                onClick={() => unassignMutation.mutate({ roleId: userRoles.primary_role!.id, roleType: 'primary' })}
              >
                Remove
              </Button>
            )}
          </div>
        ) : (
          <p style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)' }}>No primary role assigned.</p>
        )}
        {isAdmin && (
          <div style={{ marginTop: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <select
              className="form-select"
              style={{ maxWidth: 240 }}
              defaultValue=""
              onChange={(e) => {
                if (!e.target.value) return;
                assignMutation.mutate({ roleId: Number(e.target.value), roleType: 'primary' });
                e.target.value = '';
              }}
            >
              <option value="">Set primary role…</option>
              {allRoles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Additional roles */}
      <div className="card">
        <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: 'var(--space-3)' }}>Additional Roles</h3>
        {userRoles.additional_roles.length === 0 ? (
          <p style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)' }}>No additional roles assigned.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {userRoles.additional_roles.map((assignment) => (
              <div key={assignment.assignment_id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-2)', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--surface-subtle)' }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: assignment.role.color || 'var(--border-subtle)', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{assignment.role.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                    Level {assignment.role.level}
                    {assignment.granted_by && ` · Granted by ${assignment.granted_by}`}
                  </div>
                </div>
                {isAdmin && (
                  <Button
                    variant="ghost"
                    size="sm"
                    style={{ color: 'var(--error)' }}
                    disabled={unassignMutation.isPending}
                    onClick={() => unassignMutation.mutate({ roleId: assignment.role.id, roleType: 'additional' })}
                  >
                    Remove
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
        {isAdmin && (
          <div style={{ marginTop: 'var(--space-3)' }}>
            <select
              className="form-select"
              style={{ maxWidth: 240 }}
              defaultValue=""
              onChange={(e) => {
                if (!e.target.value) return;
                assignMutation.mutate({ roleId: Number(e.target.value), roleType: 'additional' });
                e.target.value = '';
              }}
            >
              <option value="">Add additional role…</option>
              {allRoles.filter((r) => !additionalRoleIds.has(r.id)).map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Effective permissions */}
      {userRoles.effective_permissions.length > 0 && (
        <div className="card">
          <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: 'var(--space-3)' }}>
            Effective Permissions ({userRoles.effective_permissions.length})
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            {userRoles.effective_permissions.map((p) => (
              <span key={p} style={{ fontSize: '0.6875rem', padding: '2px 8px', borderRadius: 4, background: 'var(--surface-subtle)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)', fontFamily: 'monospace' }}>
                {p}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const { isTenantAdmin, isPlatformAdmin } = useMyPermissions();
  const isAdmin = isTenantAdmin || isPlatformAdmin || ['hr_manager', 'hr_secretary', 'company_director'].includes(currentUser?.role ?? '');

  const [activeTab,     setActiveTab]     = useState('Profile');
  const [editSection,   setEditSection]   = useState<'personal' | 'professional' | 'contact' | 'legal' | 'salary' | 'account' | null>(null);
  const [form,          setForm]          = useState<Record<string, any>>({});
  const [avatarFile,    setAvatarFile]    = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [changePassword, setChangePassword] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: emp, isLoading, error } = useQuery<HREmployee>({
    queryKey: ['hr-employee', id],
    queryFn:  () => hrEmployeesApi.getById(Number(id)),
  });
  const { data: depts }     = useQuery({ queryKey: ['hr-departments-all'], queryFn: () => hrDepartmentsApi.getAll({ page: 1 }), staleTime: 300_000 });
  const { data: positions } = useQuery({ queryKey: ['hr-positions-all'],   queryFn: () => hrPositionsApi.getAll({ page: 1 }), staleTime: 300_000 });
  const { data: summary }   = useQuery({
    queryKey: ['hr-emp-summary', id],
    queryFn:  () => hrEmployeesApi.getAttendanceSummary(Number(id)),
    enabled:  !!id,
    staleTime: 60_000,
  });

  // ── Mutations ──────────────────────────────────────────────────────────────
  const updateMutation = useMutation({
    mutationFn: (data: any) => hrEmployeesApi.update(Number(id), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-employee', id] });
      queryClient.invalidateQueries({ queryKey: ['hr-employees'] });
      toast('Saved successfully', 'success');
      setEditSection(null);
    },
    onError: () => toast('Failed to save', 'error'),
  });

  const userUpdateMutation = useMutation({
    mutationFn: (data: any) =>
      usersApi.update(emp!.user!.id, { ...data, ...(avatarFile ? { avatar: avatarFile } : {}) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-employee', id] });
      toast('Account updated', 'success');
      setEditSection(null);
      setAvatarFile(null);
      setAvatarPreview(null);
      setChangePassword(false);
    },
    onError: () => toast('Failed to update account', 'error'),
  });

  const isSaving = updateMutation.isPending || userUpdateMutation.isPending;

  // ── Handlers ──────────────────────────────────────────────────────────────
  const f = (key: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(p => ({ ...p, [key]: e.target.value }));

  const openEdit = (section: typeof editSection) => {
    if (!emp) return;
    setAvatarFile(null);
    setAvatarPreview(null);
    setChangePassword(false);
    setForm({
      salary_display_name:  emp.salary_display_name || '',
      gender:               emp.gender || '',
      date_of_birth:        emp.date_of_birth || '',
      nationality:          emp.nationality || '',
      home_country:         emp.home_country || '',
      religion:             emp.religion || '',
      national_id:          emp.national_id || '',
      passport_number:      emp.passport_number || '',
      passport_issue_date:  emp.passport_issue_date || '',
      passport_expiry_date: emp.passport_expiry_date || '',
      personal_email:       emp.personal_email || '',
      marital_status:       emp.marital_status || '',
      employment_type:      emp.employment_type || 'full_time',
      join_date:            emp.join_date || '',
      probation_end_date:   emp.probation_end_date || '',
      end_date:             emp.end_date || '',
      department:           emp.department ?? '',
      position:             emp.position ?? '',
      manager:              emp.manager ?? '',
      work_location:        emp.work_location || '',
      is_active:            emp.is_active,
      mobile_number:        emp.mobile_number || '',
      extension_number:     emp.extension_number || '',
      address:              emp.address || '',
      sponsor_name:         emp.sponsor_name || '',
      sponsor_id:           emp.sponsor_id || '',
      labor_card:           emp.labor_card || '',
      labor_card_expiry:    emp.labor_card_expiry || '',
      mol_number:           emp.mol_number || '',
      resident_id:          emp.resident_id || '',
      is_citizen:           emp.is_citizen ?? false,
      basic_salary:         emp.basic_salary || '0',
      housing_allowance:    emp.housing_allowance || '0',
      transport_allowance:  emp.transport_allowance || '0',
      other_allowances:     emp.other_allowances || '0',
      username:             emp.user?.username || '',
      email:                emp.user?.email || '',
      phone:                emp.user?.phone || '',
      role:                 emp.user?.role || '',
      first_name:           (emp.full_name || '').split(' ')[0] || '',
      last_name:            (emp.full_name || '').split(' ').slice(-1)[0] || '',
      password:             '',
      password2:            '',
    });
    setEditSection(section);
  };

  const handleSave = () => {
    if (editSection === 'account') {
      if (changePassword) {
        if (!form.password || form.password.length < 8) { toast('Password must be at least 8 characters', 'error'); return; }
        if (form.password !== form.password2) { toast('Passwords do not match', 'error'); return; }
      }
      const accountData: any = {
        username: form.username, email: form.email, phone: form.phone,
        role: form.role, first_name: form.first_name, last_name: form.last_name,
      };
      if (changePassword && form.password) accountData.password = form.password;
      userUpdateMutation.mutate(accountData);
    } else {
      updateMutation.mutate({
        ...form,
        department: form.department || null,
        position:   form.position   || null,
        manager:    form.manager    || null,
      });
    }
  };

  // ── Loading / error ────────────────────────────────────────────────────────
  if (isLoading) return (
    <MainLayout>
      <PageShell>
        <div className="skeleton" style={{ height: 72, marginBottom: 'var(--space-4)' }} />
        <div className="skeleton" style={{ height: 36, marginBottom: 'var(--space-5)', borderRadius: 0 }} />
        <div style={{ display: 'flex', gap: 'var(--space-6)' }}>
          <div className="skeleton" style={{ width: 300, height: 500, flexShrink: 0 }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div className="skeleton" style={{ height: 200 }} />
            <div className="skeleton" style={{ height: 160 }} />
          </div>
        </div>
      </PageShell>
    </MainLayout>
  );

  if (error || !emp) return (
    <MainLayout>
      <PageShell>
        <div className="card empty-state">
          <p className="empty-state-title">Employee not found</p>
          <p className="empty-state-desc">The requested employee record could not be loaded</p>
        </div>
      </PageShell>
    </MainLayout>
  );

  const avatarSrc    = avatarPreview || emp.avatar || null;
  const avatarLetter = (emp.full_name || emp.user?.username || '?')[0].toUpperCase();

  const drawerTitle =
    editSection === 'account'       ? 'Edit Account & Access'
    : editSection === 'personal'    ? 'Edit Personal Info'
    : editSection === 'professional'? 'Edit Professional Info'
    : editSection === 'contact'     ? 'Edit Contact Info'
    : editSection === 'legal'       ? 'Edit UAE Legal Info'
    : 'Edit Salary Package';

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <MainLayout>
      <PageShell>

        <PageHeader
          title={emp.full_name}
          description={`${emp.employee_id} · ${empTypeLabel[emp.employment_type] || emp.employment_type}`}
          backHref="/hr/employees"
          breadcrumbs={[
            { label: 'HR' },
            { label: 'Employees', href: '/hr/employees' },
            { label: emp.full_name },
          ]}
        />

        {/* ── Tab bar ── */}
        <div className="tab-row" style={{ marginBottom: 'var(--space-5)' }}>
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`tab-row-item${activeTab === tab ? ' active' : ''}`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* ── Tab content ── */}
        {activeTab === 'Roles' ? (
          <RolesTab empUserId={emp.user?.id} isAdmin={isAdmin} />
        ) : activeTab !== 'Profile' ? (
          <div className="card empty-state">
            <svg className="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
            </svg>
            <p className="empty-state-title">Coming Soon</p>
            <p className="empty-state-desc">This section is under development</p>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 'var(--space-6)', alignItems: 'flex-start' }}>

            {/* ══ LEFT SIDEBAR ══════════════════════════════════════════════ */}
            <div style={{ width: 296, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>

              {/* User identity card */}
              <div className="card">
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                  {avatarSrc ? (
                    <img src={avatarSrc} alt={emp.full_name} className="av" style={{ width: 80, height: 80 }} />
                  ) : (
                    <div className="av-initials" style={{ width: 80, height: 80, fontSize: '1.75rem' }}>
                      {avatarLetter}
                    </div>
                  )}
                  <div>
                    <p style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--text-primary)', fontSize: 'var(--text-sm)', lineHeight: 1.35 }}>
                      {emp.full_name}
                    </p>
                    {emp.position_title && (
                      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 'var(--space-1)' }}>
                        {emp.position_title}
                      </p>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
                  {([
                    ['Emp. No.',  emp.employee_id,         true ],
                    ['Username', emp.user?.username,       false],
                    ['Email',    emp.user?.email,          false],
                    ['Role',     emp.user?.role?.replace(/_/g, ' '), false],
                  ] as [string, string | undefined, boolean][]).map(([label, value, mono]) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', flexShrink: 0 }}>{label}</span>
                      <span style={{
                        fontSize: 'var(--text-xs)',
                        fontWeight: 'var(--weight-medium)',
                        color: 'var(--text-primary)',
                        fontFamily: mono ? 'ui-monospace, monospace' : 'inherit',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        maxWidth: 160, textAlign: 'right',
                      }}>{value || '—'}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>Status</span>
                    <Badge variant={emp.is_active ? 'success' : 'error'}>{emp.is_active ? 'Active' : 'Inactive'}</Badge>
                  </div>
                </div>

                {isAdmin && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                    <Button variant="secondary" size="sm" style={{ width: '100%' }} onClick={() => openEdit('account')}>
                      Edit Account & Access
                    </Button>
                    <Button
                      variant={emp.is_active ? 'delete' : 'primary'}
                      size="sm"
                      style={{ width: '100%' }}
                      onClick={() => updateMutation.mutate({ is_active: !emp.is_active })}
                    >
                      {emp.is_active ? 'Deactivate Account' : 'Activate Account'}
                    </Button>
                  </div>
                )}
              </div>

              {/* Personal Info */}
              <div className="card">
                <SectionHead title="Personal Info" onEdit={() => openEdit('personal')} isAdmin={isAdmin} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                  <InfoRow label="Gender"         value={emp.gender ? emp.gender.charAt(0).toUpperCase() + emp.gender.slice(1) : undefined} />
                  <InfoRow label="Nationality"    value={emp.nationality} />
                  <InfoRow label="Birth Date"     value={fmtDate(emp.date_of_birth)} />
                  <InfoRow label="Age"            value={calcAge(emp.date_of_birth)} />
                  <InfoRow label="Marital Status" value={emp.marital_status ? emp.marital_status.charAt(0).toUpperCase() + emp.marital_status.slice(1) : undefined} />
                  <InfoRow label="National ID"    value={emp.national_id} />
                </div>
                <div className="info-section" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                  <InfoRow label="Home Country"    value={emp.home_country} />
                  <InfoRow label="Religion"        value={emp.religion} />
                  <InfoRow label="Passport No."    value={emp.passport_number} />
                  <InfoRow label="Passport Issue"  value={fmtDate(emp.passport_issue_date)} />
                  <InfoRow label="Passport Expiry" value={fmtDate(emp.passport_expiry_date)} />
                </div>
              </div>

              {/* Contact Info */}
              <div className="card">
                <SectionHead title="Contact Info" onEdit={() => openEdit('contact')} isAdmin={isAdmin} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', fontSize: 'var(--text-sm)' }}>
                  {emp.personal_email && (
                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                      <span style={{ color: 'var(--text-tertiary)', flexShrink: 0 }}>✉</span>
                      <span style={{ color: 'var(--text-primary)', wordBreak: 'break-all' }}>{emp.personal_email}</span>
                    </div>
                  )}
                  {(emp.mobile_number || emp.user?.phone) && (
                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                      <span style={{ color: 'var(--text-tertiary)', flexShrink: 0 }}>📱</span>
                      <div>
                        {emp.mobile_number && <p style={{ color: 'var(--text-primary)', fontWeight: 'var(--weight-medium)' }}>{emp.mobile_number}</p>}
                        {emp.user?.phone && <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)' }}>{emp.user.phone}</p>}
                      </div>
                    </div>
                  )}
                  {emp.extension_number && (
                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                      <span style={{ color: 'var(--text-tertiary)', flexShrink: 0 }}>☎</span>
                      <span style={{ color: 'var(--text-primary)' }}>Ext. {emp.extension_number}</span>
                    </div>
                  )}
                  {emp.address && (
                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                      <span style={{ color: 'var(--text-tertiary)', flexShrink: 0 }}>📍</span>
                      <span style={{ color: 'var(--text-primary)' }}>{emp.address}</span>
                    </div>
                  )}
                  {!emp.personal_email && !emp.mobile_number && !emp.user?.phone && !emp.extension_number && !emp.address && (
                    <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)' }}>No contact info on file</p>
                  )}
                </div>
              </div>

              {/* UAE Legal */}
              <div className="card">
                <SectionHead title="UAE Legal" onEdit={() => openEdit('legal')} isAdmin={isAdmin} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                  <InfoRow label="Resident ID"       value={emp.resident_id} />
                  <InfoRow label="Labor Card"        value={emp.labor_card} />
                  <InfoRow label="Labor Card Expiry" value={fmtDate(emp.labor_card_expiry)} />
                  <InfoRow label="MOL Number"        value={emp.mol_number} />
                  <InfoRow label="Sponsor Name"      value={emp.sponsor_name} />
                  <InfoRow label="Sponsor ID"        value={emp.sponsor_id} />
                  <InfoRow label="UAE Citizen"       value={emp.is_citizen ? 'Yes' : 'No'} />
                </div>
              </div>
            </div>

            {/* ══ MAIN CONTENT ══════════════════════════════════════════════ */}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>

              {/* Professional Info */}
              <div className="card">
                <SectionHead title="Professional Info" onEdit={() => openEdit('professional')} isAdmin={isAdmin} />
                <div className="info-grid">
                  <InfoRow label="Job Title"            value={emp.position_title} />
                  <InfoRow label="Work Location"        value={emp.work_location} />
                  <InfoRow label="Hiring Date"          value={fmtDate(emp.join_date)} />
                  <InfoRow label="Work Type"            value={empTypeLabel[emp.employment_type] || emp.employment_type} />
                  <InfoRow label="Department"           value={emp.department_name} />
                  <InfoRow label="End of Probation"     value={fmtDate(emp.probation_end_date)} />
                  <InfoRow label="Direct Manager"       value={emp.manager_detail?.full_name} />
                  <InfoRow label="Employment Period"    value={calcPeriod(emp.join_date)} />
                  <InfoRow label="End Date"             value={fmtDate(emp.end_date)} />
                  <InfoRow label="Salary Display Name"  value={emp.salary_display_name} />
                  {emp.user?.role && (
                    <InfoRow
                      label="System Role"
                      value={emp.user.role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                    />
                  )}
                </div>
              </div>

              {/* Salary Package */}
              <div className="card">
                <SectionHead title="Salary Package" onEdit={() => openEdit('salary')} isAdmin={isAdmin} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-3)' }}>
                  {([
                    ['Basic Salary',  emp.basic_salary],
                    ['Housing',       emp.housing_allowance],
                    ['Transport',     emp.transport_allowance],
                    ['Other',         emp.other_allowances],
                  ] as [string, string | undefined][]).map(([label, val]) => (
                    <div key={label} style={{
                      background: 'var(--surface-subtle)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-lg)',
                      padding: 'var(--space-3)',
                      textAlign: 'center',
                    }}>
                      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: 'var(--space-1)' }}>{label}</p>
                      <p style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-bold)', color: 'var(--text-primary)', lineHeight: 1 }}>
                        {Number(val).toLocaleString('en-US', { minimumFractionDigits: 0 })}
                      </p>
                      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>AED</p>
                    </div>
                  ))}
                </div>
                <div className="info-section" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-primary)' }}>
                    Total Package
                  </span>
                  <span style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-bold)', color: 'var(--text-brand)' }}>
                    {Number(emp.total_salary).toLocaleString('en-US', { minimumFractionDigits: 2 })} AED
                  </span>
                </div>
              </div>

              {/* Attendance Summary */}
              {summary && (
                <div className="card">
                  <SectionHead title="Attendance Summary" />
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-3)' }}>
                    {(['present', 'absent', 'late', 'on_leave'] as const).map(s => {
                      const color: Record<string, string> = {
                        present:  'var(--status-success)',
                        absent:   'var(--status-error)',
                        late:     'var(--status-warning)',
                        on_leave: 'var(--status-info)',
                      };
                      const bg: Record<string, string> = {
                        present:  'var(--status-success-bg)',
                        absent:   'var(--status-error-bg)',
                        late:     'var(--status-warning-bg)',
                        on_leave: 'var(--status-info-bg)',
                      };
                      return (
                        <div key={s} style={{
                          borderRadius: 'var(--radius-lg)',
                          padding: 'var(--space-4)',
                          textAlign: 'center',
                          background: bg[s],
                          border: `1px solid ${color[s]}33`,
                        }}>
                          <p style={{ fontSize: 'var(--text-3xl)', fontWeight: 'var(--weight-bold)', lineHeight: 1, marginBottom: 'var(--space-1)', color: color[s] }}>
                            {summary.summary?.[s] || 0}
                          </p>
                          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                            {s.replace('_', ' ')}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Emergency Contact */}
              {emp.emergency_contact && (
                <div className="card">
                  <SectionHead title="Emergency Contact" />
                  <div className="info-grid">
                    <InfoRow label="Name"         value={emp.emergency_contact.name} />
                    <InfoRow label="Relationship" value={emp.emergency_contact.relationship} />
                    <InfoRow label="Phone"        value={emp.emergency_contact.phone} />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </PageShell>

      {/* ══ EDIT DRAWER ════════════════════════════════════════════════════════ */}
      <Drawer
        isOpen={!!editSection}
        onClose={() => setEditSection(null)}
        title={drawerTitle}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditSection(null)}>Cancel</Button>
            <Button variant="primary" onClick={handleSave} isLoading={isSaving}>
              {isSaving ? 'Saving…' : 'Save Changes'}
            </Button>
          </>
        }
      >
        {/* ─ Account & Access ─ */}
        {editSection === 'account' && (
          <>
            <div className={fld}>
              <label className={lbl}>Profile Picture</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                {avatarPreview || emp.avatar ? (
                  <img src={avatarPreview || emp.avatar || ''} alt="" className="av" style={{ width: 56, height: 56 }} />
                ) : (
                  <div className="av-initials" style={{ width: 56, height: 56, fontSize: '1.25rem' }}>{avatarLetter}</div>
                )}
                <div>
                  <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }}
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 5 * 1024 * 1024) { toast('Max 5MB', 'error'); return; }
                      setAvatarFile(file);
                      const reader = new FileReader();
                      reader.onloadend = () => setAvatarPreview(reader.result as string);
                      reader.readAsDataURL(file);
                    }} />
                  <button type="button" className="btn btn-secondary"
                    style={{ fontSize: 'var(--text-xs)', padding: '4px 12px' }}
                    onClick={() => fileInputRef.current?.click()}>
                    {avatarPreview || emp.avatar ? 'Change Photo' : 'Upload Photo'}
                  </button>
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 'var(--space-1)' }}>
                    JPG, PNG — max 5 MB
                  </p>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginTop: 'var(--space-4)' }}>
              <div className={fld}><label className={lbl}>First Name</label><input className={inp} value={form.first_name} onChange={f('first_name')} /></div>
              <div className={fld}><label className={lbl}>Last Name</label><input className={inp} value={form.last_name} onChange={f('last_name')} /></div>
              <div className={fld}><label className={lbl}>Username</label><input className={inp} value={form.username} onChange={f('username')} /></div>
              <div className={fld}><label className={lbl}>Email</label><input className={inp} type="email" value={form.email} onChange={f('email')} /></div>
              <div className={fld}><label className={lbl}>Phone</label><input className={inp} type="tel" value={form.phone} onChange={f('phone')} /></div>
              <div className={fld}>
                <label className={lbl}>System Role</label>
                <select className={sel} value={form.role} onChange={f('role')}>
                  <option value="">— Select Role —</option>
                  {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-4)', marginTop: 'var(--space-4)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer', marginBottom: 'var(--space-3)' }}>
                <input type="checkbox" checked={changePassword}
                  onChange={e => {
                    setChangePassword(e.target.checked);
                    if (!e.target.checked) setForm(p => ({ ...p, password: '', password2: '' }));
                  }} />
                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: 'var(--text-primary)' }}>
                  Change Password
                </span>
              </label>
              {changePassword && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                  <div className={fld}><label className={lbl}>New Password</label><input className={inp} type="password" placeholder="Min 8 characters" value={form.password} onChange={f('password')} /></div>
                  <div className={fld}><label className={lbl}>Confirm Password</label><input className={inp} type="password" placeholder="Repeat password" value={form.password2} onChange={f('password2')} /></div>
                </div>
              )}
            </div>
          </>
        )}

        {/* ─ Personal ─ */}
        {editSection === 'personal' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
            <div className={fld}><label className={lbl}>Salary Display Name</label><input className={inp} value={form.salary_display_name} onChange={f('salary_display_name')} /></div>
            <div className={fld}>
              <label className={lbl}>Gender</label>
              <select className={sel} value={form.gender} onChange={f('gender')}>
                <option value="">—</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>
            <div className={fld}><label className={lbl}>Date of Birth</label><input className={inp} type="date" value={form.date_of_birth} onChange={f('date_of_birth')} /></div>
            <div className={fld}>
              <label className={lbl}>Marital Status</label>
              <select className={sel} value={form.marital_status} onChange={f('marital_status')}>
                <option value="">—</option>
                <option value="single">Single</option>
                <option value="married">Married</option>
                <option value="divorced">Divorced</option>
                <option value="widowed">Widowed</option>
              </select>
            </div>
            <div className={fld}><label className={lbl}>Nationality</label><input className={inp} value={form.nationality} onChange={f('nationality')} /></div>
            <div className={fld}><label className={lbl}>Home Country</label><input className={inp} value={form.home_country} onChange={f('home_country')} /></div>
            <div className={fld}><label className={lbl}>Religion</label><input className={inp} value={form.religion} onChange={f('religion')} /></div>
            <div className={fld}><label className={lbl}>National ID</label><input className={inp} value={form.national_id} onChange={f('national_id')} /></div>
            <div className={fld}><label className={lbl}>Passport Number</label><input className={inp} value={form.passport_number} onChange={f('passport_number')} /></div>
            <div className={fld}><label className={lbl}>Passport Issue Date</label><input className={inp} type="date" value={form.passport_issue_date} onChange={f('passport_issue_date')} /></div>
            <div className={fld}><label className={lbl}>Passport Expiry Date</label><input className={inp} type="date" value={form.passport_expiry_date} onChange={f('passport_expiry_date')} /></div>
            <div className={fld}><label className={lbl}>Personal Email</label><input className={inp} type="email" value={form.personal_email} onChange={f('personal_email')} /></div>
          </div>
        )}

        {/* ─ Professional ─ */}
        {editSection === 'professional' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
            <div className={fld}>
              <label className={lbl}>Employment Type</label>
              <select className={sel} value={form.employment_type} onChange={f('employment_type')}>
                <option value="full_time">Full Time</option>
                <option value="part_time">Part Time</option>
                <option value="contract">Contract</option>
                <option value="intern">Intern</option>
              </select>
            </div>
            <div className={fld}>
              <label className={lbl}>Status</label>
              <select className={sel} value={form.is_active ? 'true' : 'false'}
                onChange={e => setForm(p => ({ ...p, is_active: e.target.value === 'true' }))}>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
            <div className={fld}>
              <label className={lbl}>Department</label>
              <select className={sel} value={form.department} onChange={f('department')}>
                <option value="">— None —</option>
                {depts?.results?.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className={fld}>
              <label className={lbl}>Position</label>
              <select className={sel} value={form.position} onChange={f('position')}>
                <option value="">— None —</option>
                {positions?.results?.map((p: any) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </div>
            <div className={fld}><label className={lbl}>Work Location</label><input className={inp} value={form.work_location} onChange={f('work_location')} /></div>
            <div className={fld}><label className={lbl}>Salary Display Name</label><input className={inp} value={form.salary_display_name} onChange={f('salary_display_name')} /></div>
            <div className={fld}><label className={lbl}>Hiring Date</label><input className={inp} type="date" value={form.join_date} onChange={f('join_date')} /></div>
            <div className={fld}><label className={lbl}>End of Probation</label><input className={inp} type="date" value={form.probation_end_date} onChange={f('probation_end_date')} /></div>
            <div className={fld}><label className={lbl}>End Date</label><input className={inp} type="date" value={form.end_date} onChange={f('end_date')} /></div>
          </div>
        )}

        {/* ─ Contact ─ */}
        {editSection === 'contact' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
            <div className={fld}><label className={lbl}>Mobile Number</label><input className={inp} value={form.mobile_number} onChange={f('mobile_number')} /></div>
            <div className={fld}><label className={lbl}>Extension Number</label><input className={inp} value={form.extension_number} onChange={f('extension_number')} /></div>
            <div className={fld} style={{ gridColumn: '1 / -1' }}>
              <label className={lbl}>Address</label>
              <textarea className={ta} rows={3} value={form.address} onChange={f('address')} />
            </div>
            <div className={fld}><label className={lbl}>Personal Email</label><input className={inp} type="email" value={form.personal_email} onChange={f('personal_email')} /></div>
          </div>
        )}

        {/* ─ UAE Legal ─ */}
        {editSection === 'legal' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
            <div className={fld}><label className={lbl}>Resident ID</label><input className={inp} value={form.resident_id} onChange={f('resident_id')} /></div>
            <div className={fld}><label className={lbl}>Labor Card</label><input className={inp} value={form.labor_card} onChange={f('labor_card')} /></div>
            <div className={fld}><label className={lbl}>Labor Card Expiry</label><input className={inp} type="date" value={form.labor_card_expiry} onChange={f('labor_card_expiry')} /></div>
            <div className={fld}><label className={lbl}>MOL Number</label><input className={inp} value={form.mol_number} onChange={f('mol_number')} /></div>
            <div className={fld}><label className={lbl}>Sponsor Name</label><input className={inp} value={form.sponsor_name} onChange={f('sponsor_name')} /></div>
            <div className={fld}><label className={lbl}>Sponsor ID</label><input className={inp} value={form.sponsor_id} onChange={f('sponsor_id')} /></div>
            <div className={fld} style={{ gridColumn: '1 / -1' }}>
              <label className={lbl}>UAE Citizen?</label>
              <select className={sel} value={form.is_citizen ? 'true' : 'false'}
                onChange={e => setForm(p => ({ ...p, is_citizen: e.target.value === 'true' }))}>
                <option value="false">No</option>
                <option value="true">Yes</option>
              </select>
            </div>
          </div>
        )}

        {/* ─ Salary ─ */}
        {editSection === 'salary' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
            {([
              ['basic_salary',        'Basic Salary'],
              ['housing_allowance',   'Housing Allowance'],
              ['transport_allowance', 'Transport Allowance'],
              ['other_allowances',    'Other Allowances'],
            ] as [string, string][]).map(([key, label]) => (
              <div key={key} className={fld}>
                <label className={lbl}>{label} (AED)</label>
                <input className={inp} type="number" min="0" value={form[key]} onChange={f(key)} />
              </div>
            ))}
          </div>
        )}
      </Drawer>
    </MainLayout>
  );
}
