'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { BRAND, XERB } from '@/lib/config/brand';
import { useMutation } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/store/auth-store';
import { authApi } from '@/lib/api/auth';
import { tenantApi } from '@/lib/api/tenants';
import { TextField, PasswordField, Button } from '@/components/ui';
import AuthParticles from '@/components/layout/AuthParticles';
import DarkModeToggle from '@/components/ui/DarkModeToggle';
import { getApiError } from '@/lib/utils/error';

const LAST_CODE_KEY     = 'last_company_code';
const LAST_VALID_KEY    = 'last_company_validated';
const LAST_NAME_KEY     = 'last_company_name';
const LAST_BRANDING_KEY = 'last_company_branding';

const WINE_ACCENT       = '#7c2d44';
const FALLBACK_BG       = 'linear-gradient(135deg, #0c0a1e 0%, #1a1535 40%, #0f172a 70%, #1e1b4b 100%)';

function ls(key: string): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(key);
}
function lsSet(key: string, value: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, value);
}
function lsClear(...keys: string[]) {
  if (typeof window === 'undefined') return;
  keys.forEach((k) => localStorage.removeItem(k));
}

type TenantPreview = { name: string; plan: string; status: string };
type TenantBranding = { logo_url?: string; login_bg_url?: string; primary_color?: string };

export default function CompanyLoginPage() {
  const [step, setStep]               = useState<1 | 2>(1);
  const [companyCode, setCompanyCode] = useState('');
  const [tenant, setTenant]           = useState<TenantPreview | null>(null);
  const [branding, setBranding]       = useState<TenantBranding | null>(null);
  const [username, setUsername]       = useState('');
  const [password, setPassword]       = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError]             = useState('');
  // True while auto-resolving company (Paths A/B/C/D) — never show step 1 during this time
  const [isInitializing, setIsInitializing] = useState(true);

  const { setAuth } = useAuthStore();
  const router = useRouter();

  // Step 1 — validate company code
  const { mutate: validateCode, isPending: isValidating } = useMutation({
    mutationFn: (code: string) => tenantApi.validateCompanyCode(code),
    onSuccess: (data, code) => {
      const upper = code.toUpperCase();
      lsSet(LAST_CODE_KEY, upper);
      lsSet(LAST_NAME_KEY, data.tenant_name ?? '');
      if (data.branding) lsSet(LAST_BRANDING_KEY, JSON.stringify(data.branding));
      setError('');
      setTenant({ name: data.tenant_name ?? '', plan: data.plan ?? '', status: data.status ?? 'active' });
      if (data.branding) setBranding(data.branding);
      setStep(2);
      setIsInitializing(false);
    },
    onError: (err: unknown) => {
      setError(getApiError(err, 'Company code not found. Please check and try again.'));
      setIsInitializing(false);
    },
  });

  useEffect(() => {
    // Path A: pre-validated payload from landing-page modal
    const raw = sessionStorage.getItem('xerb_prevalidated_tenant');
    if (raw) {
      sessionStorage.removeItem('xerb_prevalidated_tenant');
      try {
        const { code, tenant: t, branding: b } = JSON.parse(raw);
        const upper = (code as string).toUpperCase();
        lsSet(LAST_CODE_KEY, upper);
        lsSet(LAST_NAME_KEY, t.name ?? '');
        if (b) lsSet(LAST_BRANDING_KEY, JSON.stringify(b));
        setCompanyCode(upper);
        setTenant(t);
        if (b) setBranding(b);
        setStep(2);
        setIsInitializing(false);
        return;
      } catch { /* fall through */ }
    }

    // Path B: ?code= query param — validate silently (spinner, never show step 1)
    const urlCode = new URLSearchParams(window.location.search).get('code');
    if (urlCode) {
      const upper = urlCode.toUpperCase();
      setCompanyCode(upper);
      // strip ?code= from URL so back-navigation doesn't re-trigger
      window.history.replaceState({}, '', '/company-login');
      validateCode(upper);
      return; // isInitializing stays true until onSuccess/onError
    }

    // Path C: returning from logout — already validated, skip step 1 entirely
    const savedCode      = ls(LAST_CODE_KEY);
    const savedValidated = ls(LAST_VALID_KEY);
    const savedName      = ls(LAST_NAME_KEY);
    const savedBranding  = ls(LAST_BRANDING_KEY);

    if (savedCode && savedValidated === 'true' && savedName) {
      setCompanyCode(savedCode);
      setTenant({ name: savedName, plan: '', status: 'active' });
      if (savedBranding) {
        try { setBranding(JSON.parse(savedBranding)); } catch { /* ignore */ }
      }
      setStep(2);
      setIsInitializing(false);
      return;
    }

    // Path D: saved code but not yet flagged as validated — re-verify silently
    if (savedCode) {
      setCompanyCode(savedCode);
      validateCode(savedCode);
      return; // isInitializing stays true until onSuccess/onError
    }

    // Path E: completely fresh — show step 1
    setIsInitializing(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Step 2 — credentials
  const { mutate: login, isPending: isLoggingIn } = useMutation({
    mutationFn: () => authApi.login(username, password),
    onSuccess: (data) => {
      setError('');
      setAuth(data.user, data.tokens.access, data.tokens.refresh);
      window.location.replace('/dashboard');
    },
    onError: (err: unknown) => {
      setError(getApiError(err, 'Invalid username or password.'));
    },
  });

  const handleCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyCode.trim()) return;
    validateCode(companyCode.trim());
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login();
  };

  const switchCompany = () => {
    lsClear(LAST_CODE_KEY, LAST_VALID_KEY, LAST_NAME_KEY, LAST_BRANDING_KEY);
    setCompanyCode('');
    setTenant(null);
    setBranding(null);
    setError('');
    setUsername('');
    setPassword('');
    setIsInitializing(false);
    setStep(1);
  };

  // ── Initializing: silent spinner, never flash step 1 ───────────────
  if (isInitializing) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-app)' }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid var(--border-default)', borderTopColor: WINE_ACCENT, animation: 'spin 700ms linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ── STEP 2: Full-screen premium layout ─────────────────────────────
  if (step === 2 && tenant) {
    const accent  = branding?.primary_color || WINE_ACCENT;
    const bgImage = branding?.login_bg_url;
    const logoUrl = branding?.logo_url;
    const canSubmit = !isLoggingIn && !!username.trim() && !!password;

    return (
      <div style={{ minHeight: '100vh', display: 'flex', position: 'relative' }}>

        {/* ── Left panel: background image or gradient (desktop) ──── */}
        <div
          className="hidden lg:block"
          style={{
            width: '50%', flexShrink: 0,
            position: 'relative', overflow: 'hidden',
            background: bgImage ? undefined : FALLBACK_BG,
          }}
        >
          {bgImage && (
            <img
              src={bgImage}
              alt=""
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
            />
          )}
          {/* dark overlay for legibility */}
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.32)' }} />

          {/* Company logo bottom-left — inverted to show on dark bg */}
          {logoUrl && (
            <div style={{ position: 'absolute', bottom: 48, left: 48, zIndex: 2 }}>
              <img
                src={logoUrl}
                alt={tenant.name}
                style={{ height: 44, objectFit: 'contain', filter: 'brightness(0) invert(1)', opacity: 0.85 }}
              />
            </div>
          )}
        </div>

        {/* ── Right panel: login form ──────────────────────────────── */}
        <div
          style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            padding: '48px 28px', minWidth: 0,
            background: 'var(--surface-app)',
            position: 'relative',
          }}
        >
          <div style={{ position: 'absolute', top: 20, right: 20 }}>
            <DarkModeToggle />
          </div>

          <div style={{ width: '100%', maxWidth: 400 }}>

            {/* Company logo — color, no box */}
            {logoUrl ? (
              <div style={{ marginBottom: 28 }}>
                <img src={logoUrl} alt={tenant.name} style={{ height: 52, objectFit: 'contain', display: 'block' }} />
              </div>
            ) : (
              <div style={{ marginBottom: 28 }} />
            )}

            {/* Heading */}
            <h1 style={{ fontSize: '1.875rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 6px', letterSpacing: '-0.03em', lineHeight: 1.2 }}>
              {tenant.name}
            </h1>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '0 0 36px', lineHeight: 1.5 }}>
              Sign in to your account
            </p>

            <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {error && <ErrorBanner message={error} />}

              <TextField
                id="username"
                name="username"
                type="text"
                label="Username"
                required
                autoFocus
                placeholder="Enter your username"
                value={username}
                onChange={(e) => { setUsername(e.target.value); setError(''); }}
              />

              <PasswordField
                id="password"
                name="password"
                label="Password"
                required
                placeholder="Enter your password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                showPassword={showPassword}
                onTogglePassword={() => setShowPassword(!showPassword)}
              />

              <button
                type="submit"
                disabled={!canSubmit}
                style={{
                  width: '100%', padding: '13px 0', borderRadius: 10,
                  background: canSubmit ? accent : 'var(--surface-subtle)',
                  color: canSubmit ? '#fff' : 'var(--text-muted)',
                  fontSize: 15, fontWeight: 700,
                  border: 'none', cursor: canSubmit ? 'pointer' : 'not-allowed',
                  transition: 'background 150ms, opacity 150ms',
                  letterSpacing: '0.01em', marginTop: 4,
                }}
                onMouseEnter={(e) => { if (canSubmit) e.currentTarget.style.opacity = '0.88'; }}
                onMouseLeave={(e) => { if (canSubmit) e.currentTarget.style.opacity = '1'; }}
              >
                {isLoggingIn ? 'Signing in…' : 'Sign In'}
              </button>
            </form>


          </div>
        </div>
      </div>
    );
  }

  // ── STEP 1: Company code entry (centered card, unchanged) ──────────
  return (
    <div
      className="auth-bg"
      style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}
    >
      <AuthParticles />

      <div style={{ position: 'absolute', top: 'var(--space-6)', right: 'var(--space-6)', zIndex: 10 }}>
        <DarkModeToggle />
      </div>

      <div
        className="auth-fade-in"
        style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: 448, padding: '0 var(--space-6)' }}
      >
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-8)' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--space-4)' }}>
            <div style={{ width: 88, height: 88, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Image src={XERB.logo} alt={XERB.name} width={80} height={80} style={{ objectFit: 'contain' }} priority />
            </div>
          </div>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 700, margin: '0 0 var(--space-2) 0', color: 'var(--text-primary)' }}>
            {BRAND.name}
          </h1>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0 }}>
            Enter your company code to continue
          </p>
        </div>

        {/* Step indicator */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-6)' }}>
          {([1, 2] as const).map((s) => (
            <div
              key={s}
              style={{
                height: 6, width: s === 1 ? 28 : 8, borderRadius: 3,
                backgroundColor: 'var(--color-primary)',
                opacity: s === 2 ? 0.3 : 1,
                transition: 'all 0.3s ease',
              }}
            />
          ))}
        </div>

        <div className="auth-card" style={{ borderRadius: 'var(--radius-2xl)', padding: 'var(--space-8)' }}>
          <form onSubmit={handleCodeSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
            {error && <ErrorBanner message={error} />}

            <TextField
              id="company-code"
              name="company_code"
              type="text"
              label="Company Code"
              required
              autoFocus
              placeholder="e.g. AY-001"
              value={companyCode}
              onChange={(e) => { setCompanyCode(e.target.value.toUpperCase()); setError(''); }}
              style={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}
            />

            <Button
              type="submit"
              disabled={isValidating || !companyCode.trim()}
              isLoading={isValidating}
              className="auth-btn"
              style={{ width: '100%', position: 'relative', overflow: 'hidden' }}
            >
              <span style={{ position: 'relative', zIndex: 1 }}>
                {isValidating ? 'Verifying...' : 'Continue →'}
              </span>
            </Button>
          </form>
        </div>

        <div style={{ textAlign: 'center', marginTop: 'var(--space-6)', fontSize: 'var(--text-sm)' }}>
          <a href="/" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>← Back to home</a>
        </div>

        <div style={{ textAlign: 'center', marginTop: 'var(--space-4)', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
          © {BRAND.year} {BRAND.name} – All Rights Reserved.
        </div>
      </div>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      style={{
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-3) var(--space-4)',
        fontSize: 'var(--text-sm)',
        fontWeight: 'var(--weight-medium)',
        backgroundColor: 'rgba(239,68,68,0.1)',
        color: '#ef4444',
        border: '1px solid rgba(239,68,68,0.3)',
      }}
    >
      {message}
    </div>
  );
}
