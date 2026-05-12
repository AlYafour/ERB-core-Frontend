'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { usersApi } from '@/lib/api/users';
import MainLayout from '@/components/layout/MainLayout';
import { Button, PageHeader, PageShell } from '@/components/ui';
import { toast } from '@/lib/hooks/use-toast';
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

  const { data: profile, isLoading, refetch } = useQuery({
    queryKey: ['profile'],
    queryFn: () => usersApi.getMe(),
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => usersApi.updateMe(data),
    onSuccess: () => {
      toast('Profile updated successfully!', 'success');
      setEditMode(false);
      refetch();
    },
    onError: (error: any) => {
      toast(error?.response?.data?.detail || 'Failed to update profile', 'error');
    },
  });

  if (isLoading) {
    return (
      <MainLayout>
        <div className="card text-center py-12">
          <p className="text-muted-foreground">Loading...</p>
        </div>
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
            <Button variant={editMode ? 'secondary' : 'edit'} onClick={() => setEditMode(e => !e)}>
              {editMode ? 'Cancel' : 'Edit Profile'}
            </Button>
          }
        />

        {editMode ? (
          <div className="card">
            <h2 className="section-title">Edit Profile</h2>
            <form onSubmit={(e) => { e.preventDefault(); updateMutation.mutate(form); }}>
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
              <div className="flex gap-3 mt-4">
                <Button type="submit" variant="primary" isLoading={updateMutation.isPending}>Save Changes</Button>
                <Button type="button" variant="secondary" onClick={() => setEditMode(false)}>Cancel</Button>
              </div>
            </form>
          </div>
        ) : (
          <div className="card">
            <h2 className="section-title">Profile Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <p className="text-sm text-muted-foreground">Full Name</p>
                <p className="font-medium">{fullName}</p>
              </div>
              {(user as any).full_name_ar && (
                <div>
                  <p className="text-sm text-muted-foreground">Arabic Name</p>
                  <p className="font-medium" dir="rtl">{(user as any).full_name_ar}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-muted-foreground">Username</p>
                <p className="font-medium">{user.username}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{user.email}</p>
              </div>
              {user.phone && (
                <div>
                  <p className="text-sm text-muted-foreground">Phone</p>
                  <p className="font-medium">{user.phone}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-muted-foreground">Role</p>
                <p className="font-medium">{roleLabels[user.role] || user.role}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <span className={`badge ${user.is_active ? 'badge-success' : 'badge-error'}`}>
                  {user.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              {(user as any).date_joined && (
                <div>
                  <p className="text-sm text-muted-foreground">Member Since</p>
                  <p className="font-medium">{new Date((user as any).date_joined).toLocaleDateString('en-US')}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </PageShell>
    </MainLayout>
  );
}
