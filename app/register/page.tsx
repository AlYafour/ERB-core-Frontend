'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { authApi } from '@/lib/api/auth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { toast } from '@/lib/hooks/use-toast';
import { TextField, PasswordField, Button } from '@/components/ui';
import DarkModeToggle from '@/components/ui/DarkModeToggle';
import AuthParticles from '@/components/layout/AuthParticles';

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    username: '', email: '', password: '', password2: '',
    first_name: '', last_name: '', phone: '', role: 'employee',
  });
  const [showPassword, setShowPassword]   = useState(false);
  const [showPassword2, setShowPassword2] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState<string[]>([]);
  const router = useRouter();

  const validatePassword = (p: string) => {
    const e: string[] = [];
    if (p.length < 8) e.push('Password must be at least 8 characters long');
    if (/^\d+$/.test(p)) e.push('Password cannot be entirely numeric');
    if (['123456','password','12345678','qwerty','abc123','admin'].includes(p.toLowerCase()))
      e.push('Password is too common');
    if (!/[a-zA-Z]/.test(p)) e.push('Password must contain at least one letter');
    if (!/\d/.test(p))        e.push('Password must contain at least one number');
    return e;
  };

  const { mutate: register, isPending: isRegistering } = useMutation({
    mutationFn: (data: typeof formData) => authApi.register(data),
    onSuccess: () => {
      toast('Registration successful! Your account is pending approval. You will be notified once approved.', 'success');
      router.push('/login');
    },
    onError: (error: any) => {
      if (error?.response?.data?.password) {
        const passwordErrors = error.response.data.password;
        toast(Array.isArray(passwordErrors) ? passwordErrors[0] : String(passwordErrors), 'error');
      } else if (error?.response?.data?.error) {
        toast(error.response.data.error, 'error');
      } else if (error?.response?.data?.message) {
        toast(error.response.data.message, 'error');
      } else {
        const nonFieldErrors = error?.response?.data?.non_field_errors;
        toast(
          nonFieldErrors?.[0] ?? error?.message ?? 'Registration failed. Please check your information and try again.',
          'error'
        );
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password !== formData.password2) { toast('Passwords do not match', 'error'); return; }
    const errs = validatePassword(formData.password);
    if (errs.length) { toast(errs[0], 'error'); setPasswordErrors(errs); return; }
    setPasswordErrors([]);
    register(formData);
  };

  return (
    <div className="auth-bg min-h-screen flex items-center justify-center relative overflow-hidden py-12">

      <AuthParticles />

      {/* Dark Mode Toggle */}
      <div className="absolute top-6 right-6 z-10">
        <DarkModeToggle />
      </div>

      {/* Main Content */}
      <div className="auth-fade-in relative z-10 w-full max-w-md px-6">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="auth-logo-box w-20 h-20 rounded-2xl flex items-center justify-center relative overflow-hidden">
              <Image src="/logo.png" alt="AL YAFOUR Logo" width={64} height={64} className="object-contain" priority />
              <div className="auth-logo-glow absolute inset-0 rounded-2xl" />
            </div>
          </div>
          <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>AL YAFOUR</h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Create New Account</p>
        </div>

        {/* Card */}
        <div className="auth-card rounded-2xl p-8 backdrop-blur-xl border">
          <h2 className="text-2xl font-semibold text-center mb-6" style={{ color: 'var(--text-primary)' }}>Sign Up</h2>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-4">
              <TextField id="username" name="username" type="text" label="Username" required
                placeholder="Choose a username" value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })} />

              <TextField id="email" name="email" type="email" label="Email" required
                placeholder="Enter your email" value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })} />

              <div className="grid grid-cols-2 gap-4">
                <TextField id="first_name" name="first_name" type="text" label="First Name"
                  placeholder="First name" value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })} />
                <TextField id="last_name" name="last_name" type="text" label="Last Name"
                  placeholder="Last name" value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })} />
              </div>

              <TextField id="phone" name="phone" type="tel" label="Phone"
                placeholder="Phone number" value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />

              <div>
                <PasswordField id="password" name="password" label="Password" required
                  placeholder="Min 8 characters" value={formData.password}
                  onChange={(e) => { setFormData({ ...formData, password: e.target.value }); setPasswordErrors(e.target.value ? validatePassword(e.target.value) : []); }}
                  showPassword={showPassword} onTogglePassword={() => setShowPassword(!showPassword)} />
                {passwordErrors.map((err, i) => <p key={i} className="text-xs text-red-500 mt-1">â€¢ {err}</p>)}
                {formData.password && !passwordErrors.length && <p className="text-xs mt-1" style={{ color: 'var(--color-success)' }}>âœ“ Password is valid</p>}
              </div>

              <PasswordField id="password2" name="password2" label="Confirm Password" required
                placeholder="Confirm your password" value={formData.password2}
                onChange={(e) => setFormData({ ...formData, password2: e.target.value })}
                showPassword={showPassword2} onTogglePassword={() => setShowPassword2(!showPassword2)} />
            </div>

            <div className="p-3 rounded-lg text-sm" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}>
              <p className="text-xs mb-1 font-medium" style={{ color: 'var(--text-primary)' }}>â“˜ Account Approval Required</p>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Your account will be reviewed by an administrator.</p>
            </div>

            <Button type="submit" disabled={isRegistering} isLoading={isRegistering} className="auth-btn w-full">
              {isRegistering ? 'Creating Account...' : 'Create Account'}
            </Button>

            <div className="text-center pt-4">
              <Link href="/login" className="text-sm font-medium"
                style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-primary)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; }}>
                Already have an account?{' '}
                <span style={{ color: 'var(--color-primary)' }}>Sign in</span>
              </Link>
            </div>
          </form>
        </div>

        <div className="text-center mt-8 text-xs" style={{ color: 'var(--text-tertiary)' }}>
          Â© 2025 Al Yafour â€” All Rights Reserved.
        </div>
      </div>
    </div>
  );
}
