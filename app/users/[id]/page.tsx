'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '@/lib/api/users';
import MainLayout from '@/components/layout/MainLayout';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/use-auth';
import { useAuthStore } from '@/lib/store/auth-store';
import SearchableDropdown from '@/components/ui/SearchableDropdown';
import { Button, PasswordField } from '@/components/ui';
import Image from 'next/image';
import { toast } from '@/lib/hooks/use-toast';
import { normalizeImageUrl } from '@/lib/utils/image-url';

const roles = [
  { 
    value: 'site_engineer', 
    label: 'Site Engineer - مهندس الموقع',
    description: 'Create purchase requests, receive materials (GRN), add notes'
  },
  { 
    value: 'procurement_manager', 
    label: 'Procurement Manager - مدير المشتريات',
    description: 'الموافقة على الطلبات، اختيار أفضل سعر، الموافقة على LPO'
  },
  { 
    value: 'procurement_officer', 
    label: 'Procurement Officer - موظف المشتريات',
    description: 'إعداد Quotation Requests، إدخال الأسعار، إنشاء LPO و Invoice'
  },
  { 
    value: 'super_admin', 
    label: 'Super Admin - المدير الرئيسي',
    description: 'جميع الصلاحيات بما فيها الحذف وإدارة النظام'
  },
];

export default function EditUserPage() {
  const router = useRouter();
  const params = useParams();
  const id = Number(params.id);
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const { setAuth } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: user, isLoading } = useQuery({
    queryKey: ['users', id],
    queryFn: () => usersApi.getById(id),
  });

  const [formData, setFormData] = useState({
    username: '',
    email: '',
    first_name: '',
    last_name: '',
    full_name_ar: '',
    phone: '',
    role: 'site_engineer',
    is_active: true,
    password: '',
    password2: '',
  });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showPassword2, setShowPassword2] = useState(false);
  const [changePassword, setChangePassword] = useState(false);

  useEffect(() => {
    if (user) {
      setFormData({
        username: user.username || '',
        email: user.email || '',
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        full_name_ar: user.full_name_ar || '',
        phone: user.phone || '',
        role: user.role || 'site_engineer',
        is_active: user.is_active ?? true,
        password: '',
        password2: '',
      });
    }
  }, [user]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast('Please select an image file', 'error');
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast('Image size must be less than 5MB', 'error');
        return;
      }
      
      setAvatarFile(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const mutation = useMutation({
    mutationFn: (data: any) => usersApi.update(id, data),
    onSuccess: (updatedUser) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      
      // If updating current user, update auth store and query cache
      if (currentUser?.id === id) {
        // Update query cache directly for immediate UI update
        queryClient.setQueryData(['auth', 'me'], updatedUser);
        queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
        
        // Update auth store
        const accessToken = localStorage.getItem('access_token');
        const refreshToken = localStorage.getItem('refresh_token');
        if (accessToken && refreshToken) {
          setAuth(updatedUser, accessToken, refreshToken);
        }
      } else {
        // Just invalidate to refetch if needed
        queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      }
      
      toast('User updated successfully', 'success');
      // Don't redirect immediately - let user see the success message
      setTimeout(() => {
        router.push('/users');
      }, 1000);
    },
    onError: (error: any) => {
      const message = error?.response?.data?.error || error?.message || 'Failed to update user';
      toast(message, 'error');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate password if changing
    if (changePassword) {
      if (!formData.password || formData.password.length < 8) {
        toast('Password must be at least 8 characters long', 'error');
        return;
      }
      if (formData.password !== formData.password2) {
        toast('Passwords do not match', 'error');
        return;
      }
    }
    
    const submitData: any = { ...formData };
    
    // Only include password if changing
    if (!changePassword) {
      delete submitData.password;
      delete submitData.password2;
    } else {
      delete submitData.password2;
    }

    if (avatarFile) submitData.avatar = avatarFile;
    mutation.mutate(submitData);
  };

  if (currentUser?.role !== 'super_admin' && !currentUser?.is_staff) {
    return (
      <MainLayout>
        <div className="space-y-6">
          <div className="card border-destructive bg-destructive/10">
            <p className="text-destructive text-sm">Access Denied. Admin access required.</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (isLoading) {
    return (
      <MainLayout>
        <div className="space-y-6">
          <div className="card text-center py-12">
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <Link href="/users" className="text-sm text-muted-foreground hover:text-foreground mb-2 inline-block">
            ← Back to Users
          </Link>
          <h1 className="text-2xl font-semibold text-foreground">Edit User</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Update user information
          </p>
        </div>

        <form onSubmit={handleSubmit} className="card">
          {/* Avatar Upload Section */}
          <div style={{ marginBottom: 'var(--spacing-6)' }}>
            <label
              style={{
                display: 'block',
                fontSize: 'var(--font-sm)',
                fontWeight: 'var(--font-weight-medium)',
                color: 'var(--text-secondary)',
                marginBottom: 'var(--spacing-2)',
              }}
            >
              Profile Picture
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-4)' }}>
              <div
                style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  overflow: 'hidden',
                  backgroundColor: 'var(--bg-tertiary)',
                  border: '2px solid var(--border-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {avatarPreview || user?.avatar_url || user?.avatar ? (
                  <Image
                    src={avatarPreview || normalizeImageUrl(user?.avatar_url || user?.avatar) || ''}
                    alt={user?.username || 'User'}
                    width={80}
                    height={80}
                    unoptimized
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                    onError={(e) => {
                      // Fallback to default avatar on error
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: 'var(--bg-tertiary)',
                      color: 'var(--text-tertiary)',
                      fontSize: 'var(--font-xl)',
                      fontWeight: 'var(--font-weight-bold)',
                    }}
                  >
                    {(user?.username || formData.username || 'U').charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  style={{ display: 'none' }}
                />
                <Button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="btn btn-secondary"
                  size="sm"
                >
                  {avatarPreview || user?.avatar_url || user?.avatar ? 'Change Photo' : 'Upload Photo'}
                </Button>
                <p
                  style={{
                    fontSize: 'var(--font-xs)',
                    color: 'var(--text-tertiary)',
                    margin: 'var(--spacing-1) 0 0 0',
                  }}
                >
                  JPG, PNG or GIF. Max size 5MB
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Username *
              </label>
              <input
                type="text"
                required
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Email *
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Role *
              </label>
              <SearchableDropdown
                required
                options={roles.map((role) => ({
                  value: role.value,
                  label: role.label,
                }))}
                value={formData.role}
                onChange={(val) => setFormData({ ...formData, role: val as any })}
                placeholder="Select Role"
              />
              {formData.role && (
                <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                  {roles.find(r => r.value === formData.role)?.description}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                First Name
              </label>
              <input
                type="text"
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Last Name
              </label>
              <input
                type="text"
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                الاسم الكامل بالعربي
              </label>
              <input
                type="text"
                dir="rtl"
                placeholder="الاسم الكامل بالعربي"
                value={formData.full_name_ar}
                onChange={(e) => setFormData({ ...formData, full_name_ar: e.target.value })}
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Phone
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full"
              />
            </div>

          </div>

          {/* Superuser/Staff Status Info */}
          {user?.is_superuser && (
            <div className="mt-4 p-4 rounded-lg" style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)' }}>
              <p className="text-sm font-medium text-foreground mb-2">
                ⚠️ Superuser Account
              </p>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                This user has full system access (is_superuser). All permissions are granted automatically. 
                This status can only be changed by system administrators via Django admin or shell.
              </p>
            </div>
          )}
          {user?.is_staff && !user?.is_superuser && (
            <div className="mt-4 p-4 rounded-lg" style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)' }}>
              <p className="text-sm font-medium text-foreground mb-2">
                ℹ️ Staff Member
              </p>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                This user has staff privileges (can access Django admin panel). 
                This status can only be changed by system administrators.
              </p>
            </div>
          )}

          {/* Account Active Toggle */}
          <div className="mt-4 p-4 rounded-lg" style={{
            backgroundColor: formData.is_active ? 'rgba(16,185,129,.06)' : 'rgba(239,68,68,.06)',
            border: `1px solid ${formData.is_active ? 'rgba(16,185,129,.3)' : 'rgba(239,68,68,.3)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
          }}>
            <div>
              <p className="text-sm font-medium" style={{ color: formData.is_active ? '#065f46' : '#991b1b', marginBottom: 2 }}>
                {formData.is_active ? '✅ Account Active' : '🚫 Account Deactivated'}
              </p>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {formData.is_active
                  ? 'User can sign in normally.'
                  : 'User cannot sign in. Activate to restore access.'}
              </p>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: currentUser?.id === id ? 'not-allowed' : 'pointer', flexShrink: 0 }}>
              <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                {formData.is_active ? 'Active' : 'Inactive'}
              </span>
              <div
                onClick={() => {
                  if (currentUser?.id === id) return;
                  setFormData({ ...formData, is_active: !formData.is_active });
                }}
                style={{
                  width: 44, height: 24, borderRadius: 12,
                  background: formData.is_active ? '#10b981' : '#d1d5db',
                  position: 'relative', transition: 'background .2s',
                  cursor: currentUser?.id === id ? 'not-allowed' : 'pointer',
                  opacity: currentUser?.id === id ? 0.5 : 1,
                  flexShrink: 0,
                }}
              >
                <div style={{
                  width: 18, height: 18, borderRadius: '50%', background: '#fff',
                  position: 'absolute', top: 3,
                  left: formData.is_active ? 23 : 3,
                  transition: 'left .2s',
                  boxShadow: '0 1px 3px rgba(0,0,0,.2)',
                }} />
              </div>
            </label>
            {currentUser?.id === id && (
              <p className="text-xs" style={{ color: '#9ca3af', marginTop: 4 }}>
                You cannot deactivate your own account.
              </p>
            )}
          </div>

          {/* Password Change Section */}
          <div className="mt-6 pt-6" style={{ borderTop: '1px solid var(--border-primary)' }}>
            <div className="flex items-center gap-2 mb-4">
              <input
                type="checkbox"
                id="changePassword"
                checked={changePassword}
                onChange={(e) => {
                  setChangePassword(e.target.checked);
                  if (!e.target.checked) {
                    setFormData({ ...formData, password: '', password2: '' });
                  }
                }}
                className="w-4 h-4"
              />
              <label htmlFor="changePassword" className="text-sm font-medium text-foreground cursor-pointer">
                Change Password
              </label>
            </div>
            
            {changePassword && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <PasswordField
                    id="password"
                    name="password"
                    label="New Password *"
                    required={changePassword}
                    placeholder="Enter new password (min 8 characters)"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    showPassword={showPassword}
                    onTogglePassword={() => setShowPassword(!showPassword)}
                  />
                </div>
                <div>
                  <PasswordField
                    id="password2"
                    name="password2"
                    label="Confirm New Password *"
                    required={changePassword}
                    placeholder="Confirm new password"
                    value={formData.password2}
                    onChange={(e) => setFormData({ ...formData, password2: e.target.value })}
                    showPassword={showPassword2}
                    onTogglePassword={() => setShowPassword2(!showPassword2)}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 flex gap-3">
            <button
              type="submit"
              disabled={mutation.isPending}
              className="btn btn-primary"
            >
              {mutation.isPending ? 'Saving...' : 'Save Changes'}
            </button>
            <Link href="/users" className="btn btn-secondary">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </MainLayout>
  );
}
