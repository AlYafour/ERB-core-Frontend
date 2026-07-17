'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import MainLayout from '@/components/layout/MainLayout';
import { hrEmployeesApi, hrDepartmentsApi, hrPositionsApi, hrEmployeeGroupsApi, hrOfficeLocationsApi, hrLegalEntitiesApi } from '@/lib/api/hr';
import { usersApi } from '@/lib/api/users';
import type { User, HREmployee, HRPosition } from '@/types';
import { toast } from '@/lib/hooks/use-toast';
import { getApiError } from '@/lib/utils/error';
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

// ── Step metadata ──────────────────────────────────────────────────────────────

const STEP_META = [
  { label: 'Personal Info',    sub: 'Name, identity & documents'     },
  { label: 'Employment',       sub: 'Position, contract & dates'     },
  { label: 'Salary',           sub: 'Compensation breakdown'         },
  { label: 'Contact',          sub: 'Phone, extension & address'     },
  { label: 'UAE Legal',        sub: 'Residency & labor documents'    },
  { label: 'Account & Access', sub: 'Login credentials & role'       },
  { label: 'Bank Account',     sub: 'Optional — add now or later'    },
];

// ── Vertical step navigator ────────────────────────────────────────────────────

function StepNav({
  steps, current, onGoTo,
}: {
  steps: { label: string; sub: string }[];
  current: number;
  onGoTo: (i: number) => void;
}) {
  const pct = Math.round((current / (steps.length - 1)) * 100);

  return (
    <aside style={{
      width: 248,
      flexShrink: 0,
      borderRight: '1px solid var(--border-subtle)',
      display: 'flex',
      flexDirection: 'column',
      position: 'sticky',
      top: 0,
      alignSelf: 'flex-start',
      maxHeight: '100%',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: '24px 20px 20px' }}>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
          New Employee
        </p>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
          Step {current + 1} of {steps.length}
        </p>
        {/* Progress bar */}
        <div style={{ marginTop: 12, height: 3, borderRadius: 99, background: 'var(--border-subtle)', overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 99, background: 'var(--brand)',
            width: `${pct}%`, transition: 'width 0.25s ease',
          }} />
        </div>
      </div>

      {/* Step list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px 24px' }}>
        {steps.map((s, i) => {
          const done   = i < current;
          const active = i === current;

          return (
            <div
              key={s.label}
              onClick={() => done ? onGoTo(i) : undefined}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 10px',
                borderRadius: 8,
                cursor: done ? 'pointer' : 'default',
                background: active ? 'var(--brand-muted, rgba(180,120,30,.08))' : 'transparent',
                borderLeft: active ? '2px solid var(--brand)' : '2px solid transparent',
                marginBottom: 2,
                transition: 'background 0.15s',
              }}
            >
              {/* Circle */}
              <div style={{
                width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: done ? 12 : 11, fontWeight: 700,
                background: done ? 'var(--brand)' : active ? 'var(--brand)' : 'transparent',
                color: done || active ? '#fff' : 'var(--text-tertiary)',
                border: done || active ? 'none' : '1.5px solid var(--border-subtle)',
              }}>
                {done ? '✓' : i + 1}
              </div>

              {/* Text */}
              <div style={{ minWidth: 0 }}>
                <p style={{
                  margin: 0, fontSize: 13, lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  fontWeight: active ? 600 : 400,
                  color: active ? 'var(--brand)' : done ? 'var(--text-primary)' : 'var(--text-tertiary)',
                }}>{s.label}</p>
                <p style={{
                  margin: '1px 0 0', fontSize: 11, lineHeight: 1.2,
                  color: active ? 'var(--brand)' : 'var(--text-tertiary)',
                  opacity: active ? 0.75 : 1,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{s.sub}</p>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

// ── Section heading inside a step ──────────────────────────────────────────────

function SectionHead({ eyebrow, title, desc }: { eyebrow?: string; title: string; desc?: string }) {
  return (
    <div style={{ marginBottom: 28 }}>
      {eyebrow && (
        <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--brand)' }}>
          {eyebrow}
        </p>
      )}
      <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', textWrap: 'balance' } as React.CSSProperties}>{title}</h2>
      {desc && <p style={{ margin: '5px 0 0', fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{desc}</p>}
    </div>
  );
}

// ── Sub-section divider ────────────────────────────────────────────────────────

function SubSection({ title }: { title: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '32px 0 20px' }}>
      <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>{title}</p>
      <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
    </div>
  );
}

// ── Nav buttons ────────────────────────────────────────────────────────────────

function NavButtons({
  isFirst, isLast, isSubmitting, onBack, onNext,
}: {
  isFirst: boolean; isLast: boolean; isSubmitting: boolean;
  onBack: () => void; onNext: () => void;
}) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      marginTop: 40, paddingTop: 24, borderTop: '1px solid var(--border-subtle)',
    }}>
      {!isFirst ? (
        <button
          type="button"
          onClick={onBack}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', borderRadius: 8,
            border: '1px solid var(--border-subtle)',
            background: 'transparent', cursor: 'pointer',
            fontSize: 14, color: 'var(--text-secondary)',
            fontWeight: 500,
          }}
        >
          ← Back
        </button>
      ) : <span />}

      <button
        type="button"
        onClick={onNext}
        disabled={isSubmitting}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 24px', borderRadius: 8,
          background: isSubmitting ? 'var(--brand-muted)' : 'var(--brand)',
          border: 'none', cursor: isSubmitting ? 'not-allowed' : 'pointer',
          fontSize: 14, fontWeight: 600, color: '#fff',
          opacity: isSubmitting ? 0.7 : 1,
          minWidth: 140, justifyContent: 'center',
        }}
      >
        {isSubmitting
          ? 'Creating…'
          : isLast
            ? 'Create Employee'
            : 'Continue →'}
      </button>
    </div>
  );
}

// ── Page wrapper ───────────────────────────────────────────────────────────────

export default function NewEmployeePage() {
  return <Suspense><NewEmployeeForm /></Suspense>;
}

// ── Main form ──────────────────────────────────────────────────────────────────

function NewEmployeeForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const existingUserId = searchParams.get('user_id') ? Number(searchParams.get('user_id')) : null;

  const ALL_META = STEP_META.filter((_, i) => {
    if (i === 5 && existingUserId) return false;  // skip Account step if linking
    return true;
  });

  const ACCOUNT_STEP = existingUserId ? -1 : 5;
  const BANK_STEP    = existingUserId ? 5  : 6;

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
    employment_type: '', join_date: '',
    probation_end_date: '', end_date: '',
    department: null as number | null, position: null as number | null,
    legal_entity: null as number | null, location: null as number | null,
    direct_manager: null as number | null, employee_group: null as number | null,
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
  const { data: depts }           = useQuery({ queryKey: ['hr-depts'],              queryFn: () => hrDepartmentsApi.getAll({ page: 1 }),                                      staleTime: 300_000 });
  const { data: positions }       = useQuery({ queryKey: ['hr-positions'],           queryFn: () => hrPositionsApi.getAll({ page_size: 200 }),                                 staleTime: 300_000 });
  const { data: groups }          = useQuery({ queryKey: ['hr-employee-groups-all'], queryFn: () => hrEmployeeGroupsApi.getAll(),                                              staleTime: 300_000 });
  const { data: officeLocations } = useQuery({ queryKey: ['hr-office-locations'],   queryFn: () => hrOfficeLocationsApi.getAll({ is_active: true }),                          staleTime: 300_000 });
  const { data: legalEntities }   = useQuery({ queryKey: ['hr-legal-entities'],     queryFn: () => hrLegalEntitiesApi.getAll(),                                               staleTime: 300_000 });
  const { data: managers }        = useQuery({ queryKey: ['hr-managers'],           queryFn: () => hrEmployeesApi.getAll({ is_manager: true, is_active: true, page_size: 200 }), staleTime: 60_000 });

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

  // ── Derived ────────────────────────────────────────────────────────────────

  const deptOptions  = (depts?.results          ?? []).map(d  => ({ value: d.id,  label: d.name }));
  const positionOpts = (positions?.results      ?? [])
    .filter(p => !employment.department || p.department === employment.department)
    .map(p => ({ value: p.id, label: p.title }));
  const groupOptions  = (groups?.results         ?? []).map(g  => ({ value: g.id,  label: g.name }));
  const locationOpts  = (officeLocations?.results ?? []).map(l  => ({ value: l.id,  label: l.name }));
  const legalEntOpts  = (legalEntities?.results  ?? []).map(le => ({ value: le.id, label: le.name }));
  const managerOpts   = (managers?.results       ?? []).map(m  => ({ value: m.id,  label: `${m.full_name} (${m.employee_id})` }));

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

  // ── Payload ────────────────────────────────────────────────────────────────

  const buildEmpPayload = (userId: number) => ({
    user_id:              userId,
    employment_type:      employment.employment_type,
    join_date:            employment.join_date,
    probation_end_date:   employment.probation_end_date  || null,
    end_date:             employment.end_date            || null,
    department:           employment.department,
    position:             employment.position,
    legal_entity:         employment.legal_entity,
    office_location:      employment.location,
    direct_manager:       employment.direct_manager,
    employee_group:       employment.employee_group,
    basic_salary:         salary.basic_salary,
    housing_allowance:    salary.housing_allowance,
    transport_allowance:  salary.transport_allowance,
    other_allowances:     salary.other_allowances,
    mobile_number:        contact.mobile_number,
    extension_number:     contact.extension_number       || null,
    address:              contact.address                || null,
    resident_id:          legal.resident_id              || null,
    is_citizen:           legal.is_citizen,
    labor_card:           legal.labor_card               || null,
    labor_card_expiry:    legal.labor_card_expiry        || null,
    mol_number:           legal.mol_number               || null,
    sponsor_name:         legal.sponsor_name             || null,
    sponsor_id:           legal.sponsor_id               || null,
    gender:               personal.gender,
    date_of_birth:        personal.date_of_birth         || null,
    nationality:          personal.nationality,
    home_country:         personal.home_country,
    religion:             personal.religion,
    national_id:          personal.national_id,
    personal_email:       personal.personal_email,
    passport_number:      personal.passport_number,
    passport_issue_date:  personal.passport_issue_date   || null,
    passport_expiry_date: personal.passport_expiry_date  || null,
    marital_status:       personal.marital_status,
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
            toast('Employee record already exists — redirecting', 'error');
            router.push(`/hr/employees/${existing.results![0].id}`);
            return;
          }
          createdUser = orphan;
        }
        userId = createdUser.id;
      }

      const createdEmp = await createEmpMutation.mutateAsync(
        buildEmpPayload(userId) as Partial<HREmployee>
      );

      if (bank.bank_name.trim()) {
        try {
          await hrEmployeesApi.addBankAccount(createdEmp.id, {
            bank_name:           bank.bank_name,
            account_holder_name: bank.account_holder_name || `${personal.first_name} ${personal.last_name}`.trim(),
            iban:                bank.iban         || undefined,
            account_number:      bank.account_number || undefined,
            swift_code:          bank.swift_code   || undefined,
            is_primary:          true,
          });
        } catch {
          toast('Employee created but bank account could not be saved — add it from the profile', 'error');
        }
      }

      toast('Employee created successfully', 'success');
      router.push('/hr/employees');
    } catch (err: unknown) {
      toast(getApiError(err, 'Failed to create employee'), 'error');
    }
  };

  // ── Navigation ─────────────────────────────────────────────────────────────

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
    if (step === ALL_META.length - 1) {
      handleFinalSubmit();
    } else {
      setStep(s => s + 1);
    }
  };

  const handleBack = () => setStep(s => s - 1);

  // ── Field shorthand ────────────────────────────────────────────────────────

  const fi = 'form-input';
  const p  = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setPersonal(prev => ({ ...prev, [k]: e.target.value }));
  const sa = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setSalary(prev => ({ ...prev, [k]: e.target.value }));
  const co = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setContact(prev => ({ ...prev, [k]: e.target.value }));
  const le = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setLegal(prev => ({ ...prev, [k]: e.target.value }));
  const ac = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setAccount(prev => ({ ...prev, [k]: e.target.value }));
  const ba = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setBank(prev => ({ ...prev, [k]: e.target.value }));

  const isFirst = step === 0;
  const isLast  = step === ALL_META.length - 1;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <MainLayout>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

        {/* Top chrome */}
        <div style={{
          padding: '16px 28px', borderBottom: '1px solid var(--border-subtle)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
        }}>
          <div>
            <p style={{ margin: 0, fontSize: 11, color: 'var(--text-tertiary)', letterSpacing: '0.04em' }}>HR / Employees</p>
            <h1 style={{ margin: '2px 0 0', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>New Employee</h1>
          </div>
          <button
            type="button"
            onClick={() => router.push('/hr/employees')}
            style={{
              padding: '7px 16px', borderRadius: 8, border: '1px solid var(--border-subtle)',
              background: 'transparent', cursor: 'pointer', fontSize: 13,
              color: 'var(--text-secondary)', fontWeight: 500,
            }}
          >
            Cancel
          </button>
        </div>

        {/* Existing-user banner */}
        {existingUserId && existingUser && (
          <div style={{
            margin: '0', padding: '10px 28px',
            background: 'var(--brand-muted, rgba(180,120,30,.08))',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--brand)', flexShrink: 0 }} />
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>
              Linking to existing account: <strong>@{existingUser.username}</strong> · {existingUser.email}
            </p>
          </div>
        )}

        {/* Wizard body */}
        <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>

          {/* Left: step navigator */}
          <StepNav steps={ALL_META} current={step} onGoTo={setStep} />

          {/* Right: form area */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '40px 48px 60px' }}>

            {/* ── STEP 0: Personal Info ──────────────────────────────────── */}
            {step === 0 && (
              <>
                <SectionHead
                  eyebrow="Step 1 — Personal"
                  title="Personal Information"
                  desc="Basic identity details and official documents."
                />

                <div className="form-grid">
                  <div className="form-field"><label className="form-label">First Name *</label><input className={fi} value={personal.first_name} onChange={p('first_name')} autoFocus /></div>
                  <div className="form-field"><label className="form-label">Last Name</label><input className={fi} value={personal.last_name} onChange={p('last_name')} /></div>
                  <div className="form-field"><label className="form-label">Arabic Name</label><input className={fi} dir="rtl" value={personal.full_name_ar} onChange={p('full_name_ar')} /></div>
                  <div className="form-field"><label className="form-label">Date of Birth</label>
                    <DateInput className={fi} value={personal.date_of_birth} onChange={v => setPersonal(prev => ({ ...prev, date_of_birth: v }))} />
                  </div>
                  <div className="form-field"><label className="form-label">Gender</label>
                    <SearchableDropdown options={GENDER_OPTS} value={personal.gender} onChange={v => setPersonal(prev => ({ ...prev, gender: String(v ?? '') }))} placeholder="" allowClear />
                  </div>
                  <div className="form-field"><label className="form-label">Marital Status</label>
                    <SearchableDropdown options={MARITAL_OPTS} value={personal.marital_status} onChange={v => setPersonal(prev => ({ ...prev, marital_status: String(v ?? '') }))} placeholder="" allowClear />
                  </div>
                  <div className="form-field"><label className="form-label">Nationality</label>
                    <SearchableDropdown options={nationalityOpts} value={personal.nationality} onChange={v => setPersonal(prev => ({ ...prev, nationality: String(v ?? '') }))} placeholder="" allowClear
                      onCreateOption={async label => { const opt = { value: label, label }; setNationalityOpts(prev => [...prev, opt]); return opt; }} createLabel="Add" />
                  </div>
                  <div className="form-field"><label className="form-label">Home Country</label>
                    <SearchableDropdown options={homeCountryOpts} value={personal.home_country} onChange={v => setPersonal(prev => ({ ...prev, home_country: String(v ?? '') }))} placeholder="" allowClear
                      onCreateOption={async label => { const opt = { value: label, label }; setHomeCountryOpts(prev => [...prev, opt]); return opt; }} createLabel="Add" />
                  </div>
                  <div className="form-field"><label className="form-label">Religion</label>
                    <SearchableDropdown options={religionOpts} value={personal.religion} onChange={v => setPersonal(prev => ({ ...prev, religion: String(v ?? '') }))} placeholder="" allowClear
                      onCreateOption={async label => { const opt = { value: label, label }; setReligionOpts(prev => [...prev, opt]); return opt; }} createLabel="Add" />
                  </div>
                </div>

                <SubSection title="Identity Documents" />

                <div className="form-grid">
                  <div className="form-field"><label className="form-label">National ID (Emirates ID)</label>
                    <input className={fi} value={personal.national_id} placeholder="XXX-XXXX-XXXXXXX-X"
                      onChange={e => setPersonal(prev => ({ ...prev, national_id: formatEmiratesId(e.target.value) }))} />
                  </div>
                  <div className="form-field"><label className="form-label">Personal Email</label>
                    <input className={fi} type="email" value={personal.personal_email} onChange={p('personal_email')} />
                  </div>
                  <div className="form-field"><label className="form-label">Passport Number</label>
                    <input className={fi} value={personal.passport_number} onChange={p('passport_number')} />
                  </div>
                  <div className="form-field"><label className="form-label">Passport Issue Date</label>
                    <DateInput className={fi} value={personal.passport_issue_date} onChange={v => setPersonal(prev => ({ ...prev, passport_issue_date: v }))} />
                  </div>
                  <div className="form-field"><label className="form-label">Passport Expiry Date</label>
                    <DateInput className={fi} value={personal.passport_expiry_date} onChange={v => setPersonal(prev => ({ ...prev, passport_expiry_date: v }))} />
                  </div>
                </div>

                <NavButtons isFirst={isFirst} isLast={isLast} isSubmitting={false} onBack={handleBack} onNext={handleNext} />
              </>
            )}

            {/* ── STEP 1: Employment ────────────────────────────────────── */}
            {step === 1 && (
              <>
                <SectionHead
                  eyebrow="Step 2 — Employment"
                  title="Employment Details"
                  desc="Position, department, reporting line, and contract dates."
                />

                <div className="form-grid">
                  <div className="form-field"><label className="form-label">Employment Type</label>
                    <SearchableDropdown options={employmentTypeOpts} value={employment.employment_type || null} onChange={v => setEmployment(prev => ({ ...prev, employment_type: String(v ?? '') }))} placeholder="" allowClear
                      onCreateOption={async label => { const opt = { value: label, label }; setEmploymentTypeOpts(prev => [...prev, opt]); setEmployment(prev => ({ ...prev, employment_type: label })); return opt; }} createLabel="Add" />
                  </div>
                  <div className="form-field"><label className="form-label">Employee Category</label>
                    <SearchableDropdown options={groupOptions} value={employment.employee_group} onChange={v => setEmployment(prev => ({ ...prev, employee_group: v as number | null }))} placeholder="" allowClear
                      onCreateOption={async label => {
                        const code = label.toUpperCase().replace(/[^A-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '').slice(0, 20);
                        const g = await hrEmployeeGroupsApi.create({ name: label, name_ar: '', code, description: '', is_active: true });
                        queryClient.invalidateQueries({ queryKey: ['hr-employee-groups-all'] });
                        return { value: g.id, label: `${g.name} (${g.code})` };
                      }} />
                  </div>
                  <div className="form-field"><label className="form-label">Department</label>
                    <SearchableDropdown options={deptOptions} value={employment.department} onChange={v => {
                      const newDept = v as number | null;
                      const currPos = positions?.results?.find(pos => pos.id === employment.position);
                      const stillValid = !newDept || currPos?.department === newDept;
                      setEmployment(prev => ({ ...prev, department: newDept, position: stillValid ? prev.position : null }));
                    }} placeholder="" allowClear
                      onCreateOption={async name => {
                        const dept = await hrDepartmentsApi.create({ name });
                        queryClient.invalidateQueries({ queryKey: ['hr-depts'] });
                        toast(`Department "${name}" created`, 'success');
                        return { value: dept.id, label: dept.name };
                      }} />
                  </div>
                  <div className="form-field"><label className="form-label">Position</label>
                    <SearchableDropdown options={positionOpts} value={employment.position} onChange={v => setEmployment(prev => ({ ...prev, position: v as number | null }))} placeholder="" allowClear
                      onCreateOption={async title => {
                        const pos = await hrPositionsApi.create({ title });
                        queryClient.invalidateQueries({ queryKey: ['hr-positions'] });
                        toast(`Position "${title}" created`, 'success');
                        return { value: pos.id, label: pos.title };
                      }} />
                  </div>
                  <div className="form-field"><label className="form-label">Legal Entity</label>
                    <SearchableDropdown options={legalEntOpts} value={employment.legal_entity} onChange={v => setEmployment(prev => ({ ...prev, legal_entity: v as number | null }))} placeholder="" allowClear
                      onCreateOption={async name => {
                        const le = await hrLegalEntitiesApi.create({ name });
                        queryClient.invalidateQueries({ queryKey: ['hr-legal-entities'] });
                        return { value: le.id, label: le.name };
                      }} />
                  </div>
                  <div className="form-field"><label className="form-label">Work Location</label>
                    <SearchableDropdown options={locationOpts} value={employment.location} onChange={v => setEmployment(prev => ({ ...prev, location: v as number | null }))} placeholder="" allowClear />
                  </div>
                  <div className="form-field"><label className="form-label">Direct Manager</label>
                    <SearchableDropdown options={managerOpts} value={employment.direct_manager} onChange={v => setEmployment(prev => ({ ...prev, direct_manager: v as number | null }))} placeholder="" allowClear />
                  </div>
                </div>

                {selectedPosition?.default_permission_set_name && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '12px 16px', borderRadius: 8, marginTop: 4,
                    background: 'var(--brand-muted, rgba(180,120,30,.08))',
                    border: '1px solid var(--border-subtle)',
                  }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--brand)', flexShrink: 0 }} />
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>
                      <strong>{selectedPosition.title}</strong> auto-assigns the <strong>{selectedPosition.default_permission_set_name}</strong> role
                    </p>
                  </div>
                )}

                <SubSection title="Contract Dates" />

                <div className="form-grid">
                  <div className="form-field"><label className="form-label">Hiring Date *</label>
                    <DateInput className={fi} value={employment.join_date} onChange={v => setEmployment(prev => ({ ...prev, join_date: v }))} />
                  </div>
                  <div className="form-field"><label className="form-label">End of Probation</label>
                    <DateInput className={fi} value={employment.probation_end_date} onChange={v => setEmployment(prev => ({ ...prev, probation_end_date: v }))} />
                  </div>
                  <div className="form-field"><label className="form-label">Contract End Date</label>
                    <DateInput className={fi} value={employment.end_date} onChange={v => setEmployment(prev => ({ ...prev, end_date: v }))} />
                  </div>
                </div>

                <NavButtons isFirst={isFirst} isLast={isLast} isSubmitting={false} onBack={handleBack} onNext={handleNext} />
              </>
            )}

            {/* ── STEP 2: Salary ────────────────────────────────────────── */}
            {step === 2 && (
              <>
                <SectionHead
                  eyebrow="Step 3 — Salary"
                  title="Salary Package"
                  desc="Monthly compensation in AED. All fields default to zero."
                />

                <div className="form-grid">
                  {([
                    ['basic_salary',        'Basic Salary'],
                    ['housing_allowance',   'Housing Allowance'],
                    ['transport_allowance', 'Transport Allowance'],
                    ['other_allowances',    'Other Allowances'],
                  ] as [keyof typeof salary, string][]).map(([k, label]) => (
                    <div key={k} className="form-field">
                      <label className="form-label">{label}</label>
                      <input className={fi} type="number" min="0" step="0.01" value={salary[k]} onChange={sa(k)} />
                    </div>
                  ))}
                </div>

                {/* Total panel */}
                <div style={{
                  marginTop: 28, borderRadius: 10,
                  background: 'var(--brand)', padding: '20px 24px',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,.65)', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700 }}>Total Monthly Package</p>
                    <p style={{ margin: '4px 0 0', fontSize: 28, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
                      {totalSalary.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      <span style={{ fontSize: 14, fontWeight: 400, marginLeft: 6 }}>AED</span>
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,.65)' }}>Annual</p>
                    <p style={{ margin: '4px 0 0', fontSize: 18, fontWeight: 700, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>
                      {(totalSalary * 12).toLocaleString('en-US')} AED
                    </p>
                  </div>
                </div>

                <NavButtons isFirst={isFirst} isLast={isLast} isSubmitting={false} onBack={handleBack} onNext={handleNext} />
              </>
            )}

            {/* ── STEP 3: Contact ───────────────────────────────────────── */}
            {step === 3 && (
              <>
                <SectionHead
                  eyebrow="Step 4 — Contact"
                  title="Contact Information"
                  desc="Mobile number, internal extension, and residential address."
                />

                <div className="form-grid">
                  <div className="form-field">
                    <label className="form-label">Mobile Number</label>
                    <PhoneInput value={contact.mobile_number} onChange={v => setContact(prev => ({ ...prev, mobile_number: v }))} />
                  </div>
                  <div className="form-field">
                    <label className="form-label">Extension Number</label>
                    <input className={fi} value={contact.extension_number} onChange={co('extension_number')} placeholder="e.g. 101" />
                  </div>
                  <div className="form-field" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">Residential Address</label>
                    <input className={fi} value={contact.address} onChange={co('address')} placeholder="Street, building, area…" />
                  </div>
                </div>

                <NavButtons isFirst={isFirst} isLast={isLast} isSubmitting={false} onBack={handleBack} onNext={handleNext} />
              </>
            )}

            {/* ── STEP 4: UAE Legal ─────────────────────────────────────── */}
            {step === 4 && (
              <>
                <SectionHead
                  eyebrow="Step 5 — UAE Legal"
                  title="UAE Legal & Immigration"
                  desc="Residency, labor card, MOL, and sponsorship details."
                />

                <div className="form-grid">
                  <div className="form-field"><label className="form-label">Resident ID</label>
                    <input className={fi} value={legal.resident_id} onChange={le('resident_id')} />
                  </div>
                  <div className="form-field"><label className="form-label">Labor Card Number</label>
                    <input className={fi} value={legal.labor_card} onChange={le('labor_card')} />
                  </div>
                  <div className="form-field"><label className="form-label">Labor Card Expiry</label>
                    <DateInput className={fi} value={legal.labor_card_expiry} onChange={v => setLegal(prev => ({ ...prev, labor_card_expiry: v }))} />
                  </div>
                  <div className="form-field"><label className="form-label">MOL Number</label>
                    <input className={fi} value={legal.mol_number} onChange={le('mol_number')} />
                  </div>
                  <div className="form-field"><label className="form-label">Sponsor Name</label>
                    <input className={fi} value={legal.sponsor_name} onChange={le('sponsor_name')} />
                  </div>
                  <div className="form-field"><label className="form-label">Sponsor ID</label>
                    <input className={fi} value={legal.sponsor_id} onChange={le('sponsor_id')} />
                  </div>
                  <div className="form-field" style={{ gridColumn: '1 / -1' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
                      <input type="checkbox" checked={legal.is_citizen} onChange={e => setLegal(prev => ({ ...prev, is_citizen: e.target.checked }))} />
                      <span style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 500 }}>UAE Citizen</span>
                    </label>
                  </div>
                </div>

                <NavButtons isFirst={isFirst} isLast={isLast} isSubmitting={false} onBack={handleBack} onNext={handleNext} />
              </>
            )}

            {/* ── STEP 5: Account & Access (new user only) ──────────────── */}
            {step === ACCOUNT_STEP && !existingUserId && (
              <>
                <SectionHead
                  eyebrow="Step 6 — Account"
                  title="Account & Access"
                  desc="System login credentials, role, and initial account status."
                />

                {/* Avatar upload */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 28 }}>
                  <div style={{
                    width: 64, height: 64, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
                    background: 'var(--surface-subtle)', border: '1px solid var(--border-subtle)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {avatarPreview
                      ? <img src={avatarPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <span style={{ fontSize: '1.5rem', color: 'var(--text-tertiary)' }}>
                          {personal.first_name ? personal.first_name[0].toUpperCase() : '?'}
                        </span>
                    }
                  </div>
                  <div>
                    <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }}
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (file.size > 5 * 1024 * 1024) { toast('Max 5 MB', 'error'); return; }
                        setAvatarFile(file);
                        const reader = new FileReader();
                        reader.onloadend = () => setAvatarPreview(reader.result as string);
                        reader.readAsDataURL(file);
                      }}
                    />
                    <button type="button"
                      style={{
                        padding: '7px 14px', borderRadius: 7, fontSize: 13, fontWeight: 500,
                        border: '1px solid var(--border-subtle)', background: 'var(--surface-subtle)',
                        color: 'var(--text-primary)', cursor: 'pointer',
                      }}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {avatarPreview ? 'Change photo' : 'Upload photo'}
                    </button>
                    <p style={{ margin: '5px 0 0', fontSize: 12, color: 'var(--text-tertiary)' }}>JPG or PNG, max 5 MB</p>
                  </div>
                </div>

                <div className="form-grid">
                  <div className="form-field"><label className="form-label">Username *</label>
                    <input className={fi} value={account.username} onChange={ac('username')} autoComplete="new-password" />
                  </div>
                  <div className="form-field"><label className="form-label">Work Email *</label>
                    <input className={fi} type="email" value={account.email} onChange={ac('email')} />
                  </div>
                  <div className="form-field"><label className="form-label">Password *</label>
                    <input className={fi} type="password" value={account.password} onChange={ac('password')} autoComplete="new-password" />
                    <span style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4, display: 'block' }}>Min 8 characters</span>
                  </div>

                  {!selectedPosition?.default_permission_set_name && (
                    <div className="form-field" style={{ gridColumn: '1 / -1' }}>
                      <label className="form-label">Role</label>
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
                </div>

                <SubSection title="Account Status" />

                <div style={{ display: 'flex', gap: 12 }}>
                  {([
                    { val: false, label: 'Inactive — activate later', desc: 'Cannot log in until activated' },
                    { val: true,  label: 'Active immediately',        desc: 'Can log in right away'        },
                  ] as { val: boolean; label: string; desc: string }[]).map(({ val, label, desc }) => (
                    <label key={String(val)} style={{
                      flex: 1, display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer',
                      padding: '14px 16px', borderRadius: 8,
                      border: `1.5px solid ${account.is_active === val ? 'var(--brand)' : 'var(--border-subtle)'}`,
                      background: account.is_active === val ? 'var(--brand-muted, rgba(180,120,30,.07))' : 'transparent',
                      transition: 'border-color 0.15s, background 0.15s',
                    }}>
                      <input type="radio" style={{ marginTop: 2 }} checked={account.is_active === val}
                        onChange={() => setAccount(prev => ({ ...prev, is_active: val }))} />
                      <div>
                        <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{label}</p>
                        <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-tertiary)' }}>{desc}</p>
                      </div>
                    </label>
                  ))}
                </div>

                <NavButtons isFirst={isFirst} isLast={isLast} isSubmitting={false} onBack={handleBack} onNext={handleNext} />
              </>
            )}

            {/* ── STEP 6 (or 5 if no account): Bank Account ────────────── */}
            {step === BANK_STEP && (
              <>
                <SectionHead
                  eyebrow={`Step ${ALL_META.length} — Bank`}
                  title="Bank Account"
                  desc="Optional. Leave blank to add bank details later from the employee profile."
                />

                <div className="form-grid">
                  <div className="form-field"><label className="form-label">Bank Name</label>
                    <input className={fi} value={bank.bank_name} onChange={ba('bank_name')} placeholder="e.g. Emirates NBD" />
                  </div>
                  <div className="form-field"><label className="form-label">Account Holder Name</label>
                    <input className={fi} value={bank.account_holder_name} onChange={ba('account_holder_name')}
                      placeholder={`${personal.first_name} ${personal.last_name}`.trim() || 'Full name on account'} />
                  </div>
                  <div className="form-field"><label className="form-label">IBAN</label>
                    <input className={fi} value={bank.iban} onChange={ba('iban')} placeholder="AE00 0000 0000 0000 0000 000" />
                  </div>
                  <div className="form-field"><label className="form-label">Account Number</label>
                    <input className={fi} value={bank.account_number} onChange={ba('account_number')} />
                  </div>
                  <div className="form-field"><label className="form-label">SWIFT / BIC</label>
                    <input className={fi} value={bank.swift_code} onChange={ba('swift_code')} placeholder="e.g. EBILAEAD" />
                  </div>
                </div>

                {/* Summary card */}
                <div style={{
                  marginTop: 32, borderRadius: 10, overflow: 'hidden',
                  border: '1px solid var(--border-subtle)',
                }}>
                  <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-subtle)' }}>
                    <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>Summary</p>
                  </div>
                  <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 32, rowGap: 10 }}>
                    {([
                      ['Name',         [personal.first_name, personal.last_name].filter(Boolean).join(' ') || '—'],
                      ['Position',     selectedPosition?.title || '—'],
                      ['Role',         selectedPosition?.default_permission_set_name || account.role.replace(/_/g, ' ') || '—'],
                      ['Monthly Total',`${totalSalary.toLocaleString()} AED`],
                      ['Hiring Date',  employment.join_date || '—'],
                    ] as [string, string][]).map(([k, v]) => (
                      <>
                        <p key={`k-${k}`} style={{ margin: 0, fontSize: 13, color: 'var(--text-tertiary)' }}>{k}</p>
                        <p key={`v-${k}`} style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{v}</p>
                      </>
                    ))}
                  </div>
                </div>

                <NavButtons isFirst={isFirst} isLast={isLast} isSubmitting={isSubmitting} onBack={handleBack} onNext={handleNext} />
              </>
            )}

          </div>
        </div>
      </div>
    </MainLayout>
  );
}
