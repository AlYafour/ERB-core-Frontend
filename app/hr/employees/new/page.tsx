'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import MainLayout from '@/components/layout/MainLayout';
import { hrEmployeesApi, hrDepartmentsApi, hrPositionsApi, hrEmployeeGroupsApi, hrOfficeLocationsApi, hrLegalEntitiesApi } from '@/lib/api/hr';
import { usersApi } from '@/lib/api/users';
import type { User, HREmployee, HRPosition } from '@/types';
import { toast } from '@/lib/hooks/use-toast';
import { Button, PageHeader, PageShell } from '@/components/ui';
import SearchableDropdown, { DropdownOption } from '@/components/ui/SearchableDropdown';
import DateInput from '@/components/ui/DateInput';
import PhoneInput from '@/components/ui/PhoneInput';

// ── Static lists ───────────────────────────────────────────────────────────────

const GENDER_OPTS: DropdownOption[] = [
  { value: 'male', label: 'Male' }, { value: 'female', label: 'Female' },
];
const MARITAL_OPTS: DropdownOption[] = [
  { value: 'single', label: 'Single' }, { value: 'married', label: 'Married' },
  { value: 'divorced', label: 'Divorced' }, { value: 'widowed', label: 'Widowed' },
];
const NATIONALITY_OPTS: DropdownOption[] = [
  'Emirati','Egyptian','Indian','Pakistani','Filipino','Bangladeshi','Sri Lankan','Nepali',
  'Jordanian','Syrian','Lebanese','Yemeni','Saudi','Omani','Kuwaiti','Bahraini','Qatari',
  'Moroccan','Sudanese','Ethiopian','Kenyan','British','American','Canadian','Other',
].map(n => ({ value: n, label: n }));
const HOME_COUNTRY_OPTS: DropdownOption[] = [
  'UAE','Egypt','India','Pakistan','Philippines','Bangladesh','Sri Lanka','Nepal',
  'Jordan','Syria','Lebanon','Yemen','Saudi Arabia','Oman','Kuwait','Bahrain','Qatar',
  'Morocco','Sudan','Ethiopia','Kenya','UK','USA','Canada','Other',
].map(c => ({ value: c, label: c }));
const RELIGION_OPTS: DropdownOption[] = [
  { value: 'Islam', label: 'Islam' }, { value: 'Christianity', label: 'Christianity' },
  { value: 'Hinduism', label: 'Hinduism' }, { value: 'Buddhism', label: 'Buddhism' },
  { value: 'Other', label: 'Other' },
];
const DEFAULT_EMPLOYMENT_TYPES: DropdownOption[] = [
  { value: 'full_time', label: 'Full Time' }, { value: 'part_time', label: 'Part Time' },
  { value: 'contract', label: 'Contract' }, { value: 'intern', label: 'Intern' },
];

function formatEmiratesId(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 15);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  if (digits.length <= 14) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 14)}-${digits.slice(14)}`;
}

// ── Step indicator ─────────────────────────────────────────────────────────────

function StepBar({ steps, current, onBack }: { steps: string[]; current: number; onBack: (i: number) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {steps.map((s, i) => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', flex: i < steps.length - 1 ? 1 : undefined }}>
            <div
              title={s}
              onClick={() => { if (i < current) onBack(i); }}
              style={{
                width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700,
                cursor: i < current ? 'pointer' : 'default',
                background: i < current ? 'var(--brand)' : i === current ? 'var(--brand)' : 'var(--surface-subtle)',
                color: i <= current ? '#fff' : 'var(--text-tertiary)',
                outline: i === current ? '2px solid var(--brand)' : 'none',
                outlineOffset: 2,
              }}
            >
              {i < current ? '✓' : i + 1}
            </div>
            {i < steps.length - 1 && (
              <div style={{ flex: 1, height: 2, background: i < current ? 'var(--brand)' : 'var(--border-subtle)', margin: '0 4px' }} />
            )}
          </div>
        ))}
      </div>
      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0 }}>
        Step {current + 1} of {steps.length} — <strong style={{ color: 'var(--text-primary)' }}>{steps[current]}</strong>
      </p>
    </div>
  );
}

// ── Section heading ────────────────────────────────────────────────────────────

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: 'var(--space-3)', marginBottom: 'var(--space-1)' }}>
      <h2 style={{ fontWeight: 'var(--weight-semibold)', margin: 0, fontSize: 'var(--text-lg)' }}>{title}</h2>
      {subtitle && <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: '4px 0 0' }}>{subtitle}</p>}
    </div>
  );
}

// ── Nav buttons ────────────────────────────────────────────────────────────────

function NavButtons({
  step, isFirst, isLast, isSubmitting, onBack, onNext, nextLabel,
}: {
  step: number; isFirst: boolean; isLast: boolean; isSubmitting: boolean;
  onBack: () => void; onNext: () => void; nextLabel?: string;
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--border-subtle)', marginTop: 'var(--space-2)' }}>
      {!isFirst
        ? <Button variant="secondary" onClick={onBack}>← Back</Button>
        : <span />
      }
      <Button variant="primary" onClick={onNext} isLoading={isSubmitting} disabled={isSubmitting}>
        {isLast ? (isSubmitting ? 'Creating...' : (nextLabel || 'Create Employee')) : 'Next →'}
      </Button>
    </div>
  );
}

// ── Page wrapper ───────────────────────────────────────────────────────────────

export default function NewEmployeePage() {
  return (
    <Suspense>
      <NewEmployeeForm />
    </Suspense>
  );
}

// ── Main form ──────────────────────────────────────────────────────────────────

function NewEmployeeForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const existingUserId = searchParams.get('user_id') ? Number(searchParams.get('user_id')) : null;

  const STEPS = [
    'Personal Info',
    'Employment',
    'Salary',
    'Contact',
    'UAE Legal',
    ...(existingUserId ? [] : ['Account & Access']),
    'Bank Account',
  ];
  const ACCOUNT_STEP = existingUserId ? -1 : 5;
  const BANK_STEP    = existingUserId ? 5 : 6;

  const [step, setStep] = useState(0);

  // ── State ──────────────────────────────────────────────────────────────────

  const [personal, setPersonal] = useState({
    first_name: '', last_name: '', full_name_ar: '',
    gender: '', marital_status: '', date_of_birth: '',
    nationality: '', home_country: '', religion: '',
    national_id: '', personal_email: '',
    passport_number: '', passport_issue_date: '', passport_expiry_date: '',
  });

  const [employment, setEmployment] = useState({
    employment_type: '',
    join_date: '',
    probation_end_date: '', end_date: '',
    department:     null as number | null,
    position:       null as number | null,
    legal_entity:   null as number | null,
    location:       null as number | null,
    direct_manager: null as number | null,
    employee_group: null as number | null,
  });

  const [salary, setSalary] = useState({
    basic_salary: '0', housing_allowance: '0',
    transport_allowance: '0', other_allowances: '0',
  });

  const [contact, setContact] = useState({
    mobile_number: '', extension_number: '', address: '',
  });

  const [legal, setLegal] = useState({
    resident_id: '', is_citizen: false,
    labor_card: '', labor_card_expiry: '',
    mol_number: '', sponsor_name: '', sponsor_id: '',
  });

  const [account, setAccount] = useState({
    username: '', email: '', password: '',
    role: 'employee', is_active: false,
  });

  const [bank, setBank] = useState({
    bank_name: '', account_holder_name: '', iban: '',
    account_number: '', swift_code: '',
  });

  const [avatarFile,    setAvatarFile]    = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Extendable dropdowns
  const [nationalityOpts,    setNationalityOpts]    = useState<DropdownOption[]>(NATIONALITY_OPTS);
  const [homeCountryOpts,    setHomeCountryOpts]    = useState<DropdownOption[]>(HOME_COUNTRY_OPTS);
  const [religionOpts,       setReligionOpts]       = useState<DropdownOption[]>(RELIGION_OPTS);
  const [employmentTypeOpts, setEmploymentTypeOpts] = useState<DropdownOption[]>(DEFAULT_EMPLOYMENT_TYPES);

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: existingUser } = useQuery({
    queryKey: ['user-for-employee', existingUserId],
    queryFn: () => usersApi.getById(existingUserId!),
    enabled: !!existingUserId,
  });

  const queryClient = useQueryClient();
  const { data: depts }          = useQuery({ queryKey: ['hr-depts'],              queryFn: () => hrDepartmentsApi.getAll({ page: 1 }),                              staleTime: 300_000 });
  const { data: positions }      = useQuery({ queryKey: ['hr-positions'],           queryFn: () => hrPositionsApi.getAll({ page_size: 200 }),                         staleTime: 300_000 });
  const { data: groups }         = useQuery({ queryKey: ['hr-employee-groups-all'], queryFn: () => hrEmployeeGroupsApi.getAll(),                                      staleTime: 300_000 });
  const { data: officeLocations} = useQuery({ queryKey: ['hr-office-locations'],   queryFn: () => hrOfficeLocationsApi.getAll({ is_active: true }),                   staleTime: 300_000 });
  const { data: legalEntities }  = useQuery({ queryKey: ['hr-legal-entities'],     queryFn: () => hrLegalEntitiesApi.getAll(),                                        staleTime: 300_000 });
  const { data: managers }       = useQuery({ queryKey: ['hr-managers'],           queryFn: () => hrEmployeesApi.getAll({ is_manager: true, is_active: true, page_size: 200 }), staleTime: 60_000 });

  // ── Effects ────────────────────────────────────────────────────────────────

  useEffect(() => {
    setEmployment(prev => ({ ...prev, join_date: prev.join_date || new Date().toISOString().split('T')[0] }));
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

  // ── Options ────────────────────────────────────────────────────────────────

  const deptOptions    = (depts?.results          ?? []).map(d  => ({ value: d.id,  label: d.name }));
  const positionOpts   = (positions?.results      ?? [])
    .filter(p => !employment.department || p.department === employment.department)
    .map(p => ({ value: p.id, label: p.title }));
  const groupOptions   = (groups?.results         ?? []).map(g  => ({ value: g.id,  label: g.name }));
  const locationOpts   = (officeLocations?.results ?? []).map(l  => ({ value: l.id,  label: l.name }));
  const legalEntOpts   = (legalEntities?.results  ?? []).map(le => ({ value: le.id, label: le.name }));
  const managerOpts    = (managers?.results       ?? []).map(m  => ({ value: m.id,  label: `${m.full_name} (${m.employee_id})` }));

  const selectedPosition: HRPosition | undefined = positions?.results?.find(
    (pos: HRPosition) => pos.id === employment.position
  );

  const totalSalary =
    parseFloat(salary.basic_salary        || '0') +
    parseFloat(salary.housing_allowance   || '0') +
    parseFloat(salary.transport_allowance || '0') +
    parseFloat(salary.other_allowances    || '0');

  // ── Mutations ──────────────────────────────────────────────────────────────

  const createUserMutation = useMutation({ mutationFn: usersApi.create });
  const createEmpMutation  = useMutation({ mutationFn: (data: Partial<HREmployee>) => hrEmployeesApi.create(data) });
  const isSubmitting = createUserMutation.isPending || createEmpMutation.isPending;

  // ── Payload builders ───────────────────────────────────────────────────────

  const buildEmpPayload = (userId: number) => ({
    user_id:             userId,
    employment_type:     employment.employment_type,
    join_date:           employment.join_date,
    probation_end_date:  employment.probation_end_date  || null,
    end_date:            employment.end_date            || null,
    department:          employment.department,
    position:            employment.position,
    legal_entity:        employment.legal_entity,
    office_location:     employment.location,
    direct_manager:      employment.direct_manager,
    employee_group:      employment.employee_group,
    basic_salary:        salary.basic_salary,
    housing_allowance:   salary.housing_allowance,
    transport_allowance: salary.transport_allowance,
    other_allowances:    salary.other_allowances,
    mobile_number:       contact.mobile_number,
    extension_number:    contact.extension_number       || null,
    address:             contact.address                || null,
    resident_id:         legal.resident_id              || null,
    is_citizen:          legal.is_citizen,
    labor_card:          legal.labor_card               || null,
    labor_card_expiry:   legal.labor_card_expiry        || null,
    mol_number:          legal.mol_number               || null,
    sponsor_name:        legal.sponsor_name             || null,
    sponsor_id:          legal.sponsor_id               || null,
    gender:              personal.gender,
    date_of_birth:       personal.date_of_birth         || null,
    nationality:         personal.nationality,
    home_country:        personal.home_country,
    religion:            personal.religion,
    national_id:         personal.national_id,
    personal_email:      personal.personal_email,
    passport_number:     personal.passport_number,
    passport_issue_date: personal.passport_issue_date   || null,
    passport_expiry_date:personal.passport_expiry_date  || null,
    marital_status:      personal.marital_status,
  });

  // ── Submit ─────────────────────────────────────────────────────────────────

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
            email:        account.email,
            password:     account.password,
            role:         account.role as User['role'],
            is_active:    account.is_active,
            ...(avatarFile ? { avatar: avatarFile as unknown as string } : {}),
          });
        } catch (userErr: unknown) {
          const ue = userErr as { response?: { data?: Record<string, string[]> } };
          const isConflict = ue?.response?.data?.username?.some(m => m.toLowerCase().includes('already exists'));
          if (!isConflict) throw userErr;
          const found = await usersApi.getAll({ username: account.username, page_size: 1 });
          const orphan = found.results?.[0];
          if (!orphan) throw userErr;
          const existing = await hrEmployeesApi.getAll({ user: orphan.id });
          if ((existing.results?.length ?? 0) > 0) {
            const emp = existing.results![0];
            toast('Employee record already exists — redirecting to their profile', 'error');
            router.push(`/hr/employees/${emp.id}`);
            return;
          }
          createdUser = orphan;
        }
        userId = createdUser.id;
      }

      const createdEmp = await createEmpMutation.mutateAsync(
        buildEmpPayload(userId) as Partial<HREmployee>
      );

      // Add bank account if filled
      if (bank.bank_name.trim()) {
        try {
          await hrEmployeesApi.addBankAccount(createdEmp.id, {
            bank_name:            bank.bank_name,
            account_holder_name:  bank.account_holder_name || `${personal.first_name} ${personal.last_name}`.trim(),
            iban:                 bank.iban         || undefined,
            account_number:       bank.account_number || undefined,
            swift_code:           bank.swift_code   || undefined,
            is_primary:           true,
          });
        } catch {
          toast('Employee created but bank account could not be saved — add it from the profile', 'error');
        }
      }

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

  // ── Step navigation ────────────────────────────────────────────────────────

  const handleNext = () => {
    if (step === 0 && !personal.first_name.trim()) {
      toast('First name is required', 'error'); return;
    }
    if (step === 1 && !employment.join_date) {
      toast('Hiring date is required', 'error'); return;
    }
    if (step === ACCOUNT_STEP) {
      if (!account.username || !account.email || !account.password) {
        toast('Username, email and password are required', 'error'); return;
      }
      if (account.password.length < 8) {
        toast('Password must be at least 8 characters', 'error'); return;
      }
    }
    if (step === STEPS.length - 1) {
      handleFinalSubmit();
    } else {
      setStep(s => s + 1);
    }
  };

  const handleBack = () => setStep(s => s - 1);

  // ── Shorthand helpers ──────────────────────────────────────────────────────

  const ff = 'form-field';
  const fl = 'form-label';
  const fi = 'form-input';

  const p  = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setPersonal(prev => ({ ...prev, [k]: e.target.value }));
  const em = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setEmployment(prev => ({ ...prev, [k]: e.target.value }));
  const sa = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setSalary(prev => ({ ...prev, [k]: e.target.value }));
  const co = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setContact(prev => ({ ...prev, [k]: e.target.value }));
  const le = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setLegal(prev => ({ ...prev, [k]: e.target.value }));
  const ac = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setAccount(prev => ({ ...prev, [k]: e.target.value }));
  const ba = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setBank(prev => ({ ...prev, [k]: e.target.value }));

  const isFirst = step === 0;
  const isLast  = step === STEPS.length - 1;

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
              <p style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', color: 'var(--brand)', margin: 0 }}>Linking to existing account</p>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--brand)', opacity: 0.8, margin: 0 }}>@{existingUser.username} · {existingUser.email}</p>
            </div>
          </div>
        )}

        <StepBar steps={STEPS} current={step} onBack={setStep} />

        {/* ── STEP 0: Personal Info ────────────────────────────────────────── */}
        {step === 0 && (
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
            <SectionTitle title="Personal Information" subtitle="Basic identity and biographical details" />

            <div className="form-grid">
              <div className={ff}><label className={fl}>First Name *</label><input className={fi} value={personal.first_name} onChange={p('first_name')} autoFocus /></div>
              <div className={ff}><label className={fl}>Last Name</label><input className={fi} value={personal.last_name} onChange={p('last_name')} /></div>
              <div className={ff}><label className={fl}>Arabic Name</label><input className={fi} dir="rtl" value={personal.full_name_ar} onChange={p('full_name_ar')} /></div>
              <div className={ff}><label className={fl}>Gender</label>
                <SearchableDropdown options={GENDER_OPTS} value={personal.gender} onChange={v => setPersonal(p => ({ ...p, gender: String(v ?? '') }))} placeholder="" allowClear />
              </div>
              <div className={ff}><label className={fl}>Date of Birth</label>
                <DateInput className={fi} value={personal.date_of_birth} onChange={v => setPersonal(p => ({ ...p, date_of_birth: v }))} />
              </div>
              <div className={ff}><label className={fl}>Marital Status</label>
                <SearchableDropdown options={MARITAL_OPTS} value={personal.marital_status} onChange={v => setPersonal(p => ({ ...p, marital_status: String(v ?? '') }))} placeholder="" allowClear />
              </div>
              <div className={ff}><label className={fl}>Nationality</label>
                <SearchableDropdown options={nationalityOpts} value={personal.nationality} onChange={v => setPersonal(p => ({ ...p, nationality: String(v ?? '') }))} placeholder="" allowClear
                  onCreateOption={async label => { const opt = { value: label, label }; setNationalityOpts(prev => [...prev, opt]); return opt; }} createLabel="Add" />
              </div>
              <div className={ff}><label className={fl}>Home Country</label>
                <SearchableDropdown options={homeCountryOpts} value={personal.home_country} onChange={v => setPersonal(p => ({ ...p, home_country: String(v ?? '') }))} placeholder="" allowClear
                  onCreateOption={async label => { const opt = { value: label, label }; setHomeCountryOpts(prev => [...prev, opt]); return opt; }} createLabel="Add" />
              </div>
              <div className={ff}><label className={fl}>Religion</label>
                <SearchableDropdown options={religionOpts} value={personal.religion} onChange={v => setPersonal(p => ({ ...p, religion: String(v ?? '') }))} placeholder="" allowClear
                  onCreateOption={async label => { const opt = { value: label, label }; setReligionOpts(prev => [...prev, opt]); return opt; }} createLabel="Add" />
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-4)' }}>
              <p style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', marginBottom: 'var(--space-3)', marginTop: 0, color: 'var(--text-secondary)' }}>Identity Documents</p>
              <div className="form-grid">
                <div className={ff}><label className={fl}>National ID (Emirates ID)</label>
                  <input className={fi} value={personal.national_id} placeholder="XXX-XXXX-XXXXXXX-X"
                    onChange={e => setPersonal(prev => ({ ...prev, national_id: formatEmiratesId(e.target.value) }))} />
                </div>
                <div className={ff}><label className={fl}>Personal Email</label>
                  <input className={fi} type="email" value={personal.personal_email} onChange={p('personal_email')} />
                </div>
                <div className={ff}><label className={fl}>Passport Number</label>
                  <input className={fi} value={personal.passport_number} onChange={p('passport_number')} />
                </div>
                <div className={ff}><label className={fl}>Passport Issue Date</label>
                  <DateInput className={fi} value={personal.passport_issue_date} onChange={v => setPersonal(p => ({ ...p, passport_issue_date: v }))} />
                </div>
                <div className={ff}><label className={fl}>Passport Expiry Date</label>
                  <DateInput className={fi} value={personal.passport_expiry_date} onChange={v => setPersonal(p => ({ ...p, passport_expiry_date: v }))} />
                </div>
              </div>
            </div>

            <NavButtons step={step} isFirst={isFirst} isLast={isLast} isSubmitting={false} onBack={handleBack} onNext={handleNext} />
          </div>
        )}

        {/* ── STEP 1: Employment ───────────────────────────────────────────── */}
        {step === 1 && (
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
            <SectionTitle title="Employment Details" subtitle="Position, department, and contract information" />

            <div className="form-grid">
              <div className={ff}><label className={fl}>Employment Type</label>
                <SearchableDropdown options={employmentTypeOpts} value={employment.employment_type || null} onChange={v => setEmployment(p => ({ ...p, employment_type: String(v ?? '') }))} placeholder="" allowClear
                  onCreateOption={async label => { const opt = { value: label, label }; setEmploymentTypeOpts(prev => [...prev, opt]); setEmployment(p => ({ ...p, employment_type: label })); return opt; }} createLabel="Add" />
              </div>
              <div className={ff}><label className={fl}>Employee Category</label>
                <SearchableDropdown options={groupOptions} value={employment.employee_group} onChange={v => setEmployment(p => ({ ...p, employee_group: v as number | null }))} placeholder="" allowClear
                  onCreateOption={async label => {
                    const code = label.toUpperCase().replace(/[^A-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '').slice(0, 20);
                    const g = await hrEmployeeGroupsApi.create({ name: label, name_ar: '', code, description: '', is_active: true });
                    queryClient.invalidateQueries({ queryKey: ['hr-employee-groups-all'] });
                    return { value: g.id, label: `${g.name} (${g.code})` };
                  }} />
              </div>
              <div className={ff}><label className={fl}>Department</label>
                <SearchableDropdown options={deptOptions} value={employment.department} onChange={v => {
                  const newDept = v as number | null;
                  const currPos = positions?.results?.find(pos => pos.id === employment.position);
                  const stillValid = !newDept || currPos?.department === newDept;
                  setEmployment(p => ({ ...p, department: newDept, position: stillValid ? p.position : null }));
                }} placeholder="" allowClear
                  onCreateOption={async name => {
                    const dept = await hrDepartmentsApi.create({ name });
                    queryClient.invalidateQueries({ queryKey: ['hr-depts'] });
                    toast(`Department "${name}" created`, 'success');
                    return { value: dept.id, label: dept.name };
                  }} />
              </div>
              <div className={ff}><label className={fl}>Position</label>
                <SearchableDropdown options={positionOpts} value={employment.position} onChange={v => setEmployment(p => ({ ...p, position: v as number | null }))} placeholder="" allowClear
                  onCreateOption={async title => {
                    const pos = await hrPositionsApi.create({ title });
                    queryClient.invalidateQueries({ queryKey: ['hr-positions'] });
                    toast(`Position "${title}" created`, 'success');
                    return { value: pos.id, label: pos.title };
                  }} />
              </div>
              <div className={ff}><label className={fl}>Legal Entity</label>
                <SearchableDropdown options={legalEntOpts} value={employment.legal_entity} onChange={v => setEmployment(p => ({ ...p, legal_entity: v as number | null }))} placeholder="" allowClear
                  onCreateOption={async name => {
                    const le = await hrLegalEntitiesApi.create({ name });
                    queryClient.invalidateQueries({ queryKey: ['hr-legal-entities'] });
                    return { value: le.id, label: le.name };
                  }} />
              </div>
              <div className={ff}><label className={fl}>Work Location</label>
                <SearchableDropdown options={locationOpts} value={employment.location} onChange={v => setEmployment(p => ({ ...p, location: v as number | null }))} placeholder="" allowClear />
              </div>
              <div className={ff}><label className={fl}>Direct Manager</label>
                <SearchableDropdown options={managerOpts} value={employment.direct_manager} onChange={v => setEmployment(p => ({ ...p, direct_manager: v as number | null }))} placeholder="" allowClear />
              </div>
            </div>

            {selectedPosition?.default_permission_set_name && (
              <div style={{ borderRadius: 'var(--radius-md)', padding: 'var(--space-3) var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)', background: 'var(--brand-muted)', border: '1px solid var(--brand)20' }}>
                <span>🔑</span>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--brand)', margin: 0 }}>
                  <strong>{selectedPosition.title}</strong> → auto-assigns role <strong>{selectedPosition.default_permission_set_name}</strong>
                </p>
              </div>
            )}

            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-4)' }}>
              <p style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', marginBottom: 'var(--space-3)', marginTop: 0, color: 'var(--text-secondary)' }}>Contract Dates</p>
              <div className="form-grid">
                <div className={ff}><label className={fl}>Hiring Date *</label>
                  <DateInput className={fi} value={employment.join_date} onChange={v => setEmployment(p => ({ ...p, join_date: v }))} />
                </div>
                <div className={ff}><label className={fl}>End of Probation</label>
                  <DateInput className={fi} value={employment.probation_end_date} onChange={v => setEmployment(p => ({ ...p, probation_end_date: v }))} />
                </div>
                <div className={ff}><label className={fl}>Contract End Date</label>
                  <DateInput className={fi} value={employment.end_date} onChange={v => setEmployment(p => ({ ...p, end_date: v }))} />
                </div>
              </div>
            </div>

            <NavButtons step={step} isFirst={isFirst} isLast={isLast} isSubmitting={false} onBack={handleBack} onNext={handleNext} />
          </div>
        )}

        {/* ── STEP 2: Salary ───────────────────────────────────────────────── */}
        {step === 2 && (
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
            <SectionTitle title="Salary Package" subtitle="Monthly compensation breakdown in AED" />

            <div className="form-grid">
              {([
                ['basic_salary',        'Basic Salary'],
                ['housing_allowance',   'Housing Allowance'],
                ['transport_allowance', 'Transport Allowance'],
                ['other_allowances',    'Other Allowances'],
              ] as [keyof typeof salary, string][]).map(([k, label]) => (
                <div key={k} className={ff}>
                  <label className={fl}>{label}</label>
                  <input className={fi} type="number" min="0" step="0.01" value={salary[k]} onChange={sa(k)} />
                </div>
              ))}
            </div>

            <div style={{ padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', background: 'var(--brand)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ fontSize: 'var(--text-xs)', color: 'rgba(255,255,255,0.75)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Monthly Package</p>
                <p style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, color: '#fff', margin: '2px 0 0', letterSpacing: '-0.02em' }}>
                  {totalSalary.toLocaleString('en-US', { minimumFractionDigits: 2 })} <span style={{ fontSize: 'var(--text-sm)', fontWeight: 400 }}>AED</span>
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: 'var(--text-xs)', color: 'rgba(255,255,255,0.75)', margin: 0 }}>Annual</p>
                <p style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: '#fff', margin: '2px 0 0' }}>
                  {(totalSalary * 12).toLocaleString('en-US', { minimumFractionDigits: 0 })} AED
                </p>
              </div>
            </div>

            <NavButtons step={step} isFirst={isFirst} isLast={isLast} isSubmitting={false} onBack={handleBack} onNext={handleNext} />
          </div>
        )}

        {/* ── STEP 3: Contact ──────────────────────────────────────────────── */}
        {step === 3 && (
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
            <SectionTitle title="Contact Information" subtitle="Phone, extension, and residential address" />

            <div className="form-grid">
              <div className={ff}>
                <label className={fl}>Mobile Number</label>
                <PhoneInput value={contact.mobile_number} onChange={v => setContact(p => ({ ...p, mobile_number: v }))} />
              </div>
              <div className={ff}><label className={fl}>Extension Number</label>
                <input className={fi} value={contact.extension_number} onChange={co('extension_number')} placeholder="e.g. 101" />
              </div>
              <div className={ff} style={{ gridColumn: '1 / -1' }}><label className={fl}>Address</label>
                <input className={fi} value={contact.address} onChange={co('address')} placeholder="Residential address" />
              </div>
            </div>

            <NavButtons step={step} isFirst={isFirst} isLast={isLast} isSubmitting={false} onBack={handleBack} onNext={handleNext} />
          </div>
        )}

        {/* ── STEP 4: UAE Legal ────────────────────────────────────────────── */}
        {step === 4 && (
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
            <SectionTitle title="UAE Legal & Immigration" subtitle="Residency, labor card, and sponsorship details" />

            <div className="form-grid">
              <div className={ff}><label className={fl}>Resident ID</label>
                <input className={fi} value={legal.resident_id} onChange={le('resident_id')} />
              </div>
              <div className={ff}><label className={fl}>Labor Card</label>
                <input className={fi} value={legal.labor_card} onChange={le('labor_card')} />
              </div>
              <div className={ff}><label className={fl}>Labor Card Expiry</label>
                <DateInput className={fi} value={legal.labor_card_expiry} onChange={v => setLegal(p => ({ ...p, labor_card_expiry: v }))} />
              </div>
              <div className={ff}><label className={fl}>MOL Number</label>
                <input className={fi} value={legal.mol_number} onChange={le('mol_number')} />
              </div>
              <div className={ff}><label className={fl}>Sponsor Name</label>
                <input className={fi} value={legal.sponsor_name} onChange={le('sponsor_name')} />
              </div>
              <div className={ff}><label className={fl}>Sponsor ID</label>
                <input className={fi} value={legal.sponsor_id} onChange={le('sponsor_id')} />
              </div>
              <div className={ff} style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer', userSelect: 'none' }}>
                  <input type="checkbox" checked={legal.is_citizen} onChange={e => setLegal(p => ({ ...p, is_citizen: e.target.checked }))} />
                  <span className={fl} style={{ margin: 0 }}>UAE Citizen</span>
                </label>
              </div>
            </div>

            <NavButtons step={step} isFirst={isFirst} isLast={isLast} isSubmitting={false} onBack={handleBack} onNext={handleNext} />
          </div>
        )}

        {/* ── STEP 5: Account & Access (new user only) ─────────────────────── */}
        {step === ACCOUNT_STEP && !existingUserId && (
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
            <SectionTitle title="Account & Access" subtitle="System login credentials and permissions" />

            {/* Profile Picture */}
            <div className={ff}>
              <label className={fl}>Profile Picture</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                <div style={{ width: 64, height: 64, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: 'var(--surface-subtle)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {avatarPreview
                    ? <img src={avatarPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ fontSize: '1.5rem', color: 'var(--text-tertiary)' }}>{personal.first_name ? personal.first_name[0].toUpperCase() : '?'}</span>
                  }
                </div>
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
                  <button type="button" className="btn btn-secondary" style={{ fontSize: 'var(--text-xs)', padding: '4px 12px' }}
                    onClick={() => fileInputRef.current?.click()}>
                    {avatarPreview ? 'Change Photo' : 'Upload Photo'}
                  </button>
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', margin: '4px 0 0' }}>JPG, PNG — max 5 MB</p>
                </div>
              </div>
            </div>

            <div className="form-grid">
              <div className={ff}><label className={fl}>Username *</label><input className={fi} value={account.username} onChange={ac('username')} autoComplete="new-password" /></div>
              <div className={ff}><label className={fl}>Work Email *</label><input className={fi} type="email" value={account.email} onChange={ac('email')} /></div>
              <div className={ff}>
                <label className={fl}>Password *</label>
                <input className={fi} type="password" value={account.password} onChange={ac('password')} autoComplete="new-password" />
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>Min 8 characters</span>
              </div>

              {!selectedPosition?.default_permission_set_name && (
                <div className={ff} style={{ gridColumn: '1 / -1' }}>
                  <label className={fl}>Role</label>
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

              <div className={ff} style={{ gridColumn: '1 / -1' }}>
                <label className={fl}>Account Status</label>
                <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-1)' }}>
                  {([
                    { val: false, label: 'Inactive — activate later', desc: 'Cannot log in until activated' },
                    { val: true,  label: 'Active immediately',         desc: 'Can log in right away'        },
                  ] as { val: boolean; label: string; desc: string }[]).map(({ val, label, desc }) => (
                    <label key={String(val)} style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)', cursor: 'pointer', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', border: `1px solid ${account.is_active === val ? 'var(--brand)' : 'var(--border-subtle)'}`, background: account.is_active === val ? 'var(--brand-muted)' : 'transparent', flex: 1 }}>
                      <input type="radio" style={{ marginTop: 2 }} checked={account.is_active === val} onChange={() => setAccount(prev => ({ ...prev, is_active: val }))} />
                      <div>
                        <p style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', margin: 0 }}>{label}</p>
                        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: 0 }}>{desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <NavButtons step={step} isFirst={isFirst} isLast={isLast} isSubmitting={false} onBack={handleBack} onNext={handleNext} />
          </div>
        )}

        {/* ── STEP 6 (or 5): Bank Account ──────────────────────────────────── */}
        {step === BANK_STEP && (
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
            <SectionTitle title="Bank Account" subtitle="Optional — can be added or updated later from the employee profile" />

            <div className="form-grid">
              <div className={ff}><label className={fl}>Bank Name</label>
                <input className={fi} value={bank.bank_name} onChange={ba('bank_name')} placeholder="e.g. Emirates NBD" />
              </div>
              <div className={ff}><label className={fl}>Account Holder Name</label>
                <input className={fi} value={bank.account_holder_name} onChange={ba('account_holder_name')}
                  placeholder={`${personal.first_name} ${personal.last_name}`.trim() || 'Full name on account'} />
              </div>
              <div className={ff}><label className={fl}>IBAN</label>
                <input className={fi} value={bank.iban} onChange={ba('iban')} placeholder="AE00 0000 0000 0000 0000 000" />
              </div>
              <div className={ff}><label className={fl}>Account Number</label>
                <input className={fi} value={bank.account_number} onChange={ba('account_number')} />
              </div>
              <div className={ff}><label className={fl}>SWIFT / BIC Code</label>
                <input className={fi} value={bank.swift_code} onChange={ba('swift_code')} placeholder="e.g. EBILAEAD" />
              </div>
            </div>

            {/* Final Summary */}
            <div style={{ borderRadius: 'var(--radius-md)', padding: 'var(--space-4)', border: '1px solid var(--border-subtle)', background: 'var(--surface-subtle)' }}>
              <p style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', marginBottom: 'var(--space-3)', marginTop: 0 }}>Summary</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 'var(--space-4)', rowGap: 'var(--space-1-5)', fontSize: 'var(--text-sm)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Name</span>
                <span style={{ fontWeight: 'var(--weight-medium)' }}>
                  {[personal.first_name, personal.last_name].filter(Boolean).join(' ')}
                  {personal.full_name_ar && <span style={{ color: 'var(--text-secondary)', marginRight: 6 }}> — {personal.full_name_ar}</span>}
                </span>
                <span style={{ color: 'var(--text-secondary)' }}>Position</span>
                <span style={{ fontWeight: 'var(--weight-medium)' }}>{selectedPosition?.title || '—'}</span>
                <span style={{ color: 'var(--text-secondary)' }}>Access</span>
                <span style={{ fontWeight: 'var(--weight-medium)', color: 'var(--brand)' }}>
                  {selectedPosition?.default_permission_set_name || account.role.replace(/_/g, ' ') || '—'}
                </span>
                <span style={{ color: 'var(--text-secondary)' }}>Total Salary</span>
                <span style={{ fontWeight: 'var(--weight-bold)' }}>{totalSalary.toLocaleString()} AED / month</span>
                <span style={{ color: 'var(--text-secondary)' }}>Hiring Date</span>
                <span style={{ fontWeight: 'var(--weight-medium)' }}>{employment.join_date || '—'}</span>
              </div>
            </div>

            <NavButtons step={step} isFirst={isFirst} isLast={isLast} isSubmitting={isSubmitting} onBack={handleBack} onNext={handleNext} />
          </div>
        )}

      </PageShell>
    </MainLayout>
  );
}
