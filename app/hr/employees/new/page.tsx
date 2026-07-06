'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import MainLayout from '@/components/layout/MainLayout';
import { hrEmployeesApi, hrDepartmentsApi, hrPositionsApi, hrEmployeeGroupsApi, hrOfficeLocationsApi, hrLegalEntitiesApi } from '@/lib/api/hr';
import { usersApi } from '@/lib/api/users';
import type { User } from '@/types';
import { toast } from '@/lib/hooks/use-toast';
import { Button, PageHeader, PageShell } from '@/components/ui';
import SearchableDropdown, { DropdownOption } from '@/components/ui/SearchableDropdown';
import DateInput from '@/components/ui/DateInput';
import PhoneInput from '@/components/ui/PhoneInput';
import { HRPosition } from '@/types';

// ── Static option lists ────────────────────────────────────────────────────────

const GENDER_OPTS: DropdownOption[] = [
  { value: 'male',   label: 'Male' },
  { value: 'female', label: 'Female' },
];

const MARITAL_OPTS: DropdownOption[] = [
  { value: 'single',   label: 'Single' },
  { value: 'married',  label: 'Married' },
  { value: 'divorced', label: 'Divorced' },
  { value: 'widowed',  label: 'Widowed' },
];

const NATIONALITY_OPTS: DropdownOption[] = [
  'Emirati','Egyptian','Indian','Pakistani','Filipino','Bangladeshi',
  'Sri Lankan','Nepali','Jordanian','Syrian','Lebanese','Yemeni',
  'Saudi','Omani','Kuwaiti','Bahraini','Qatari','Moroccan','Sudanese',
  'Ethiopian','Kenyan','British','American','Canadian','Other',
].map(n => ({ value: n, label: n }));

const HOME_COUNTRY_OPTS: DropdownOption[] = [
  'UAE','Egypt','India','Pakistan','Philippines','Bangladesh',
  'Sri Lanka','Nepal','Jordan','Syria','Lebanon','Yemen',
  'Saudi Arabia','Oman','Kuwait','Bahrain','Qatar','Morocco','Sudan',
  'Ethiopia','Kenya','UK','USA','Canada','Other',
].map(c => ({ value: c, label: c }));

const RELIGION_OPTS: DropdownOption[] = [
  { value: 'Islam',        label: 'Islam' },
  { value: 'Christianity', label: 'Christianity' },
  { value: 'Hinduism',     label: 'Hinduism' },
  { value: 'Buddhism',     label: 'Buddhism' },
  { value: 'Other',        label: 'Other' },
];

const DEFAULT_EMPLOYMENT_TYPES: DropdownOption[] = [
  { value: 'full_time', label: 'Full Time' },
  { value: 'part_time', label: 'Part Time' },
  { value: 'contract',  label: 'Contract'  },
  { value: 'intern',    label: 'Intern'    },
];

function formatEmiratesId(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 15);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  if (digits.length <= 14) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 14)}-${digits.slice(14)}`;
}

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
    first_name: '', last_name: '', full_name_ar: '',
    gender: '', marital_status: '', date_of_birth: '',
    nationality: '', home_country: '', religion: '',
    national_id: '', passport_number: '',
    passport_issue_date: '', passport_expiry_date: '',
    personal_email: '',
  });

  // Extendable option lists for free-text fields (user can add custom values)
  const [nationalityOpts,     setNationalityOpts]     = useState<DropdownOption[]>(NATIONALITY_OPTS);
  const [homeCountryOpts,     setHomeCountryOpts]     = useState<DropdownOption[]>(HOME_COUNTRY_OPTS);
  const [religionOpts,        setReligionOpts]        = useState<DropdownOption[]>(RELIGION_OPTS);
  const [employmentTypeOpts,  setEmploymentTypeOpts]  = useState<DropdownOption[]>(DEFAULT_EMPLOYMENT_TYPES);

  const [employment, setEmployment] = useState({
    employment_type: '',
    join_date: '',
    probation_end_date: '', end_date: '',
    department:     null as number | null,
    position:       null as number | null,
    legal_entity:   null as number | null,
    location:       null as number | null,
    direct_manager: null as number | null,
    mobile_number:  '',
    employee_group: null as number | null,
    salary_display_name: '',
    basic_salary: '0', housing_allowance: '0',
    transport_allowance: '0', other_allowances: '0',
  });

  const [account, setAccount] = useState({
    username: '', email: '', phone: '', password: '',
    role: 'employee', is_active: false,
  });

  const { data: existingUser } = useQuery({
    queryKey: ['user-for-employee', existingUserId],
    queryFn: () => usersApi.getById(existingUserId!),
    enabled: !!existingUserId,
  });

  useEffect(() => {
    setEmployment(prev => ({
      ...prev,
      join_date: prev.join_date || new Date().toISOString().split('T')[0],
    }));
  }, []);

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
  const { data: depts }         = useQuery({ queryKey: ['hr-depts'],             queryFn: () => hrDepartmentsApi.getAll({ page: 1 }),       staleTime: 300_000 });
  const { data: positions }     = useQuery({ queryKey: ['hr-positions'],          queryFn: () => hrPositionsApi.getAll({ page_size: 200 }),   staleTime: 300_000 });
  const { data: groups }        = useQuery({ queryKey: ['hr-employee-groups-all'], queryFn: () => hrEmployeeGroupsApi.getAll(),              staleTime: 300_000 });
  const { data: officeLocations } = useQuery({ queryKey: ['hr-office-locations'],  queryFn: () => hrOfficeLocationsApi.getAll({ is_active: true }), staleTime: 300_000 });
  const { data: legalEntities }   = useQuery({ queryKey: ['hr-legal-entities'],   queryFn: () => hrLegalEntitiesApi.getAll(),                      staleTime: 300_000 });
  const { data: managers }        = useQuery({ queryKey: ['hr-managers'],         queryFn: () => hrEmployeesApi.getAll({ is_manager: true, is_active: true, page_size: 200 }), staleTime: 60_000 });

  const deptOptions           = (depts?.results          ?? []).map((d)  => ({ value: d.id,  label: d.name }));
  const positionOptions       = (positions?.results      ?? [])
    .filter((p) => !employment.department || p.department === employment.department)
    .map((p)  => ({ value: p.id, label: p.title }));
  const groupOptions          = (groups?.results         ?? []).map((g)  => ({ value: g.id,  label: g.name }));
  const officeLocationOptions = (officeLocations?.results ?? []).map((l) => ({ value: l.id,  label: l.name }));
  const legalEntityOptions    = (legalEntities?.results  ?? []).map((le) => ({ value: le.id, label: le.name }));
  const managerOptions        = (managers?.results       ?? []).map((m)  => ({ value: m.id,  label: `${m.full_name} (${m.employee_id})` }));

  const selectedPosition: HRPosition | undefined = positions?.results?.find(
    (pos: HRPosition) => pos.id === employment.position
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
    department:           employment.department,
    position:             employment.position,
    legal_entity:         employment.legal_entity,
    office_location:      employment.location,
    direct_manager:       employment.direct_manager,
    mobile_number:        employment.mobile_number,
    employee_group:       employment.employee_group,
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
      let userId: number;

      if (existingUserId) {
        userId = existingUserId;
      } else {
        if (!account.username || !account.email || !account.password) {
          toast('Username, email and password are required', 'error'); return;
        }
        let createdUser: User;
        try {
          createdUser = await createUserMutation.mutateAsync({
            first_name:   personal.first_name,
            last_name:    personal.last_name,
            full_name_ar: personal.full_name_ar,
            username:     account.username,
            email:       account.email,
            phone:       account.phone,
            password:    account.password,
            role:        account.role as User['role'],
            is_active:   account.is_active,
          });
        } catch (userErr: unknown) {
          // Username conflict: user was created before but employee record failed.
          // Find the orphaned user and resume from there.
          const ue = userErr as { response?: { data?: Record<string, string[]> } };
          const isConflict = ue?.response?.data?.username?.some(
            (m) => m.toLowerCase().includes('already exists')
          );
          if (!isConflict) throw userErr;

          const found = await usersApi.getAll({ username: account.username, page_size: 1 });
          const orphan = found.results?.[0];
          if (!orphan) throw userErr;

          // Check if this user already has an employee record.
          const existing = await hrEmployeesApi.getAll({ user: orphan.id });
          if ((existing.results?.length ?? 0) > 0) {
            const emp = existing.results![0];
            toast(`Employee record already exists — redirecting to their profile`, 'error');
            router.push(`/hr/employees/${emp.id}`);
            return;
          }
          createdUser = orphan;
        }
        userId = createdUser.id;
      }

      await createEmpMutation.mutateAsync(buildEmpPayload(userId) as Partial<import('@/types').HREmployee>);
      toast('Employee created successfully', 'success');
      router.push('/hr/employees');
    } catch (err: unknown) {
      const e = err as { response?: { data?: Record<string, unknown[]> } };
      const msg = e?.response?.data
        ? Object.entries(e.response.data).map(([k, v]) => `${k}: ${(v as unknown[]).flat().join(', ')}`).join(' | ')
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
          <div style={{ borderRadius: 'var(--radius-md)', padding: 'var(--space-3) var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)', border: '1px solid var(--brand)', background: 'var(--brand-muted)' }}>
            <span>🔗</span>
            <div>
              <p style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', color: 'var(--brand)', margin: 0 }}>
                Linking to existing account
              </p>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--brand)', opacity: 0.8, margin: 0 }}>
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
                  backgroundColor: i <= step ? 'var(--brand)' : 'var(--surface-subtle)',
                  color: i <= step ? 'white' : 'var(--text-secondary)',
                }}
                onClick={() => { if (i < step) setStep(i); }}>
                {i < step ? '✓' : i + 1}
              </div>
              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: i === step ? 'inherit' : 'var(--text-secondary)' }}>{s}</span>
              {i < STEPS.length - 1 && (
                <div style={{ width: 32, height: 1, margin: '0 var(--space-1)', backgroundColor: i < step ? 'var(--brand)' : 'var(--border-subtle)' }} />
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
              <div className="form-field"><label className="form-label">Last Name</label><input className="form-input" value={personal.last_name} onChange={p('last_name')} /></div>
              <div className="form-field"><label className="form-label">Arabic Name</label><input className="form-input" value={personal.full_name_ar} onChange={p('full_name_ar')} dir="rtl" /></div>
              <div className="form-field">
                <label className="form-label">Gender</label>
                <SearchableDropdown options={GENDER_OPTS} value={personal.gender} onChange={(v) => setPersonal(prev => ({ ...prev, gender: String(v ?? '') }))} placeholder="" allowClear />
              </div>
              <div className="form-field">
                <label className="form-label">Marital Status</label>
                <SearchableDropdown options={MARITAL_OPTS} value={personal.marital_status} onChange={(v) => setPersonal(prev => ({ ...prev, marital_status: String(v ?? '') }))} placeholder="" allowClear />
              </div>
              <div className="form-field"><label className="form-label">Date of Birth</label><DateInput className="form-input" value={personal.date_of_birth} onChange={(v) => setPersonal(prev => ({ ...prev, date_of_birth: v }))} /></div>
              <div className="form-field">
                <label className="form-label">Nationality</label>
                <SearchableDropdown options={nationalityOpts} value={personal.nationality} onChange={(v) => setPersonal(prev => ({ ...prev, nationality: String(v ?? '') }))} placeholder="" allowClear
                  onCreateOption={async (label) => { const opt: DropdownOption = { value: label, label }; setNationalityOpts(prev => [...prev, opt]); return opt; }} createLabel="Add" />
              </div>
              <div className="form-field">
                <label className="form-label">Home Country</label>
                <SearchableDropdown options={homeCountryOpts} value={personal.home_country} onChange={(v) => setPersonal(prev => ({ ...prev, home_country: String(v ?? '') }))} placeholder="" allowClear
                  onCreateOption={async (label) => { const opt: DropdownOption = { value: label, label }; setHomeCountryOpts(prev => [...prev, opt]); return opt; }} createLabel="Add" />
              </div>
              <div className="form-field">
                <label className="form-label">Religion</label>
                <SearchableDropdown options={religionOpts} value={personal.religion} onChange={(v) => setPersonal(prev => ({ ...prev, religion: String(v ?? '') }))} placeholder="" allowClear
                  onCreateOption={async (label) => { const opt: DropdownOption = { value: label, label }; setReligionOpts(prev => [...prev, opt]); return opt; }} createLabel="Add" />
              </div>
              <div className="form-field">
                <label className="form-label">National ID</label>
                <input
                  className="form-input"
                  value={personal.national_id}
                  onChange={(e) => setPersonal(prev => ({ ...prev, national_id: formatEmiratesId(e.target.value) }))}
                  inputMode="numeric"
                  maxLength={18}
                />
              </div>
              <div className="form-field"><label className="form-label">Personal Email</label><input className="form-input" type="email" value={personal.personal_email} onChange={p('personal_email')} /></div>
              <div className="form-field"><label className="form-label">Passport Number</label><input className="form-input" value={personal.passport_number} onChange={p('passport_number')} /></div>
              <div className="form-field"><label className="form-label">Passport Issue Date</label><DateInput className="form-input" value={personal.passport_issue_date} onChange={(v) => setPersonal(prev => ({ ...prev, passport_issue_date: v }))} /></div>
              <div className="form-field"><label className="form-label">Passport Expiry Date</label><DateInput className="form-input" value={personal.passport_expiry_date} onChange={(v) => setPersonal(prev => ({ ...prev, passport_expiry_date: v }))} /></div>
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
              <div className="form-field">
                <label className="form-label">Employment Type</label>
                <SearchableDropdown
                  options={employmentTypeOpts}
                  value={employment.employment_type || null}
                  onChange={(v) => setEmployment((p) => ({ ...p, employment_type: String(v ?? '') }))}
                  placeholder=""
                  allowClear
                  onCreateOption={async (label) => {
                    const opt: DropdownOption = { value: label, label };
                    setEmploymentTypeOpts(prev => [...prev, opt]);
                    setEmployment(p => ({ ...p, employment_type: label }));
                    return opt;
                  }}
                  createLabel="Add"
                />
              </div>
              <div className="form-field">
                <label className="form-label">Employee Category</label>
                <SearchableDropdown
                  options={groupOptions}
                  value={employment.employee_group}
                  onChange={(v) => setEmployment((p) => ({ ...p, employee_group: v as number | null }))}
                  placeholder=""
                  allowClear
                  onCreateOption={async (label) => {
                    const code = label.toUpperCase().replace(/[^A-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '').slice(0, 20);
                    const g = await hrEmployeeGroupsApi.create({ name: label, name_ar: '', code, description: '', is_active: true });
                    queryClient.invalidateQueries({ queryKey: ['hr-employee-groups-all'] });
                    return { value: g.id, label: `${g.name} (${g.code})` };
                  }}
                />
              </div>
              <div className="form-field">
                <label className="form-label">Department</label>
                <SearchableDropdown
                  options={deptOptions}
                  value={employment.department}
                  onChange={(v) => setEmployment((p) => {
                    const newDept = v as number | null;
                    const currentPos = positions?.results?.find(pos => pos.id === p.position);
                    const positionStillValid = !newDept || currentPos?.department === newDept;
                    return { ...p, department: newDept, position: positionStillValid ? p.position : null };
                  })}
                  placeholder=""
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
                  value={employment.position}
                  onChange={(v) => setEmployment((p) => ({ ...p, position: v as number | null }))}
                  placeholder=""
                  allowClear
                  onCreateOption={async (title) => {
                    const pos = await hrPositionsApi.create({ title });
                    queryClient.invalidateQueries({ queryKey: ['hr-positions'] });
                    toast(`Position "${title}" created`, 'success');
                    return { value: pos.id, label: pos.title };
                  }}
                />
              </div>

              {selectedPosition?.default_permission_set_name && (
                <div style={{ gridColumn: '1 / -1', borderRadius: 'var(--radius-md)', padding: 'var(--space-3) var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)', background: 'var(--brand-muted)' }}>
                  <span>🔑</span>
                  <div>
                    <p style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', color: 'var(--brand)', margin: 0 }}>
                      Access auto-assigned from position
                    </p>
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--brand)', opacity: 0.8, margin: 0 }}>
                      {'"'}{selectedPosition.title}{'"'} → <strong>{selectedPosition.default_permission_set_name}</strong>
                    </p>
                  </div>
                </div>
              )}

              <div className="form-field">
                <label className="form-label">Legal Entity</label>
                <SearchableDropdown
                  options={legalEntityOptions}
                  value={employment.legal_entity}
                  onChange={(v) => setEmployment((p) => ({ ...p, legal_entity: v as number | null }))}
                  placeholder=""
                  allowClear
                  onCreateOption={async (name) => {
                    const le = await hrLegalEntitiesApi.create({ name });
                    queryClient.invalidateQueries({ queryKey: ['hr-legal-entities'] });
                    return { value: le.id, label: le.name };
                  }}
                />
              </div>
              <div className="form-field">
                <label className="form-label">Work Location</label>
                <SearchableDropdown
                  options={officeLocationOptions}
                  value={employment.location}
                  onChange={(v) => setEmployment((p) => ({ ...p, location: v as number | null }))}
                  placeholder=""
                  allowClear
                />
              </div>
              <div className="form-field">
                <label className="form-label">Direct Manager</label>
                <SearchableDropdown
                  options={managerOptions}
                  value={employment.direct_manager}
                  onChange={(v) => setEmployment((p) => ({ ...p, direct_manager: v as number | null }))}
                  placeholder=""
                  allowClear
                />
              </div>
              <div className="form-field">
                <label className="form-label">Mobile Number</label>
                <PhoneInput value={employment.mobile_number} onChange={(v) => setEmployment((p) => ({ ...p, mobile_number: v }))} />
              </div>
              <div className="form-field"><label className="form-label">Hiring Date *</label><DateInput className="form-input" value={employment.join_date} onChange={(v) => setEmployment(prev => ({ ...prev, join_date: v }))} /></div>
              <div className="form-field"><label className="form-label">End of Probation</label><DateInput className="form-input" value={employment.probation_end_date} onChange={(v) => setEmployment(prev => ({ ...prev, probation_end_date: v }))} /></div>
              <div className="form-field"><label className="form-label">Contract End Date</label><DateInput className="form-input" value={employment.end_date} onChange={(v) => setEmployment(prev => ({ ...prev, end_date: v }))} /></div>
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
              <div style={{ marginTop: 'var(--space-3)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--brand)' }}>
                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', color: 'var(--primary-foreground)' }}>Total</span>
                <span style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)', color: 'var(--primary-foreground)' }}>
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
              <div className="form-field"><label className="form-label">Username *</label><input className="form-input" value={account.username} onChange={ac('username')} /></div>
              <div className="form-field"><label className="form-label">Work Email *</label><input className="form-input" type="email" value={account.email} onChange={ac('email')} /></div>
              <div className="form-field"><label className="form-label">Password *</label>
                <input className="form-input" type="password" value={account.password} onChange={ac('password')} minLength={8} />
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>Min 8 characters</span>
              </div>

              {!selectedPosition?.default_permission_set_name && (
                <div className="form-field" style={{ gridColumn: '1 / -1' }}><label className="form-label">Role</label>
                  <select className="form-select" value={account.role} onChange={ac('role')}>
                    <option value="employee">Employee</option>
                    <option value="site_engineer">Site Engineer</option>
                    <option value="site_manager">Site Manager</option>
                    <option value="supervisor">Supervisor</option>
                    <option value="hr_manager">HR Manager</option>
                    <option value="hr_secretary">HR Secretary</option>
                    <option value="procurement_officer">Procurement Officer</option>
                    <option value="procurement_manager">Procurement Manager</option>
                    <option value="admin">Admin</option>
                    <option value="company_director">Company Director</option>
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
                    <label key={String(val)} style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)', cursor: 'pointer', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', border: `1px solid ${account.is_active === val ? 'var(--brand)' : 'var(--border-subtle)'}`, background: account.is_active === val ? 'var(--brand-muted)' : 'transparent', flex: 1 }}>
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
                <span style={{ fontWeight: 'var(--weight-medium)' }}>{[personal.first_name, personal.last_name].filter(Boolean).join(' ')}{personal.full_name_ar && <span style={{ color: 'var(--text-secondary)', marginRight: 6 }}> — {personal.full_name_ar}</span>}</span>
                <span style={{ color: 'var(--text-secondary)' }}>Position</span>
                <span style={{ fontWeight: 'var(--weight-medium)' }}>{selectedPosition?.title || '—'}</span>
                <span style={{ color: 'var(--text-secondary)' }}>Access</span>
                <span style={{ fontWeight: 'var(--weight-medium)', color: 'var(--brand)' }}>
                  {selectedPosition?.default_permission_set_name || account.role.replace(/_/g, ' ')}
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
