'use client';

import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/store/auth-store';
import { authApi } from '@/lib/api/auth';
import Link from 'next/link';
import Image from 'next/image';
import { TextField, PasswordField, Button } from '@/components/ui';
import DarkModeToggle from '@/components/ui/DarkModeToggle';
import AuthParticles from '@/components/layout/AuthParticles';
import { getApiError } from '@/lib/utils/error';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { setAuth, isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated) window.location.replace('/dashboard');
  }, [isAuthenticated]);

  const [error, setError] = useState('');

  const { mutate: login, isPending: isLoggingIn } = useMutation({
    mutationFn: ({ username, password }: { username: string; password: string }) =>
      authApi.login(username, password),
    onSuccess: (data) => {
      setError('');
      setAuth(data.user, data.tokens.access, data.tokens.refresh);
      window.location.replace('/dashboard');
    },
    onError: (err: unknown) => {
      setError(getApiError(err, 'Invalid username or password'));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login({ username, password });
  };

  return (
    <div className="auth-bg" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>

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
              <Image
                src="/xerb-logo.svg"
                alt="ERB Logo"
                width={64}
                height={64}
                style={{ objectFit: 'contain' }}
                priority
              />
              <div className="auth-logo-glow" style={{ position: 'absolute', inset: 0, borderRadius: 'var(--radius-2xl)' }} />
            </div>
          </div>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 700, margin: '0 0 var(--space-2) 0', color: 'var(--text-primary)' }}>
            AL YAFOUR
          </h1>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0 }}>
            Operations & Procurement System
          </p>
        </div>

        {/* Card */}
        <div className="auth-card" style={{ borderRadius: 'var(--radius-2xl)', padding: 'var(--space-8)' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'var(--weight-semibold)', textAlign: 'center', marginBottom: 'var(--space-6)', marginTop: 0, color: 'var(--text-primary)' }}>
            Sign In
          </h2>

          <form style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }} onSubmit={handleSubmit}>
            {error && (
              <div style={{ borderRadius: 'var(--radius-lg)', padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>
                {error}
              </div>
            )}
            <TextField
              id="username" name="username" type="text" label="Username" required
              placeholder="Enter your username" value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <PasswordField
              id="password" name="password" label="Password" required
              placeholder="Enter your password" value={password}
              onChange={(e) => setPassword(e.target.value)}
              showPassword={showPassword}
              onTogglePassword={() => setShowPassword(!showPassword)}
            />

            <Button
              type="submit" disabled={isLoggingIn} isLoading={isLoggingIn}
              className="auth-btn" style={{ width: '100%', position: 'relative', overflow: 'hidden' }}
            >
              <span style={{ position: 'relative', zIndex: 1 }}>{isLoggingIn ? 'Signing in...' : 'Sign In'}</span>
              {isLoggingIn && <div className="auth-shimmer" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.2), transparent)' }} />}
            </Button>

            <div style={{ textAlign: 'center', paddingTop: 'var(--space-4)' }}>
              <Link
                href="/register"
                style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: 'var(--text-secondary)', textDecoration: 'none' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-primary)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
              >
                Don't have an account?{' '}
                <span style={{ color: 'var(--color-primary)' }}>Sign up</span>
              </Link>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: 'var(--space-8)', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
          © 2025 Al Yafour – All Rights Reserved.
        </div>
      </div>
    </div>
  );
}
