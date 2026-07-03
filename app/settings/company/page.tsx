'use client';

import { useState, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import MainLayout from '@/components/layout/MainLayout';
import { tenantApi } from '@/lib/api/tenants';
import { useMyPermissions } from '@/lib/hooks/use-my-permissions';
import { useAuth } from '@/lib/hooks/use-auth';
import { toast } from '@/lib/hooks/use-toast';
import type { TenantBrandingData } from '@/types/saas';
import type { User } from '@/types';
import Link from 'next/link';
import Image from 'next/image';
import { generateScale, hexToRgba, applyTenantTheme } from '@/lib/utils/tenant-theme';

/* ── color presets ────────────────────────────────────────────────── */
const PRESETS = [
  { hex: '#C9943A', name: 'Gold' },
  { hex: '#1B4F72', name: 'Navy' },
  { hex: '#1A6B3C', name: 'Forest' },
  { hex: '#7B2D8B', name: 'Purple' },
  { hex: '#C0392B', name: 'Crimson' },
  { hex: '#2E86AB', name: 'Steel' },
  { hex: '#B7410E', name: 'Rust' },
  { hex: '#2C3E50', name: 'Slate' },
];

function ThemePreview({ color, mode }: { color: string; mode: 'light' | 'dark' }) {
  const sc = generateScale(color);
  const isDark = mode === 'dark';
  const bg      = isDark ? '#0F1D30' : '#F7F4F0';
  const surf    = isDark ? '#1A2235' : '#FFFFFF';
  const border  = isDark ? '#1E2D45' : '#E2DBD6';
  const textPri = isDark ? '#F1F5F9' : '#1C1414';
  const textSec = isDark ? '#94A3B8' : '#6D5F5C';
  const active  = isDark ? sc['400'] : sc['500'];
  const btnBg   = active;
  const sideAct = hexToRgba(color, 0.12);

  return (
    <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 10, padding: 14, flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: textSec, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
        {mode === 'dark' ? '🌙 Dark' : '☀️ Light'}
      </div>
      {/* sidebar active item */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: sideAct, borderRadius: 7, padding: '6px 10px', borderLeft: `3px solid ${active}`, marginBottom: 8 }}>
        <div style={{ width: 12, height: 12, borderRadius: 3, background: active, opacity: 0.8 }} />
        <span style={{ fontSize: 11, fontWeight: 600, color: active }}>Dashboard</span>
      </div>
      {/* primary button */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        <div style={{ background: btnBg, color: '#fff', borderRadius: 6, padding: '5px 12px', fontSize: 11, fontWeight: 600 }}>Save</div>
        <div style={{ background: surf, color: textSec, borderRadius: 6, padding: '5px 12px', fontSize: 11, border: `1px solid ${border}` }}>Cancel</div>
      </div>
      {/* badge */}
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: hexToRgba(color, 0.10), border: `1px solid ${hexToRgba(color, 0.25)}`, borderRadius: 20, padding: '2px 10px' }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: active }} />
        <span style={{ fontSize: 10, fontWeight: 600, color: active }}>Active</span>
      </div>
      {/* input focus */}
      <div style={{ marginTop: 8, border: `1.5px solid ${active}`, borderRadius: 6, padding: '5px 10px', background: surf, boxShadow: `0 0 0 3px ${hexToRgba(color, 0.14)}` }}>
        <span style={{ fontSize: 10, color: textPri }}>Input focused</span>
      </div>
    </div>
  );
}

function BrandColorPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const isValidHex = /^#[0-9A-Fa-f]{6}$/.test(value);
  const safeColor = isValidHex ? value : '#C9943A';

  return (
    <div>
      {/* Preset swatches */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        {PRESETS.map(p => (
          <button
            key={p.hex}
            title={p.name}
            onClick={() => onChange(p.hex)}
            style={{
              width: 36, height: 36, borderRadius: 8, background: p.hex, cursor: 'pointer',
              border: value.toLowerCase() === p.hex.toLowerCase() ? `3px solid ${p.hex}` : '3px solid transparent',
              outline: value.toLowerCase() === p.hex.toLowerCase() ? '2px solid var(--text-primary)' : 'none',
              outlineOffset: 1,
              boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
              transition: 'transform 0.1s',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.12)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
          />
        ))}
        {/* Custom color picker */}
        <label title="Custom color" style={{ width: 36, height: 36, borderRadius: 8, border: '2px dashed var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: 'var(--surface-subtle)', position: 'relative', overflow: 'hidden' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
          <input type="color" value={safeColor} onChange={e => onChange(e.target.value)}
            style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }} />
        </label>
      </div>

      {/* Hex input */}
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
            background: 'var(--input-bg)', color: 'var(--text-primary)',
            outline: 'none',
          }}
        />
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Controls buttons, sidebar, badges, and focus rings</span>
      </div>

      {/* Live preview — light + dark */}
      {isValidHex && (
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 10px' }}>Live Preview</p>
          <div style={{ display: 'flex', gap: 12 }}>
            <ThemePreview color={safeColor} mode="light" />
            <ThemePreview color={safeColor} mode="dark" />
          </div>
          {/* Color scale strip */}
          <div style={{ display: 'flex', gap: 3, marginTop: 12, borderRadius: 6, overflow: 'hidden' }}>
            {['50','100','200','300','400','500','600','700','800','900'].map(k => {
              const sc = generateScale(safeColor);
              return (
                <div key={k} style={{ flex: 1, height: 20, background: sc[k] }} title={`${k}: ${sc[k]}`} />
              );
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

/* ── helpers ──────────────────────────────────────────────────────── */
function Field({ label, name, value, onChange, type = 'text', placeholder }: {
  label: string; name: string; value: string;
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
        style={{ width: '100%', padding: '9px 12px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--input-bg)', color: 'var(--text-primary)', boxSizing: 'border-box' }}
      />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '22px 24px', marginBottom: 20 }}>
      <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 18px' }}>{title}</h2>
      {children}
    </div>
  );
}

/* ── main ─────────────────────────────────────────────────────────── */
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

  const logoRef     = useRef<HTMLInputElement>(null);
  const bgRef       = useRef<HTMLInputElement>(null);
  const stampRef    = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<string | null>(null);

  /* save branding fields */
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

  /* upload logo or bg */
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

  /* upload user stamp */
  async function handleStampUpload(file: File) {
    setUploading('stamp');
    try {
      const fd = new FormData();
      fd.append('stamp', file);
      const res = await fetch('/api/auth/me/', { method: 'PATCH', body: fd, credentials: 'include' });
      if (!res.ok) throw new Error();
      qc.invalidateQueries({ queryKey: ['auth-me'] });
      toast('Stamp uploaded', 'success');
    } catch {
      toast('Stamp upload failed', 'error');
    } finally {
      setUploading(null);
    }
  }

  /* fetch current user for stamp preview */
  const { data: me } = useQuery<User>({
    queryKey: ['auth-me'],
    queryFn: () => fetch('/api/auth/me/', { credentials: 'include' }).then(r => r.json()),
  });

  const logoUrl = form.logo_url ?? branding?.logo_url ?? '';
  const bgUrl   = form.login_bg_url ?? branding?.login_bg_url ?? '';

  return (
    <MainLayout>
      <div style={{ maxWidth: 720, margin: '32px auto', padding: '0 24px' }}>
        {/* breadcrumb */}
        <div style={{ marginBottom: 20 }}>
          <Link href="/settings/permissions" style={{ fontSize: 13, color: 'var(--text-tertiary)', textDecoration: 'none' }}>
            ← Settings
          </Link>
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 24px' }}>Company Settings</h1>

        {isLoading ? (
          <div style={{ height: 200, background: 'var(--surface-subtle)', borderRadius: 12, animation: 'pulse 1.5s infinite' }} />
        ) : !isAdmin ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)', fontSize: 14 }}>
            Only tenant admins can manage company settings.
          </div>
        ) : (
          <>
            {/* ── Branding assets ── */}
            <Section title="Branding Assets">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                {/* Logo */}
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', margin: '0 0 8px' }}>Company Logo</p>
                  <div style={{ width: '100%', height: 100, border: '2px dashed var(--border-subtle)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-subtle)', overflow: 'hidden', cursor: 'pointer', position: 'relative' }}
                    onClick={() => logoRef.current?.click()}>
                    {logoUrl
                      ? <Image src={logoUrl} alt="logo" fill style={{ objectFit: 'contain', padding: 8 }} unoptimized />
                      : <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Click to upload logo</span>}
                    {uploading === 'logo' && <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12 }}>Uploading…</div>}
                  </div>
                  <input ref={logoRef} type="file" accept="image/*" style={{ display: 'none' }}
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleAssetUpload(f, 'logo'); }} />
                  <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 5 }}>PNG / SVG recommended. Shows on all printed documents.</p>
                </div>

                {/* Login background */}
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', margin: '0 0 8px' }}>Login Background</p>
                  <div style={{ width: '100%', height: 100, border: '2px dashed var(--border-subtle)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-subtle)', overflow: 'hidden', cursor: 'pointer', position: 'relative' }}
                    onClick={() => bgRef.current?.click()}>
                    {bgUrl
                      ? <Image src={bgUrl} alt="bg" fill style={{ objectFit: 'cover' }} unoptimized />
                      : <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Click to upload background</span>}
                    {uploading === 'login_bg' && <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12 }}>Uploading…</div>}
                  </div>
                  <input ref={bgRef} type="file" accept="image/*" style={{ display: 'none' }}
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleAssetUpload(f, 'login_bg'); }} />
                  <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 5 }}>Shown on the login page.</p>
                </div>
              </div>

              {/* Primary color */}
              <div style={{ marginTop: 18 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', margin: '0 0 6px' }}>Brand Color</p>
                <BrandColorPicker
                  value={val('primary_color') || '#C9943A'}
                  onChange={v => {
                    setForm(f => ({ ...f, primary_color: v }));
                    if (/^#[0-9A-Fa-f]{6}$/.test(v)) applyTenantTheme(v);
                  }}
                />
              </div>
            </Section>

            {/* ── Legal info ── */}
            <Section title="Legal Information">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <Field label="Company Legal Name" name="company_legal_name" value={val('company_legal_name')}
                  onChange={v => setForm(f => ({ ...f, company_legal_name: v }))}
                  placeholder="Your Company Legal Name" />
                <Field label="Address" name="company_address" value={val('company_address')}
                  onChange={v => setForm(f => ({ ...f, company_address: v }))}
                  placeholder="Abu Dhabi, United Arab Emirates" />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <Field label="Phone" name="company_phone" value={val('company_phone')}
                    onChange={v => setForm(f => ({ ...f, company_phone: v }))} placeholder="+971 XX XXX XXXX" />
                  <Field label="Email" name="company_email" value={val('company_email')}
                    onChange={v => setForm(f => ({ ...f, company_email: v }))} type="email" placeholder="info@company.ae" />
                </div>
                <Field label="Tax Registration Number (TRN)" name="company_trn" value={val('company_trn')}
                  onChange={v => setForm(f => ({ ...f, company_trn: v }))} placeholder="1XXXXXXXXXXXXX" />
              </div>

              {isDirty && (
                <div style={{ marginTop: 18, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button onClick={() => setForm({})} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--card-bg)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13 }}>
                    Discard
                  </button>
                  <button
                    onClick={() => saveMutation.mutate()}
                    disabled={saveMutation.isPending}
                    style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: 'var(--brand)', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, opacity: saveMutation.isPending ? 0.7 : 1 }}>
                    {saveMutation.isPending ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              )}
            </Section>

            {/* ── Default Terms & Conditions ── */}
            <Section title="Default Terms & Conditions">
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 14px' }}>
                These terms appear automatically on all printed documents (LPO, PQ, GRN). Write each condition on a new line or number them manually.
              </p>
              <textarea
                value={val('default_terms')}
                onChange={e => setForm(f => ({ ...f, default_terms: e.target.value }))}
                placeholder={`1- The Company reserves the right to return items partially or completely in the following instances: non-compliance with specifications, failure to meet the delivery date, or in the case of defective materials.\n2- This purchase order is confidential and intended exclusively for use by the specified supplier and our organization.\n3- Please acknowledge the receipt & confirm the delivery dates.\n4- This LPO must be signed and stamped by the authorized signatory.`}
                rows={8}
                style={{
                  width: '100%', padding: '10px 12px', fontSize: 13,
                  borderRadius: 8, border: '1px solid var(--border-subtle)',
                  background: 'var(--input-bg)', color: 'var(--text-primary)',
                  boxSizing: 'border-box', resize: 'vertical', lineHeight: 1.6,
                  fontFamily: 'inherit',
                }}
              />
              <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 6 }}>
                Tip: start each condition with a number e.g. {'"'}1-{'"'} for auto-formatting in print.
              </p>
              {isDirty && (
                <div style={{ marginTop: 14, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button onClick={() => setForm({})} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--card-bg)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13 }}>
                    Discard
                  </button>
                  <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}
                    style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: 'var(--brand)', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, opacity: saveMutation.isPending ? 0.7 : 1 }}>
                    {saveMutation.isPending ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              )}
            </Section>

            {/* ── My Stamp ── */}
            <Section title="My Signature Stamp">
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 16px' }}>
                Your stamp appears on printed documents (LPO, PQ, GRN) where you are listed as Prepared By / Approved By.
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                <div style={{ width: 120, height: 120, border: '2px dashed var(--border-subtle)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-subtle)', overflow: 'hidden', cursor: 'pointer', position: 'relative', flexShrink: 0 }}
                  onClick={() => stampRef.current?.click()}>
                  {me?.stamp_url
                    ? <Image src={me.stamp_url} alt="stamp" fill style={{ objectFit: 'contain', padding: 8 }} unoptimized />
                    : <span style={{ fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'center', padding: 8 }}>Click to upload stamp</span>}
                  {uploading === 'stamp' && <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12 }}>Uploading…</div>}
                </div>
                <input ref={stampRef} type="file" accept="image/png,image/svg+xml" style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleStampUpload(f); }} />
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 6px' }}>Upload your stamp</p>
                  <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: '0 0 12px' }}>PNG or SVG, transparent background preferred. Max 2MB.</p>
                  <button onClick={() => stampRef.current?.click()} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--card-bg)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12 }}>
                    {me?.stamp_url ? 'Replace Stamp' : 'Upload Stamp'}
                  </button>
                </div>
              </div>
            </Section>
          </>
        )}
      </div>
    </MainLayout>
  );
}
