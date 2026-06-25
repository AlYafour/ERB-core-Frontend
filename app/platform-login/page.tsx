'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/store/auth-store';
import { authApi } from '@/lib/api/auth';
import { BRAND, XERB } from '@/lib/config/brand';
import Link from 'next/link';
import Image from 'next/image';
import { TextField, PasswordField } from '@/components/ui';
import DarkModeToggle from '@/components/ui/DarkModeToggle';
import { getApiError } from '@/lib/utils/error';

const C = XERB.colors;

export default function PlatformLoginPage() {
  const router = useRouter();
  const [username, setUsername]       = useState('');
  const [password, setPassword]       = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError]             = useState('');
  const { setAuth, isAuthenticated, isPlatformAdmin } = useAuthStore();

  // Only redirect a confirmed platform-admin session.
  // A stale non-admin Zustand state must NOT redirect away from this page.
  useEffect(() => {
    if (isAuthenticated && isPlatformAdmin) {
      router.replace('/super-admin');
    }
  }, [isAuthenticated, isPlatformAdmin, router]);

  const { mutate: login, isPending: isLoggingIn } = useMutation({
    mutationFn: ({ username, password }: { username: string; password: string }) =>
      authApi.login(username, password),
    onSuccess: (data) => {
      setError('');
      const claims = JSON.parse(
        atob(data.tokens.access.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))
      );
      if (!claims.is_platform_admin) {
        setError('Access denied — this portal is for XERB platform administrators only. Company users should use Company Login.');
        return;
      }
      setAuth(data.user, data.tokens.access, data.tokens.refresh);
      router.replace('/super-admin');
    },
    onError: (err: unknown) => {
      setError(getApiError(err, 'Invalid username or password.'));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login({ username, password });
  };

  const canSubmit = !isLoggingIn && username.trim() && password;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', backgroundColor: 'var(--surface-app)' }}>

      {/* ── Left panel — XERB brand (desktop only) ──────────────────── */}
      <div
        className="hidden lg:flex"
        style={{
          width: 480, flexShrink: 0,
          background: `linear-gradient(150deg, ${C.darkBg} 0%, ${C.darkSurface} 52%, ${C.darkDeep} 100%)`,
          flexDirection: 'column', justifyContent: 'space-between',
          padding: '48px 44px',
          position: 'relative', overflow: 'hidden',
        }}
      >
        {/* Decorative blobs */}
        <div style={{ position: 'absolute', top: -80, right: -80, width: 280, height: 280, borderRadius: '50%', background: `${C.accent}1a`, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: 60, left: -100, width: 340, height: 340, borderRadius: '50%', background: `${C.primary}0f`, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -30, right: 60, width: 160, height: 160, borderRadius: '50%', background: `${C.accentLight}18`, pointerEvents: 'none' }} />

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, position: 'relative', zIndex: 1 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(99,102,241,0.3)', border: `1px solid rgba(129,140,248,0.4)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Image src={XERB.logo} alt={XERB.name} width={26} height={26} />
          </div>
          <span style={{ fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>{XERB.name}</span>
        </div>

        {/* Middle copy */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 99, background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.35)', marginBottom: 24 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: C.accentLight, flexShrink: 0 }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: C.accentPale, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Platform Administration</span>
          </div>
          <h2 style={{ fontSize: 'clamp(1.6rem, 2.5vw, 2.25rem)', fontWeight: 800, color: '#fff', lineHeight: 1.2, letterSpacing: '-0.03em', margin: '0 0 16px' }}>
            Manage the{' '}
            <span style={{ color: C.accentLight }}>XERB platform</span>
            {' '}from one place.
          </h2>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', lineHeight: 1.7, margin: 0, maxWidth: 320 }}>
            Companies, plans, modules, audit logs, and platform-wide settings — all in the super-admin dashboard.
          </p>
        </div>

        {/* Bottom */}
        <div style={{ position: 'relative', zIndex: 1, fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>
          © {BRAND.year} {XERB.name} · Platform Administration
        </div>
      </div>

      {/* ── Right panel — login form ─────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', position: 'relative', minWidth: 0 }}>

        <div style={{ position: 'absolute', top: 20, right: 20 }}>
          <DarkModeToggle />
        </div>

        <div style={{ width: '100%', maxWidth: 380 }}>

          {/* Mobile logo */}
          <div className="lg:hidden" style={{ textAlign: 'center', marginBottom: 36 }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, background: C.primary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Image src={XERB.logo} alt={XERB.name} width={32} height={32} />
              </div>
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>{XERB.name}</div>
          </div>

          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px' }}>
            Platform Admin Login
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '0 0 28px', lineHeight: 1.5 }}>
            Restricted to {XERB.name} platform administrators.
          </p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {error && (
              <div style={{ borderRadius: 8, padding: '10px 14px', fontSize: 13, fontWeight: 500, backgroundColor: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)', lineHeight: 1.5 }}>
                {error}
              </div>
            )}

            <TextField
              id="username" name="username" type="text" label="Email or Username" required
              placeholder="admin@admin.com" value={username}
              onChange={(e) => { setUsername(e.target.value); setError(''); }}
            />
            <PasswordField
              id="password" name="password" label="Password" required
              placeholder="Password" value={password}
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              showPassword={showPassword}
              onTogglePassword={() => setShowPassword(!showPassword)}
            />

            <button
              type="submit"
              disabled={!canSubmit}
              style={{
                width: '100%', padding: '11px 0', borderRadius: 9,
                background: C.primary, color: '#fff',
                fontSize: 14, fontWeight: 600,
                border: 'none', cursor: canSubmit ? 'pointer' : 'not-allowed',
                opacity: canSubmit ? 1 : 0.55,
                transition: 'background 150ms, opacity 150ms',
                letterSpacing: '0.01em',
              }}
              onMouseEnter={(e) => { if (canSubmit) e.currentTarget.style.background = C.primaryHover; }}
              onMouseLeave={(e) => { if (canSubmit) e.currentTarget.style.background = C.primary; }}
            >
              {isLoggingIn ? 'Signing in…' : 'Sign In to Platform'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: 24, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
            <Link
              href="/company-login"
              style={{ fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'none' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = C.primary; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
            >
              Company user? Use Company Login →
            </Link>
            <Link
              href="/"
              style={{ fontSize: 12, color: 'var(--text-tertiary)', textDecoration: 'none' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-tertiary)'; }}
            >
              ← Back to home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
