'use client';

import { useState, useRef, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tenantApi } from '@/lib/api/tenants';
import type { TenantBrandingData, TenantInfo, PlanInfo } from '@/types/saas';
import { toast } from '@/lib/hooks/use-toast';
import { getApiError } from '@/lib/utils/error';

const MODULES = [
  { key: 'procurement',    label: 'Procurement',    desc: 'Purchase requests, quotations, orders, GRN, invoices' },
  { key: 'inventory',      label: 'Inventory',       desc: 'Products, stock levels, item catalogue'               },
  { key: 'projects',       label: 'Projects',        desc: 'Project tracking and cost management'                 },
  { key: 'tasks',          label: 'Tasks',           desc: 'Task management, teams, and assignments'              },
  { key: 'crm',            label: 'CRM / Customers', desc: 'Customers, contacts, sales pipeline'                 },
  { key: 'hr',             label: 'HR',              desc: 'Employees, departments, attendance, payroll'          },
  { key: 'subcontractors', label: 'Subcontractors',  desc: 'Subcontractor contracts, BOQ, certificates'          },
  { key: 'violations',     label: 'Violations',      desc: 'Compliance violations tracking and reporting'        },
  { key: 'ai',             label: 'AI Assistant',    desc: 'AI-powered voice assistant and suggestions'          },
];

const STATUS_COLORS: Record<string, string> = {
  active:    'var(--color-success)',
  trial:     'var(--color-warning)',
  inactive:  'var(--text-secondary)',
  suspended: 'var(--color-error)',
};

const inp: React.CSSProperties = {
  width: '100%', padding: '8px 10px', borderRadius: 6,
  border: '1px solid var(--border-subtle)',
  background: 'var(--surface-input)', color: 'var(--text-primary)',
  fontSize: 13, outline: 'none', boxSizing: 'border-box',
};

const lbl: React.CSSProperties = {
  fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)',
  display: 'block', marginBottom: 4,
};

const card: React.CSSProperties = {
  background: 'var(--surface-card)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 12,
  padding: '24px',
  marginBottom: 20,
};

const sectionTitle: React.CSSProperties = {
  fontSize: 13, fontWeight: 700, color: 'var(--text-primary)',
  textTransform: 'uppercase', letterSpacing: '0.06em',
  marginBottom: 20, paddingBottom: 12,
  borderBottom: '1px solid var(--border-subtle)',
};

function ImageUploader({
  label, url, onUpload, uploading,
}: {
  label: string;
  url: string;
  onUpload: (file: File) => void;
  uploading: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div>
      <span style={lbl}>{label}</span>
      <div
        onClick={() => !uploading && ref.current?.click()}
        style={{
          width: '100%', height: 110, borderRadius: 8,
          border: '2px dashed var(--border-subtle)',
          background: url ? 'transparent' : 'var(--surface-subtle)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: uploading ? 'wait' : 'pointer',
          overflow: 'hidden', position: 'relative',
          transition: 'border-color 0.15s',
        }}
      >
        {url
          ? <img src={url} alt={label} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
          : <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{uploading ? 'Uploading…' : 'Click to upload'}</span>
        }
        {url && (
          <div style={{
            position: 'absolute', inset: 0, background: 'rgba(0,0,0,0)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s',
          }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.45)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0)'; }}
          >
            <span style={{ fontSize: 11, color: '#fff', opacity: 0, transition: 'opacity 0.15s' }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = '0'; }}
            >Change</span>
          </div>
        )}
      </div>
      <input ref={ref} type="file" accept="image/*" style={{ display: 'none' }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ''; }}
      />
    </div>
  );
}

export default function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const { data: tenant, isLoading: tenantLoading } = useQuery({
    queryKey: ['super-tenant', id],
    queryFn: () => tenantApi.getTenant(id),
  });

  const { data: plans } = useQuery({
    queryKey: ['super-plans'],
    queryFn: () => tenantApi.listPlans(),
    select: (r) => r.results ?? (r as unknown as PlanInfo[]),
  });

  const { data: branding, isLoading: brandingLoading } = useQuery({
    queryKey: ['super-branding', id],
    queryFn: () => tenantApi.getBranding(id),
  });

  const [brandingForm, setBrandingForm] = useState<Partial<TenantBrandingData>>({});
  const [logoUploading, setLogoUploading] = useState(false);
  const [bgUploading, setBgUploading]     = useState(false);
  const [moduleMap, setModuleMap]         = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (branding) setBrandingForm(branding);
  }, [branding]);

  useEffect(() => {
    if (tenant?.modules) {
      const m: Record<string, boolean> = {};
      tenant.modules.forEach((mod) => { m[mod.module_key] = mod.is_enabled; });
      setModuleMap(m);
    }
  }, [tenant]);

  const updateBrandingMut = useMutation({
    mutationFn: (data: Partial<TenantBrandingData>) => tenantApi.updateBranding(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['super-branding', id] });
      toast.success('Branding saved');
    },
    onError: (e) => toast.error(getApiError(e)),
  });

  const setStatusMut = useMutation({
    mutationFn: (status: string) => tenantApi.setStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['super-tenant', id] });
      toast.success('Status updated');
    },
    onError: (e) => toast.error(getApiError(e)),
  });

  const changePlanMut = useMutation({
    mutationFn: (planId: number) => tenantApi.changePlan(id, planId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['super-tenant', id] });
      toast.success('Plan updated');
    },
    onError: (e) => toast.error(getApiError(e)),
  });

  const updateModulesMut = useMutation({
    mutationFn: (updates: Record<string, boolean>) => tenantApi.updateModules(id, updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['super-tenant', id] });
      toast.success('Modules updated');
    },
    onError: (e) => toast.error(getApiError(e)),
  });

  async function handleUpload(file: File, type: 'logo' | 'login_bg') {
    if (type === 'logo') setLogoUploading(true);
    else setBgUploading(true);
    try {
      const res = await tenantApi.uploadTenantBranding(id, file, type);
      const field = type === 'logo' ? 'logo_url' : 'login_bg_url';
      setBrandingForm((p) => ({ ...p, [field]: res.url }));
      toast.success(`${type === 'logo' ? 'Logo' : 'Background'} uploaded`);
    } catch (e) {
      toast.error(getApiError(e));
    } finally {
      if (type === 'logo') setLogoUploading(false);
      else setBgUploading(false);
    }
  }

  if (tenantLoading || brandingLoading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14 }}>
        Loading…
      </div>
    );
  }

  if (!tenant) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-error)', fontSize: 14 }}>
        Company not found.
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '32px 24px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <button
          onClick={() => router.push('/super-admin/companies')}
          style={{ padding: '6px 14px', borderRadius: 7, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer' }}
        >
          ← Back
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{tenant.name}</h1>
          <code style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{tenant.company_code}</code>
        </div>
        <span style={{
          padding: '4px 12px', borderRadius: 99, fontSize: 12, fontWeight: 600,
          color: STATUS_COLORS[tenant.status] ?? 'var(--text-secondary)',
          background: `${STATUS_COLORS[tenant.status] ?? 'var(--text-secondary)'}18`,
          textTransform: 'capitalize',
        }}>
          {tenant.status}
        </span>
      </div>

      {/* ── Company Info ─────────────────────────────────────────── */}
      <div style={card}>
        <div style={sectionTitle}>Company Info</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 20 }}>
          <div>
            <span style={lbl}>Company Name</span>
            <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 500 }}>{tenant.name}</div>
            {tenant.name_ar && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{tenant.name_ar}</div>}
          </div>
          <div>
            <span style={lbl}>Active Users</span>
            <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 500 }}>
              {tenant.active_user_count ?? 0} / {tenant.max_users}
            </div>
          </div>
          <div>
            <span style={lbl}>Email</span>
            <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{tenant.email || '—'}</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* Plan */}
          <div>
            <span style={lbl}>Plan</span>
            <select
              value={tenant.plan?.id ?? ''}
              onChange={(e) => changePlanMut.mutate(Number(e.target.value))}
              style={{ ...inp }}
            >
              {(plans ?? []).map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div>
            <span style={lbl}>Status</span>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['active', 'trial', 'inactive', 'suspended'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusMut.mutate(s)}
                  disabled={tenant.status === s}
                  style={{
                    padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    border: tenant.status === s ? 'none' : '1px solid var(--border-subtle)',
                    background: tenant.status === s ? `${STATUS_COLORS[s]}22` : 'transparent',
                    color: STATUS_COLORS[s] ?? 'var(--text-secondary)',
                    opacity: tenant.status === s ? 1 : 0.6,
                    textTransform: 'capitalize',
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Branding ─────────────────────────────────────────────── */}
      <div style={card}>
        <div style={sectionTitle}>Branding</div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
          <ImageUploader
            label="Company Logo"
            url={brandingForm.logo_url ?? ''}
            onUpload={(f) => handleUpload(f, 'logo')}
            uploading={logoUploading}
          />
          <ImageUploader
            label="Login Background"
            url={brandingForm.login_bg_url ?? ''}
            onUpload={(f) => handleUpload(f, 'login_bg')}
            uploading={bgUploading}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            <span style={lbl}>Primary Color</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="color"
                value={brandingForm.primary_color ?? '#3B82F6'}
                onChange={(e) => setBrandingForm((p) => ({ ...p, primary_color: e.target.value }))}
                style={{ width: 40, height: 36, padding: 2, borderRadius: 6, border: '1px solid var(--border-subtle)', cursor: 'pointer', background: 'var(--surface-input)' }}
              />
              <input
                type="text"
                value={brandingForm.primary_color ?? ''}
                onChange={(e) => setBrandingForm((p) => ({ ...p, primary_color: e.target.value }))}
                placeholder="#3B82F6"
                style={{ ...inp, flex: 1 }}
              />
            </div>
          </div>
          <div>
            <span style={lbl}>Legal Name</span>
            <input
              type="text"
              value={brandingForm.company_legal_name ?? ''}
              onChange={(e) => setBrandingForm((p) => ({ ...p, company_legal_name: e.target.value }))}
              style={inp}
              placeholder="Full legal company name"
            />
          </div>
          <div>
            <span style={lbl}>TRN</span>
            <input
              type="text"
              value={brandingForm.company_trn ?? ''}
              onChange={(e) => setBrandingForm((p) => ({ ...p, company_trn: e.target.value }))}
              style={inp}
              placeholder="Tax Registration Number"
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            <span style={lbl}>Phone</span>
            <input
              type="text"
              value={brandingForm.company_phone ?? ''}
              onChange={(e) => setBrandingForm((p) => ({ ...p, company_phone: e.target.value }))}
              style={inp}
              placeholder="+971 XX XXX XXXX"
            />
          </div>
          <div>
            <span style={lbl}>Email</span>
            <input
              type="email"
              value={brandingForm.company_email ?? ''}
              onChange={(e) => setBrandingForm((p) => ({ ...p, company_email: e.target.value }))}
              style={inp}
              placeholder="info@company.com"
            />
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <span style={lbl}>Address</span>
          <textarea
            value={brandingForm.company_address ?? ''}
            onChange={(e) => setBrandingForm((p) => ({ ...p, company_address: e.target.value }))}
            rows={2}
            style={{ ...inp, resize: 'vertical' }}
            placeholder="Company physical address"
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={() => updateBrandingMut.mutate(brandingForm)}
            disabled={updateBrandingMut.isPending}
            style={{
              padding: '9px 24px', borderRadius: 8, border: 'none',
              background: 'var(--color-primary)', color: '#fff',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              opacity: updateBrandingMut.isPending ? 0.6 : 1,
            }}
          >
            {updateBrandingMut.isPending ? 'Saving…' : 'Save Branding'}
          </button>
        </div>
      </div>

      {/* ── Modules ──────────────────────────────────────────────── */}
      <div style={card}>
        <div style={sectionTitle}>Modules</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
          {MODULES.map((mod) => (
            <label
              key={mod.key}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px',
                borderRadius: 8, border: '1px solid var(--border-subtle)',
                background: moduleMap[mod.key] ? 'var(--color-primary)0A' : 'var(--surface-subtle)',
                cursor: 'pointer', transition: 'background 0.15s',
              }}
            >
              <input
                type="checkbox"
                checked={moduleMap[mod.key] ?? false}
                onChange={(e) => setModuleMap((p) => ({ ...p, [mod.key]: e.target.checked }))}
                style={{ marginTop: 2, accentColor: 'var(--color-primary)', width: 15, height: 15, flexShrink: 0 }}
              />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{mod.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{mod.desc}</div>
              </div>
            </label>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={() => updateModulesMut.mutate(moduleMap)}
            disabled={updateModulesMut.isPending}
            style={{
              padding: '9px 24px', borderRadius: 8, border: 'none',
              background: 'var(--color-primary)', color: '#fff',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              opacity: updateModulesMut.isPending ? 0.6 : 1,
            }}
          >
            {updateModulesMut.isPending ? 'Saving…' : 'Save Modules'}
          </button>
        </div>
      </div>

    </div>
  );
}
