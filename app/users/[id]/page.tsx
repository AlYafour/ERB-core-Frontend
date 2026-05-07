'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '@/lib/api/users';
import { hrEmployeesApi, hrDepartmentsApi, hrPositionsApi } from '@/lib/api/hr';
import MainLayout from '@/components/layout/MainLayout';
import Link from 'next/link';
import { Button, Badge, Loader } from '@/components/ui';
import { toast } from '@/lib/hooks/use-toast';

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

export default function UserProfilePage() {
  const { id } = useParams<{ id: string }>();
  const userId = Number(id);
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [avatarFile, setAvatarFile]         = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview]   = useState<string | null>(null);
  const [changePassword, setChangePassword] = useState(false);

  const [uForm, setUForm] = useState({
    username: '', email: '', first_name: '', last_name: '',
    phone: '', role: 'site_engineer', is_active: true,
    password: '', password2: '',
  });

  const [eForm, setEForm] = useState({
    employment_type: 'full_time', join_date: '',
    department: '' as any, position: '' as any,
    work_location: '', salary_display_name: '',
    basic_salary: '0', housing_allowance: '0',
    transport_allowance: '0', other_allowances: '0',
    gender: '', date_of_birth: '', nationality: '',
    marital_status: '', national_id: '', passport_number: '',
    passport_issue_date: '', passport_expiry_date: '',
    personal_email: '', mobile_number: '', address: '',
    sponsor_name: '', sponsor_id: '', labor_card: '',
    labor_card_expiry: '', mol_number: '', resident_id: '',
    is_citizen: false,
  });

  // ── Fetch user ──────────────────────────────────────────────────────────────
  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ['user', userId],
    queryFn:  () => usersApi.getById(userId),
    enabled:  !!userId,
  });

  // ── Fetch employee (may not exist) ─────────────────────────────────────────
  const { data: empData, isLoading: empLoading } = useQuery({
    queryKey: ['employee-by-user', userId],
    queryFn:  () => hrEmployeesApi.getAll({ user: userId }),
    enabled:  !!userId,
  });

  const { data: depts }     = useQuery({ queryKey: ['hr-depts'],     queryFn: () => hrDepartmentsApi.getAll({ page: 1 }) });
  const { data: positions } = useQuery({ queryKey: ['hr-positions'], queryFn: () => hrPositionsApi.getAll({ page: 1 }) });

  const emp = empData?.results?.[0] ?? null;

  // ── Pre-fill forms ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    setUForm(p => ({
      ...p,
      username:   user.username   || '',
      email:      user.email      || '',
      first_name: user.first_name || '',
      last_name:  user.last_name  || '',
      phone:      user.phone      || '',
      role:       user.role       || 'site_engineer',
      is_active:  user.is_active  ?? true,
    }));
  }, [user]);

  useEffect(() => {
    if (!emp) return;
    setEForm({
      employment_type:      emp.employment_type      || 'full_time',
      join_date:            emp.join_date            || '',
      department:           emp.department           ?? '',
      position:             emp.position             ?? '',
      work_location:        emp.work_location        || '',
      salary_display_name:  emp.salary_display_name  || '',
      basic_salary:         emp.basic_salary         || '0',
      housing_allowance:    emp.housing_allowance    || '0',
      transport_allowance:  emp.transport_allowance  || '0',
      other_allowances:     emp.other_allowances     || '0',
      gender:               emp.gender               || '',
      date_of_birth:        emp.date_of_birth        || '',
      nationality:          emp.nationality          || '',
      marital_status:       emp.marital_status       || '',
      national_id:          emp.national_id          || '',
      passport_number:      emp.passport_number      || '',
      passport_issue_date:  emp.passport_issue_date  || '',
      passport_expiry_date: emp.passport_expiry_date || '',
      personal_email:       emp.personal_email       || '',
      mobile_number:        emp.mobile_number        || '',
      address:              emp.address              || '',
      sponsor_name:         emp.sponsor_name         || '',
      sponsor_id:           emp.sponsor_id           || '',
      labor_card:           emp.labor_card           || '',
      labor_card_expiry:    emp.labor_card_expiry    || '',
      mol_number:           emp.mol_number           || '',
      resident_id:          emp.resident_id          || '',
      is_citizen:           emp.is_citizen           ?? false,
    });
  }, [emp]);

  const u = (k: string) => (e: React.ChangeEvent<any>) => setUForm(p => ({ ...p, [k]: e.target.value }));
  const ef = (k: string) => (e: React.ChangeEvent<any>) => setEForm(p => ({ ...p, [k]: e.target.value }));

  // ── Mutations ───────────────────────────────────────────────────────────────
  const userMutation = useMutation({
    mutationFn: (data: any) => usersApi.update(userId, { ...data, ...(avatarFile ? { avatar: avatarFile } : {}) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user', userId] });
      toast('Account saved', 'success');
    },
    onError: () => toast('Failed to save account', 'error'),
  });

  const createEmpMutation = useMutation({
    mutationFn: (data: any) => hrEmployeesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-by-user', userId] });
      toast('Employee profile created', 'success');
    },
    onError: () => toast('Failed to create employee profile', 'error'),
  });

  const updateEmpMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => hrEmployeesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-by-user', userId] });
      toast('Employee profile saved', 'success');
    },
    onError: () => toast('Failed to save employee profile', 'error'),
  });

  const isSaving = userMutation.isPending || createEmpMutation.isPending || updateEmpMutation.isPending;

  const buildEmpPayload = () => ({
    user_id:              userId,
    employment_type:      eForm.employment_type,
    join_date:            eForm.join_date            || null,
    department:           eForm.department           || null,
    position:             eForm.position             || null,
    work_location:        eForm.work_location,
    salary_display_name:  eForm.salary_display_name,
    basic_salary:         eForm.basic_salary,
    housing_allowance:    eForm.housing_allowance,
    transport_allowance:  eForm.transport_allowance,
    other_allowances:     eForm.other_allowances,
    gender:               eForm.gender,
    date_of_birth:        eForm.date_of_birth        || null,
    nationality:          eForm.nationality,
    marital_status:       eForm.marital_status,
    national_id:          eForm.national_id,
    passport_number:      eForm.passport_number,
    passport_issue_date:  eForm.passport_issue_date  || null,
    passport_expiry_date: eForm.passport_expiry_date || null,
    personal_email:       eForm.personal_email,
    mobile_number:        eForm.mobile_number,
    address:              eForm.address,
    sponsor_name:         eForm.sponsor_name,
    sponsor_id:           eForm.sponsor_id,
    labor_card:           eForm.labor_card,
    labor_card_expiry:    eForm.labor_card_expiry    || null,
    mol_number:           eForm.mol_number,
    resident_id:          eForm.resident_id,
    is_citizen:           eForm.is_citizen,
  });

  const handleSave = () => {
    if (changePassword) {
      if (!uForm.password || uForm.password.length < 8) {
        toast('Password must be at least 8 characters', 'error'); return;
      }
      if (uForm.password !== uForm.password2) {
        toast('Passwords do not match', 'error'); return;
      }
    }
    const userData: any = {
      username: uForm.username, email: uForm.email,
      first_name: uForm.first_name, last_name: uForm.last_name,
      phone: uForm.phone, role: uForm.role, is_active: uForm.is_active,
    };
    if (changePassword && uForm.password) userData.password = uForm.password;
    userMutation.mutate(userData);

    if (emp) {
      updateEmpMutation.mutate({ id: emp.id, data: buildEmpPayload() });
    } else if (eForm.join_date) {
      createEmpMutation.mutate(buildEmpPayload());
    }
  };

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (userLoading || empLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center py-24">
          <Loader className="mx-auto mb-3" />
          <p className="text-muted-foreground text-sm ml-3">Loading...</p>
        </div>
      </MainLayout>
    );
  }

  if (!user) {
    return (
      <MainLayout>
        <div className="card text-center py-20">
          <p className="text-destructive">User not found.</p>
        </div>
      </MainLayout>
    );
  }

  const avatarLetter = (user.first_name || user.username || '?')[0].toUpperCase();
  const totalSalary  = ['basic_salary','housing_allowance','transport_allowance','other_allowances']
    .reduce((s, k) => s + parseFloat((eForm as any)[k] || '0'), 0);

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto space-y-6 pb-12">

        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/users">
            <button className="text-sm text-muted-foreground hover:text-foreground">← Users</button>
          </Link>
          <span className="text-muted-foreground">/</span>
          <h1 className="text-xl font-bold text-foreground">
            {[user.first_name, user.last_name].filter(Boolean).join(' ') || user.username}
          </h1>
          <Badge className={user.is_active ? 'badge-success' : 'badge-error'}>
            {user.is_active ? 'Active' : 'Inactive'}
          </Badge>
          {emp && (
            <Badge className="badge-info">Employee #{emp.employee_id}</Badge>
          )}
        </div>

        {/* ── Account ── */}
        <div className="card space-y-5">
          <h2 className="font-semibold text-foreground border-b pb-3" style={{ borderColor: 'var(--border)' }}>
            Account Information
          </h2>

          {/* Avatar */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full overflow-hidden border-2 flex items-center justify-center text-2xl font-bold flex-shrink-0"
              style={{ backgroundColor: 'var(--sidebar-active-bg)', color: 'var(--sidebar-active-text)', borderColor: 'var(--border)' }}>
              {avatarPreview || (user as any).avatar
                ? <img src={avatarPreview || (user as any).avatar || ''} alt="" className="w-full h-full object-cover" />
                : avatarLetter}
            </div>
            <div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                onChange={ev => {
                  const file = ev.target.files?.[0];
                  if (!file) return;
                  if (file.size > 5 * 1024 * 1024) { toast('Max 5MB', 'error'); return; }
                  setAvatarFile(file);
                  const reader = new FileReader();
                  reader.onloadend = () => setAvatarPreview(reader.result as string);
                  reader.readAsDataURL(file);
                }} />
              <button type="button" className="btn btn-secondary text-xs px-3 py-1.5"
                onClick={() => fileInputRef.current?.click()}>
                Change Photo
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className={fld}><label className={lbl}>First Name</label>
              <input className={inp} value={uForm.first_name} onChange={u('first_name')} />
            </div>
            <div className={fld}><label className={lbl}>Last Name</label>
              <input className={inp} value={uForm.last_name} onChange={u('last_name')} />
            </div>
            <div className={fld}><label className={lbl}>Username</label>
              <input className={inp} value={uForm.username} onChange={u('username')} />
            </div>
            <div className={fld}><label className={lbl}>Email</label>
              <input className={inp} type="email" value={uForm.email} onChange={u('email')} />
            </div>
            <div className={fld}><label className={lbl}>Phone</label>
              <input className={inp} type="tel" value={uForm.phone} onChange={u('phone')} />
            </div>
            <div className={fld}><label className={lbl}>Role</label>
              <select className={sel} value={uForm.role} onChange={u('role')}>
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div className={`${fld} col-span-2`}><label className={lbl}>Account Status</label>
              <select className={sel} value={uForm.is_active ? 'true' : 'false'}
                onChange={ev => setUForm(p => ({ ...p, is_active: ev.target.value === 'true' }))}>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
          </div>

          <div className="border-t pt-4" style={{ borderColor: 'var(--border)' }}>
            <label className="flex items-center gap-2 cursor-pointer mb-3">
              <input type="checkbox" className="w-4 h-4" checked={changePassword}
                onChange={ev => { setChangePassword(ev.target.checked); if (!ev.target.checked) setUForm(p => ({ ...p, password: '', password2: '' })); }} />
              <span className="text-sm font-medium text-foreground">Change Password</span>
            </label>
            {changePassword && (
              <div className="grid grid-cols-2 gap-4">
                <div className={fld}><label className={lbl}>New Password</label>
                  <input className={inp} type="password" value={uForm.password} onChange={u('password')} placeholder="Min 8 characters" />
                </div>
                <div className={fld}><label className={lbl}>Confirm Password</label>
                  <input className={inp} type="password" value={uForm.password2} onChange={u('password2')} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Employment ── */}
        <div className="card space-y-5">
          <h2 className="font-semibold text-foreground border-b pb-3" style={{ borderColor: 'var(--border)' }}>
            Employment Details
            {!emp && <span className="ml-2 text-xs font-normal text-muted-foreground">(fill Hiring Date to create employee profile)</span>}
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div className={fld}><label className={lbl}>Hiring Date</label>
              <input className={inp} type="date" value={eForm.join_date} onChange={ef('join_date')} />
            </div>
            <div className={fld}><label className={lbl}>Employment Type</label>
              <select className={sel} value={eForm.employment_type} onChange={ef('employment_type')}>
                <option value="full_time">Full Time</option>
                <option value="part_time">Part Time</option>
                <option value="contract">Contract</option>
                <option value="intern">Intern</option>
              </select>
            </div>
            <div className={fld}><label className={lbl}>Department</label>
              <select className={sel} value={eForm.department} onChange={ef('department')}>
                <option value="">— None —</option>
                {depts?.results?.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className={fld}><label className={lbl}>Position</label>
              <select className={sel} value={eForm.position} onChange={ef('position')}>
                <option value="">— None —</option>
                {positions?.results?.map((pos: any) => <option key={pos.id} value={pos.id}>{pos.title}</option>)}
              </select>
            </div>
            <div className={fld}><label className={lbl}>Work Location</label>
              <input className={inp} value={eForm.work_location} onChange={ef('work_location')} />
            </div>
            <div className={fld}><label className={lbl}>Salary Display Name</label>
              <input className={inp} value={eForm.salary_display_name} onChange={ef('salary_display_name')} />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-4">
            {[['basic_salary','Basic'],['housing_allowance','Housing'],['transport_allowance','Transport'],['other_allowances','Other']].map(([k,l]) => (
              <div key={k} className={fld}><label className={lbl}>{l} (AED)</label>
                <input className={inp} type="number" min="0" value={(eForm as any)[k]} onChange={ef(k)} />
              </div>
            ))}
          </div>
          {totalSalary > 0 && (
            <div className="flex justify-between items-center p-3 rounded-lg" style={{ background: 'var(--sidebar-active-bg)' }}>
              <span className="text-sm font-semibold" style={{ color: 'var(--sidebar-active-text)' }}>Total Package</span>
              <span className="text-lg font-bold" style={{ color: 'var(--sidebar-active-text)' }}>
                {totalSalary.toLocaleString('en-US', { minimumFractionDigits: 2 })} AED
              </span>
            </div>
          )}
        </div>

        {/* ── Personal Info ── */}
        <div className="card space-y-5">
          <h2 className="font-semibold text-foreground border-b pb-3" style={{ borderColor: 'var(--border)' }}>Personal Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className={fld}><label className={lbl}>Gender</label>
              <select className={sel} value={eForm.gender} onChange={ef('gender')}>
                <option value="">—</option><option value="male">Male</option><option value="female">Female</option>
              </select>
            </div>
            <div className={fld}><label className={lbl}>Marital Status</label>
              <select className={sel} value={eForm.marital_status} onChange={ef('marital_status')}>
                <option value="">—</option><option value="single">Single</option>
                <option value="married">Married</option><option value="divorced">Divorced</option><option value="widowed">Widowed</option>
              </select>
            </div>
            <div className={fld}><label className={lbl}>Date of Birth</label>
              <input className={inp} type="date" value={eForm.date_of_birth} onChange={ef('date_of_birth')} />
            </div>
            <div className={fld}><label className={lbl}>Nationality</label>
              <input className={inp} value={eForm.nationality} onChange={ef('nationality')} />
            </div>
            <div className={fld}><label className={lbl}>National ID</label>
              <input className={inp} value={eForm.national_id} onChange={ef('national_id')} />
            </div>
            <div className={fld}><label className={lbl}>Personal Email</label>
              <input className={inp} type="email" value={eForm.personal_email} onChange={ef('personal_email')} />
            </div>
            <div className={fld}><label className={lbl}>Mobile Number</label>
              <input className={inp} value={eForm.mobile_number} onChange={ef('mobile_number')} />
            </div>
            <div className={fld}><label className={lbl}>Passport Number</label>
              <input className={inp} value={eForm.passport_number} onChange={ef('passport_number')} />
            </div>
            <div className={fld}><label className={lbl}>Passport Issue Date</label>
              <input className={inp} type="date" value={eForm.passport_issue_date} onChange={ef('passport_issue_date')} />
            </div>
            <div className={fld}><label className={lbl}>Passport Expiry Date</label>
              <input className={inp} type="date" value={eForm.passport_expiry_date} onChange={ef('passport_expiry_date')} />
            </div>
            <div className={`${fld} col-span-2`}><label className={lbl}>Address</label>
              <textarea className={inp} rows={2} value={eForm.address} onChange={ef('address')} />
            </div>
          </div>
        </div>

        {/* ── UAE Legal ── */}
        <div className="card space-y-5">
          <h2 className="font-semibold text-foreground border-b pb-3" style={{ borderColor: 'var(--border)' }}>UAE Legal</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className={fld}><label className={lbl}>Resident ID</label>
              <input className={inp} value={eForm.resident_id} onChange={ef('resident_id')} />
            </div>
            <div className={fld}><label className={lbl}>Labor Card</label>
              <input className={inp} value={eForm.labor_card} onChange={ef('labor_card')} />
            </div>
            <div className={fld}><label className={lbl}>Labor Card Expiry</label>
              <input className={inp} type="date" value={eForm.labor_card_expiry} onChange={ef('labor_card_expiry')} />
            </div>
            <div className={fld}><label className={lbl}>MOL Number</label>
              <input className={inp} value={eForm.mol_number} onChange={ef('mol_number')} />
            </div>
            <div className={fld}><label className={lbl}>Sponsor Name</label>
              <input className={inp} value={eForm.sponsor_name} onChange={ef('sponsor_name')} />
            </div>
            <div className={fld}><label className={lbl}>Sponsor ID</label>
              <input className={inp} value={eForm.sponsor_id} onChange={ef('sponsor_id')} />
            </div>
            <div className={`${fld} col-span-2`}><label className={lbl}>UAE Citizen?</label>
              <select className={sel} value={eForm.is_citizen ? 'true' : 'false'}
                onChange={ev => setEForm(p => ({ ...p, is_citizen: ev.target.value === 'true' }))}>
                <option value="false">No</option>
                <option value="true">Yes</option>
              </select>
            </div>
          </div>
        </div>

        {/* Save */}
        <div className="flex gap-3">
          <Button variant="primary" onClick={handleSave} isLoading={isSaving}>
            {isSaving ? 'Saving...' : 'Save All'}
          </Button>
          <Link href="/users"><Button variant="secondary">Cancel</Button></Link>
        </div>
      </div>
    </MainLayout>
  );
}
