'use client';

import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tenantApi } from '@/lib/api/tenants';
import type { TenantBrandingData } from '@/types/saas';
import { toast } from '@/lib/hooks/use-toast';
import { getApiError } from '@/lib/utils/error';
import { useAuth } from '@/lib/hooks/use-auth';
import { useRouter } from 'next/navigation';

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
          width: '100%', height: 120, borderRadius: 8,
          border: '2px dashed var(--border-subtle)',
          background: url ? 'transparent' : 'var(--surface-subtle)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: uploading ? 'wait' : 'pointer',
          overflow: 'hidden', position: 'relative',
        }}
      >
        {url
          ? <img src={url} alt={label} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
          : <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{uploading ? 'Uploading…' : 'Click to upload'}</span>
        }
        {url && (
          <div style={{
            position: 'absolute', inset: 0, background: 'rgba(0,0,0,0)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.15s',
          }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.4)'; }}
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

export default function CompanySettingsPage() {
  const { user } = useAuth();
  const router   = useRouter();
  const qc       = useQueryClient();

  // Only company admins can access this page
  useEffect(() => {
    if (user && user.role !== 'admin') router.replace('/dashboard');
  }, [user, router]);

  const { data: branding, isLoading } = useQuery({
    queryKey: ['my-branding'],
    queryFn: () => tenantApi.myBranding(),
    enabled: user?.role === 'admin',
  });

  const [form, setForm] = useState<Partial<TenantBrandingData>>({});
  const [logoUploading, setLogoUploading] = useState(false);
  const [bgUploading, setBgUploading]     = useState(false);

  useEffect(() => {
    if (branding) setForm(branding);
  }, [branding]);

  const updateMut = useMutation({
    mutationFn: (data: Partial<TenantBrandingData>) => tenantApi.updateMyBranding(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-branding'] });
      qc.invalidateQueries({ queryKey: ['tenant-branding'] });
      toast.success('Company settings saved');
    },
    onError: (e) => toast.error(getApiError(e)),
  });

  async function handleUpload(file: File, type: 'logo' | 'login_bg') {
    if (type === 'logo') setLogoUploading(true);
    else setBgUploading(true);
    try {
      const res = await tenantApi.myBrandingUpload(file, type);
      const field = type === 'logo' ? 'logo_url' : 'login_bg_url';
      setForm((p) => ({ ...p, [field]: res.url }));
      toast.success(`${type === 'logo' ? 'Logo' : 'Background'} uploaded`);
    } catch (e) {
      toast.error(getApiError(e));
    } finally {
      if (type === 'logo') setLogoUploading(false);
      else setBgUploading(false);
    }
  }

  if (isLoading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14 }}>
        Loading…
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 24px' }}>

      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>
          Company Settings
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
          Manage your company branding — logo, colors, and document details.
        </p>
      </div>

      <div style={{
        background: 'var(--surface-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 12, padding: '28px',
      }}>
        <div style={{
          fontSize: 13, fontWeight: 700, color: 'var(--text-primary)',
          textTransform: 'uppercase', letterSpacing: '0.06em',
          marginBottom: 20, paddingBottom: 12,
          borderBottom: '1px solid var(--border-subtle)',
        }}>
          Branding
        </div>

        {/* Logo + Background */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
          <ImageUploader
            label="Company Logo"
            url={form.logo_url ?? ''}
            onUpload={(f) => handleUpload(f, 'logo')}
            uploading={logoUploading}
          />
          <ImageUploader
            label="Login Background"
            url={form.login_bg_url ?? ''}
            onUpload={(f) => handleUpload(f, 'login_bg')}
            uploading={bgUploading}
          />
        </div>

        {/* Color + Legal Name + TRN */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            <span style={lbl}>Primary Color</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="color"
                value={form.primary_color ?? '#3B82F6'}
                onChange={(e) => setForm((p) => ({ ...p, primary_color: e.target.value }))}
                style={{ width: 40, height: 36, padding: 2, borderRadius: 6, border: '1px solid var(--border-subtle)', cursor: 'pointer', background: 'var(--surface-input)' }}
              />
              <input
                type="text"
                value={form.primary_color ?? ''}
                onChange={(e) => setForm((p) => ({ ...p, primary_color: e.target.value }))}
                placeholder="#3B82F6"
                style={{ ...inp, flex: 1 }}
              />
            </div>
          </div>
          <div>
            <span style={lbl}>Legal Name</span>
            <input
              type="text"
              value={form.company_legal_name ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, company_legal_name: e.target.value }))}
              style={inp}
              placeholder="Full legal company name"
            />
          </div>
          <div>
            <span style={lbl}>TRN</span>
            <input
              type="text"
              value={form.company_trn ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, company_trn: e.target.value }))}
              style={inp}
              placeholder="Tax Registration Number"
            />
          </div>
        </div>

        {/* Phone + Email */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            <span style={lbl}>Phone</span>
            <input
              type="text"
              value={form.company_phone ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, company_phone: e.target.value }))}
              style={inp}
              placeholder="+971 XX XXX XXXX"
            />
          </div>
          <div>
            <span style={lbl}>Email</span>
            <input
              type="email"
              value={form.company_email ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, company_email: e.target.value }))}
              style={inp}
              placeholder="info@company.com"
            />
          </div>
        </div>

        {/* Address */}
        <div style={{ marginBottom: 24 }}>
          <span style={lbl}>Address</span>
          <textarea
            value={form.company_address ?? ''}
            onChange={(e) => setForm((p) => ({ ...p, company_address: e.target.value }))}
            rows={2}
            style={{ ...inp, resize: 'vertical' }}
            placeholder="Company physical address"
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={() => updateMut.mutate(form)}
            disabled={updateMut.isPending}
            style={{
              padding: '10px 28px', borderRadius: 8, border: 'none',
              background: 'var(--color-primary)', color: '#fff',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              opacity: updateMut.isPending ? 0.6 : 1,
            }}
          >
            {updateMut.isPending ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>

    </div>
  );
}
