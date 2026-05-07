'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '@/lib/api/users';
import { hrEmployeesApi, hrDepartmentsApi, hrPositionsApi } from '@/lib/api/hr';
import MainLayout from '@/components/layout/MainLayout';
import Link from 'next/link';
import { Button, Badge } from '@/components/ui';
import { toast } from '@/lib/hooks/use-toast';
import { useAuth } from '@/lib/hooks/use-auth';

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
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [avatarFile, setAvatarFile]       = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [changePassword, setChangePassword] = useState(false);
  const [redirecting, setRedirecting]     = useState(false);

  // User form
  const [uForm, setUForm] = useState({
    username: '', email: '', first_name: '', last_name: '',
    phone: '', role: 'site_engineer', is_active: true,
    password: '', password2: '',
  });

  // Employee form (empty until filled)
  const [eForm, setEForm] = useState({
    employment_type: 'full_time', join_date: '',
    department: '', position: '', work_location: '',
    salary_display_name: '', basic_salary: '0',
    housing_allowance: '0', transport_allowance: '0', other_allowances: '0',
    gender: '', date_of_birth: '', nationality: '', marital_status: '',
    national_id: '', passport_number: '',
    passport_issue_date: '', passport_expiry_date: '',
    personal_email: '', mobile_number: '', address: '',
  });

  // Fetch user
  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => usersApi.getById(userId),
    enabled: !!userId,
  });

  // Check for employee record
  const { data: empData, isLoading: empLoading } = useQuery({
    queryKey: ['employee-by-user', userId],
    queryFn: () => hrEmployeesApi.getAll({ user: userId }),
    enabled: !!userId,
  });

  const { data: depts }     = useQuery({ queryKey: ['hr-depts'],     queryFn: () => hrDepartmentsApi.getAll({ page: 1 }) });
  const { data: positions } = useQuery({ queryKey: ['hr-positions'], queryFn: () => hrPositionsApi.getAll({ page: 1 }) });

  // Redirect if employee record exists
  useEffect(() => {
    if (empLoading || !empData) return;
    const emp = empData.results?.[0];
    if (emp) {
      setRedirecting(true);
      router.replace(`/hr/employees/${emp.id}`);
    }
  }, [empData, empLoading, router]);

  // Pre-fill user form
  useEffect(() => {
    if (!user) return;
    setUForm({
      username:   user.username   || '',
      email:      user.email      || '',
      first_name: user.first_name || '',
      last_name:  user.last_name  || '',
      phone:      user.phone      || '',
      role:       user.role       || 'site_engineer',
      is_active:  user.is_active  ?? true,
      password:   '',
      password2:  '',
    });
  }, [user]);

  const u = (k: string) => (e: React.ChangeEvent<any>) => setUForm(p => ({ ...p, [k]: e.target.value }));
  const e = (k: string) => (ev: React.ChangeEvent<any>) => setEForm(p => ({ ...p, [k]: ev.target.value }));

  const userMutation = useMutation({
    mutationFn: (data: any) => usersApi.update(userId, { ...data, ...(avatarFile ? { avatar: avatarFile } : {}) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user', userId] });
      toast('Account updated', 'success');
    },
    onError: () => toast('Failed to update account', 'error'),
  });

  const createEmpMutation = useMutation({
    mutationFn: (data: any) => hrEmployeesApi.create(data),
    onSuccess: (emp) => {
      toast('Employee profile created', 'success');
      router.replace(`/hr/employees/${emp.id}`);
    },
    onError: () => toast('Failed to create employee profile', 'error'),
  });

  const isSaving = userMutation.isPending || createEmpMutation.isPending;

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

    // Save user always
    userMutation.mutate(userData);

    // If employee fields have something, create employee record too
    if (eForm.join_date) {
      createEmpMutation.mutate({
        user_id:              userId,
        employment_type:      eForm.employment_type,
        join_date:            eForm.join_date,
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
      });
    }
  };

  if (userLoading || empLoading || redirecting) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center py-24">
          <p className="text-muted-foreground text-sm">Loading...</p>
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

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/users">
            <button className="text-sm text-muted-foreground hover:text-foreground">← Users</button>
          </Link>
          <span className="text-muted-foreground">/</span>
          <h1 className="text-xl font-bold text-foreground">{user.first_name || user.username}</h1>
          <Badge className={user.is_active ? 'badge-success' : 'badge-error'}>
            {user.is_active ? 'Active' : 'Inactive'}
          </Badge>
        </div>

        {/* ── Account Info ── */}
        <div className="card space-y-5">
          <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--border)' }}>
            <h2 className="font-semibold text-foreground">Account Information</h2>
          </div>

          {/* Avatar */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full overflow-hidden border-2 flex items-center justify-center text-2xl font-bold flex-shrink-0"
              style={{ backgroundColor: 'var(--sidebar-active-bg)', color: 'var(--sidebar-active-text)', borderColor: 'var(--border)' }}>
              {avatarPreview || user.avatar
                ? <img src={avatarPreview || user.avatar || ''} alt="" className="w-full h-full object-cover" />
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
                {avatarPreview || user.avatar ? 'Change Photo' : 'Upload Photo'}
              </button>
              <p className="text-xs text-muted-foreground mt-1">JPG, PNG. Max 5MB</p>
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

        {/* ── Employee Info ── */}
        <div className="card space-y-5">
          <div className="border-b pb-3" style={{ borderColor: 'var(--border)' }}>
            <h2 className="font-semibold text-foreground">Employment Details</h2>
            <p className="text-xs text-muted-foreground mt-1">Fill hiring date to create employee profile. Leave blank to skip.</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className={fld}><label className={lbl}>Hiring Date</label>
              <input className={inp} type="date" value={eForm.join_date} onChange={e('join_date')} />
            </div>
            <div className={fld}><label className={lbl}>Employment Type</label>
              <select className={sel} value={eForm.employment_type} onChange={e('employment_type')}>
                <option value="full_time">Full Time</option>
                <option value="part_time">Part Time</option>
                <option value="contract">Contract</option>
                <option value="intern">Intern</option>
              </select>
            </div>
            <div className={fld}><label className={lbl}>Department</label>
              <select className={sel} value={eForm.department} onChange={e('department')}>
                <option value="">— None —</option>
                {depts?.results?.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className={fld}><label className={lbl}>Position</label>
              <select className={sel} value={eForm.position} onChange={e('position')}>
                <option value="">— None —</option>
                {positions?.results?.map((pos: any) => <option key={pos.id} value={pos.id}>{pos.title}</option>)}
              </select>
            </div>
            <div className={fld}><label className={lbl}>Work Location</label>
              <input className={inp} value={eForm.work_location} onChange={e('work_location')} />
            </div>
            <div className={fld}><label className={lbl}>Salary Display Name</label>
              <input className={inp} value={eForm.salary_display_name} onChange={e('salary_display_name')} />
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4">
            {[['basic_salary','Basic Salary'],['housing_allowance','Housing'],['transport_allowance','Transport'],['other_allowances','Other']].map(([k, l]) => (
              <div key={k} className={fld}><label className={lbl}>{l} (AED)</label>
                <input className={inp} type="number" min="0" value={(eForm as any)[k]} onChange={e(k)} />
              </div>
            ))}
          </div>
        </div>

        {/* ── Personal Info ── */}
        <div className="card space-y-5">
          <div className="border-b pb-3" style={{ borderColor: 'var(--border)' }}>
            <h2 className="font-semibold text-foreground">Personal Information</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className={fld}><label className={lbl}>Gender</label>
              <select className={sel} value={eForm.gender} onChange={e('gender')}>
                <option value="">—</option><option value="male">Male</option><option value="female">Female</option>
              </select>
            </div>
            <div className={fld}><label className={lbl}>Marital Status</label>
              <select className={sel} value={eForm.marital_status} onChange={e('marital_status')}>
                <option value="">—</option><option value="single">Single</option>
                <option value="married">Married</option><option value="divorced">Divorced</option>
              </select>
            </div>
            <div className={fld}><label className={lbl}>Date of Birth</label>
              <input className={inp} type="date" value={eForm.date_of_birth} onChange={e('date_of_birth')} />
            </div>
            <div className={fld}><label className={lbl}>Nationality</label>
              <input className={inp} value={eForm.nationality} onChange={e('nationality')} />
            </div>
            <div className={fld}><label className={lbl}>National ID</label>
              <input className={inp} value={eForm.national_id} onChange={e('national_id')} />
            </div>
            <div className={fld}><label className={lbl}>Personal Email</label>
              <input className={inp} type="email" value={eForm.personal_email} onChange={e('personal_email')} />
            </div>
            <div className={fld}><label className={lbl}>Mobile Number</label>
              <input className={inp} value={eForm.mobile_number} onChange={e('mobile_number')} />
            </div>
            <div className={fld}><label className={lbl}>Passport Number</label>
              <input className={inp} value={eForm.passport_number} onChange={e('passport_number')} />
            </div>
            <div className={fld}><label className={lbl}>Passport Issue Date</label>
              <input className={inp} type="date" value={eForm.passport_issue_date} onChange={e('passport_issue_date')} />
            </div>
            <div className={fld}><label className={lbl}>Passport Expiry Date</label>
              <input className={inp} type="date" value={eForm.passport_expiry_date} onChange={e('passport_expiry_date')} />
            </div>
            <div className={`${fld} col-span-2`}><label className={lbl}>Address</label>
              <textarea className={inp} rows={2} value={eForm.address} onChange={e('address')} />
            </div>
          </div>
        </div>

        {/* Save */}
        <div className="flex gap-3 pb-8">
          <Button variant="primary" onClick={handleSave} isLoading={isSaving}>
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
          <Link href="/users"><Button variant="secondary">Cancel</Button></Link>
        </div>
      </div>
    </MainLayout>
  );
}
