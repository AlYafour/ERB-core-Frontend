'use client';

import { useState, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { usersApi } from '@/lib/api/users';
import MainLayout from '@/components/layout/MainLayout';
import { Button, PageHeader, PageShell } from '@/components/ui';
import { toast } from '@/lib/hooks/use-toast';
import { getApiError } from '@/lib/utils/error';
import { useAuth } from '@/lib/hooks/use-auth';
import { useT } from '@/lib/i18n/useT';

const roleLabels: Record<string, string> = {
  site_engineer: 'Site Engineer',
  procurement_manager: 'Procurement Manager',
  procurement_officer: 'Procurement Officer',
  super_admin: 'Super Admin',
};

export default function ProfilePage() {
  const t = useT();
  const { user: authUser } = useAuth();
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    full_name_ar: '',
    phone: '',
    email: '',
  });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const enterEditMode = (u: any) => {
    if (!u) return;
    setForm({
      first_name: u.first_name || '',
      last_name: u.last_name || '',
      full_name_ar: (u as any).full_name_ar || '',
      phone: u.phone || '',
      email: u.email || '',
    });
    setAvatarFile(null);
    setAvatarPreview(null);
    setEditMode(true);
  };

  const cancelEdit = () => {
    setEditMode(false);
    setAvatarFile(null);
    setAvatarPreview(null);
  };

  const { data: profile, isLoading, refetch } = useQuery({
    queryKey: ['profile'],
    queryFn: () => usersApi.getMe(),
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => usersApi.updateMe(data),
    onSuccess: () => {
      toast('Profile updated successfully!', 'success');
      cancelEdit();
      refetch();
    },
    onError: (error: any) => {
      toast(getApiError(error, 'Failed to update profile'), 'error');
    },
  });

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast('Image must be under 5MB', 'error');
      return;
    }
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  if (isLoading) {
    return (
      <MainLayout>
        <PageShell>
          <div className="card animate-pulse" style={{ height: 80 }} />
          <div className="card animate-pulse" style={{ height: 200 }} />
        </PageShell>
      </MainLayout>
    );
  }

  const user = profile ?? authUser;
  if (!user) return null;

  const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username;

  return (
    <MainLayout>
      <PageShell>
        <PageHeader
          title="My Profile"
          description={user.email}
          breadcrumbs={[{ label: 'My Profile' }]}
          actions={
            <Button variant={editMode ? 'secondary' : 'edit'} onClick={() => editMode ? cancelEdit() : enterEditMode(user)}>
              {editMode ? 'Cancel' : 'Edit Profile'}
            </Button>
          }
        />

        {editMode ? (
          <div className="card">
            <h2 className="section-title">Edit Profile</h2>
            <form onSubmit={(e) => { e.preventDefault(); updateMutation.mutate(avatarFile ? { ...form, avatar: avatarFile } : form); }}>
              {/* Avatar Upload */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 'var(--space-5)' }}>
                <div
                  style={{ width: 80, height: 80, borderRadius: '50%', overflow: 'hidden', border: '2px solid var(--border-subtle)', background: 'var(--surface-inset)', flexShrink: 0, cursor: 'pointer' }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {avatarPreview || (user as any).avatar ? (
                    <img src={avatarPreview || (user as any).avatar} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 700, color: 'var(--text-secondary)' }}>
                      {(fullName[0] || '?').toUpperCase()}
                    </div>
                  )}
                </div>
                <div>
                  <button type="button" className="btn btn-secondary" style={{ fontSize: 13 }} onClick={() => fileInputRef.current?.click()}>
                    Change Photo
                  </button>
                  <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>JPG, PNG — max 5MB</p>
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
              </div>
              <div className="form-grid">
                <div className="form-field">
                  <label className="form-label">First Name</label>
                  <input className="input" value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} />
                </div>
                <div className="form-field">
                  <label className="form-label">Last Name</label>
                  <input className="input" value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} />
                </div>
                <div className="form-field">
                  <label className="form-label">Arabic Full Name</label>
                  <input className="input" dir="rtl" value={form.full_name_ar} onChange={e => setForm(f => ({ ...f, full_name_ar: e.target.value }))} />
                </div>
                <div className="form-field">
                  <label className="form-label">Phone</label>
                  <input className="input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
                <div className="form-field">
                  <label className="form-label">Email</label>
                  <input className="input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
                <Button type="submit" variant="primary" isLoading={updateMutation.isPending}>Save Changes</Button>
                <Button type="button" variant="secondary" onClick={cancelEdit}>Cancel</Button>
              </div>
            </form>
          </div>
        ) : (
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 'var(--space-5)' }}>
              <div style={{ width: 72, height: 72, borderRadius: '50%', overflow: 'hidden', border: '2px solid var(--border-subtle)', background: 'var(--surface-inset)', flexShrink: 0 }}>
                {(user as any).avatar ? (
                  <img src={(user as any).avatar} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 700, color: 'var(--text-secondary)' }}>
                    {(fullName[0] || '?').toUpperCase()}
                  </div>
                )}
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{fullName}</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{roleLabels[user.role] || user.role}</div>
              </div>
            </div>
            <div className="info-grid">
              <div>
                <div className="info-label">Full Name</div>
                <div className="info-value">{fullName}</div>
              </div>
              {(user as any).full_name_ar && (
                <div>
                  <div className="info-label">Arabic Name</div>
                  <div className="info-value" dir="rtl">{(user as any).full_name_ar}</div>
                </div>
              )}
              <div>
                <div className="info-label">Username</div>
                <div className="info-value info-value-mono">{user.username}</div>
              </div>
              <div>
                <div className="info-label">Email</div>
                <div className="info-value">{user.email}</div>
              </div>
              {user.phone && (
                <div>
                  <div className="info-label">Phone</div>
                  <div className="info-value">{user.phone}</div>
                </div>
              )}
              <div>
                <div className="info-label">Role</div>
                <div className="info-value">{roleLabels[user.role] || user.role}</div>
              </div>
              <div>
                <div className="info-label">Status</div>
                <span className={`badge ${user.is_active ? 'badge-success' : 'badge-error'}`}>
                  {user.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              {(user as any).date_joined && (
                <div>
                  <div className="info-label">Member Since</div>
                  <div className="info-value">{new Date((user as any).date_joined).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
                </div>
              )}
            </div>
          </div>
        )}
      </PageShell>
    </MainLayout>
  );
}
