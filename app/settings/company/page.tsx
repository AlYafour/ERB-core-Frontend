'use client';

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import MainLayout from '@/components/layout/MainLayout';
import { tenantApi } from '@/lib/api/tenants';
import { useMyPermissions } from '@/lib/hooks/use-my-permissions';
import { useAuth } from '@/lib/hooks/use-auth';
import { toast } from '@/lib/hooks/use-toast';
import { Button, PageShell, PageHeader } from '@/components/ui';
import type { TenantBrandingData } from '@/types/saas';
import type { User } from '@/types';
import Image from 'next/image';
import { generateScale, hexToRgba, applyTenantTheme } from '@/lib/utils/tenant-theme';
import apiClient from '@/lib/api/client';

/* ── color presets ────────────────────────────────────────────────── */
const PRESETS = [
  { hex: '#C9943A', name: 'Gold',    surface: 'Warm Cream'    },
  { hex: '#1B4F72', name: 'Navy',    surface: 'Cool Ivory'    },
  { hex: '#1A6B3C', name: 'Forest',  surface: 'Sage White'    },
  { hex: '#7B2D8B', name: 'Plum',    surface: 'Lavender Mist' },
  { hex: '#C0392B', name: 'Crimson', surface: 'Rose White'    },
  { hex: '#2E86AB', name: 'Steel',   surface: 'Sky Ivory'     },
  { hex: '#B7410E', name: 'Rust',    surface: 'Sand White'    },
  { hex: '#2C3E50', name: 'Slate',   surface: 'Pearl Grey'    },
  { hex: '#276749', name: 'Emerald', surface: 'Mint White'    },
  { hex: '#6B21A8', name: 'Violet',  surface: 'Lilac White'   },
];

/* ── color helpers ───────────────────────────────────────────────── */
function hexToHue(hex: string): number {
  const c = hex.replace('#', '');
  const r = parseInt(c.slice(0, 2), 16) / 255;
  const g = parseInt(c.slice(2, 4), 16) / 255;
  const b = parseInt(c.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (d === 0) return 0;
  const h = max === r ? ((g - b) / d + (g < b ? 6 : 0)) / 6
          : max === g ? ((b - r) / d + 2) / 6
          : ((r - g) / d + 4) / 6;
  return h * 360;
}
function previewHsl(h: number, s: number, l: number): string {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return Math.round(255 * (l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1))).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/* ── ThemePreview ────────────────────────────────────────────────── */
function ThemePreview({ color, mode }: { color: string; mode: 'light' | 'dark' }) {
  const sc = generateScale(color);
  const isDark = mode === 'dark';
  const h = hexToHue(color);
  const bg      = isDark ? previewHsl(h, 14, 10) : previewHsl(h,  7, 96);
  const surf    = isDark ? previewHsl(h, 18, 13) : previewHsl(h,  4, 99);
  const border  = isDark ? previewHsl(h, 20, 20) : previewHsl(h, 13, 90);
  const sidebar = isDark ? previewHsl(h, 18,  8) : previewHsl(h,  4, 99);
  const textPri = isDark ? '#F1F5F9' : 'var(--text-primary)';
  const textSec = isDark ? '#94A3B8' : 'var(--text-secondary)';
  const active  = isDark ? sc['400'] : sc['500'];
  const sideAct = hexToRgba(color, isDark ? 0.12 : 0.08);

  return (
    <div style={{ border: `1px solid ${border}`, borderRadius: 10, overflow: 'hidden', flex: 1, minWidth: 0, display: 'flex' }}>
      <div style={{ width: 52, background: sidebar, borderRight: `1px solid ${previewHsl(h, 18, 12)}`, display: 'flex', flexDirection: 'column', padding: '10px 0', gap: 4, flexShrink: 0 }}>
        <div style={{ height: 8, background: sideAct, borderRight: `2px solid ${active}`, margin: '0 0 4px 0' }} />
        {[0.3, 0.15, 0.15].map((op, i) => (
          <div key={i} style={{ height: 6, background: previewHsl(h, 14, 37), opacity: op, margin: '0 8px', borderRadius: 3 }} />
        ))}
      </div>
      <div style={{ background: bg, padding: 12, flex: 1 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: textSec, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
          {mode === 'dark' ? '🌙 Dark' : '☀️ Light'}
        </div>
        <div style={{ display: 'flex', gap: 5, marginBottom: 8 }}>
          <div style={{ background: active, color: '#fff', borderRadius: 5, padding: '4px 10px', fontSize: 10, fontWeight: 600 }}>Save</div>
          <div style={{ background: surf, color: textSec, borderRadius: 5, padding: '4px 10px', fontSize: 10, border: `1px solid ${border}` }}>Cancel</div>
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: hexToRgba(color, 0.10), border: `1px solid ${hexToRgba(color, 0.25)}`, borderRadius: 20, padding: '2px 8px', marginBottom: 7 }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: active }} />
          <span style={{ fontSize: 9, fontWeight: 600, color: active }}>Active</span>
        </div>
        <div style={{ border: `1.5px solid ${active}`, borderRadius: 5, padding: '4px 8px', background: surf, boxShadow: `0 0 0 3px ${hexToRgba(color, 0.14)}` }}>
          <span style={{ fontSize: 9, color: textPri }}>Input focused</span>
        </div>
      </div>
    </div>
  );
}

/* ── BrandColorPicker ────────────────────────────────────────────── */
function BrandColorPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const isValidHex = /^#[0-9A-Fa-f]{6}$/.test(value);
  const safeColor = isValidHex ? value : '#C9943A';

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 16 }}>
        {PRESETS.map(p => {
          const h = hexToHue(p.hex);
          const lightSurf = previewHsl(h, 7, 96);
          const isSelected = value.toLowerCase() === p.hex.toLowerCase();
          return (
            <button
              key={p.hex}
              title={`${p.name} / ${p.surface}`}
              onClick={() => onChange(p.hex)}
              style={{
                height: 48, borderRadius: 10, cursor: 'pointer',
                border: isSelected ? `2.5px solid ${p.hex}` : '2.5px solid transparent',
                outline: isSelected ? '2px solid var(--text-primary)' : 'none',
                outlineOffset: 2,
                overflow: 'hidden', display: 'flex', flexDirection: 'column',
                boxShadow: isSelected ? `0 0 0 1px ${p.hex}, 0 2px 8px rgba(0,0,0,0.2)` : '0 1px 3px rgba(0,0,0,0.18)',
                transition: 'transform 0.12s, box-shadow 0.12s',
                padding: 0, background: 'none',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.06)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
            >
              <div style={{ flex: 1, background: p.hex, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 8, fontWeight: 800, color: '#fff', letterSpacing: '0.05em', opacity: 0.9 }}>{p.name.toUpperCase()}</span>
              </div>
              <div style={{ flex: 1, background: lightSurf, display: 'flex', alignItems: 'center', justifyContent: 'center', borderTop: `1px solid ${previewHsl(h, 13, 88)}` }}>
                <span style={{ fontSize: 7, color: p.hex, fontWeight: 700, letterSpacing: '0.04em', opacity: 0.8 }}>{p.surface.toUpperCase()}</span>
              </div>
            </button>
          );
        })}
        <label title="Custom color" style={{ width: 36, height: 36, borderRadius: 8, border: '2px dashed var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: 'var(--surface-subtle)', position: 'relative', overflow: 'hidden' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
          <input type="color" value={safeColor} onChange={e => onChange(e.target.value)}
            style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }} />
        </label>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div style={{ width: 32, height: 32, borderRadius: 7, background: safeColor, border: '1px solid var(--border-subtle)', flexShrink: 0, boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }} />
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="#C9943A"
          maxLength={7}
          style={{
            width: 120, padding: '7px 10px', fontSize: 13, fontFamily: 'monospace',
            borderRadius: 7, border: `1px solid ${isValidHex ? safeColor : 'var(--border-default)'}`,
            background: 'var(--input-bg)', color: 'var(--text-primary)', outline: 'none',
          }}
        />
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Controls buttons, sidebar, badges and focus rings</span>
      </div>

      {isValidHex && (
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 10px' }}>Live Preview</p>
          <div style={{ display: 'flex', gap: 12 }}>
            <ThemePreview color={safeColor} mode="light" />
            <ThemePreview color={safeColor} mode="dark" />
          </div>
          <div style={{ display: 'flex', gap: 3, marginTop: 12, borderRadius: 6, overflow: 'hidden' }}>
            {['50','100','200','300','400','500','600','700','800','900'].map(k => {
              const sc = generateScale(safeColor);
              return <div key={k} style={{ flex: 1, height: 20, background: sc[k] }} title={`${k}: ${sc[k]}`} />;
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
            <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>50</span>
            <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>500</span>
            <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>900</span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Shared field ────────────────────────────────────────────────── */
function Field({ label, value, onChange, type = 'text', placeholder }: {
  label: string; value: string;
  onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', padding: '9px 12px', fontSize: 13,
          borderRadius: 8, border: '1px solid var(--border-subtle)',
          background: 'var(--input-bg)', color: 'var(--text-primary)',
          boxSizing: 'border-box', outline: 'none',
          transition: 'border-color 0.15s',
        }}
        onFocus={e => { e.currentTarget.style.borderColor = 'var(--brand)'; }}
        onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
      />
    </div>
  );
}

/* ── Card section ────────────────────────────────────────────────── */
function CardSection({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: '22px 24px' }}>
      <div style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{title}</h2>
        {description && (
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: '4px 0 0', lineHeight: 1.5 }}>{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}

/* ── Upload zone ────────────────────────────────────────────────── */
function UploadZone({
  label, hint, inputRef, imageUrl, uploading, accept, onClick, onChange,
}: {
  label: string; hint: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  imageUrl: string; uploading: boolean;
  accept: string;
  onClick: () => void;
  onChange: (f: File) => void;
}) {
  return (
    <div>
      <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', margin: '0 0 8px' }}>{label}</p>
      <div
        onClick={onClick}
        style={{
          width: '100%', height: 100,
          border: '2px dashed var(--border-default)',
          borderRadius: 10, display: 'flex', alignItems: 'center',
          justifyContent: 'center', background: 'var(--surface-subtle)',
          overflow: 'hidden', cursor: 'pointer', position: 'relative',
          transition: 'border-color 0.15s',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--brand)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)'; }}
      >
        {imageUrl
          ? <Image src={imageUrl} alt={label} fill style={{ objectFit: 'contain', padding: 8 }} unoptimized />
          : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Click to upload</span>
            </div>
          )}
        {uploading && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 600 }}>
            Uploading…
          </div>
        )}
      </div>
      <input ref={inputRef} type="file" accept={accept} style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) onChange(f); }} />
      <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 5 }}>{hint}</p>
    </div>
  );
}

/* ── Main page ───────────────────────────────────────────────────── */
export default function CompanySettingsPage() {
  const { isTenantAdmin, isPlatformAdmin } = useMyPermissions();
  const isAdmin = isTenantAdmin || isPlatformAdmin;
  const { user: authUser } = useAuth();
  const qc = useQueryClient();

  const { data: branding, isLoading } = useQuery<TenantBrandingData>({
    queryKey: ['tenant-branding'],
    queryFn: tenantApi.myBranding,
    enabled: isAdmin,
  });

  const [form, setForm] = useState<Partial<TenantBrandingData>>({});
  const isDirty = Object.keys(form).length > 0;
  const val = (k: keyof TenantBrandingData) => (form[k] as string) ?? (branding?.[k] as string) ?? '';

  const logoRef  = useRef<HTMLInputElement>(null);
  const bgRef    = useRef<HTMLInputElement>(null);
  const stampRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<string | null>(null);

  const saveMutation = useMutation({
    mutationFn: () => tenantApi.updateBranding(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenant-branding'] });
      qc.invalidateQueries({ queryKey: ['tenant', 'me'] });
      setForm({});
      toast('Company settings saved', 'success');
    },
    onError: () => toast('Failed to save settings', 'error'),
  });

  async function handleAssetUpload(file: File, type: 'logo' | 'login_bg') {
    setUploading(type);
    try {
      const { url } = await tenantApi.uploadTenantAsset(file, type);
      const key = type === 'logo' ? 'logo_url' : 'login_bg_url';
      await tenantApi.updateBranding({ [key]: url });
      qc.invalidateQueries({ queryKey: ['tenant-branding'] });
      qc.invalidateQueries({ queryKey: ['tenant', 'me'] });
      toast(`${type === 'logo' ? 'Logo' : 'Background'} updated`, 'success');
    } catch {
      toast('Upload failed', 'error');
    } finally {
      setUploading(null);
    }
  }

  async function handleStampUpload(file: File) {
    setUploading('stamp');
    try {
      const fd = new FormData();
      fd.append('stamp', file);
      await apiClient.patch('/auth/me/', fd);
      qc.invalidateQueries({ queryKey: ['auth-me'] });
      toast('Stamp uploaded', 'success');
    } catch {
      toast('Stamp upload failed', 'error');
    } finally {
      setUploading(null);
    }
  }

  const { data: me } = useQuery<User>({
    queryKey: ['auth-me'],
    queryFn: () => apiClient.get<User>('/auth/me/').then(r => r.data),
  });

  const logoUrl = form.logo_url ?? branding?.logo_url ?? '';
  const bgUrl   = form.login_bg_url ?? branding?.login_bg_url ?? '';

  return (
    <MainLayout>
      <PageShell>
        <PageHeader
          title="Company Settings"
          description="Manage your organization's branding, legal details, and default document content."
          breadcrumbs={[
            { label: 'Settings', href: '/settings/permissions' },
            { label: 'Company' },
          ]}
          actions={
            isDirty ? (
              <>
                <Button variant="secondary" size="sm" onClick={() => setForm({})}>
                  Discard
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  isLoading={saveMutation.isPending}
                  onClick={() => saveMutation.mutate()}
                >
                  Save Changes
                </Button>
              </>
            ) : undefined
          }
        />

        {isLoading ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div style={{ height: 320, background: 'var(--surface-subtle)', borderRadius: 12 }} className="animate-pulse" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ height: 180, background: 'var(--surface-subtle)', borderRadius: 12 }} className="animate-pulse" />
              <div style={{ height: 120, background: 'var(--surface-subtle)', borderRadius: 12 }} className="animate-pulse" />
            </div>
          </div>
        ) : !isAdmin ? (
          <div className="card" style={{ padding: 40, textAlign: 'center' }}>
            <p style={{ color: 'var(--text-tertiary)', fontSize: 14, margin: 0 }}>
              Only tenant admins can manage company settings.
            </p>
          </div>
        ) : (
          <>
            {/* ── 2-column grid ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, alignItems: 'start' }}>

              {/* Left col — Branding */}
              <CardSection
                title="Branding"
                description="Logo, login background, and brand color."
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 18 }}>
                  <UploadZone
                    label="Company Logo"
                    hint="PNG or SVG · shown on all printed documents"
                    inputRef={logoRef}
                    imageUrl={logoUrl}
                    uploading={uploading === 'logo'}
                    accept="image/*"
                    onClick={() => logoRef.current?.click()}
                    onChange={f => handleAssetUpload(f, 'logo')}
                  />
                  <UploadZone
                    label="Login Background"
                    hint="Displayed on the sign-in page"
                    inputRef={bgRef}
                    imageUrl={bgUrl}
                    uploading={uploading === 'login_bg'}
                    accept="image/*"
                    onClick={() => bgRef.current?.click()}
                    onChange={f => handleAssetUpload(f, 'login_bg')}
                  />
                </div>
                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 16 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', margin: '0 0 12px' }}>Brand Color</p>
                  <BrandColorPicker
                    value={val('primary_color') || '#C9943A'}
                    onChange={v => {
                      setForm(f => ({ ...f, primary_color: v }));
                      if (/^#[0-9A-Fa-f]{6}$/.test(v)) applyTenantTheme(v);
                    }}
                  />
                </div>
              </CardSection>

              {/* Right col — Legal + Terms + Stamp */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <CardSection
                  title="Legal Information"
                  description="Appears on printed documents and official correspondence."
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <Field
                      label="Company Legal Name"
                      value={val('company_legal_name')}
                      onChange={v => setForm(f => ({ ...f, company_legal_name: v }))}
                      placeholder="Your Company Legal Name"
                    />
                    <Field
                      label="Address"
                      value={val('company_address')}
                      onChange={v => setForm(f => ({ ...f, company_address: v }))}
                      placeholder="Abu Dhabi, United Arab Emirates"
                    />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <Field
                        label="Phone"
                        value={val('company_phone')}
                        onChange={v => setForm(f => ({ ...f, company_phone: v }))}
                        placeholder="+971 XX XXX XXXX"
                      />
                      <Field
                        label="Email"
                        value={val('company_email')}
                        onChange={v => setForm(f => ({ ...f, company_email: v }))}
                        type="email"
                        placeholder="info@company.ae"
                      />
                    </div>
                    <Field
                      label="Tax Registration Number (TRN)"
                      value={val('company_trn')}
                      onChange={v => setForm(f => ({ ...f, company_trn: v }))}
                      placeholder="1XXXXXXXXXXXXX"
                    />
                  </div>
                </CardSection>

                {/* ── Default Terms & Conditions ── */}
                <CardSection
                  title="Default Terms & Conditions"
                  description="Auto-appended on LPO, PQ, and GRN prints."
                >
                  <textarea
                    value={val('default_terms')}
                    onChange={e => setForm(f => ({ ...f, default_terms: e.target.value }))}
                    placeholder={`1- The Company reserves the right to return items partially or completely in the following instances: non-compliance with specifications, failure to meet the delivery date, or in the case of defective materials.\n2- This purchase order is confidential and intended exclusively for use by the specified supplier and our organization.\n3- Please acknowledge the receipt & confirm the delivery dates.\n4- This LPO must be signed and stamped by the authorized signatory.`}
                    rows={7}
                    style={{
                      width: '100%', padding: '10px 12px', fontSize: 13,
                      borderRadius: 8, border: '1px solid var(--border-subtle)',
                      background: 'var(--input-bg)', color: 'var(--text-primary)',
                      boxSizing: 'border-box', resize: 'vertical', lineHeight: 1.6,
                      fontFamily: 'inherit', outline: 'none', transition: 'border-color 0.15s',
                    }}
                    onFocus={e => { e.currentTarget.style.borderColor = 'var(--brand)'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
                  />
                  <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 6 }}>
                    Tip: start each condition with a number e.g. &ldquo;1-&rdquo; for auto-formatting in print.
                  </p>
                </CardSection>

                {/* ── My Signature Stamp ── */}
                <CardSection
                  title="My Signature Stamp"
                  description="Appears on LPO, PQ, GRN where you are Prepared By / Approved By."
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                    <div
                      onClick={() => stampRef.current?.click()}
                      style={{
                        width: 96, height: 96, border: '2px dashed var(--border-default)',
                        borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'var(--surface-subtle)', overflow: 'hidden', cursor: 'pointer',
                        position: 'relative', flexShrink: 0, transition: 'border-color 0.15s',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--brand)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)'; }}
                    >
                      {me?.stamp_url
                        ? <Image src={me.stamp_url} alt="stamp" fill style={{ objectFit: 'contain', padding: 8 }} unoptimized />
                        : <span style={{ fontSize: 10, color: 'var(--text-tertiary)', textAlign: 'center', padding: 6, lineHeight: 1.4 }}>Click to<br />upload</span>}
                      {uploading === 'stamp' && (
                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 600 }}>
                          Uploading…
                        </div>
                      )}
                    </div>
                    <input ref={stampRef} type="file" accept="image/png,image/svg+xml" style={{ display: 'none' }}
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleStampUpload(f); }} />
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px' }}>
                        {me?.stamp_url ? 'Stamp uploaded' : 'No stamp yet'}
                      </p>
                      <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: '0 0 12px', lineHeight: 1.5 }}>
                        PNG or SVG · transparent bg · max 2 MB
                      </p>
                      <Button variant="secondary" size="sm" onClick={() => stampRef.current?.click()}>
                        {me?.stamp_url ? 'Replace Stamp' : 'Upload Stamp'}
                      </Button>
                    </div>
                  </div>
                </CardSection>
              </div>{/* end right col */}
            </div>{/* end 2-col grid */}

            {/* ── Bottom save bar ── */}
            {isDirty && (
              <div style={{
                position: 'sticky', bottom: 16,
                background: 'var(--card-bg)', border: '1px solid var(--card-border)',
                borderRadius: 12, boxShadow: 'var(--card-shadow)',
                padding: '12px 20px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  You have unsaved changes
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button variant="secondary" size="sm" onClick={() => setForm({})}>Discard</Button>
                  <Button
                    variant="primary"
                    size="sm"
                    isLoading={saveMutation.isPending}
                    onClick={() => saveMutation.mutate()}
                  >
                    Save Changes
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </PageShell>
    </MainLayout>
  );
}
