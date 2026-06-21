'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { authApi } from '@/lib/api/auth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { toast } from '@/lib/hooks/use-toast';
import { TextField, PasswordField, Button } from '@/components/ui';
import { getApiError } from '@/lib/utils/error';
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
    onError: (error: unknown) => {
      toast(getApiError(error, 'Registration failed. Please check your information and try again.'), 'error');
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
    <div className="auth-bg" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden', padding: 'var(--space-12) 0' }}>

      <AuthParticles />

      {/* Dark Mode Toggle */}
      <div style={{ position: 'absolute', top: 'var(--space-6)', right: 'var(--space-6)', zIndex: 10 }}>
        <DarkModeToggle />
      </div>

      {/* Main Content */}
      <div className="auth-fade-in" style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: 448, padding: '0 var(--space-6)' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-8)' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--space-4)' }}>
            <div className="auth-logo-box" style={{ width: 80, height: 80, borderRadius: 'var(--radius-2xl)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
              <Image src="/xerb-logo.svg" alt="XERB Logo" width={64} height={64} style={{ objectFit: 'contain' }} priority />
              <div className="auth-logo-glow" style={{ position: 'absolute', inset: 0, borderRadius: 'var(--radius-2xl)' }} />
            </div>
          </div>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 700, marginBottom: 'var(--space-2)', color: 'var(--text-primary)', margin: '0 0 var(--space-2) 0' }}>XERB</h1>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0 }}>Create New Account</p>
        </div>

        {/* Card */}
        <div className="auth-card" style={{ borderRadius: 'var(--radius-2xl)', padding: 'var(--space-8)' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'var(--weight-semibold)', textAlign: 'center', marginBottom: 'var(--space-6)', color: 'var(--text-primary)', marginTop: 0 }}>Sign Up</h2>

          <form style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }} onSubmit={handleSubmit}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <TextField id="username" name="username" type="text" label="Username" required
                placeholder="Choose a username" value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })} />

              <TextField id="email" name="email" type="email" label="Email" required
                placeholder="Enter your email" value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })} />

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-4)' }}>
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
                {passwordErrors.map((err, i) => <p key={i} style={{ fontSize: 'var(--text-xs)', color: 'var(--color-error)', marginTop: 'var(--space-1)' }}>• {err}</p>)}
                {formData.password && !passwordErrors.length && <p style={{ fontSize: 'var(--text-xs)', marginTop: 'var(--space-1)', color: 'var(--color-success)' }}>✓ Password is valid</p>}
              </div>

              <PasswordField id="password2" name="password2" label="Confirm Password" required
                placeholder="Confirm your password" value={formData.password2}
                onChange={(e) => setFormData({ ...formData, password2: e.target.value })}
                showPassword={showPassword2} onTogglePassword={() => setShowPassword2(!showPassword2)} />
            </div>

            <div style={{ padding: 'var(--space-3)', borderRadius: 'var(--radius-lg)', backgroundColor: 'var(--surface-subtle)', border: '1px solid var(--border-subtle)' }}>
              <p style={{ fontSize: 'var(--text-xs)', marginBottom: 'var(--space-1)', fontWeight: 'var(--weight-medium)', color: 'var(--text-primary)', marginTop: 0 }}>ℹ Account Approval Required</p>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: 0 }}>Your account will be reviewed by an administrator.</p>
            </div>

            <Button type="submit" disabled={isRegistering} isLoading={isRegistering} className="auth-btn" style={{ width: '100%' }}>
              {isRegistering ? 'Creating Account...' : 'Create Account'}
            </Button>

            <div style={{ textAlign: 'center', paddingTop: 'var(--space-4)' }}>
              <Link href="/login"
                style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: 'var(--text-secondary)', textDecoration: 'none' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-primary)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; }}>
                Already have an account?{' '}
                <span style={{ color: 'var(--color-primary)' }}>Sign in</span>
              </Link>
            </div>
          </form>
        </div>

        <div style={{ textAlign: 'center', marginTop: 'var(--space-8)', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
          © 2025 XERB – All Rights Reserved.
        </div>
      </div>
    </div>
  );
}
