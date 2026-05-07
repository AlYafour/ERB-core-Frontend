'use client';

import { useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import MainLayout from '@/components/layout/MainLayout';
import { hrEmployeesApi, hrDepartmentsApi, hrPositionsApi } from '@/lib/api/hr';
import { usersApi } from '@/lib/api/users';
import { useAuth } from '@/lib/hooks/use-auth';
import { toast } from '@/lib/hooks/use-toast';
import { Button, Badge, Loader } from '@/components/ui';
import Link from 'next/link';
import { HREmployee } from '@/types';

// ── Helpers ────────────────────────────────────────────────────────────────────

function calcAge(dob: string | null): string {
  if (!dob) return '—';
  const d = new Date(dob);
  const age = new Date().getFullYear() - d.getFullYear();
  return `${age} Years Old`;
}

function calcPeriod(joinDate: string): string {
  const start = new Date(joinDate);
  const now = new Date();
  let y = now.getFullYear() - start.getFullYear();
  let m = now.getMonth() - start.getMonth();
  let d = now.getDate() - start.getDate();
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

const TABS = ['Profile', 'Bank Accounts', 'Family Info', 'Documents', 'Competencies',
  'Insurance', 'Air Ticket', 'Timeoff Setup', 'Assets', 'Projects', 'Contracts'];

// ── Input helpers ──────────────────────────────────────────────────────────────
const inp = 'w-full px-3 py-2 rounded-md border text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40';
const sel = inp;
const fld = 'flex flex-col gap-1';
const lbl = 'text-xs font-medium text-muted-foreground uppercase tracking-wide';

// ── Row component ──────────────────────────────────────────────────────────────
function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground mt-0.5">{value || '—'}</p>
    </div>
  );
}

// ── Section header ─────────────────────────────────────────────────────────────
function SectionHead({ title, onEdit, isAdmin }: { title: string; onEdit?: () => void; isAdmin?: boolean }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {isAdmin && onEdit && (
        <button onClick={onEdit}
          className="text-xs font-medium px-3 py-1 rounded-md"
          style={{ color: 'var(--sidebar-active-text)', background: 'var(--sidebar-active-bg)' }}>
          Edit
        </button>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'super_admin' || currentUser?.is_staff || currentUser?.is_superuser;

  const [activeTab, setActiveTab]       = useState('Profile');
  const [editSection, setEditSection]   = useState<'personal' | 'professional' | 'contact' | 'legal' | 'salary' | 'account' | null>(null);
  const [form, setForm]                 = useState<Record<string, any>>({});
  const [avatarFile, setAvatarFile]     = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [changePassword, setChangePassword] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: emp, isLoading, error } = useQuery<HREmployee>({
    queryKey: ['hr-employee', id],
    queryFn: () => hrEmployeesApi.getById(Number(id)),
  });

  const { data: depts }     = useQuery({ queryKey: ['hr-departments-all'], queryFn: () => hrDepartmentsApi.getAll({ page: 1 }) });
  const { data: positions } = useQuery({ queryKey: ['hr-positions-all'],   queryFn: () => hrPositionsApi.getAll({ page: 1 }) });
  const { data: summary }   = useQuery({
    queryKey: ['hr-emp-summary', id],
    queryFn:  () => hrEmployeesApi.getAttendanceSummary(Number(id)),
    enabled:  !!id,
  });

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
    mutationFn: (data: any) => usersApi.update(emp!.user!.id, { ...data, ...(avatarFile ? { avatar: avatarFile } : {}) }),
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

  const openEdit = (section: typeof editSection) => {
    if (!emp) return;
    setAvatarFile(null);
    setAvatarPreview(null);
    setChangePassword(false);
    setForm({
      // Personal
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
      // Professional
      employment_type:      emp.employment_type || 'full_time',
      join_date:            emp.join_date || '',
      probation_end_date:   emp.probation_end_date || '',
      end_date:             emp.end_date || '',
      department:           emp.department ?? '',
      position:             emp.position ?? '',
      manager:              emp.manager ?? '',
      work_location:        emp.work_location || '',
      is_active:            emp.is_active,
      // Contact
      mobile_number:        emp.mobile_number || '',
      extension_number:     emp.extension_number || '',
      address:              emp.address || '',
      // Legal
      sponsor_name:         emp.sponsor_name || '',
      sponsor_id:           emp.sponsor_id || '',
      labor_card:           emp.labor_card || '',
      labor_card_expiry:    emp.labor_card_expiry || '',
      mol_number:           emp.mol_number || '',
      resident_id:          emp.resident_id || '',
      is_citizen:           emp.is_citizen ?? false,
      // Salary
      basic_salary:         emp.basic_salary || '0',
      housing_allowance:    emp.housing_allowance || '0',
      transport_allowance:  emp.transport_allowance || '0',
      other_allowances:     emp.other_allowances || '0',
      // Account
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

  const f = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [key]: e.target.value }));

  const handleSave = () => {
    if (editSection === 'account') {
      if (changePassword) {
        if (!form.password || form.password.length < 8) {
          toast('Password must be at least 8 characters', 'error');
          return;
        }
        if (form.password !== form.password2) {
          toast('Passwords do not match', 'error');
          return;
        }
      }
      const accountData: any = {
        username:   form.username,
        email:      form.email,
        phone:      form.phone,
        role:       form.role,
        first_name: form.first_name,
        last_name:  form.last_name,
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

  const isSaving = updateMutation.isPending || userUpdateMutation.isPending;

  if (isLoading) return <MainLayout><div className="card text-center py-20"><Loader className="mx-auto mb-4" /><p className="text-muted-foreground text-sm">Loading employee...</p></div></MainLayout>;
  if (error || !emp) return <MainLayout><div className="card text-center py-20"><p className="text-destructive">Employee not found.</p></div></MainLayout>;

  const avatarSrc = avatarPreview || emp.avatar || null;
  const avatarLetter = (emp.full_name || emp.user?.username || '?')[0].toUpperCase();

  return (
    <MainLayout>
      <div className="space-y-0">

        {/* ── Page title ── */}
        <div className="flex items-center gap-3 mb-4">
          <Link href="/hr/employees">
            <button className="text-sm text-muted-foreground hover:text-foreground transition-colors">← Employees</button>
          </Link>
          <span className="text-muted-foreground">/</span>
          <h1 className="text-xl font-bold text-foreground uppercase tracking-wide">{emp.full_name}</h1>
        </div>

        {/* ── Tabs ── */}
        <div className="border-b mb-6" style={{ borderColor: 'var(--border)' }}>
          <div className="flex gap-0 overflow-x-auto">
            {TABS.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px"
                style={{
                  borderColor: activeTab === tab ? 'var(--sidebar-active-text)' : 'transparent',
                  color:       activeTab === tab ? 'var(--sidebar-active-text)' : 'var(--muted-foreground)',
                }}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {activeTab !== 'Profile' ? (
          <div className="card text-center py-16">
            <p className="text-muted-foreground text-sm">Coming soon</p>
          </div>
        ) : (
          <div className="flex gap-6 items-start">

            {/* ══ LEFT SIDEBAR ══════════════════════════════════════════════ */}
            <div className="w-80 flex-shrink-0 space-y-4">

              {/* User card */}
              <div className="card">
                <div className="flex flex-col items-center text-center gap-3 mb-4">
                  {avatarSrc ? (
                    <img src={avatarSrc} alt="" className="w-24 h-24 rounded-full object-cover border-2" style={{ borderColor: 'var(--border)' }} />
                  ) : (
                    <div className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold border-2"
                      style={{ backgroundColor: 'var(--sidebar-active-bg)', color: 'var(--sidebar-active-text)', borderColor: 'var(--border)' }}>
                      {avatarLetter}
                    </div>
                  )}
                  <div>
                    <p className="font-semibold text-foreground text-sm leading-snug">{emp.full_name}</p>
                  </div>
                </div>

                <div className="space-y-2 text-sm mb-4">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Employment Number</span>
                    <span className="font-mono font-medium text-foreground">{emp.employee_id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Username</span>
                    <span className="font-medium text-foreground">{emp.user?.username || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Email</span>
                    <span className="font-medium text-foreground text-xs truncate max-w-[140px]">{emp.user?.email || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Role</span>
                    <span className="font-medium text-foreground text-xs">{emp.user?.role ? emp.user.role.replace(/_/g, ' ') : '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <Badge className={emp.is_active ? 'badge-success' : 'badge-error'}>
                      {emp.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </div>

                {isAdmin && (
                  <div className="flex flex-col gap-2">
                    <Button variant="secondary" size="sm" className="w-full" onClick={() => openEdit('account')}>
                      Edit Account & Access
                    </Button>
                    <Button variant={emp.is_active ? 'delete' : 'primary'} size="sm" className="w-full"
                      onClick={() => updateMutation.mutate({ is_active: !emp.is_active })}>
                      {emp.is_active ? 'Deactivate Account' : 'Activate Account'}
                    </Button>
                  </div>
                )}
              </div>

              {/* Personal Info */}
              <div className="card">
                <SectionHead title="Personal Info" onEdit={() => openEdit('personal')} isAdmin={isAdmin} />
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <InfoRow label="Gender"         value={emp.gender ? emp.gender.charAt(0).toUpperCase() + emp.gender.slice(1) : '—'} />
                    <InfoRow label="Nationality"    value={emp.nationality} />
                    <InfoRow label="Birth Date"     value={fmtDate(emp.date_of_birth)} />
                    <InfoRow label="Age"            value={calcAge(emp.date_of_birth)} />
                    <InfoRow label="Marital Status" value={emp.marital_status ? emp.marital_status.charAt(0).toUpperCase() + emp.marital_status.slice(1) : '—'} />
                    <InfoRow label="National ID"    value={emp.national_id} />
                  </div>
                  <div className="border-t pt-3 space-y-2" style={{ borderColor: 'var(--border)' }}>
                    <InfoRow label="Home Country"    value={emp.home_country} />
                    <InfoRow label="Religion"        value={emp.religion} />
                    <InfoRow label="Passport No."    value={emp.passport_number} />
                    <InfoRow label="Passport Issue"  value={fmtDate(emp.passport_issue_date)} />
                    <InfoRow label="Passport Expiry" value={fmtDate(emp.passport_expiry_date)} />
                  </div>
                </div>
              </div>

              {/* Contact Info */}
              <div className="card">
                <SectionHead title="Contact Info" onEdit={() => openEdit('contact')} isAdmin={isAdmin} />
                <div className="space-y-2.5 text-sm">
                  {emp.personal_email && (
                    <div className="flex items-start gap-2">
                      <span className="text-muted-foreground mt-0.5">✉</span>
                      <span className="text-foreground break-all">{emp.personal_email}</span>
                    </div>
                  )}
                  {(emp.user?.phone || emp.mobile_number) && (
                    <div className="flex items-start gap-2">
                      <span className="text-muted-foreground mt-0.5">📱</span>
                      <div>
                        {emp.mobile_number && <p className="text-foreground font-medium">{emp.mobile_number}</p>}
                        {emp.user?.phone && <p className="text-muted-foreground text-xs">{emp.user.phone}</p>}
                      </div>
                    </div>
                  )}
                  {emp.extension_number && (
                    <div className="flex items-start gap-2">
                      <span className="text-muted-foreground mt-0.5">☎</span>
                      <span className="text-foreground">Ext. {emp.extension_number}</span>
                    </div>
                  )}
                  {emp.address && (
                    <div className="flex items-start gap-2">
                      <span className="text-muted-foreground mt-0.5">📍</span>
                      <span className="text-foreground">{emp.address}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* UAE Legal */}
              <div className="card">
                <SectionHead title="UAE Legal" onEdit={() => openEdit('legal')} isAdmin={isAdmin} />
                <div className="space-y-2">
                  <InfoRow label="Resident ID"       value={emp.resident_id} />
                  <InfoRow label="Labor Card"        value={emp.labor_card} />
                  <InfoRow label="Labor Card Expiry" value={fmtDate(emp.labor_card_expiry)} />
                  <InfoRow label="MOL Number"        value={emp.mol_number} />
                  <InfoRow label="Sponsor Name"      value={emp.sponsor_name} />
                  <InfoRow label="Sponsor ID"        value={emp.sponsor_id} />
                  <InfoRow label="Citizen"           value={emp.is_citizen ? 'Yes' : 'No'} />
                </div>
              </div>
            </div>

            {/* ══ MAIN CONTENT ══════════════════════════════════════════════ */}
            <div className="flex-1 min-w-0 space-y-5">

              {/* Professional Info */}
              <div className="card">
                <SectionHead title="Professional Info" onEdit={() => openEdit('professional')} isAdmin={isAdmin} />
                <div className="grid grid-cols-3 gap-x-8 gap-y-5">
                  <InfoRow label="Job Title"            value={emp.position_title} />
                  <InfoRow label="Work Location"        value={emp.work_location} />
                  <InfoRow label="Hiring Date"          value={fmtDate(emp.join_date)} />
                  <InfoRow label="Work Type"            value={empTypeLabel[emp.employment_type] || emp.employment_type} />
                  <InfoRow label="Department"           value={emp.department_name} />
                  <InfoRow label="End of Probation"     value={fmtDate(emp.probation_end_date)} />
                  <InfoRow label="Direct Manager"       value={emp.manager_detail?.full_name} />
                  <InfoRow label="Period of Employment" value={calcPeriod(emp.join_date)} />
                  <InfoRow label="End Date"             value={fmtDate(emp.end_date)} />
                  <InfoRow label="Salary Display Name"  value={emp.salary_display_name} />
                  {emp.user?.role && (
                    <InfoRow label="System Role" value={emp.user.role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} />
                  )}
                </div>
              </div>

              {/* Salary Package */}
              <div className="card">
                <SectionHead title="Salary Package" onEdit={() => openEdit('salary')} isAdmin={isAdmin} />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    ['Basic Salary',        emp.basic_salary],
                    ['Housing Allowance',   emp.housing_allowance],
                    ['Transport Allowance', emp.transport_allowance],
                    ['Other Allowances',    emp.other_allowances],
                  ].map(([label, val]) => (
                    <div key={label as string} className="rounded-lg p-3 text-center" style={{ background: 'var(--muted)' }}>
                      <p className="text-xs text-muted-foreground mb-1">{label}</p>
                      <p className="text-lg font-bold text-foreground">
                        {Number(val).toLocaleString('en-US', { minimumFractionDigits: 0 })}
                      </p>
                      <p className="text-xs text-muted-foreground">AED</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t flex justify-between items-center" style={{ borderColor: 'var(--border)' }}>
                  <span className="text-sm font-semibold text-foreground">Total Package</span>
                  <span className="text-xl font-bold" style={{ color: 'var(--sidebar-active-text)' }}>
                    {Number(emp.total_salary).toLocaleString('en-US', { minimumFractionDigits: 2 })} AED
                  </span>
                </div>
              </div>

              {/* Attendance Summary */}
              {summary && (
                <div className="card">
                  <SectionHead title="Attendance Summary" />
                  <div className="grid grid-cols-4 gap-4">
                    {(['present', 'absent', 'late', 'on_leave'] as const).map(s => {
                      const colors: Record<string, string> = {
                        present: '#10b981', absent: '#ef4444',
                        late:    '#f59e0b', on_leave: '#3b82f6',
                      };
                      return (
                        <div key={s} className="rounded-xl p-4 text-center" style={{ background: 'var(--muted)' }}>
                          <p className="text-3xl font-bold mb-1" style={{ color: colors[s] }}>
                            {summary.summary?.[s] || 0}
                          </p>
                          <p className="text-xs text-muted-foreground capitalize">{s.replace('_', ' ')}</p>
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
                  <div className="grid grid-cols-3 gap-6 text-sm">
                    <InfoRow label="Name"         value={emp.emergency_contact.name} />
                    <InfoRow label="Relationship" value={emp.emergency_contact.relationship} />
                    <InfoRow label="Phone"        value={emp.emergency_contact.phone} />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ══ EDIT DRAWER ════════════════════════════════════════════════════════ */}
      {editSection && (
        <div className="fixed inset-0 z-50 flex" style={{ background: 'rgba(0,0,0,0.45)' }} onClick={() => setEditSection(null)}>
          <div className="ml-auto w-full max-w-xl h-full flex flex-col shadow-2xl"
            style={{ background: 'var(--card)', color: 'var(--foreground)' }}
            onClick={e => e.stopPropagation()}>

            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <h2 className="font-semibold text-foreground">
                {editSection === 'account'      ? 'Edit Account & Access'
                 : editSection === 'personal'   ? 'Edit Personal Info'
                 : editSection === 'professional' ? 'Edit Professional Info'
                 : editSection === 'contact'    ? 'Edit Contact Info'
                 : editSection === 'legal'      ? 'Edit UAE Legal Info'
                 : 'Edit Salary'}
              </h2>
              <button onClick={() => setEditSection(null)} className="text-muted-foreground hover:text-foreground text-lg">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

              {/* ─ Account & Access ─ */}
              {editSection === 'account' && (
                <>
                  {/* Avatar */}
                  <div className={fld}>
                    <label className={lbl}>Profile Picture</label>
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-full overflow-hidden border-2 flex items-center justify-center text-xl font-bold flex-shrink-0"
                        style={{ backgroundColor: 'var(--sidebar-active-bg)', color: 'var(--sidebar-active-text)', borderColor: 'var(--border)' }}>
                        {avatarPreview || emp.avatar
                          ? <img src={avatarPreview || emp.avatar || ''} alt="" className="w-full h-full object-cover" />
                          : avatarLetter}
                      </div>
                      <div>
                        <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                          onChange={e => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            if (file.size > 5 * 1024 * 1024) { toast('Max 5MB', 'error'); return; }
                            setAvatarFile(file);
                            const reader = new FileReader();
                            reader.onloadend = () => setAvatarPreview(reader.result as string);
                            reader.readAsDataURL(file);
                          }} />
                        <button type="button" className="btn btn-secondary text-xs px-3 py-1.5"
                          onClick={() => fileInputRef.current?.click()}>
                          {avatarPreview || emp.avatar ? 'Change Photo' : 'Upload Photo'}
                        </button>
                        <p className="text-xs text-muted-foreground mt-1">JPG, PNG. Max 5MB</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className={fld}>
                      <label className={lbl}>First Name</label>
                      <input className={inp} value={form.first_name} onChange={f('first_name')} />
                    </div>
                    <div className={fld}>
                      <label className={lbl}>Last Name</label>
                      <input className={inp} value={form.last_name} onChange={f('last_name')} />
                    </div>
                    <div className={fld}>
                      <label className={lbl}>Username</label>
                      <input className={inp} value={form.username} onChange={f('username')} />
                    </div>
                    <div className={fld}>
                      <label className={lbl}>Email</label>
                      <input className={inp} type="email" value={form.email} onChange={f('email')} />
                    </div>
                    <div className={fld}>
                      <label className={lbl}>Phone</label>
                      <input className={inp} type="tel" value={form.phone} onChange={f('phone')} />
                    </div>
                    <div className={fld}>
                      <label className={lbl}>System Role</label>
                      <select className={sel} value={form.role} onChange={f('role')}>
                        <option value="">— Select Role —</option>
                        {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Password change */}
                  <div className="border-t pt-4 mt-2" style={{ borderColor: 'var(--border)' }}>
                    <label className="flex items-center gap-2 cursor-pointer mb-3">
                      <input type="checkbox" className="w-4 h-4 rounded"
                        checked={changePassword}
                        onChange={e => {
                          setChangePassword(e.target.checked);
                          if (!e.target.checked) setForm(p => ({ ...p, password: '', password2: '' }));
                        }} />
                      <span className="text-sm font-medium text-foreground">Change Password</span>
                    </label>
                    {changePassword && (
                      <div className="grid grid-cols-2 gap-4">
                        <div className={fld}>
                          <label className={lbl}>New Password</label>
                          <input className={inp} type="password" placeholder="Min 8 characters"
                            value={form.password} onChange={f('password')} />
                        </div>
                        <div className={fld}>
                          <label className={lbl}>Confirm Password</label>
                          <input className={inp} type="password" placeholder="Repeat password"
                            value={form.password2} onChange={f('password2')} />
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* ─ Personal ─ */}
              {editSection === 'personal' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className={fld}>
                    <label className={lbl}>Salary Display Name</label>
                    <input className={inp} value={form.salary_display_name} onChange={f('salary_display_name')} />
                  </div>
                  <div className={fld}>
                    <label className={lbl}>Gender</label>
                    <select className={sel} value={form.gender} onChange={f('gender')}>
                      <option value="">—</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                    </select>
                  </div>
                  <div className={fld}>
                    <label className={lbl}>Date of Birth</label>
                    <input className={inp} type="date" value={form.date_of_birth} onChange={f('date_of_birth')} />
                  </div>
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
                  <div className={fld}>
                    <label className={lbl}>Nationality</label>
                    <input className={inp} value={form.nationality} onChange={f('nationality')} />
                  </div>
                  <div className={fld}>
                    <label className={lbl}>Home Country</label>
                    <input className={inp} value={form.home_country} onChange={f('home_country')} />
                  </div>
                  <div className={fld}>
                    <label className={lbl}>Religion</label>
                    <input className={inp} value={form.religion} onChange={f('religion')} />
                  </div>
                  <div className={fld}>
                    <label className={lbl}>National ID</label>
                    <input className={inp} value={form.national_id} onChange={f('national_id')} />
                  </div>
                  <div className={fld}>
                    <label className={lbl}>Passport Number</label>
                    <input className={inp} value={form.passport_number} onChange={f('passport_number')} />
                  </div>
                  <div className={fld}>
                    <label className={lbl}>Passport Issue Date</label>
                    <input className={inp} type="date" value={form.passport_issue_date} onChange={f('passport_issue_date')} />
                  </div>
                  <div className={fld}>
                    <label className={lbl}>Passport Expiry Date</label>
                    <input className={inp} type="date" value={form.passport_expiry_date} onChange={f('passport_expiry_date')} />
                  </div>
                  <div className={fld}>
                    <label className={lbl}>Personal Email</label>
                    <input className={inp} type="email" value={form.personal_email} onChange={f('personal_email')} />
                  </div>
                </div>
              )}

              {/* ─ Professional ─ */}
              {editSection === 'professional' && (
                <div className="grid grid-cols-2 gap-4">
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
                  <div className={fld}>
                    <label className={lbl}>Work Location</label>
                    <input className={inp} value={form.work_location} onChange={f('work_location')} />
                  </div>
                  <div className={fld}>
                    <label className={lbl}>Salary Display Name</label>
                    <input className={inp} value={form.salary_display_name} onChange={f('salary_display_name')} />
                  </div>
                  <div className={fld}>
                    <label className={lbl}>Hiring Date</label>
                    <input className={inp} type="date" value={form.join_date} onChange={f('join_date')} />
                  </div>
                  <div className={fld}>
                    <label className={lbl}>End of Probation</label>
                    <input className={inp} type="date" value={form.probation_end_date} onChange={f('probation_end_date')} />
                  </div>
                  <div className={fld}>
                    <label className={lbl}>End Date</label>
                    <input className={inp} type="date" value={form.end_date} onChange={f('end_date')} />
                  </div>
                </div>
              )}

              {/* ─ Contact ─ */}
              {editSection === 'contact' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className={fld}>
                    <label className={lbl}>Mobile Number</label>
                    <input className={inp} value={form.mobile_number} onChange={f('mobile_number')} />
                  </div>
                  <div className={fld}>
                    <label className={lbl}>Extension Number</label>
                    <input className={inp} value={form.extension_number} onChange={f('extension_number')} />
                  </div>
                  <div className={`${fld} col-span-2`}>
                    <label className={lbl}>Address</label>
                    <textarea className={inp} rows={3} value={form.address} onChange={f('address')} />
                  </div>
                  <div className={fld}>
                    <label className={lbl}>Personal Email</label>
                    <input className={inp} type="email" value={form.personal_email} onChange={f('personal_email')} />
                  </div>
                </div>
              )}

              {/* ─ UAE Legal ─ */}
              {editSection === 'legal' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className={fld}>
                    <label className={lbl}>Resident ID</label>
                    <input className={inp} value={form.resident_id} onChange={f('resident_id')} />
                  </div>
                  <div className={fld}>
                    <label className={lbl}>Labor Card</label>
                    <input className={inp} value={form.labor_card} onChange={f('labor_card')} />
                  </div>
                  <div className={fld}>
                    <label className={lbl}>Labor Card Expiry</label>
                    <input className={inp} type="date" value={form.labor_card_expiry} onChange={f('labor_card_expiry')} />
                  </div>
                  <div className={fld}>
                    <label className={lbl}>MOL Number</label>
                    <input className={inp} value={form.mol_number} onChange={f('mol_number')} />
                  </div>
                  <div className={fld}>
                    <label className={lbl}>Sponsor Name</label>
                    <input className={inp} value={form.sponsor_name} onChange={f('sponsor_name')} />
                  </div>
                  <div className={fld}>
                    <label className={lbl}>Sponsor ID</label>
                    <input className={inp} value={form.sponsor_id} onChange={f('sponsor_id')} />
                  </div>
                  <div className={`${fld} col-span-2`}>
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
                <div className="grid grid-cols-2 gap-4">
                  {[
                    ['basic_salary',        'Basic Salary'],
                    ['housing_allowance',   'Housing Allowance'],
                    ['transport_allowance', 'Transport Allowance'],
                    ['other_allowances',    'Other Allowances'],
                  ].map(([key, label]) => (
                    <div key={key} className={fld}>
                      <label className={lbl}>{label} (AED)</label>
                      <input className={inp} type="number" min="0" value={form[key]} onChange={f(key)} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t flex justify-end gap-3" style={{ borderColor: 'var(--border)' }}>
              <Button variant="secondary" onClick={() => setEditSection(null)}>Cancel</Button>
              <Button variant="primary" onClick={handleSave} isLoading={isSaving}>
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
