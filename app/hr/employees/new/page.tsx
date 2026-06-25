'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import MainLayout from '@/components/layout/MainLayout';
import { hrEmployeesApi, hrDepartmentsApi, hrPositionsApi, hrEmployeeGroupsApi } from '@/lib/api/hr';
import { usersApi } from '@/lib/api/users';
import { toast } from '@/lib/hooks/use-toast';
import { Button, PageHeader, PageShell } from '@/components/ui';
import SearchableDropdown from '@/components/ui/SearchableDropdown';
import { HRPosition } from '@/types';

export default function NewEmployeePage() {
  return (
    <Suspense>
      <NewEmployeeForm />
    </Suspense>
  );
}

function NewEmployeeForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const existingUserId = searchParams.get('user_id') ? Number(searchParams.get('user_id')) : null;

  const STEPS = existingUserId
    ? ['Personal Info', 'Employment']
    : ['Personal Info', 'Employment', 'Account & Access'];

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
    employee_group: null as number | null, salary_display_name: '',
    basic_salary: '0', housing_allowance: '0',
    transport_allowance: '0', other_allowances: '0',
  });

  const [account, setAccount] = useState({
    username: '', email: '', phone: '', password: '',
    role: 'site_engineer', is_active: false,
  });

  const { data: existingUser } = useQuery({
    queryKey: ['user-for-employee', existingUserId],
    queryFn: () => usersApi.getById(existingUserId!),
    enabled: !!existingUserId,
  });

  useEffect(() => {
    if (existingUser) {
      setPersonal(prev => ({
        ...prev,
        first_name: existingUser.first_name || prev.first_name,
        last_name:  existingUser.last_name  || prev.last_name,
      }));
    }
  }, [existingUser]);

  const queryClient = useQueryClient();
  const { data: depts }     = useQuery({ queryKey: ['hr-depts'],     queryFn: () => hrDepartmentsApi.getAll({ page: 1 }), staleTime: 300_000 });
  const { data: positions } = useQuery({ queryKey: ['hr-positions'], queryFn: () => hrPositionsApi.getAll({ page: 1 }), staleTime: 300_000 });
  const { data: groups }    = useQuery({ queryKey: ['hr-employee-groups-all'], queryFn: () => hrEmployeeGroupsApi.getAll(), staleTime: 300_000 });

  const deptOptions     = (depts?.results     ?? []).map((d) => ({ value: d.id,    label: d.name }));
  const positionOptions = (positions?.results ?? []).map((p) => ({ value: p.id,    label: p.title }));
  const groupOptions    = (groups?.results    ?? []).map((g) => ({ value: g.id,    label: g.name + (g.name_ar ? ` — ${g.name_ar}` : '') }));

  const selectedPosition: HRPosition | undefined = positions?.results?.find(
    (pos: HRPosition) => String(pos.id) === String(employment.position)
  );

  const totalSalary =
    parseFloat(employment.basic_salary || '0') +
    parseFloat(employment.housing_allowance || '0') +
    parseFloat(employment.transport_allowance || '0') +
    parseFloat(employment.other_allowances || '0');

  const createUserMutation = useMutation({ mutationFn: usersApi.create });
  const createEmpMutation  = useMutation({ mutationFn: (data: Partial<import('@/types').HREmployee>) => hrEmployeesApi.create(data) });
  const isSubmitting = createUserMutation.isPending || createEmpMutation.isPending;

  const buildEmpPayload = (userId: number) => ({
    user_id: userId,
    employment_type:      employment.employment_type,
    join_date:            employment.join_date,
    probation_end_date:   employment.probation_end_date   || null,
    end_date:             employment.end_date             || null,
    department:           employment.department           || null,
    position:             employment.position             || null,
    employee_group:       employment.employee_group || null,
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

  const handleFinalSubmit = async () => {
    try {
      if (existingUserId) {
        await createEmpMutation.mutateAsync(buildEmpPayload(existingUserId));
      } else {
        if (!account.username || !account.email || !account.password) {
          toast('Username, email and password are required', 'error'); return;
        }
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
        });
        await createEmpMutation.mutateAsync(buildEmpPayload(user.id));
      }
      toast('Employee created successfully', 'success');
      router.push('/hr/employees');
    } catch (err: unknown) {
      const e = err as { response?: { data?: Record<string, unknown[]> } };
      const msg = e?.response?.data
        ? Object.values(e.response.data).flat().join(' — ')
        : 'Failed to create employee';
      toast(msg as string, 'error');
    }
  };

  const p  = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setPersonal(prev => ({ ...prev, [k]: e.target.value }));
  const em = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setEmployment(prev => ({ ...prev, [k]: e.target.value }));
  const ac = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setAccount(prev => ({ ...prev, [k]: e.target.value }));

  const isLastStep = step === STEPS.length - 1;

  return (
    <MainLayout>
      <PageShell>
        <PageHeader
          title="New Employee"
          breadcrumbs={[{ label: 'HR' }, { label: 'Employees', href: '/hr/employees' }, { label: 'New Employee' }]}
        />

        {existingUserId && existingUser && (
          <div style={{ borderRadius: 'var(--radius-md)', padding: 'var(--space-3) var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)', border: '1px solid var(--sidebar-active-text)', background: 'var(--sidebar-active-bg)' }}>
            <span>🔗</span>
            <div>
              <p style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', color: 'var(--sidebar-active-text)', margin: 0 }}>
                Linking to existing account
              </p>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--sidebar-active-text)', opacity: 0.8, margin: 0 }}>
                @{existingUser.username} · {existingUser.email}
              </p>
            </div>
          </div>
        )}

        {/* Steps */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          {STEPS.map((s, i) => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <div
                style={{
                  width: 32, height: 32, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', cursor: 'pointer',
                  backgroundColor: i < step ? '#10b981' : i === step ? 'var(--sidebar-active-bg)' : 'var(--surface-subtle)',
                  color: i <= step ? 'white' : 'var(--text-secondary)',
                }}
                onClick={() => { if (i < step) setStep(i); }}>
                {i < step ? '✓' : i + 1}
              </div>
              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: i === step ? 'inherit' : 'var(--text-secondary)' }}>{s}</span>
              {i < STEPS.length - 1 && (
                <div style={{ width: 32, height: 1, margin: '0 var(--space-1)', backgroundColor: i < step ? '#10b981' : 'var(--border-subtle)' }} />
              )}
            </div>
          ))}
        </div>

        {/* STEP 0: Personal Info */}
        {step === 0 && (
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
            <h2 style={{ fontWeight: 'var(--weight-semibold)', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 'var(--space-3)', margin: 0 }}>Personal Information</h2>
            <div className="form-grid">
              <div className="form-field"><label className="form-label">First Name *</label><input className="form-input" value={personal.first_name} onChange={p('first_name')} /></div>
              <div className="form-field"><label className="form-label">Second Name</label><input className="form-input" value={personal.second_name} onChange={p('second_name')} /></div>
              <div className="form-field"><label className="form-label">Third Name</label><input className="form-input" value={personal.third_name} onChange={p('third_name')} /></div>
              <div className="form-field"><label className="form-label">Last Name</label><input className="form-input" value={personal.last_name} onChange={p('last_name')} /></div>
              <div className="form-field"><label className="form-label">Gender</label>
                <select className="form-select" value={personal.gender} onChange={p('gender')}>
                  <option value="">—</option><option value="male">Male</option><option value="female">Female</option>
                </select>
              </div>
              <div className="form-field"><label className="form-label">Marital Status</label>
                <select className="form-select" value={personal.marital_status} onChange={p('marital_status')}>
                  <option value="">—</option><option value="single">Single</option>
                  <option value="married">Married</option><option value="divorced">Divorced</option><option value="widowed">Widowed</option>
                </select>
              </div>
              <div className="form-field"><label className="form-label">Date of Birth</label><input className="form-input" type="date" value={personal.date_of_birth} onChange={p('date_of_birth')} /></div>
              <div className="form-field"><label className="form-label">Nationality</label><input className="form-input" value={personal.nationality} onChange={p('nationality')} /></div>
              <div className="form-field"><label className="form-label">Home Country</label><input className="form-input" value={personal.home_country} onChange={p('home_country')} /></div>
              <div className="form-field"><label className="form-label">Religion</label><input className="form-input" value={personal.religion} onChange={p('religion')} /></div>
              <div className="form-field"><label className="form-label">National ID</label><input className="form-input" value={personal.national_id} onChange={p('national_id')} /></div>
              <div className="form-field"><label className="form-label">Personal Email</label><input className="form-input" type="email" value={personal.personal_email} onChange={p('personal_email')} /></div>
              <div className="form-field"><label className="form-label">Passport Number</label><input className="form-input" value={personal.passport_number} onChange={p('passport_number')} /></div>
              <div className="form-field"><label className="form-label">Passport Issue Date</label><input className="form-input" type="date" value={personal.passport_issue_date} onChange={p('passport_issue_date')} /></div>
              <div className="form-field" style={{ gridColumn: '1 / -1' }}><label className="form-label">Passport Expiry Date</label><input className="form-input" type="date" value={personal.passport_expiry_date} onChange={p('passport_expiry_date')} /></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 'var(--space-2)' }}>
              <Button variant="primary" onClick={() => {
                if (!personal.first_name) { toast('First name is required', 'error'); return; }
                setStep(1);
              }}>Next →</Button>
            </div>
          </div>
        )}

        {/* STEP 1: Employment */}
        {step === 1 && (
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
            <h2 style={{ fontWeight: 'var(--weight-semibold)', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 'var(--space-3)', margin: 0 }}>Employment Details</h2>
            <div className="form-grid">
              <div className="form-field"><label className="form-label">Employment Type</label>
                <select className="form-select" value={employment.employment_type} onChange={em('employment_type')}>
                  <option value="full_time">Full Time</option><option value="part_time">Part Time</option>
                  <option value="contract">Contract</option><option value="intern">Intern</option>
                </select>
              </div>
              <div className="form-field">
                <label className="form-label">Employee Group</label>
                <SearchableDropdown
                  options={groupOptions}
                  value={employment.employee_group}
                  onChange={(v) => setEmployment((p) => ({ ...p, employee_group: v as number | null }))}
                  placeholder="— None —"
                  allowClear
                />
              </div>
              <div className="form-field">
                <label className="form-label">Department</label>
                <SearchableDropdown
                  options={deptOptions}
                  value={employment.department ? Number(employment.department) : null}
                  onChange={(v) => setEmployment((p) => ({ ...p, department: v ? String(v) : '' }))}
                  placeholder="— None —"
                  allowClear
                  onCreateOption={async (name) => {
                    const dept = await hrDepartmentsApi.create({ name });
                    queryClient.invalidateQueries({ queryKey: ['hr-depts'] });
                    toast(`Department "${name}" created`, 'success');
                    return { value: dept.id, label: dept.name };
                  }}
                />
              </div>
              <div className="form-field">
                <label className="form-label">Position</label>
                <SearchableDropdown
                  options={positionOptions}
                  value={employment.position ? Number(employment.position) : null}
                  onChange={(v) => setEmployment((p) => ({ ...p, position: v ? String(v) : '' }))}
                  placeholder="— None —"
                  allowClear
                  onCreateOption={async (title) => {
                    const pos = await hrPositionsApi.create({ title });
                    queryClient.invalidateQueries({ queryKey: ['hr-positions'] });
                    toast(`Position "${title}" created`, 'success');
                    return { value: pos.id, label: pos.title };
                  }}
                />
              </div>

              {selectedPosition?.permission_set_name && (
                <div style={{ gridColumn: '1 / -1', borderRadius: 'var(--radius-md)', padding: 'var(--space-3) var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)', background: 'var(--sidebar-active-bg)' }}>
                  <span>🔑</span>
                  <div>
                    <p style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', color: 'var(--sidebar-active-text)', margin: 0 }}>
                      Access auto-assigned from position
                    </p>
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--sidebar-active-text)', opacity: 0.8, margin: 0 }}>
                      {'"'}{selectedPosition.title}{'"'} → <strong>{selectedPosition.permission_set_name}</strong>
                    </p>
                  </div>
                </div>
              )}

              <div className="form-field"><label className="form-label">Hiring Date *</label><input className="form-input" type="date" value={employment.join_date} onChange={em('join_date')} /></div>
              <div className="form-field"><label className="form-label">End of Probation</label><input className="form-input" type="date" value={employment.probation_end_date} onChange={em('probation_end_date')} /></div>
              <div className="form-field" style={{ gridColumn: '1 / -1' }}><label className="form-label">Salary Display Name</label><input className="form-input" value={employment.salary_display_name} onChange={em('salary_display_name')} placeholder="Name on payslip" /></div>
            </div>

            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-4)' }}>
              <p style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', marginBottom: 'var(--space-3)', marginTop: 0 }}>Salary Package (AED/month)</p>
              <div className="form-grid">
                {[['basic_salary','Basic Salary'],['housing_allowance','Housing'],['transport_allowance','Transport'],['other_allowances','Other']].map(([k, l]) => (
                  <div key={k} className="form-field"><label className="form-label">{l}</label>
                    <input className="form-input" type="number" min="0" value={(employment as Record<string, unknown>)[k] as string} onChange={em(k)} />
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 'var(--space-3)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--sidebar-active-bg)' }}>
                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', color: 'var(--sidebar-active-text)' }}>Total</span>
                <span style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)', color: 'var(--sidebar-active-text)' }}>
                  {totalSalary.toLocaleString('en-US', { minimumFractionDigits: 2 })} AED
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 'var(--space-2)' }}>
              <Button variant="secondary" onClick={() => setStep(0)}>← Back</Button>
              {isLastStep ? (
                <Button variant="primary" onClick={handleFinalSubmit} isLoading={isSubmitting} disabled={!employment.join_date || isSubmitting}>
                  {isSubmitting ? 'Creating...' : 'Create Employee'}
                </Button>
              ) : (
                <Button variant="primary" onClick={() => {
                  if (!employment.join_date) { toast('Hiring date is required', 'error'); return; }
                  setStep(2);
                }}>Next →</Button>
              )}
            </div>
          </div>
        )}

        {/* STEP 2: Account & Access (new user only) */}
        {step === 2 && !existingUserId && (
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
            <h2 style={{ fontWeight: 'var(--weight-semibold)', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 'var(--space-3)', margin: 0 }}>System Account & Access</h2>
            <div className="form-grid">
              <div className="form-field"><label className="form-label">Username *</label><input className="form-input" value={account.username} onChange={ac('username')} placeholder="e.g. 1009-004" /></div>
              <div className="form-field"><label className="form-label">Work Email *</label><input className="form-input" type="email" value={account.email} onChange={ac('email')} /></div>
              <div className="form-field"><label className="form-label">Phone</label><input className="form-input" type="tel" value={account.phone} onChange={ac('phone')} /></div>
              <div className="form-field"><label className="form-label">Password *</label>
                <input className="form-input" type="password" value={account.password} onChange={ac('password')} minLength={8} />
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>Min 8 characters</span>
              </div>

              {!selectedPosition?.permission_set_name && (
                <div className="form-field" style={{ gridColumn: '1 / -1' }}><label className="form-label">Role</label>
                  <select className="form-select" value={account.role} onChange={ac('role')}>
                    <option value="site_engineer">Site Engineer</option>
                    <option value="procurement_officer">Procurement Officer</option>
                    <option value="procurement_manager">Procurement Manager</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                </div>
              )}

              <div className="form-field" style={{ gridColumn: '1 / -1' }}><label className="form-label">Account Status</label>
                <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-1)' }}>
                  {[
                    { val: false, label: 'Inactive — activate later', desc: 'Cannot log in until activated' },
                    { val: true,  label: 'Active immediately',         desc: 'Can log in right away' },
                  ].map(({ val, label, desc }) => (
                    <label key={String(val)} style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)', cursor: 'pointer', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', border: `1px solid ${account.is_active === val ? 'var(--sidebar-active-text)' : 'var(--border-subtle)'}`, background: account.is_active === val ? 'var(--sidebar-active-bg)' : 'transparent', flex: 1 }}>
                      <input type="radio" style={{ marginTop: 2 }} checked={account.is_active === val}
                        onChange={() => setAccount(prev => ({ ...prev, is_active: val }))} />
                      <div>
                        <p style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', margin: 0 }}>{label}</p>
                        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: 0 }}>{desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Summary card */}
            <div style={{ borderRadius: 'var(--radius-md)', padding: 'var(--space-4)', border: '1px solid var(--border-subtle)', background: 'var(--surface-subtle)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <p style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', marginBottom: 'var(--space-2)', marginTop: 0 }}>Summary</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 'var(--space-4)', rowGap: 'var(--space-1-5)', fontSize: 'var(--text-sm)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Name</span>
                <span style={{ fontWeight: 'var(--weight-medium)' }}>{[personal.first_name, personal.second_name, personal.third_name, personal.last_name].filter(Boolean).join(' ')}</span>
                <span style={{ color: 'var(--text-secondary)' }}>Position</span>
                <span style={{ fontWeight: 'var(--weight-medium)' }}>{selectedPosition?.title || '—'}</span>
                <span style={{ color: 'var(--text-secondary)' }}>Access</span>
                <span style={{ fontWeight: 'var(--weight-medium)', color: 'var(--sidebar-active-text)' }}>
                  {selectedPosition?.permission_set_name || account.role.replace(/_/g, ' ')}
                </span>
                <span style={{ color: 'var(--text-secondary)' }}>Total Salary</span>
                <span style={{ fontWeight: 'var(--weight-bold)' }}>{totalSalary.toLocaleString()} AED</span>
                <span style={{ color: 'var(--text-secondary)' }}>Account</span>
                <span style={{ fontWeight: 'var(--weight-medium)', color: account.is_active ? 'var(--color-success)' : 'var(--brand)' }}>
                  {account.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 'var(--space-2)' }}>
              <Button variant="secondary" onClick={() => setStep(1)}>← Back</Button>
              <Button variant="primary" onClick={handleFinalSubmit} isLoading={isSubmitting}
                disabled={!account.username || !account.email || !account.password || isSubmitting}>
                {isSubmitting ? 'Creating...' : 'Create Employee'}
              </Button>
            </div>
          </div>
        )}
      </PageShell>
    </MainLayout>
  );
}
