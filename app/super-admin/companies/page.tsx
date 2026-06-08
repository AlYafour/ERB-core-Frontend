'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tenantApi } from '@/lib/api/tenants';
import type { CreateTenantPayload, CreateTenantResponse } from '@/lib/api/tenants';
import { toast } from '@/lib/hooks/use-toast';
import { getApiError } from '@/lib/utils/error';
import type { TenantInfo, PlanInfo } from '@/types/saas';
import { XERB } from '@/lib/config/brand';

const C = XERB.colors;

const MODULES = [
  { key: 'procurement',    label: 'Procurement',     desc: 'Purchase requests, quotations, orders, GRN, invoices', defaultOn: true  },
  { key: 'inventory',      label: 'Inventory',        desc: 'Products, stock levels, item catalogue',               defaultOn: true  },
  { key: 'projects',       label: 'Projects',         desc: 'Project tracking and cost management',                 defaultOn: true  },
  { key: 'tasks',          label: 'Tasks',            desc: 'Task management, teams, and assignments',              defaultOn: true  },
  { key: 'crm',            label: 'CRM / Customers',  desc: 'Customers, contacts, sales pipeline',                  defaultOn: false },
  { key: 'hr',             label: 'HR',               desc: 'Employees, departments, attendance, payroll',          defaultOn: false },
  { key: 'subcontractors', label: 'Subcontractors',   desc: 'Subcontractor contracts, BOQ, certificates',           defaultOn: false },
  { key: 'violations',     label: 'Violations',       desc: 'Compliance violations tracking and reporting',         defaultOn: false },
  { key: 'ai',             label: 'AI Assistant',     desc: 'AI-powered voice assistant and suggestions',           defaultOn: false },
];

const STATUS_COLORS: Record<string, string> = {
  active:    'var(--color-success)',
  trial:     'var(--color-warning)',
  inactive:  'var(--text-secondary)',
  suspended: 'var(--color-error)',
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', borderRadius: 6,
  border: '1px solid var(--border-subtle)',
  background: 'var(--surface-input)', color: 'var(--text-primary)',
  fontSize: 13, outline: 'none', boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 4,
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', padding: '2px 8px',
      borderRadius: 99, fontSize: 11, fontWeight: 600,
      color: STATUS_COLORS[status] ?? 'var(--text-secondary)',
      background: `${STATUS_COLORS[status] ?? 'var(--text-secondary)'}18`,
      textTransform: 'capitalize',
    }}>
      {status}
    </span>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      style={{ padding: '3px 8px', fontSize: 11, borderRadius: 5, border: '1px solid var(--border-subtle)', background: 'transparent', cursor: 'pointer', color: copied ? C.primary : 'var(--text-secondary)', transition: 'color 150ms' }}
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

function SectionTitle({ n, title }: { n: number; title: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
      <div style={{ width: 24, height: 24, borderRadius: '50%', background: C.primary, color: '#fff', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{n}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</div>
    </div>
  );
}

// ── Default module set derived from plan modules list ────────────────────────
function defaultModulesFromPlan(plan: PlanInfo | undefined): string[] {
  if (plan?.plan_modules?.length) {
    return plan.plan_modules.map((m) => m.module_key);
  }
  return MODULES.filter((m) => m.defaultOn).map((m) => m.key);
}

// ── Success panel shown after creation ──────────────────────────────────────
function SuccessPanel({
  result,
  onClose,
}: {
  result: CreateTenantResponse;
  onClose: () => void;
}) {
  const [showPass, setShowPass] = useState(false);
  const creds = result.admin_credentials;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(34,197,94,0.12)', border: '2px solid rgba(34,197,94,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(34,197,94,0.9)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>Company Created!</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{result.name} has been set up successfully.</div>
      </div>

      {/* Company code */}
      <div style={{ background: 'var(--surface-subtle)', borderRadius: 8, padding: '12px 14px' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Company Code</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <code style={{ fontSize: 14, fontWeight: 700, color: C.primary, letterSpacing: '0.05em' }}>{result.company_code}</code>
          <CopyButton value={result.company_code} />
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>Share this with the company — they enter it at company login.</div>
      </div>

      {/* Admin credentials */}
      {creds && (
        <div style={{ background: 'var(--surface-subtle)', borderRadius: 8, padding: '12px 14px', border: '1px solid rgba(99,102,241,0.2)' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Admin Credentials</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { label: 'Username', value: creds.username },
              { label: 'Email', value: creds.email },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 1 }}>{label}</div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{value}</div>
                </div>
                <CopyButton value={value} />
              </div>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 1 }}>Password</div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'monospace', letterSpacing: showPass ? '0.02em' : '0.1em' }}>
                  {showPass ? creds.password : '•'.repeat(Math.min(creds.password.length, 12))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => setShowPass(!showPass)} style={{ padding: '3px 8px', fontSize: 11, borderRadius: 5, border: '1px solid var(--border-subtle)', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                  {showPass ? 'Hide' : 'Show'}
                </button>
                <CopyButton value={creds.password} />
              </div>
            </div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-warning)', marginTop: 10, padding: '6px 8px', background: 'rgba(245,158,11,0.08)', borderRadius: 6 }}>
            Save these credentials — the password cannot be retrieved later.
          </div>
        </div>
      )}

      <button
        onClick={onClose}
        style={{ width: '100%', padding: '10px 0', borderRadius: 8, border: 'none', background: C.primary, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
      >
        Done
      </button>
    </div>
  );
}

// ── Full-screen drawer overlay ───────────────────────────────────────────────
function CreateCompanyDrawer({
  plans,
  onClose,
  onCreated,
}: {
  plans: PlanInfo[];
  onClose: () => void;
  onCreated: () => void;
}) {
  // ── Form state ─────────────────────────────────────────────────────────────
  const [name,          setName]          = useState('');
  const [code,          setCode]          = useState('');
  const [codeIsManual,  setCodeIsManual]  = useState(false);
  const [codeSuggesting,setCodeSuggesting]= useState(false);
  const [status,        setStatus]        = useState<'trial' | 'active' | 'inactive'>('trial');
  const [planId,        setPlanId]        = useState<number>(plans[0]?.id ?? 0);
  const [industry,      setIndustry]      = useState('');
  const [country,       setCountry]       = useState('United Arab Emirates');
  const [email,         setEmail]         = useState('');
  const [maxUsers,      setMaxUsers]      = useState<number>(0);
  const [maxProjects,   setMaxProjects]   = useState<number>(0);
  const [modules,       setModules]       = useState<string[]>(() => {
    const plan = plans.find((p) => p.id === (plans[0]?.id ?? 0));
    return defaultModulesFromPlan(plan);
  });
  const [adminFirst,    setAdminFirst]    = useState('');
  const [adminLast,     setAdminLast]     = useState('');
  const [adminEmail,    setAdminEmail]    = useState('');
  const [adminPass,     setAdminPass]     = useState('');
  const [adminPassConf, setAdminPassConf] = useState('');
  const [showAdminPass, setShowAdminPass] = useState(false);
  const [logoUrl,       setLogoUrl]       = useState('');
  const [loginBgUrl,    setLoginBgUrl]    = useState('');
  const [primaryColor,  setPrimaryColor]  = useState('#6366F1');
  const [legalName,     setLegalName]     = useState('');
  const [logoPreview,   setLogoPreview]   = useState('');
  const [bgPreview,     setBgPreview]     = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBg,   setUploadingBg]   = useState(false);
  const [result,        setResult]        = useState<CreateTenantResponse | null>(null);
  const [errors,        setErrors]        = useState<Record<string, string>>({});

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const qc = useQueryClient();

  // ── Auto-suggest code when name changes ───────────────────────────────────
  useEffect(() => {
    if (codeIsManual || !name.trim()) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setCodeSuggesting(true);
      try {
        const { company_code } = await tenantApi.suggestCode(name.trim());
        setCode(company_code);
      } catch { /* silent */ }
      finally { setCodeSuggesting(false); }
    }, 600);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [name, codeIsManual]);

  // ── Sync modules when plan changes ────────────────────────────────────────
  useEffect(() => {
    const plan = plans.find((p) => p.id === planId);
    setModules(defaultModulesFromPlan(plan));
  }, [planId, plans]);

  // ── File upload handlers ──────────────────────────────────────────────────
  const uploadFile = useCallback(async (file: File, type: 'logo' | 'login_bg') => {
    const setter = type === 'logo' ? setUploadingLogo : setUploadingBg;
    const urlSetter = type === 'logo' ? setLogoUrl : setLoginBgUrl;
    const previewSetter = type === 'logo' ? setLogoPreview : setBgPreview;
    setter(true);
    try {
      const preview = URL.createObjectURL(file);
      previewSetter(preview);
      const { url } = await tenantApi.uploadBranding(file, type);
      urlSetter(url);
    } catch (err) {
      toast(getApiError(err, 'Upload failed'), 'error');
      previewSetter('');
    } finally {
      setter(false);
    }
  }, []);

  // ── Validation ────────────────────────────────────────────────────────────
  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!name.trim())  e.name = 'Company name is required.';
    if (!code.trim())  e.code = 'Company code is required.';
    if (!planId)       e.plan = 'Plan is required.';
    if (adminEmail || adminPass || adminFirst || adminLast) {
      if (!adminEmail) e.adminEmail = 'Admin email is required.';
      if (!adminPass)  e.adminPass  = 'Admin password is required.';
      if (adminPass && adminPass !== adminPassConf) e.adminPassConf = 'Passwords do not match.';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  // ── Mutation ──────────────────────────────────────────────────────────────
  const { mutate, isPending } = useMutation({
    mutationFn: () => {
      const payload: CreateTenantPayload = {
        name:             name.trim(),
        company_code:     code.trim(),
        status,
        plan:             planId,
        industry:         industry || undefined,
        country:          country  || undefined,
        email:            email    || undefined,
        max_users:        maxUsers  || undefined,
        max_projects:     maxProjects || undefined,
        enabled_modules:  modules,
      };
      if (adminEmail) {
        payload.admin_first_name = adminFirst || undefined;
        payload.admin_last_name  = adminLast  || undefined;
        payload.admin_email      = adminEmail;
        payload.admin_password   = adminPass;
      }
      if (logoUrl)        payload.branding_logo_url         = logoUrl;
      if (loginBgUrl)     payload.branding_login_bg_url     = loginBgUrl;
      if (primaryColor)   payload.branding_primary_color    = primaryColor;
      if (legalName)      payload.branding_company_legal_name = legalName;
      return tenantApi.createTenant(payload);
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['super', 'tenants'] });
      setResult(data);
      onCreated();
    },
    onError: (err: unknown) => {
      toast(getApiError(err, 'Failed to create company'), 'error');
    },
  });

  function handleSubmit() {
    if (validate()) mutate();
  }

  // ── If creation succeeded, show credentials panel ─────────────────────────
  if (result) {
    return (
      <DrawerShell onClose={onClose}>
        <SuccessPanel result={result} onClose={onClose} />
      </DrawerShell>
    );
  }

  const err = (field: string) => errors[field] ? (
    <div style={{ fontSize: 11, color: 'var(--color-error)', marginTop: 3 }}>{errors[field]}</div>
  ) : null;

  const selectedPlan = plans.find((p) => p.id === planId);

  return (
    <DrawerShell onClose={onClose} title="Add Company" footer={
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button onClick={onClose} style={{ padding: '9px 20px', borderRadius: 7, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer' }}>
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={isPending}
          style={{ padding: '9px 24px', borderRadius: 7, border: 'none', background: C.primary, color: '#fff', fontSize: 13, fontWeight: 600, cursor: isPending ? 'not-allowed' : 'pointer', opacity: isPending ? 0.6 : 1 }}
        >
          {isPending ? 'Creating…' : 'Create Company'}
        </button>
      </div>
    }>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

        {/* ── Section 1: Company Basics ─────────────────────────────── */}
        <section>
          <SectionTitle n={1} title="Company Basics" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            <div>
              <label style={labelStyle}>Company Name *</label>
              <input style={{ ...inputStyle, borderColor: errors.name ? 'var(--color-error)' : 'var(--border-subtle)' }}
                value={name} onChange={(e) => { setName(e.target.value); setErrors((ev) => ({ ...ev, name: '' })); }}
                placeholder="e.g. Acme Construction" />
              {err('name')}
            </div>

            <div>
              <label style={labelStyle}>Company Code *
                <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-tertiary)', marginLeft: 6 }}>
                  {codeSuggesting ? '(suggesting…)' : codeIsManual ? '(manual)' : '(auto-generated)'}
                </span>
              </label>
              <input
                style={{ ...inputStyle, fontFamily: 'monospace', letterSpacing: '0.04em', borderColor: errors.code ? 'var(--color-error)' : 'var(--border-subtle)' }}
                value={code}
                onChange={(e) => { setCode(e.target.value); setCodeIsManual(true); setErrors((ev) => ({ ...ev, code: '' })); }}
                placeholder="ERB-ACME-2026-ABC123"
              />
              {err('code')}
              {codeIsManual && (
                <button onClick={() => { setCodeIsManual(false); setName((n) => n); }}
                  style={{ fontSize: 11, color: C.primary, background: 'none', border: 'none', cursor: 'pointer', marginTop: 3, padding: 0 }}>
                  Reset to auto-suggest
                </button>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Status</label>
                <select style={inputStyle} value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
                  <option value="trial">Trial</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Plan *</label>
                <select style={{ ...inputStyle, borderColor: errors.plan ? 'var(--color-error)' : 'var(--border-subtle)' }}
                  value={planId} onChange={(e) => { setPlanId(Number(e.target.value)); setErrors((ev) => ({ ...ev, plan: '' })); }}>
                  {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                {err('plan')}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Country</label>
                <input style={inputStyle} value={country} onChange={(e) => setCountry(e.target.value)} placeholder="UAE" />
              </div>
              <div>
                <label style={labelStyle}>Industry</label>
                <input style={inputStyle} value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="Construction" />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Company Email</label>
              <input style={inputStyle} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="info@company.com" />
            </div>
          </div>
        </section>

        <div style={{ height: 1, background: 'var(--border-subtle)' }} />

        {/* ── Section 2: Limits & Modules ──────────────────────────── */}
        <section>
          <SectionTitle n={2} title="Limits & Modules" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Max Users <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>(0 = plan default)</span></label>
                <input style={inputStyle} type="number" min={0} value={maxUsers || ''} onChange={(e) => setMaxUsers(Number(e.target.value) || 0)} placeholder={String(selectedPlan?.max_users ?? 0)} />
              </div>
              <div>
                <label style={labelStyle}>Max Projects <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>(0 = unlimited)</span></label>
                <input style={inputStyle} type="number" min={0} value={maxProjects || ''} onChange={(e) => setMaxProjects(Number(e.target.value) || 0)} placeholder="0" />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Enabled Modules
                <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-tertiary)', marginLeft: 6 }}>
                  Pre-filled from plan · {modules.length} selected
                </span>
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                {MODULES.map((m) => {
                  const on = modules.includes(m.key);
                  return (
                    <label key={m.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 10px', borderRadius: 7, border: `1px solid ${on ? C.primary + '50' : 'var(--border-subtle)'}`, background: on ? C.primary + '08' : 'transparent', cursor: 'pointer', userSelect: 'none' }}>
                      <input
                        type="checkbox" checked={on}
                        onChange={() => setModules((prev) => on ? prev.filter((k) => k !== m.key) : [...prev, m.key])}
                        style={{ marginTop: 2, accentColor: C.primary, flexShrink: 0 }}
                      />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{m.label}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 1 }}>{m.desc}</div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <div style={{ height: 1, background: 'var(--border-subtle)' }} />

        {/* ── Section 3: Admin Account ──────────────────────────────── */}
        <section>
          <SectionTitle n={3} title="Admin Account" />
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 14, lineHeight: 1.5 }}>
            Optional — leave email blank to skip. If provided, a platform admin user will be created for this company.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>First Name</label>
                <input style={inputStyle} value={adminFirst} onChange={(e) => setAdminFirst(e.target.value)} placeholder="Ali" />
              </div>
              <div>
                <label style={labelStyle}>Last Name</label>
                <input style={inputStyle} value={adminLast} onChange={(e) => setAdminLast(e.target.value)} placeholder="Hassan" />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Admin Email {adminFirst || adminLast || adminPass ? '*' : ''}</label>
              <input style={{ ...inputStyle, borderColor: errors.adminEmail ? 'var(--color-error)' : 'var(--border-subtle)' }}
                type="email" value={adminEmail}
                onChange={(e) => { setAdminEmail(e.target.value); setErrors((ev) => ({ ...ev, adminEmail: '' })); }}
                placeholder="admin@company.com" />
              {err('adminEmail')}
            </div>

            <div>
              <label style={labelStyle}>Password {adminEmail ? '*' : ''}</label>
              <div style={{ position: 'relative' }}>
                <input
                  style={{ ...inputStyle, paddingRight: 44, borderColor: errors.adminPass ? 'var(--color-error)' : 'var(--border-subtle)' }}
                  type={showAdminPass ? 'text' : 'password'}
                  value={adminPass}
                  onChange={(e) => { setAdminPass(e.target.value); setErrors((ev) => ({ ...ev, adminPass: '' })); }}
                  placeholder="Min 8 characters"
                />
                <button type="button" onClick={() => setShowAdminPass(!showAdminPass)}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 0 }}>
                  {showAdminPass ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  )}
                </button>
              </div>
              {err('adminPass')}
            </div>

            <div>
              <label style={labelStyle}>Confirm Password</label>
              <input
                style={{ ...inputStyle, borderColor: errors.adminPassConf ? 'var(--color-error)' : 'var(--border-subtle)' }}
                type={showAdminPass ? 'text' : 'password'}
                value={adminPassConf}
                onChange={(e) => { setAdminPassConf(e.target.value); setErrors((ev) => ({ ...ev, adminPassConf: '' })); }}
                placeholder="Repeat password"
              />
              {err('adminPassConf')}
            </div>
          </div>
        </section>

        <div style={{ height: 1, background: 'var(--border-subtle)' }} />

        {/* ── Section 4: Branding ───────────────────────────────────── */}
        <section>
          <SectionTitle n={4} title="Branding" />
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 14, lineHeight: 1.5 }}>
            Optional — all fields can be set later by the company admin.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Logo upload */}
            <div>
              <label style={labelStyle}>Company Logo</label>
              <BrandingUpload
                preview={logoPreview} uploading={uploadingLogo}
                accept="image/*" placeholder="Upload logo (PNG / SVG recommended)"
                onChange={(f) => uploadFile(f, 'logo')}
                onClear={() => { setLogoUrl(''); setLogoPreview(''); }}
                aspectRatio="wide"
              />
            </div>

            {/* Login background */}
            <div>
              <label style={labelStyle}>Login Background</label>
              <BrandingUpload
                preview={bgPreview} uploading={uploadingBg}
                accept="image/*" placeholder="Upload login background (1920×1080 or similar)"
                onChange={(f) => uploadFile(f, 'login_bg')}
                onClear={() => { setLoginBgUrl(''); setBgPreview(''); }}
                aspectRatio="wide"
              />
            </div>

            {/* Primary color */}
            <div>
              <label style={labelStyle}>Primary Color</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: primaryColor, border: '1px solid var(--border-subtle)', flexShrink: 0, overflow: 'hidden', position: 'relative', cursor: 'pointer' }}>
                  <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)}
                    style={{ opacity: 0, position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: 'pointer', border: 'none' }} />
                </div>
                <input style={{ ...inputStyle, maxWidth: 120, fontFamily: 'monospace' }}
                  value={primaryColor}
                  onChange={(e) => { const v = e.target.value; if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) setPrimaryColor(v); }}
                  placeholder="#6366F1"
                />
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Click swatch to open color picker</span>
              </div>
            </div>

            {/* Legal name */}
            <div>
              <label style={labelStyle}>Company Legal Name</label>
              <input style={inputStyle} value={legalName} onChange={(e) => setLegalName(e.target.value)}
                placeholder="Acme Construction L.L.C." />
            </div>
          </div>
        </section>
      </div>
    </DrawerShell>
  );
}

// ── Reusable file-upload area ────────────────────────────────────────────────
function BrandingUpload({ preview, uploading, accept, placeholder, onChange, onClear, aspectRatio }: {
  preview: string; uploading: boolean; accept: string; placeholder: string;
  onChange: (f: File) => void; onClear: () => void; aspectRatio?: 'square' | 'wide';
}) {
  const ref = useRef<HTMLInputElement>(null);
  const height = aspectRatio === 'wide' ? 80 : 80;

  if (preview) {
    return (
      <div style={{ position: 'relative', width: '100%', height, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        <button onClick={onClear} style={{ position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: 'none', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>×</button>
      </div>
    );
  }

  return (
    <div
      onClick={() => !uploading && ref.current?.click()}
      style={{
        width: '100%', height, borderRadius: 8, border: '2px dashed var(--border-subtle)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 6,
        cursor: uploading ? 'wait' : 'pointer', background: 'var(--surface-subtle)',
        transition: 'border-color 150ms',
      }}
      onMouseEnter={(e) => { if (!uploading) (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-default)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-subtle)'; }}
    >
      {uploading ? (
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Uploading…</div>
      ) : (
        <>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--text-tertiary)', opacity: 0.6 }}>
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round" strokeLinejoin="round"/>
            <polyline points="17 8 12 3 7 8" strokeLinecap="round" strokeLinejoin="round"/>
            <line x1="12" y1="3" x2="12" y2="15" strokeLinecap="round"/>
          </svg>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{placeholder}</span>
        </>
      )}
      <input ref={ref} type="file" accept={accept} style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) onChange(f); e.target.value = ''; }} />
    </div>
  );
}

// ── Shared drawer shell ──────────────────────────────────────────────────────
function DrawerShell({ children, onClose, title, footer }: { children: React.ReactNode; onClose: () => void; title?: string; footer?: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex' }}>
      {/* Backdrop */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} onClick={onClose} />

      {/* Drawer panel */}
      <div style={{
        position: 'relative', marginLeft: 'auto',
        width: '100%', maxWidth: 560, height: '100%',
        background: 'var(--surface-card)',
        boxShadow: '-20px 0 60px rgba(0,0,0,0.2)',
        display: 'flex', flexDirection: 'column',
      }}>
        {title && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 16px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>{title}</h2>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4, display: 'flex', borderRadius: 6 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        )}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {children}
        </div>
        {footer && (
          <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-subtle)', flexShrink: 0, background: 'var(--surface-card)' }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function CompaniesPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['super', 'tenants', page, search],
    queryFn: () => tenantApi.listTenants({ page, search: search || undefined }),
    staleTime: 30_000,
  });

  const { data: plansData } = useQuery({
    queryKey: ['super', 'plans'],
    queryFn: tenantApi.listPlans,
    staleTime: 5 * 60_000,
  });
  const plans = plansData?.results ?? [];

  const setStatusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => tenantApi.setStatus(id, status),
    onSuccess: () => {
      toast('Status updated', 'success');
      qc.invalidateQueries({ queryKey: ['super', 'tenants'] });
    },
    onError: (err: unknown) => toast(getApiError(err, 'Failed to update status'), 'error'),
  });

  const regenMut = useMutation({
    mutationFn: (id: string) => tenantApi.regenerateCode(id),
    onSuccess: (res) => {
      toast(`New code: ${res.company_code}`, 'success');
      qc.invalidateQueries({ queryKey: ['super', 'tenants'] });
    },
    onError: (err: unknown) => toast(getApiError(err, 'Failed to regenerate code'), 'error'),
  });

  const tenants: TenantInfo[] = data?.results ?? [];
  const totalPages = data ? Math.ceil(data.count / 20) : 1;

  const thStyle: React.CSSProperties = { padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-subtle)', whiteSpace: 'nowrap' };
  const tdStyle: React.CSSProperties = { padding: '12px 14px', fontSize: 13, color: 'var(--text-primary)', borderBottom: '1px solid var(--border-subtle)', verticalAlign: 'middle' };

  return (
    <>
      <div>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Companies</h1>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '6px 0 0' }}>
              {data ? `${data.count} total` : '…'}
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: C.primary, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            + Add Company
          </button>
        </div>

        {/* Search */}
        <div style={{ marginBottom: 16 }}>
          <input
            type="search"
            placeholder="Search companies…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--surface-input)', color: 'var(--text-primary)', fontSize: 13, width: 260, outline: 'none' }}
          />
        </div>

        {/* Table */}
        <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, overflow: 'auto' }}>
          {isLoading ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14 }}>Loading…</div>
          ) : tenants.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14 }}>No companies found.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--surface-subtle)' }}>
                  <th style={thStyle}>Company</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Plan</th>
                  <th style={thStyle}>Users</th>
                  <th style={thStyle}>Company Code</th>
                  <th style={thStyle}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((t) => (
                  <tr key={t.id}>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 600 }}>{t.name}</div>
                      {t.email && <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{t.email}</div>}
                    </td>
                    <td style={tdStyle}><StatusBadge status={t.status} /></td>
                    <td style={tdStyle}>{t.plan?.name ?? '—'}</td>
                    <td style={tdStyle}>{t.active_user_count ?? '—'}</td>
                    <td style={tdStyle}>
                      <code style={{ fontSize: 11, background: 'var(--surface-subtle)', padding: '2px 6px', borderRadius: 4 }}>{t.company_code}</code>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {t.status !== 'active' && (
                          <button onClick={() => setStatusMut.mutate({ id: t.id, status: 'active' })}
                            style={{ padding: '4px 10px', fontSize: 11, fontWeight: 600, borderRadius: 5, border: 'none', background: 'var(--color-success)', color: '#fff', cursor: 'pointer' }}>
                            Activate
                          </button>
                        )}
                        {t.status !== 'suspended' && (
                          <button onClick={() => setStatusMut.mutate({ id: t.id, status: 'suspended' })}
                            style={{ padding: '4px 10px', fontSize: 11, fontWeight: 600, borderRadius: 5, border: 'none', background: 'var(--color-error)', color: '#fff', cursor: 'pointer' }}>
                            Suspend
                          </button>
                        )}
                        <button onClick={() => regenMut.mutate(t.id)}
                          style={{ padding: '4px 10px', fontSize: 11, borderRadius: 5, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                          Regen Code
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 16, justifyContent: 'flex-end' }}>
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-primary)', fontSize: 13, cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.4 : 1 }}>
              Prev
            </button>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{page} / {totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-primary)', fontSize: 13, cursor: page === totalPages ? 'not-allowed' : 'pointer', opacity: page === totalPages ? 0.4 : 1 }}>
              Next
            </button>
          </div>
        )}
      </div>

      {showCreate && plans.length > 0 && (
        <CreateCompanyDrawer
          plans={plans}
          onClose={() => setShowCreate(false)}
          onCreated={() => { /* drawer stays open to show success panel */ }}
        />
      )}
    </>
  );
}
