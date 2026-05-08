'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '@/lib/api/users';
import { hrEmployeesApi, hrDepartmentsApi, hrPositionsApi, hrLocationsApi } from '@/lib/api/hr';
import MainLayout from '@/components/layout/MainLayout';
import Link from 'next/link';
import { Button, Badge, Loader } from '@/components/ui';
import { toast } from '@/lib/hooks/use-toast';

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtDate(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB');
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground mt-0.5">{value || '—'}</p>
    </div>
  );
}

function Section({ title, onEdit, children }: { title: string; onEdit?: () => void; children: React.ReactNode }) {
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {onEdit && (
          <button onClick={onEdit} className="text-xs font-medium px-3 py-1 rounded-md"
            style={{ color: 'var(--sidebar-active-text)', background: 'var(--sidebar-active-bg)' }}>
            Edit
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

// ── Drawer input helpers ───────────────────────────────────────────────────────
const inp = 'w-full px-3 py-2 rounded-md border text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40';
const sel = inp;
const fld = 'flex flex-col gap-1';
const lbl = 'text-xs font-medium text-muted-foreground uppercase tracking-wide';

const ROLES = [
  { value: 'site_engineer',       label: 'Site Engineer' },
  { value: 'procurement_manager', label: 'Procurement Manager' },
  { value: 'procurement_officer', label: 'Procurement Officer' },
  { value: 'super_admin',         label: 'Super Admin' },
];

type DrawerSection = 'account' | 'employment' | 'personal' | 'legal' | null;

// ── Page ───────────────────────────────────────────────────────────────────────
export default function UserProfilePage() {
  const { id } = useParams<{ id: string }>();
  const userId = Number(id);
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [drawer, setDrawer]             = useState<DrawerSection>(null);
  const [avatarFile, setAvatarFile]     = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [changePassword, setChangePassword] = useState(false);
  const [form, setForm]                 = useState<Record<string, any>>({});

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: user, isLoading: uLoading } = useQuery({
    queryKey: ['user', userId],
    queryFn:  () => usersApi.getById(userId),
    enabled:  !!userId,
  });

  const { data: empData, isLoading: eLoading } = useQuery({
    queryKey: ['employee-by-user', userId],
    queryFn:  () => hrEmployeesApi.getAll({ user: userId }),
    enabled:  !!userId,
  });

  const { data: depts }     = useQuery({ queryKey: ['hr-depts'],     queryFn: () => hrDepartmentsApi.getAll({ page: 1 }) });
  const { data: positions } = useQuery({ queryKey: ['hr-positions'], queryFn: () => hrPositionsApi.getAll({ page: 1 }) });
  const { data: locations } = useQuery({ queryKey: ['hr-locations-all'], queryFn: () => hrLocationsApi.getAll({ page_size: 200 } as any) });

  const emp = empData?.results?.[0] ?? null;

  // ── Open drawer & pre-fill ─────────────────────────────────────────────────
  const openDrawer = (section: DrawerSection) => {
    setAvatarFile(null); setAvatarPreview(null); setChangePassword(false);
    setForm({
      // account
      username:   user?.username   || '',
      email:      user?.email      || '',
      first_name: user?.first_name || '',
      last_name:  user?.last_name  || '',
      phone:      user?.phone      || '',
      role:       user?.role       || 'site_engineer',
      is_active:  user?.is_active  ?? true,
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
    });
    setDrawer(section);
  };

  const f = (k: string) => (e: React.ChangeEvent<any>) => setForm(p => ({ ...p, [k]: e.target.value }));

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

  const isSaving = userMutation.isPending || createEmpMutation.isPending || updateEmpMutation.isPending;

  const buildEmpPayload = () => ({
    user_id: userId,
    employment_type:      form.employment_type,
    join_date:            form.join_date            || null,
    department:           form.department           || null,
    position:             form.position             || null,
    work_location:        form.work_location,
    location:             form.location             || null,
    salary_display_name:  form.salary_display_name,
    basic_salary:         form.basic_salary,
    housing_allowance:    form.housing_allowance,
    transport_allowance:  form.transport_allowance,
    other_allowances:     form.other_allowances,
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
      const d: any = { username: form.username, email: form.email, first_name: form.first_name,
        last_name: form.last_name, phone: form.phone, role: form.role, is_active: form.is_active };
      if (changePassword && form.password) d.password = form.password;
      await userMutation.mutateAsync(d);
    } else {
      if (emp) await updateEmpMutation.mutateAsync(buildEmpPayload());
      else if (form.join_date) await createEmpMutation.mutateAsync(buildEmpPayload());
    }
    toast('Saved successfully', 'success');
    setDrawer(null);
  };

  // ── Loading / Error ────────────────────────────────────────────────────────
  if (uLoading || eLoading) return (
    <MainLayout>
      <div className="flex items-center justify-center py-24">
        <Loader className="mx-auto" />
      </div>
    </MainLayout>
  );

  if (!user) return (
    <MainLayout>
      <div className="card text-center py-20"><p className="text-destructive">User not found.</p></div>
    </MainLayout>
  );

  const avatarSrc    = (user as any).avatar || null;
  const displayName  = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username;
  const avatarLetter = displayName[0].toUpperCase();
  const roleLabel    = ROLES.find(r => r.value === user.role)?.label || user.role || '—';
  const totalSalary  = ['basic_salary','housing_allowance','transport_allowance','other_allowances']
    .reduce((s, k) => s + parseFloat((emp as any)?.[k] || '0'), 0);
  const deptName     = depts?.results?.find((d: any) => d.id === emp?.department)?.name;
  const posName      = positions?.results?.find((p: any) => p.id === emp?.position)?.title;

  return (
    <MainLayout>
      <div className="space-y-0">

        {/* Breadcrumb */}
        <div className="flex items-center gap-3 mb-4">
          <Link href="/users">
            <button className="text-sm text-muted-foreground hover:text-foreground">← Users</button>
          </Link>
          <span className="text-muted-foreground">/</span>
          <h1 className="text-xl font-bold text-foreground uppercase tracking-wide">{displayName}</h1>
        </div>

        <div className="flex gap-6 items-start">

          {/* ── LEFT SIDEBAR ── */}
          <div className="w-72 flex-shrink-0 space-y-4">

            {/* Identity card */}
            <div className="card">
              <div className="flex flex-col items-center text-center gap-3 mb-4">
                {avatarSrc
                  ? <img src={avatarSrc} alt="" className="w-24 h-24 rounded-full object-cover border-2" style={{ borderColor: 'var(--border)' }} />
                  : <div className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold border-2"
                      style={{ backgroundColor: 'var(--sidebar-active-bg)', color: 'var(--sidebar-active-text)', borderColor: 'var(--border)' }}>
                      {avatarLetter}
                    </div>}
                <div>
                  <p className="font-semibold text-foreground text-sm">{displayName}</p>
                  {emp && <p className="text-xs text-muted-foreground mt-0.5">#{emp.employee_id}</p>}
                </div>
              </div>

              <div className="space-y-2 text-sm mb-4">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Username</span>
                  <span className="font-medium">@{user.username}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Role</span>
                  <span className="font-medium text-xs">{roleLabel}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <Badge className={user.is_active ? 'badge-success' : 'badge-error'}>
                    {user.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </div>

              <Button variant="secondary" size="sm" className="w-full" onClick={() => openDrawer('account')}>
                Edit Account
              </Button>
            </div>

            {/* Personal Info */}
            <Section title="Personal Info" onEdit={() => openDrawer('personal')}>
              <div className="grid grid-cols-2 gap-3">
                <InfoRow label="Gender"      value={emp?.gender ? emp.gender.charAt(0).toUpperCase() + emp.gender.slice(1) : '—'} />
                <InfoRow label="Nationality" value={emp?.nationality} />
                <InfoRow label="Birth Date"  value={fmtDate(emp?.date_of_birth)} />
                <InfoRow label="Marital"     value={emp?.marital_status} />
                <InfoRow label="National ID" value={emp?.national_id} />
                <InfoRow label="Mobile"      value={emp?.mobile_number || user.phone} />
              </div>
              {emp?.passport_number && (
                <div className="border-t mt-3 pt-3 space-y-1.5" style={{ borderColor: 'var(--border)' }}>
                  <InfoRow label="Passport No."    value={emp.passport_number} />
                  <InfoRow label="Passport Expiry" value={fmtDate(emp.passport_expiry_date)} />
                </div>
              )}
            </Section>

            {/* UAE Legal */}
            <Section title="UAE Legal" onEdit={() => openDrawer('legal')}>
              <div className="space-y-2">
                <InfoRow label="Resident ID"  value={emp?.resident_id} />
                <InfoRow label="Labor Card"   value={emp?.labor_card} />
                <InfoRow label="MOL Number"   value={emp?.mol_number} />
                <InfoRow label="Sponsor Name" value={emp?.sponsor_name} />
                <InfoRow label="Citizen"      value={emp?.is_citizen ? 'Yes' : 'No'} />
              </div>
            </Section>
          </div>

          {/* ── MAIN ── */}
          <div className="flex-1 min-w-0 space-y-5">

            {/* Employment */}
            <Section title="Employment Details" onEdit={() => openDrawer('employment')}>
              <div className="grid grid-cols-3 gap-x-8 gap-y-5">
                <InfoRow label="Position"    value={posName || emp?.position_title} />
                <InfoRow label="Department"  value={deptName || emp?.department_name} />
                <InfoRow label="Work Type"   value={emp?.employment_type?.replace('_', ' ')} />
                <InfoRow label="Hiring Date" value={fmtDate(emp?.join_date)} />
                <InfoRow label="Location"    value={emp?.location_name || emp?.work_location} />
                <InfoRow label="Email"       value={user.email} />
              </div>
              {!emp && (
                <div className="mt-4 p-3 rounded-lg text-center" style={{ background: 'var(--muted)' }}>
                  <p className="text-xs text-muted-foreground">No employee profile yet.</p>
                  <button onClick={() => openDrawer('employment')} className="text-xs font-medium mt-1"
                    style={{ color: 'var(--sidebar-active-text)' }}>
                    + Set up employee profile
                  </button>
                </div>
              )}
            </Section>

            {/* Salary */}
            {emp && (
              <Section title="Salary Package" onEdit={() => openDrawer('employment')}>
                <div className="grid grid-cols-4 gap-4">
                  {[['Basic Salary', emp.basic_salary], ['Housing', emp.housing_allowance],
                    ['Transport', emp.transport_allowance], ['Other', emp.other_allowances]].map(([l, v]) => (
                    <div key={l as string} className="rounded-lg p-3 text-center" style={{ background: 'var(--muted)' }}>
                      <p className="text-xs text-muted-foreground mb-1">{l}</p>
                      <p className="text-base font-bold text-foreground">{Number(v).toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">AED</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t flex justify-between items-center" style={{ borderColor: 'var(--border)' }}>
                  <span className="text-sm font-semibold">Total Package</span>
                  <span className="text-xl font-bold" style={{ color: 'var(--sidebar-active-text)' }}>
                    {totalSalary.toLocaleString('en-US', { minimumFractionDigits: 2 })} AED
                  </span>
                </div>
              </Section>
            )}
          </div>
        </div>
      </div>

      {/* ══ DRAWER ════════════════════════════════════════════════════════════════ */}
      {drawer && (
        <div className="fixed inset-0 z-50 flex" style={{ background: 'rgba(0,0,0,0.45)' }} onClick={() => setDrawer(null)}>
          <div className="ml-auto w-full max-w-xl h-full flex flex-col shadow-2xl"
            style={{ background: 'var(--card)' }} onClick={e => e.stopPropagation()}>

            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <h2 className="font-semibold text-foreground">
                {drawer === 'account' ? 'Edit Account' : drawer === 'employment' ? 'Edit Employment' :
                 drawer === 'personal' ? 'Edit Personal Info' : 'Edit UAE Legal'}
              </h2>
              <button onClick={() => setDrawer(null)} className="text-muted-foreground hover:text-foreground text-lg">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

              {/* Account */}
              {drawer === 'account' && <>
                {/* Avatar */}
                <div className={fld}>
                  <label className={lbl}>Profile Picture</label>
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full overflow-hidden border-2 flex items-center justify-center text-xl font-bold flex-shrink-0"
                      style={{ backgroundColor: 'var(--sidebar-active-bg)', color: 'var(--sidebar-active-text)', borderColor: 'var(--border)' }}>
                      {avatarPreview || avatarSrc
                        ? <img src={avatarPreview || avatarSrc || ''} alt="" className="w-full h-full object-cover" />
                        : avatarLetter}
                    </div>
                    <div>
                      <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                        onChange={ev => {
                          const file = ev.target.files?.[0]; if (!file) return;
                          if (file.size > 5 * 1024 * 1024) { toast('Max 5MB', 'error'); return; }
                          setAvatarFile(file);
                          const reader = new FileReader();
                          reader.onloadend = () => setAvatarPreview(reader.result as string);
                          reader.readAsDataURL(file);
                        }} />
                      <button type="button" className="btn btn-secondary text-xs px-3 py-1.5"
                        onClick={() => fileInputRef.current?.click()}>Change Photo</button>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className={fld}><label className={lbl}>First Name</label><input className={inp} value={form.first_name} onChange={f('first_name')} /></div>
                  <div className={fld}><label className={lbl}>Last Name</label><input className={inp} value={form.last_name} onChange={f('last_name')} /></div>
                  <div className={fld}><label className={lbl}>Username</label><input className={inp} value={form.username} onChange={f('username')} /></div>
                  <div className={fld}><label className={lbl}>Email</label><input className={inp} type="email" value={form.email} onChange={f('email')} /></div>
                  <div className={fld}><label className={lbl}>Phone</label><input className={inp} type="tel" value={form.phone} onChange={f('phone')} /></div>
                  <div className={fld}><label className={lbl}>Role</label>
                    <select className={sel} value={form.role} onChange={f('role')}>
                      {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </div>
                  <div className={`${fld} col-span-2`}><label className={lbl}>Status</label>
                    <select className={sel} value={form.is_active ? 'true' : 'false'}
                      onChange={ev => setForm(p => ({ ...p, is_active: ev.target.value === 'true' }))}>
                      <option value="true">Active</option><option value="false">Inactive</option>
                    </select>
                  </div>
                </div>
                <div className="border-t pt-4" style={{ borderColor: 'var(--border)' }}>
                  <label className="flex items-center gap-2 cursor-pointer mb-3">
                    <input type="checkbox" className="w-4 h-4" checked={changePassword}
                      onChange={ev => { setChangePassword(ev.target.checked); if (!ev.target.checked) setForm(p => ({ ...p, password: '', password2: '' })); }} />
                    <span className="text-sm font-medium">Change Password</span>
                  </label>
                  {changePassword && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className={fld}><label className={lbl}>New Password</label><input className={inp} type="password" value={form.password} onChange={f('password')} placeholder="Min 8 characters" /></div>
                      <div className={fld}><label className={lbl}>Confirm</label><input className={inp} type="password" value={form.password2} onChange={f('password2')} /></div>
                    </div>
                  )}
                </div>
              </>}

              {/* Employment */}
              {drawer === 'employment' && (
                <div className="grid grid-cols-2 gap-4">
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
                        <option key={l.id} value={l.id}>{l.parent_name ? `${l.parent_name} › ` : ''}{l.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className={fld}><label className={lbl}>Work Location (notes)</label><input className={inp} value={form.work_location} onChange={f('work_location')} /></div>
                  <div className={fld}><label className={lbl}>Salary Display Name</label><input className={inp} value={form.salary_display_name} onChange={f('salary_display_name')} /></div>
                  {[['basic_salary','Basic (AED)'],['housing_allowance','Housing (AED)'],['transport_allowance','Transport (AED)'],['other_allowances','Other (AED)']].map(([k,l]) => (
                    <div key={k} className={fld}><label className={lbl}>{l}</label><input className={inp} type="number" min="0" value={form[k]} onChange={f(k)} /></div>
                  ))}
                </div>
              )}

              {/* Personal */}
              {drawer === 'personal' && (
                <div className="grid grid-cols-2 gap-4">
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
                  <div className={`${fld} col-span-2`}><label className={lbl}>Address</label><textarea className={inp} rows={2} value={form.address} onChange={f('address')} /></div>
                </div>
              )}

              {/* Legal */}
              {drawer === 'legal' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className={fld}><label className={lbl}>Resident ID</label><input className={inp} value={form.resident_id} onChange={f('resident_id')} /></div>
                  <div className={fld}><label className={lbl}>Labor Card</label><input className={inp} value={form.labor_card} onChange={f('labor_card')} /></div>
                  <div className={fld}><label className={lbl}>Labor Card Expiry</label><input className={inp} type="date" value={form.labor_card_expiry} onChange={f('labor_card_expiry')} /></div>
                  <div className={fld}><label className={lbl}>MOL Number</label><input className={inp} value={form.mol_number} onChange={f('mol_number')} /></div>
                  <div className={fld}><label className={lbl}>Sponsor Name</label><input className={inp} value={form.sponsor_name} onChange={f('sponsor_name')} /></div>
                  <div className={fld}><label className={lbl}>Sponsor ID</label><input className={inp} value={form.sponsor_id} onChange={f('sponsor_id')} /></div>
                  <div className={`${fld} col-span-2`}><label className={lbl}>UAE Citizen?</label>
                    <select className={sel} value={form.is_citizen ? 'true' : 'false'}
                      onChange={ev => setForm(p => ({ ...p, is_citizen: ev.target.value === 'true' }))}>
                      <option value="false">No</option><option value="true">Yes</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t flex justify-end gap-3" style={{ borderColor: 'var(--border)' }}>
              <Button variant="secondary" onClick={() => setDrawer(null)}>Cancel</Button>
              <Button variant="primary" onClick={handleSave} isLoading={isSaving}>
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
