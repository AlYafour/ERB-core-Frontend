'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import MainLayout from '@/components/layout/MainLayout';
import { hrEmployeesApi, hrDepartmentsApi, hrPositionsApi } from '@/lib/api/hr';
import { usersApi } from '@/lib/api/users';
import { permissionsApi } from '@/lib/api/permissions';
import { toast } from '@/lib/hooks/use-toast';
import { Button } from '@/components/ui';
import Link from 'next/link';
import { HRPosition } from '@/types';

const inp = 'w-full px-3 py-2 rounded-md border text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40';
const sel = inp;
const fld = 'flex flex-col gap-1';
const lbl = 'text-xs font-medium text-muted-foreground uppercase tracking-wide';

const STEPS = ['Personal Info', 'Employment', 'Account & Access'];

export default function NewEmployeePage() {
  const router = useRouter();
  const [step, setStep] = useState(0);

  const [personal, setPersonal] = useState({
    first_name: '', second_name: '', third_name: '', last_name: '',
    gender: '', date_of_birth: '', nationality: '', home_country: '',
    religion: '', national_id: '', passport_number: '',
    passport_issue_date: '', passport_expiry_date: '',
    personal_email: '', marital_status: '',
  });

  const [employment, setEmployment] = useState({
    employment_type: 'full_time',
    join_date: new Date().toISOString().split('T')[0],
    probation_end_date: '', end_date: '',
    department: '', position: '',
    work_location: '', salary_display_name: '',
    basic_salary: '0', housing_allowance: '0',
    transport_allowance: '0', other_allowances: '0',
  });

  const [account, setAccount] = useState({
    username: '', email: '', phone: '', password: '',
    role: 'site_engineer', is_active: false,
  });

  const { data: depts }     = useQuery({ queryKey: ['hr-depts'],     queryFn: () => hrDepartmentsApi.getAll({ page: 1 }) });
  const { data: positions } = useQuery({ queryKey: ['hr-positions'], queryFn: () => hrPositionsApi.getAll({ page: 1 }) });

  const selectedPosition: HRPosition | undefined = positions?.results?.find(
    (pos: HRPosition) => String(pos.id) === String(employment.position)
  );

  const totalSalary =
    parseFloat(employment.basic_salary || '0') +
    parseFloat(employment.housing_allowance || '0') +
    parseFloat(employment.transport_allowance || '0') +
    parseFloat(employment.other_allowances || '0');

  const createUserMutation  = useMutation({ mutationFn: usersApi.create });
  const createEmpMutation   = useMutation({ mutationFn: (data: any) => hrEmployeesApi.create(data) });
  const isSubmitting = createUserMutation.isPending || createEmpMutation.isPending;

  const handleFinalSubmit = async () => {
    if (!account.username || !account.email || !account.password) {
      toast('Username, email and password are required', 'error'); return;
    }
    try {
      const user = await createUserMutation.mutateAsync({
        first_name:  personal.first_name,
        last_name:   personal.last_name,
        second_name: personal.second_name,
        third_name:  personal.third_name,
        username:    account.username,
        email:       account.email,
        phone:       account.phone,
        password:    account.password,
        role:        account.role,
        is_active:   account.is_active,
      } as any);

      await createEmpMutation.mutateAsync({
        user_id: user.id,
        employment_type:      employment.employment_type,
        join_date:            employment.join_date,
        probation_end_date:   employment.probation_end_date   || null,
        end_date:             employment.end_date             || null,
        department:           employment.department           || null,
        position:             employment.position             || null,
        work_location:        employment.work_location,
        salary_display_name:  employment.salary_display_name,
        basic_salary:         employment.basic_salary,
        housing_allowance:    employment.housing_allowance,
        transport_allowance:  employment.transport_allowance,
        other_allowances:     employment.other_allowances,
        gender:               personal.gender,
        date_of_birth:        personal.date_of_birth         || null,
        nationality:          personal.nationality,
        home_country:         personal.home_country,
        religion:             personal.religion,
        national_id:          personal.national_id,
        passport_number:      personal.passport_number,
        passport_issue_date:  personal.passport_issue_date   || null,
        passport_expiry_date: personal.passport_expiry_date  || null,
        personal_email:       personal.personal_email,
        marital_status:       personal.marital_status,
      });

      toast('Employee created successfully', 'success');
      router.push('/hr/employees');
    } catch (err: any) {
      const msg = err?.response?.data
        ? Object.values(err.response.data).flat().join(' — ')
        : 'Failed to create employee';
      toast(msg as string, 'error');
    }
  };

  const p  = (k: string) => (e: React.ChangeEvent<any>) => setPersonal(prev => ({ ...prev, [k]: e.target.value }));
  const em = (k: string) => (e: React.ChangeEvent<any>) => setEmployment(prev => ({ ...prev, [k]: e.target.value }));
  const ac = (k: string) => (e: React.ChangeEvent<any>) => setAccount(prev => ({ ...prev, [k]: e.target.value }));

  return (
    <MainLayout>
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/hr/employees">
            <button className="text-sm text-muted-foreground hover:text-foreground transition-colors">← Employees</button>
          </Link>
          <span className="text-muted-foreground">/</span>
          <h1 className="text-xl font-bold text-foreground">New Employee</h1>
        </div>

        {/* Steps */}
        <div className="flex items-center gap-2">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold cursor-pointer"
                style={{
                  backgroundColor: i < step ? '#10b981' : i === step ? 'var(--sidebar-active-bg)' : 'var(--muted)',
                  color: i <= step ? 'white' : 'var(--muted-foreground)',
                }}
                onClick={() => { if (i < step) setStep(i); }}>
                {i < step ? '✓' : i + 1}
              </div>
              <span className="text-sm font-medium hidden sm:block"
                style={{ color: i === step ? 'var(--foreground)' : 'var(--muted-foreground)' }}>{s}</span>
              {i < STEPS.length - 1 && (
                <div className="w-8 h-px mx-1" style={{ backgroundColor: i < step ? '#10b981' : 'var(--border)' }} />
              )}
            </div>
          ))}
        </div>

        {/* ── STEP 0: Personal Info ── */}
        {step === 0 && (
          <div className="card space-y-5">
            <h2 className="font-semibold text-foreground border-b pb-3" style={{ borderColor: 'var(--border)' }}>Personal Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className={fld}><label className={lbl}>First Name *</label><input className={inp} value={personal.first_name} onChange={p('first_name')} /></div>
              <div className={fld}><label className={lbl}>Second Name</label><input className={inp} value={personal.second_name} onChange={p('second_name')} /></div>
              <div className={fld}><label className={lbl}>Third Name</label><input className={inp} value={personal.third_name} onChange={p('third_name')} /></div>
              <div className={fld}><label className={lbl}>Last Name</label><input className={inp} value={personal.last_name} onChange={p('last_name')} /></div>
              <div className={fld}><label className={lbl}>Gender</label>
                <select className={sel} value={personal.gender} onChange={p('gender')}>
                  <option value="">—</option><option value="male">Male</option><option value="female">Female</option>
                </select>
              </div>
              <div className={fld}><label className={lbl}>Marital Status</label>
                <select className={sel} value={personal.marital_status} onChange={p('marital_status')}>
                  <option value="">—</option><option value="single">Single</option>
                  <option value="married">Married</option><option value="divorced">Divorced</option><option value="widowed">Widowed</option>
                </select>
              </div>
              <div className={fld}><label className={lbl}>Date of Birth</label><input className={inp} type="date" value={personal.date_of_birth} onChange={p('date_of_birth')} /></div>
              <div className={fld}><label className={lbl}>Nationality</label><input className={inp} value={personal.nationality} onChange={p('nationality')} /></div>
              <div className={fld}><label className={lbl}>Home Country</label><input className={inp} value={personal.home_country} onChange={p('home_country')} /></div>
              <div className={fld}><label className={lbl}>Religion</label><input className={inp} value={personal.religion} onChange={p('religion')} /></div>
              <div className={fld}><label className={lbl}>National ID</label><input className={inp} value={personal.national_id} onChange={p('national_id')} /></div>
              <div className={fld}><label className={lbl}>Personal Email</label><input className={inp} type="email" value={personal.personal_email} onChange={p('personal_email')} /></div>
              <div className={fld}><label className={lbl}>Passport Number</label><input className={inp} value={personal.passport_number} onChange={p('passport_number')} /></div>
              <div className={fld}><label className={lbl}>Passport Issue Date</label><input className={inp} type="date" value={personal.passport_issue_date} onChange={p('passport_issue_date')} /></div>
              <div className={`${fld} col-span-2`}><label className={lbl}>Passport Expiry Date</label><input className={inp} type="date" value={personal.passport_expiry_date} onChange={p('passport_expiry_date')} /></div>
            </div>
            <div className="flex justify-end pt-2">
              <Button variant="primary" onClick={() => {
                if (!personal.first_name) { toast('First name is required', 'error'); return; }
                setStep(1);
              }}>Next →</Button>
            </div>
          </div>
        )}

        {/* ── STEP 1: Employment ── */}
        {step === 1 && (
          <div className="card space-y-5">
            <h2 className="font-semibold text-foreground border-b pb-3" style={{ borderColor: 'var(--border)' }}>Employment Details</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className={fld}><label className={lbl}>Employment Type</label>
                <select className={sel} value={employment.employment_type} onChange={em('employment_type')}>
                  <option value="full_time">Full Time</option><option value="part_time">Part Time</option>
                  <option value="contract">Contract</option><option value="intern">Intern</option>
                </select>
              </div>
              <div className={fld}><label className={lbl}>Work Location</label><input className={inp} value={employment.work_location} onChange={em('work_location')} /></div>
              <div className={fld}><label className={lbl}>Department</label>
                <select className={sel} value={employment.department} onChange={em('department')}>
                  <option value="">— None —</option>
                  {depts?.results?.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div className={fld}><label className={lbl}>Position</label>
                <select className={sel} value={employment.position} onChange={em('position')}>
                  <option value="">— None —</option>
                  {positions?.results?.map((pos: HRPosition) => <option key={pos.id} value={pos.id}>{pos.title}</option>)}
                </select>
              </div>

              {selectedPosition?.permission_set_name && (
                <div className="col-span-2 rounded-lg px-4 py-3 flex items-center gap-3"
                  style={{ background: 'var(--sidebar-active-bg)' }}>
                  <span>🔑</span>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--sidebar-active-text)' }}>
                      Access auto-assigned from position
                    </p>
                    <p className="text-xs" style={{ color: 'var(--sidebar-active-text)', opacity: 0.8 }}>
                      "{selectedPosition.title}" → <strong>{selectedPosition.permission_set_name}</strong>
                    </p>
                  </div>
                </div>
              )}

              <div className={fld}><label className={lbl}>Hiring Date *</label><input className={inp} type="date" value={employment.join_date} onChange={em('join_date')} /></div>
              <div className={fld}><label className={lbl}>End of Probation</label><input className={inp} type="date" value={employment.probation_end_date} onChange={em('probation_end_date')} /></div>
              <div className={`${fld} col-span-2`}><label className={lbl}>Salary Display Name</label><input className={inp} value={employment.salary_display_name} onChange={em('salary_display_name')} placeholder="Name on payslip" /></div>
            </div>

            <div className="border-t pt-4" style={{ borderColor: 'var(--border)' }}>
              <p className="text-sm font-semibold text-foreground mb-3">Salary Package (AED/month)</p>
              <div className="grid grid-cols-2 gap-4">
                {[['basic_salary','Basic Salary'],['housing_allowance','Housing'],['transport_allowance','Transport'],['other_allowances','Other']].map(([k, l]) => (
                  <div key={k} className={fld}><label className={lbl}>{l}</label>
                    <input className={inp} type="number" min="0" value={(employment as any)[k]} onChange={em(k)} />
                  </div>
                ))}
              </div>
              <div className="mt-3 p-3 rounded-lg flex justify-between items-center" style={{ background: 'var(--sidebar-active-bg)' }}>
                <span className="text-sm font-semibold" style={{ color: 'var(--sidebar-active-text)' }}>Total</span>
                <span className="text-lg font-bold" style={{ color: 'var(--sidebar-active-text)' }}>
                  {totalSalary.toLocaleString('en-US', { minimumFractionDigits: 2 })} AED
                </span>
              </div>
            </div>
            <div className="flex justify-between pt-2">
              <Button variant="secondary" onClick={() => setStep(0)}>← Back</Button>
              <Button variant="primary" onClick={() => {
                if (!employment.join_date) { toast('Hiring date is required', 'error'); return; }
                setStep(2);
              }}>Next →</Button>
            </div>
          </div>
        )}

        {/* ── STEP 2: Account & Access ── */}
        {step === 2 && (
          <div className="card space-y-5">
            <h2 className="font-semibold text-foreground border-b pb-3" style={{ borderColor: 'var(--border)' }}>System Account & Access</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className={fld}><label className={lbl}>Username *</label><input className={inp} value={account.username} onChange={ac('username')} placeholder="e.g. 1009-004" /></div>
              <div className={fld}><label className={lbl}>Work Email *</label><input className={inp} type="email" value={account.email} onChange={ac('email')} /></div>
              <div className={fld}><label className={lbl}>Phone</label><input className={inp} type="tel" value={account.phone} onChange={ac('phone')} /></div>
              <div className={fld}><label className={lbl}>Password *</label>
                <input className={inp} type="password" value={account.password} onChange={ac('password')} minLength={8} />
                <span className="text-xs text-muted-foreground">Min 8 characters</span>
              </div>

              {!selectedPosition?.permission_set_name && (
                <div className={`${fld} col-span-2`}><label className={lbl}>Role</label>
                  <select className={sel} value={account.role} onChange={ac('role')}>
                    <option value="site_engineer">Site Engineer</option>
                    <option value="procurement_officer">Procurement Officer</option>
                    <option value="procurement_manager">Procurement Manager</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                </div>
              )}

              <div className={`${fld} col-span-2`}><label className={lbl}>Account Status</label>
                <div className="flex gap-3 mt-1">
                  {[
                    { val: false, label: 'Inactive — activate later', desc: 'Cannot log in until activated' },
                    { val: true,  label: 'Active immediately',         desc: 'Can log in right away' },
                  ].map(({ val, label, desc }) => (
                    <label key={String(val)} className="flex items-start gap-3 cursor-pointer p-3 rounded-lg border flex-1"
                      style={{
                        borderColor: account.is_active === val ? 'var(--sidebar-active-text)' : 'var(--border)',
                        background:  account.is_active === val ? 'var(--sidebar-active-bg)' : 'transparent',
                      }}>
                      <input type="radio" className="mt-0.5" checked={account.is_active === val}
                        onChange={() => setAccount(prev => ({ ...prev, is_active: val }))} />
                      <div>
                        <p className="text-sm font-medium text-foreground">{label}</p>
                        <p className="text-xs text-muted-foreground">{desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Summary card */}
            <div className="rounded-lg p-4 border space-y-2" style={{ borderColor: 'var(--border)', background: 'var(--muted)' }}>
              <p className="text-sm font-semibold text-foreground mb-2">Summary</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                <span className="text-muted-foreground">Name</span>
                <span className="font-medium">{[personal.first_name, personal.second_name, personal.third_name, personal.last_name].filter(Boolean).join(' ')}</span>
                <span className="text-muted-foreground">Position</span>
                <span className="font-medium">{selectedPosition?.title || '—'}</span>
                <span className="text-muted-foreground">Access</span>
                <span className="font-medium" style={{ color: 'var(--sidebar-active-text)' }}>
                  {selectedPosition?.permission_set_name || account.role.replace(/_/g, ' ')}
                </span>
                <span className="text-muted-foreground">Total Salary</span>
                <span className="font-bold">{totalSalary.toLocaleString()} AED</span>
                <span className="text-muted-foreground">Account</span>
                <span className={`font-medium ${account.is_active ? 'text-green-600' : 'text-orange-500'}`}>
                  {account.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>

            <div className="flex justify-between pt-2">
              <Button variant="secondary" onClick={() => setStep(1)}>← Back</Button>
              <Button variant="primary" onClick={handleFinalSubmit} isLoading={isSubmitting}
                disabled={!account.username || !account.email || !account.password || isSubmitting}>
                {isSubmitting ? 'Creating...' : 'Create Employee'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
