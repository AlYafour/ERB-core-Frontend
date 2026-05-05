'use client';

import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/store/auth-store';
import { authApi } from '@/lib/api/auth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { TextField, PasswordField, Button } from '@/components/ui';
import DarkModeToggle from '@/components/ui/DarkModeToggle';
import AuthParticles from '@/components/ui/AuthParticles';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { setAuth, isAuthenticated } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated) router.replace('/dashboard');
  }, [isAuthenticated, router]);

  const [error, setError] = useState('');

  const { mutate: login, isPending: isLoggingIn } = useMutation({
    mutationFn: ({ username, password }: { username: string; password: string }) =>
      authApi.login(username, password),
    onSuccess: (data) => {
      setError('');
      setAuth(data.user, data.tokens.access, data.tokens.refresh);
      router.replace('/dashboard');
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error || err?.response?.data?.detail || 'Invalid username or password';
      setError(msg);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login({ username, password });
  };

  return (
    <div className="auth-bg min-h-screen flex items-center justify-center relative overflow-hidden">

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
              <Image
                src="/logo.png"
                alt="AL YAFOUR Logo"
                width={64}
                height={64}
                className="object-contain"
                priority
              />
              <div className="auth-logo-glow absolute inset-0 rounded-2xl" />
            </div>
          </div>
          <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
            AL YAFOUR
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Operations & Procurement System
          </p>
        </div>

        {/* Card */}
        <div className="auth-card rounded-2xl p-8 backdrop-blur-xl border">
          <h2 className="text-2xl font-semibold text-center mb-6" style={{ color: 'var(--text-primary)' }}>
            Sign In
          </h2>

          <form className="space-y-5" onSubmit={handleSubmit}>
            {error && (
              <div className="rounded-lg px-4 py-3 text-sm font-medium" style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>
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
              className="auth-btn w-full relative overflow-hidden"
            >
              <span className="relative z-10">{isLoggingIn ? 'Signing in...' : 'Sign In'}</span>
              {isLoggingIn && <div className="auth-shimmer absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent" />}
            </Button>

            <div className="text-center pt-4">
              <Link
                href="/register"
                className="text-sm font-medium transition-colors"
                style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}
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
        <div className="text-center mt-8 text-xs" style={{ color: 'var(--text-tertiary)' }}>
          © 2025 Al Yafour — All Rights Reserved.
        </div>
      </div>
    </div>
  );
}
