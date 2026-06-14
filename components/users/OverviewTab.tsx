'use client';

import { useState, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '@/lib/api/users';
import { hrEmployeesApi, hrRequestsApi, hrShiftAssignmentsApi } from '@/lib/api/hr';
import { permissionsApi } from '@/lib/api/permissions';
import { Button, Badge } from '@/components/ui';
import { toast } from '@/lib/hooks/use-toast';

// ── Constants ──────────────────────────────────────────────────────────────────
const CURRENT_YEAR = new Date().getFullYear();

const LEAVE_LABELS: Record<string, string> = {
  annual_leave:    'Annual Leave',
  sick_leave:      'Sick Leave',
  emergency_leave: 'Emergency Leave',
  unpaid_leave:    'Unpaid Leave',
};
const LEAVE_ORDER = ['annual_leave', 'sick_leave', 'emergency_leave', 'unpaid_leave'];

const EC_RELATIONSHIPS = ['Spouse', 'Parent', 'Sibling', 'Child', 'Friend', 'Other'];

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtDate(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB');
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: 0 }}>{label}</p>
      <p style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', marginTop: 'var(--space-0-5)', marginBottom: 0 }}>{value || '—'}</p>
    </div>
  );
}

function Section({ title, onEdit, children }: { title: string; onEdit?: () => void; children: React.ReactNode }) {
  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
        <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', margin: 0 }}>{title}</h3>
        {onEdit && (
          <button onClick={onEdit}
            style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-medium)', padding: 'var(--space-1) var(--space-3)', borderRadius: 'var(--radius-md)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--sidebar-active-text)', backgroundColor: 'var(--sidebar-active-bg)' }}>
            Edit
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

// ── Drawer helpers ─────────────────────────────────────────────────────────────
const inp = 'form-input';
const sel = 'form-select';
const fld = 'form-field';
const lbl = 'form-label';

const ROLES = [
  { value: 'employee',            label: 'Employee' },
  { value: 'site_engineer',       label: 'Site Engineer' },
  { value: 'site_manager',        label: 'Site Manager' },
  { value: 'supervisor',          label: 'Supervisor' },
  { value: 'hr_manager',          label: 'HR Manager' },
  { value: 'company_director',    label: 'Company Director' },
  { value: 'procurement_manager', label: 'Procurement Manager' },
  { value: 'procurement_officer', label: 'Procurement Officer' },
  { value: 'admin',               label: 'Admin' },
];

type DrawerSection = 'account' | 'employment' | 'personal' | 'legal' | 'emergency' | null;

// ── Props ──────────────────────────────────────────────────────────────────────
export interface UserTabProps {
  user: any;
  emp: any;
  depts: any;
  positions: any;
  locations: any;
  isSelf: boolean;
  isAdmin: boolean;
  userId: number;
}

export default function OverviewTab({ user, emp, depts, positions, locations, isSelf, isAdmin, userId }: UserTabProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [drawer, setDrawer]               = useState<DrawerSection>(null);
  const [avatarFile, setAvatarFile]       = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [changePassword, setChangePassword] = useState(false);
  const [form, setForm]                   = useState<Record<string, any>>({});
  const [roleEditMode, setRoleEditMode]   = useState(false);
  const [roleEditValue, setRoleEditValue] = useState('');
  const [dmSearch, setDmSearch]           = useState('');
  const [imSearch, setImSearch]           = useState('');

  // ── Open drawer & pre-fill ─────────────────────────────────────────────────
  const openDrawer = (section: DrawerSection) => {
    setAvatarFile(null); setAvatarPreview(null); setChangePassword(false);
    setDmSearch(''); setImSearch('');
    setForm({
      // account
      username:     user?.username     || '',
      email:        user?.email        || '',
      first_name:   user?.first_name   || '',
      last_name:    user?.last_name    || '',
      second_name:  user?.second_name  || '',
      third_name:   user?.third_name   || '',
      full_name_ar: user?.full_name_ar || '',
      job_title:    user?.job_title    || '',
      phone:        user?.phone        || '',
      role:         user?.role         || 'site_engineer',
      is_active:    user?.is_active    ?? true,
      password: '', password2: '',
      // employment
      employment_type:     emp?.employment_type     || 'full_time',
      join_date:           emp?.join_date           || '',
      department:          emp?.department          ?? '',
      position:            emp?.position            ?? '',
      work_location:       emp?.work_location       || '',
      location:            emp?.location            ?? '',
      salary_display_name: emp?.salary_display_name || '',
      basic_salary:        emp?.basic_salary        || '0',
      housing_allowance:   emp?.housing_allowance   || '0',
      transport_allowance: emp?.transport_allowance || '0',
      other_allowances:    emp?.other_allowances    || '0',
      direct_manager:      emp?.direct_manager      ?? '',
      indirect_manager:    emp?.indirect_manager    ?? '',
      probation_end_date:  emp?.probation_end_date  || '',
      end_date:            emp?.end_date            || '',
      extension_number:    emp?.extension_number    || '',
      // personal
      gender:               emp?.gender               || '',
      date_of_birth:        emp?.date_of_birth        || '',
      nationality:          emp?.nationality          || '',
      marital_status:       emp?.marital_status       || '',
      national_id:          emp?.national_id          || '',
      passport_number:      emp?.passport_number      || '',
      passport_issue_date:  emp?.passport_issue_date  || '',
      passport_expiry_date: emp?.passport_expiry_date || '',
      personal_email:       emp?.personal_email       || '',
      mobile_number:        emp?.mobile_number        || '',
      address:              emp?.address              || '',
      // legal
      resident_id:       emp?.resident_id       || '',
      labor_card:        emp?.labor_card        || '',
      labor_card_expiry: emp?.labor_card_expiry || '',
      mol_number:        emp?.mol_number        || '',
      sponsor_name:      emp?.sponsor_name      || '',
      sponsor_id:        emp?.sponsor_id        || '',
      is_citizen:        emp?.is_citizen        ?? false,
      // emergency contact
      emergency_name:         emp?.emergency_contact?.name         || '',
      emergency_relationship: emp?.emergency_contact?.relationship || '',
      emergency_phone:        emp?.emergency_contact?.phone        || '',
    });
    setDrawer(section);
  };

  const f = (k: string) => (e: React.ChangeEvent<any>) => setForm(p => ({ ...p, [k]: e.target.value }));

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: permSummary } = useQuery({
    queryKey: ['user-permission-summary', userId],
    queryFn:  () => permissionsApi.getUserPermissionSummary(userId),
    enabled:  isAdmin && !!userId,
  });

  const { data: allEmployees } = useQuery({
    queryKey: ['all-employees-picker'],
    queryFn:  () => hrEmployeesApi.getAll({ page_size: 200, is_active: true } as any),
    enabled:  isAdmin && !!emp,
  });

  const { data: leaveBalances } = useQuery({
    queryKey: ['leave-balances', emp?.id],
    queryFn:  () => hrRequestsApi.getLeaveBalances({ employee: emp!.id, year: CURRENT_YEAR }),
    enabled:  !!emp,
  });

  const { data: shiftAssignments } = useQuery({
    queryKey: ['shift-assignments', emp?.id],
    queryFn:  () => hrShiftAssignmentsApi.getAll({ employee: emp!.id }),
    enabled:  !!emp,
  });

  const currentShift = shiftAssignments?.results?.[0] ?? null;

  // ── Mutations ──────────────────────────────────────────────────────────────
  const userMutation = useMutation({
    mutationFn: (data: any) => usersApi.update(userId, { ...data, ...(avatarFile ? { avatar: avatarFile } : {}) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['user', userId] }); },
  });

  const createEmpMutation = useMutation({
    mutationFn: (data: any) => hrEmployeesApi.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['employee-by-user', userId] }); },
  });

  const updateEmpMutation = useMutation({
    mutationFn: (data: any) => hrEmployeesApi.update(emp!.id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['employee-by-user', userId] }); },
  });

  const emergencyMutation = useMutation({
    mutationFn: (data: { name: string; relationship: string; phone: string }) =>
      hrEmployeesApi.updateEmergencyContact(emp!.id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['employee-by-user', userId] }); },
  });

  const roleMutation = useMutation({
    mutationFn: (newRole: string) => usersApi.update(userId, { role: newRole }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user', userId] });
      queryClient.invalidateQueries({ queryKey: ['user-permission-summary', userId] });
      toast('Role updated', 'success');
      setRoleEditMode(false);
    },
    onError: () => toast('Failed to update role', 'error'),
  });

  const isSaving = userMutation.isPending || createEmpMutation.isPending || updateEmpMutation.isPending || emergencyMutation.isPending;

  const buildEmpPayload = () => ({
    user_id:              userId,
    employment_type:      form.employment_type,
    join_date:            form.join_date             || null,
    department:           form.department            || null,
    position:             form.position             || null,
    work_location:        form.work_location,
    location:             form.location             || null,
    salary_display_name:  form.salary_display_name,
    basic_salary:         form.basic_salary,
    housing_allowance:    form.housing_allowance,
    transport_allowance:  form.transport_allowance,
    other_allowances:     form.other_allowances,
    direct_manager:       form.direct_manager       || null,
    indirect_manager:     form.indirect_manager     || null,
    probation_end_date:   form.probation_end_date   || null,
    end_date:             form.end_date             || null,
    extension_number:     form.extension_number,
    gender:               form.gender,
    date_of_birth:        form.date_of_birth        || null,
    nationality:          form.nationality,
    marital_status:       form.marital_status,
    national_id:          form.national_id,
    passport_number:      form.passport_number,
    passport_issue_date:  form.passport_issue_date  || null,
    passport_expiry_date: form.passport_expiry_date || null,
    personal_email:       form.personal_email,
    mobile_number:        form.mobile_number,
    address:              form.address,
    resident_id:          form.resident_id,
    labor_card:           form.labor_card,
    labor_card_expiry:    form.labor_card_expiry    || null,
    mol_number:           form.mol_number,
    sponsor_name:         form.sponsor_name,
    sponsor_id:           form.sponsor_id,
    is_citizen:           form.is_citizen,
  });

  const handleSave = async () => {
    if (drawer === 'account') {
      if (changePassword) {
        if (!form.password || form.password.length < 8) { toast('Min 8 characters', 'error'); return; }
        if (form.password !== form.password2) { toast('Passwords do not match', 'error'); return; }
      }
      const d: any = {
        username:     form.username,
        email:        form.email,
        first_name:   form.first_name,
        last_name:    form.last_name,
        second_name:  form.second_name,
        third_name:   form.third_name,
        full_name_ar: form.full_name_ar,
        job_title:    form.job_title,
        phone:        form.phone,
        role:         form.role,
        is_active:    form.is_active,
      };
      if (changePassword && form.password) d.password = form.password;
      await userMutation.mutateAsync(d);
    } else if (drawer === 'emergency') {
      if (!form.emergency_name || !form.emergency_phone) { toast('Name and phone are required', 'error'); return; }
      await emergencyMutation.mutateAsync({
        name:         form.emergency_name,
        relationship: form.emergency_relationship,
        phone:        form.emergency_phone,
      });
    } else {
      if (emp) await updateEmpMutation.mutateAsync(buildEmpPayload());
      else if (form.join_date) await createEmpMutation.mutateAsync(buildEmpPayload());
    }
    toast('Saved successfully', 'success');
    setDrawer(null);
  };

  // ── Derived values ─────────────────────────────────────────────────────────
  const avatarSrc    = (user as any).avatar || null;
  const displayName  = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username;
  const avatarLetter = displayName[0].toUpperCase();
  const roleLabel    = ROLES.find(r => r.value === user.role)?.label || user.role || '—';
  const totalSalary  = ['basic_salary', 'housing_allowance', 'transport_allowance', 'other_allowances']
    .reduce((s, k) => s + parseFloat((emp as any)?.[k] || '0'), 0);
  const deptName     = depts?.results?.find((d: any) => d.id === emp?.department)?.name;
  const posName      = positions?.results?.find((p: any) => p.id === emp?.position)?.title;

  const filteredDM = (allEmployees?.results ?? [])
    .filter((e: any) => e.id !== emp?.id)
    .filter((e: any) => !dmSearch || `${e.full_name || ''} ${e.employee_id}`.toLowerCase().includes(dmSearch.toLowerCase()));

  const filteredIM = (allEmployees?.results ?? [])
    .filter((e: any) => e.id !== emp?.id)
    .filter((e: any) => !imSearch || `${e.full_name || ''} ${e.employee_id}`.toLowerCase().includes(imSearch.toLowerCase()));

  return (
    <>
      <div style={{ display: 'flex', gap: 'var(--space-6)', alignItems: 'flex-start' }}>

        {/* ── LEFT SIDEBAR ── */}
        <div style={{ width: 288, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>

          {/* Identity card */}
          <div className="card">
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
              {avatarSrc
                ? <img src={avatarSrc} alt="" style={{ width: 96, height: 96, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border-subtle)' }} />
                : <div style={{ width: 96, height: 96, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--text-3xl)', fontWeight: 'var(--weight-bold)', border: '2px solid var(--border-subtle)', backgroundColor: 'var(--sidebar-active-bg)', color: 'var(--sidebar-active-text)' }}>
                    {avatarLetter}
                  </div>}
              <div>
                <p style={{ fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-sm)', margin: 0 }}>{displayName}</p>
                {emp && <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: 'var(--space-0-5)', marginBottom: 0 }}>#{emp.employee_id}</p>}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Username</span>
                <span style={{ fontWeight: 'var(--weight-medium)' }}>@{user.username}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Role</span>
                <span style={{ fontWeight: 'var(--weight-medium)', fontSize: 'var(--text-xs)' }}>{roleLabel}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Status</span>
                <Badge className={user.is_active ? 'badge-success' : 'badge-error'}>
                  {user.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </div>

            <Button variant="secondary" size="sm" style={{ width: '100%' }} onClick={() => openDrawer('account')}>
              Edit Account
            </Button>
          </div>

          {/* Personal Info */}
          <Section title="Personal Info" onEdit={() => openDrawer('personal')}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
              <InfoRow label="Gender"         value={emp?.gender ? emp.gender.charAt(0).toUpperCase() + emp.gender.slice(1) : '—'} />
              <InfoRow label="Nationality"    value={emp?.nationality} />
              <InfoRow label="Birth Date"     value={fmtDate(emp?.date_of_birth)} />
              <InfoRow label="Marital"        value={emp?.marital_status} />
              <InfoRow label="National ID"    value={emp?.national_id} />
              <InfoRow label="Mobile"         value={emp?.mobile_number || user.phone} />
              <InfoRow label="Personal Email" value={emp?.personal_email} />
            </div>
            {emp?.address && (
              <div style={{ marginTop: 'var(--space-2)' }}>
                <InfoRow label="Address" value={emp.address} />
              </div>
            )}
            {emp?.passport_number && (
              <div style={{ borderTop: '1px solid var(--border-subtle)', marginTop: 'var(--space-3)', paddingTop: 'var(--space-3)', display: 'flex', flexDirection: 'column', gap: 'var(--space-1-5)' }}>
                <InfoRow label="Passport No."    value={emp.passport_number} />
                <InfoRow label="Passport Issued" value={fmtDate(emp.passport_issue_date)} />
                <InfoRow label="Passport Expiry" value={fmtDate(emp.passport_expiry_date)} />
              </div>
            )}
            {(user.second_name || user.third_name || user.full_name_ar) && (
              <div style={{ borderTop: '1px solid var(--border-subtle)', marginTop: 'var(--space-3)', paddingTop: 'var(--space-3)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
                {user.second_name  && <InfoRow label="2nd Name"    value={user.second_name} />}
                {user.third_name   && <InfoRow label="3rd Name"    value={user.third_name} />}
                {user.full_name_ar && <InfoRow label="Arabic Name" value={user.full_name_ar} />}
              </div>
            )}
          </Section>

          {/* UAE Legal */}
          <Section title="UAE Legal" onEdit={() => openDrawer('legal')}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <InfoRow label="Resident ID"       value={emp?.resident_id} />
              <InfoRow label="Labor Card"        value={emp?.labor_card} />
              <InfoRow label="Labor Card Expiry" value={fmtDate(emp?.labor_card_expiry)} />
              <InfoRow label="MOL Number"        value={emp?.mol_number} />
              <InfoRow label="Sponsor Name"      value={emp?.sponsor_name} />
              <InfoRow label="Sponsor ID"        value={emp?.sponsor_id} />
              <InfoRow label="Citizen"           value={emp ? (emp.is_citizen ? 'Yes' : 'No') : '—'} />
            </div>
          </Section>

          {/* Emergency Contact */}
          <Section title="Emergency Contact" onEdit={emp ? () => openDrawer('emergency') : undefined}>
            {emp?.emergency_contact?.name ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                <InfoRow label="Name"         value={emp.emergency_contact.name} />
                <InfoRow label="Relationship" value={emp.emergency_contact.relationship} />
                <InfoRow label="Phone"        value={emp.emergency_contact.phone} />
              </div>
            ) : (
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0 }}>
                {emp ? 'No emergency contact set.' : 'Set up an employee profile first.'}
              </p>
            )}
          </Section>
        </div>

        {/* ── MAIN AREA ── */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>

          {/* Employment Details */}
          <Section title="Employment Details" onEdit={() => openDrawer('employment')}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', columnGap: 'var(--space-8)', rowGap: 'var(--space-5)' }}>
              <InfoRow label="Position"        value={posName || emp?.position_title} />
              <InfoRow label="Department"      value={deptName || emp?.department_name} />
              <InfoRow label="Work Type"       value={emp?.employment_type?.replace(/_/g, ' ')} />
              <InfoRow label="Hiring Date"     value={fmtDate(emp?.join_date)} />
              <InfoRow label="Location"        value={emp?.location_name || emp?.work_location} />
              <InfoRow label="Email"           value={user.email} />
              <InfoRow label="Direct Manager"  value={emp?.direct_manager_name} />
              <InfoRow label="Indirect Mgr."   value={emp?.indirect_manager_name} />
              <InfoRow label="Current Shift"   value={currentShift?.shift_name} />
              <InfoRow label="Job Title"       value={user.job_title} />
              <InfoRow label="Extension No."   value={emp?.extension_number} />
              <InfoRow label="Salary Name"     value={emp?.salary_display_name} />
              {emp?.probation_end_date && <InfoRow label="Probation End" value={fmtDate(emp.probation_end_date)} />}
              {emp?.end_date           && <InfoRow label="Contract End"  value={fmtDate(emp.end_date)} />}
            </div>
            {!emp && (
              <div style={{ marginTop: 'var(--space-4)', padding: 'var(--space-3)', borderRadius: 'var(--radius-lg)', textAlign: 'center', background: 'var(--surface-subtle)' }}>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: 0 }}>No employee profile yet.</p>
                <button onClick={() => openDrawer('employment')} style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-medium)', marginTop: 'var(--space-1)', color: 'var(--sidebar-active-text)', background: 'none', border: 'none', cursor: 'pointer' }}>
                  + Set up employee profile
                </button>
              </div>
            )}
          </Section>

          {/* Salary Package */}
          {emp && (
            <Section title="Salary Package" onEdit={() => openDrawer('employment')}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-4)' }}>
                {[['Basic Salary', emp.basic_salary], ['Housing', emp.housing_allowance],
                  ['Transport', emp.transport_allowance], ['Other', emp.other_allowances]].map(([l, v]) => (
                  <div key={l as string} style={{ borderRadius: 'var(--radius-lg)', padding: 'var(--space-3)', textAlign: 'center', background: 'var(--surface-subtle)' }}>
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginBottom: 'var(--space-1)', marginTop: 0 }}>{l}</p>
                    <p style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-bold)', margin: 0 }}>{Number(v).toLocaleString()}</p>
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginBottom: 0, marginTop: 'var(--space-0-5)' }}>AED</p>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 'var(--space-4)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)' }}>Total Package</span>
                <span style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-bold)', color: 'var(--sidebar-active-text)' }}>
                  {totalSalary.toLocaleString('en-US', { minimumFractionDigits: 2 })} AED
                </span>
              </div>
            </Section>
          )}

          {/* Time Off Balances */}
          {emp && (
            <Section title="Time Off Balances">
              {leaveBalances?.results && leaveBalances.results.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-4)' }}>
                  {LEAVE_ORDER.map(type => {
                    const bal = leaveBalances.results.find((b: any) => b.leave_type === type);
                    if (!bal) return null;
                    const total     = parseFloat(bal.total_days)   || 0;
                    const used      = parseFloat(bal.used_days)    || 0;
                    const pending   = parseFloat(bal.pending_days) || 0;
                    const remaining = Math.max(0, total - used - pending);
                    const pct       = total > 0 ? Math.min(100, (remaining / total) * 100) : 0;
                    const barColor  = remaining > 5   ? 'var(--sidebar-active-text)'
                                    : remaining > 0   ? '#f59e0b'
                                    : '#ef4444';
                    return (
                      <div key={type} style={{ borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)', background: 'var(--surface-subtle)' }}>
                        <p style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-secondary)', margin: '0 0 var(--space-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {LEAVE_LABELS[type]}
                        </p>
                        <p style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-bold)', margin: '0 0 var(--space-2)', color: remaining > 0 ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                          {remaining.toFixed(1)}
                          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-normal)', color: 'var(--text-secondary)', marginLeft: 4 }}>days</span>
                        </p>
                        <div style={{ height: 4, borderRadius: 2, background: 'var(--border-default)', overflow: 'hidden', marginBottom: 'var(--space-2)' }}>
                          <div style={{ height: '100%', width: `${pct}%`, borderRadius: 2, background: barColor, transition: 'width 400ms ease' }} />
                        </div>
                        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: 0 }}>
                          {used} used · {pending} pending · {total} total
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0 }}>
                  No leave balances recorded for {CURRENT_YEAR}.
                </p>
              )}
            </Section>
          )}

          {/* System Access — admin-only */}
          {isAdmin && (
            <Section title="System Access">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-5)' }}>

                {/* Role */}
                <div>
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: 0 }}>Role</p>
                  {roleEditMode ? (
                    <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-1)', alignItems: 'center' }}>
                      <select className={sel} value={roleEditValue} onChange={e => setRoleEditValue(e.target.value)} style={{ flex: 1 }}>
                        {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                      </select>
                      <Button variant="primary" size="sm" isLoading={roleMutation.isPending} onClick={() => roleMutation.mutate(roleEditValue)}>Save</Button>
                      <Button variant="secondary" size="sm" onClick={() => setRoleEditMode(false)}>Cancel</Button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginTop: 'var(--space-1)' }}>
                      <p style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', margin: 0 }}>{roleLabel}</p>
                      <button onClick={() => { setRoleEditValue(user.role || 'employee'); setRoleEditMode(true); }}
                        style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-medium)', padding: 'var(--space-0-5) var(--space-2)', borderRadius: 'var(--radius-sm)', background: 'var(--surface-subtle)', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                        Change
                      </button>
                    </div>
                  )}
                </div>

                {/* Permission Set */}
                <div>
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: 0 }}>Permission Set</p>
                  <p style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', marginTop: 'var(--space-1)', marginBottom: 0 }}>
                    {permSummary?.permission_set?.name || '—'}
                  </p>
                </div>

              </div>
            </Section>
          )}
        </div>
      </div>

      {/* ══ DRAWER ════════════════════════════════════════════════════════════════ */}
      {drawer && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', background: 'rgba(0,0,0,0.45)' }} onClick={() => setDrawer(null)}>
          <div style={{ marginLeft: 'auto', width: '100%', maxWidth: 560, height: '100%', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', background: 'var(--card-bg)' }}
            onClick={e => e.stopPropagation()}>

            {/* Drawer header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-4) var(--space-6)', borderBottom: '1px solid var(--border-subtle)' }}>
              <h2 style={{ fontWeight: 'var(--weight-semibold)', margin: 0 }}>
                {drawer === 'account'    ? 'Edit Account'       :
                 drawer === 'employment' ? 'Edit Employment'    :
                 drawer === 'personal'   ? 'Edit Personal Info' :
                 drawer === 'legal'      ? 'Edit UAE Legal'     :
                                          'Emergency Contact'}
              </h2>
              <button onClick={() => setDrawer(null)} style={{ fontSize: 'var(--text-lg)', color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1 }}>✕</button>
            </div>

            {/* Drawer body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-5) var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>

              {/* ── Account ── */}
              {drawer === 'account' && <>
                <div className={fld}>
                  <label className={lbl}>Profile Picture</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                    <div style={{ width: 56, height: 56, borderRadius: '50%', overflow: 'hidden', border: '2px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-bold)', flexShrink: 0, backgroundColor: 'var(--sidebar-active-bg)', color: 'var(--sidebar-active-text)' }}>
                      {avatarPreview || avatarSrc
                        ? <img src={avatarPreview || avatarSrc || ''} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : avatarLetter}
                    </div>
                    <div>
                      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }}
                        onChange={ev => {
                          const file = ev.target.files?.[0]; if (!file) return;
                          if (file.size > 5 * 1024 * 1024) { toast('Max 5MB', 'error'); return; }
                          setAvatarFile(file);
                          const reader = new FileReader();
                          reader.onloadend = () => setAvatarPreview(reader.result as string);
                          reader.readAsDataURL(file);
                        }} />
                      <Button type="button" variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>Change Photo</Button>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                  <div className={fld}><label className={lbl}>First Name</label><input className={inp} value={form.first_name} onChange={f('first_name')} /></div>
                  <div className={fld}><label className={lbl}>Last Name</label><input className={inp} value={form.last_name} onChange={f('last_name')} /></div>
                  <div className={fld}><label className={lbl}>2nd Name</label><input className={inp} value={form.second_name} onChange={f('second_name')} placeholder="Optional" /></div>
                  <div className={fld}><label className={lbl}>3rd Name</label><input className={inp} value={form.third_name} onChange={f('third_name')} placeholder="Optional" /></div>
                  <div className={fld} style={{ gridColumn: '1 / -1' }}><label className={lbl}>Arabic Full Name</label><input className={inp} value={form.full_name_ar} onChange={f('full_name_ar')} placeholder="Optional" dir="rtl" /></div>
                  <div className={fld}><label className={lbl}>Username</label><input className={inp} value={form.username} onChange={f('username')} /></div>
                  <div className={fld}><label className={lbl}>Email</label><input className={inp} type="email" value={form.email} onChange={f('email')} /></div>
                  <div className={fld}><label className={lbl}>Phone</label><input className={inp} type="tel" value={form.phone} onChange={f('phone')} /></div>
                  <div className={fld}><label className={lbl}>Job Title</label><input className={inp} value={form.job_title} onChange={f('job_title')} placeholder="e.g. Senior Engineer" /></div>
                  <div className={fld}><label className={lbl}>Role</label>
                    <select className={sel} value={form.role} onChange={f('role')}>
                      {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </div>
                  <div className={fld} style={{ gridColumn: '1 / -1' }}><label className={lbl}>Status</label>
                    <select className={sel} value={form.is_active ? 'true' : 'false'}
                      onChange={ev => setForm(p => ({ ...p, is_active: ev.target.value === 'true' }))}>
                      <option value="true">Active</option><option value="false">Inactive</option>
                    </select>
                  </div>
                </div>
                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-4)' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer', marginBottom: 'var(--space-3)' }}>
                    <input type="checkbox" style={{ width: 16, height: 16 }} checked={changePassword}
                      onChange={ev => { setChangePassword(ev.target.checked); if (!ev.target.checked) setForm(p => ({ ...p, password: '', password2: '' })); }} />
                    <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)' }}>Change Password</span>
                  </label>
                  {changePassword && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                      <div className={fld}><label className={lbl}>New Password</label><input className={inp} type="password" value={form.password} onChange={f('password')} placeholder="Min 8 characters" /></div>
                      <div className={fld}><label className={lbl}>Confirm</label><input className={inp} type="password" value={form.password2} onChange={f('password2')} /></div>
                    </div>
                  )}
                </div>
              </>}

              {/* ── Employment ── */}
              {drawer === 'employment' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                  {/* Manager pickers — admin only */}
                  {isAdmin && (
                    <>
                      <div className={fld}>
                        <label className={lbl}>Direct Manager</label>
                        <input className={inp} placeholder="Search by name or ID..." value={dmSearch}
                          onChange={e => setDmSearch(e.target.value)} style={{ marginBottom: 'var(--space-1)' }} />
                        <select className={sel} value={form.direct_manager ?? ''} onChange={f('direct_manager')}>
                          <option value="">— None —</option>
                          {filteredDM.map((e: any) => (
                            <option key={e.id} value={e.id}>{e.full_name || e.employee_id} ({e.employee_id})</option>
                          ))}
                        </select>
                      </div>
                      <div className={fld}>
                        <label className={lbl}>Indirect Manager</label>
                        <input className={inp} placeholder="Search by name or ID..." value={imSearch}
                          onChange={e => setImSearch(e.target.value)} style={{ marginBottom: 'var(--space-1)' }} />
                        <select className={sel} value={form.indirect_manager ?? ''} onChange={f('indirect_manager')}>
                          <option value="">— None —</option>
                          {filteredIM.map((e: any) => (
                            <option key={e.id} value={e.id}>{e.full_name || e.employee_id} ({e.employee_id})</option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                    <div className={fld}><label className={lbl}>Hiring Date</label><input className={inp} type="date" value={form.join_date} onChange={f('join_date')} /></div>
                    <div className={fld}><label className={lbl}>Employment Type</label>
                      <select className={sel} value={form.employment_type} onChange={f('employment_type')}>
                        <option value="full_time">Full Time</option><option value="part_time">Part Time</option>
                        <option value="contract">Contract</option><option value="intern">Intern</option>
                      </select>
                    </div>
                    <div className={fld}><label className={lbl}>Department</label>
                      <select className={sel} value={form.department} onChange={f('department')}>
                        <option value="">— None —</option>
                        {depts?.results?.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    </div>
                    <div className={fld}><label className={lbl}>Position</label>
                      <select className={sel} value={form.position} onChange={f('position')}>
                        <option value="">— None —</option>
                        {positions?.results?.map((p: any) => <option key={p.id} value={p.id}>{p.title}</option>)}
                      </select>
                    </div>
                    <div className={fld}><label className={lbl}>Location</label>
                      <select className={sel} value={form.location ?? ''} onChange={f('location')}>
                        <option value="">— None —</option>
                        {locations?.results?.map((l: any) => (
                          <option key={l.id} value={l.id}>
                            {l.location_type_icon ? `${l.location_type_icon} ` : ''}{l.parent_name ? `${l.parent_name} › ` : ''}{l.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className={fld}><label className={lbl}>Work Location (notes)</label><input className={inp} value={form.work_location} onChange={f('work_location')} /></div>
                    <div className={fld}><label className={lbl}>Probation End</label><input className={inp} type="date" value={form.probation_end_date} onChange={f('probation_end_date')} /></div>
                    <div className={fld}><label className={lbl}>Contract End</label><input className={inp} type="date" value={form.end_date} onChange={f('end_date')} /></div>
                    <div className={fld}><label className={lbl}>Extension No.</label><input className={inp} value={form.extension_number} onChange={f('extension_number')} placeholder="e.g. 4412" /></div>
                    <div className={fld} style={{ gridColumn: '1 / -1' }}><label className={lbl}>Salary Display Name</label><input className={inp} value={form.salary_display_name} onChange={f('salary_display_name')} /></div>
                    {[['basic_salary', 'Basic (AED)'], ['housing_allowance', 'Housing (AED)'], ['transport_allowance', 'Transport (AED)'], ['other_allowances', 'Other (AED)']].map(([k, l]) => (
                      <div key={k} className={fld}><label className={lbl}>{l}</label><input className={inp} type="number" min="0" value={form[k]} onChange={f(k)} /></div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Personal ── */}
              {drawer === 'personal' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                  <div className={fld}><label className={lbl}>Gender</label>
                    <select className={sel} value={form.gender} onChange={f('gender')}>
                      <option value="">—</option><option value="male">Male</option><option value="female">Female</option>
                    </select>
                  </div>
                  <div className={fld}><label className={lbl}>Marital Status</label>
                    <select className={sel} value={form.marital_status} onChange={f('marital_status')}>
                      <option value="">—</option><option value="single">Single</option>
                      <option value="married">Married</option><option value="divorced">Divorced</option><option value="widowed">Widowed</option>
                    </select>
                  </div>
                  <div className={fld}><label className={lbl}>Date of Birth</label><input className={inp} type="date" value={form.date_of_birth} onChange={f('date_of_birth')} /></div>
                  <div className={fld}><label className={lbl}>Nationality</label><input className={inp} value={form.nationality} onChange={f('nationality')} /></div>
                  <div className={fld}><label className={lbl}>National ID</label><input className={inp} value={form.national_id} onChange={f('national_id')} /></div>
                  <div className={fld}><label className={lbl}>Personal Email</label><input className={inp} type="email" value={form.personal_email} onChange={f('personal_email')} /></div>
                  <div className={fld}><label className={lbl}>Mobile Number</label><input className={inp} value={form.mobile_number} onChange={f('mobile_number')} /></div>
                  <div className={fld}><label className={lbl}>Passport Number</label><input className={inp} value={form.passport_number} onChange={f('passport_number')} /></div>
                  <div className={fld}><label className={lbl}>Passport Issue</label><input className={inp} type="date" value={form.passport_issue_date} onChange={f('passport_issue_date')} /></div>
                  <div className={fld}><label className={lbl}>Passport Expiry</label><input className={inp} type="date" value={form.passport_expiry_date} onChange={f('passport_expiry_date')} /></div>
                  <div className={fld} style={{ gridColumn: '1 / -1' }}><label className={lbl}>Address</label><textarea className="form-textarea" rows={2} value={form.address} onChange={f('address')} /></div>
                </div>
              )}

              {/* ── Legal ── */}
              {drawer === 'legal' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                  <div className={fld}><label className={lbl}>Resident ID</label><input className={inp} value={form.resident_id} onChange={f('resident_id')} /></div>
                  <div className={fld}><label className={lbl}>Labor Card</label><input className={inp} value={form.labor_card} onChange={f('labor_card')} /></div>
                  <div className={fld}><label className={lbl}>Labor Card Expiry</label><input className={inp} type="date" value={form.labor_card_expiry} onChange={f('labor_card_expiry')} /></div>
                  <div className={fld}><label className={lbl}>MOL Number</label><input className={inp} value={form.mol_number} onChange={f('mol_number')} /></div>
                  <div className={fld}><label className={lbl}>Sponsor Name</label><input className={inp} value={form.sponsor_name} onChange={f('sponsor_name')} /></div>
                  <div className={fld}><label className={lbl}>Sponsor ID</label><input className={inp} value={form.sponsor_id} onChange={f('sponsor_id')} /></div>
                  <div className={fld} style={{ gridColumn: '1 / -1' }}><label className={lbl}>UAE Citizen?</label>
                    <select className={sel} value={form.is_citizen ? 'true' : 'false'}
                      onChange={ev => setForm(p => ({ ...p, is_citizen: ev.target.value === 'true' }))}>
                      <option value="false">No</option><option value="true">Yes</option>
                    </select>
                  </div>
                </div>
              )}

              {/* ── Emergency Contact ── */}
              {drawer === 'emergency' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0 }}>
                    Who should be contacted in an emergency?
                  </p>
                  <div className={fld}>
                    <label className={lbl}>Contact Name *</label>
                    <input className={inp} value={form.emergency_name} onChange={f('emergency_name')} placeholder="Full name" />
                  </div>
                  <div className={fld}>
                    <label className={lbl}>Relationship</label>
                    <select className={sel} value={form.emergency_relationship} onChange={f('emergency_relationship')}>
                      <option value="">— Select —</option>
                      {EC_RELATIONSHIPS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div className={fld}>
                    <label className={lbl}>Phone Number *</label>
                    <input className={inp} type="tel" value={form.emergency_phone} onChange={f('emergency_phone')} placeholder="+971 50 000 0000" />
                  </div>
                </div>
              )}
            </div>

            {/* Drawer footer */}
            <div style={{ padding: 'var(--space-4) var(--space-6)', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
              <Button variant="secondary" onClick={() => setDrawer(null)}>Cancel</Button>
              <Button variant="primary" onClick={handleSave} isLoading={isSaving}>
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
