'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
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
import {
  prepareAuthenticationOptions,
  serializeAuthenticationCredential,
  isPlatformAuthenticatorAvailable,
} from '@/lib/utils/webauthn';

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
  const [step, setStep]               = useState<1 | 2 | 3>(1);
  const [companyCode, setCompanyCode] = useState('');
  const [tenant, setTenant]           = useState<TenantPreview | null>(null);
  const [branding, setBranding]       = useState<TenantBranding | null>(null);
  const [username, setUsername]       = useState('');
  const [password, setPassword]       = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError]             = useState('');
  const [twoFaCode, setTwoFaCode]     = useState('');
  const [tempToken, setTempToken]     = useState('');
  const [passkeySupported, setPasskeySupported] = useState(false);
  const [isPasskeyLoading, setIsPasskeyLoading] = useState(false);
  // True while auto-resolving company (Paths A/B/C/D) — never show step 1 during this time
  const [isInitializing, setIsInitializing] = useState(true);

  const { setAuth } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    isPlatformAuthenticatorAvailable().then(setPasskeySupported);
  }, []);

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
      return;
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
      return;
    }

    // Path E: completely fresh — show step 1
    setIsInitializing(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Step 2 — credentials login
  const { mutate: login, isPending: isLoggingIn } = useMutation({
    mutationFn: () => authApi.login(username, password),
    onSuccess: (data) => {
      setError('');

      // 2FA required — move to step 3
      if (data.requires_2fa && data.temp_token) {
        setTempToken(data.temp_token);
        setStep(3);
        return;
      }

      if (!data.tokens) return;

      // Reject platform admins
      try {
        const claims = JSON.parse(atob(data.tokens.access.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        if (claims.is_platform_admin) {
          setError('Platform administrators must use the Platform Admin Login, not the Company Login.');
          return;
        }
      } catch { /* ignore decode errors */ }

      setAuth(data.user, data.tokens.access, data.tokens.refresh);
      router.replace('/dashboard');
    },
    onError: (err: unknown) => {
      setError(getApiError(err, 'Invalid username or password.'));
    },
  });

  // Step 3 — 2FA verify
  const { mutate: verify2FA, isPending: isVerifying } = useMutation({
    mutationFn: () => authApi.twofa.verify(tempToken, twoFaCode),
    onSuccess: (data) => {
      setError('');
      setAuth(data.user, data.tokens.access, data.tokens.refresh);
      router.replace('/dashboard');
    },
    onError: (err: unknown) => {
      setError(getApiError(err, 'Invalid or expired code. Please try again.'));
      setTwoFaCode('');
    },
  });

  // WebAuthn passkey login
  const handlePasskeyLogin = async () => {
    if (!username.trim()) {
      setError('Enter your username first, then sign in with passkey.');
      return;
    }
    setIsPasskeyLoading(true);
    setError('');
    try {
      const { options, challenge_token } = await authApi.webauthn.loginBegin(username.trim());
      const browserOptions = prepareAuthenticationOptions(options);
      const credential = await navigator.credentials.get({ publicKey: browserOptions }) as PublicKeyCredential | null;
      if (!credential) {
        setError('Passkey sign-in was cancelled.');
        return;
      }
      const serialized = serializeAuthenticationCredential(credential);
      const data = await authApi.webauthn.loginComplete(serialized, challenge_token);
      setAuth(data.user, data.tokens.access, data.tokens.refresh);
      router.replace('/dashboard');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('NotAllowedError') || msg.includes('cancelled')) {
        setError('Passkey sign-in was cancelled.');
      } else {
        setError(getApiError(err, 'Passkey sign-in failed. Please use your password.'));
      }
    } finally {
      setIsPasskeyLoading(false);
    }
  };

  const handleCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyCode.trim()) return;
    validateCode(companyCode.trim());
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login();
  };

  const handle2FASubmit = (e: React.FormEvent) => {
    e.preventDefault();
    verify2FA();
  };

  const switchCompany = () => {
    lsClear(LAST_CODE_KEY, LAST_VALID_KEY, LAST_NAME_KEY, LAST_BRANDING_KEY);
    setCompanyCode('');
    setTenant(null);
    setBranding(null);
    setError('');
    setUsername('');
    setPassword('');
    setTwoFaCode('');
    setTempToken('');
    setIsInitializing(false);
    setStep(1);
  };

  // ── Initializing: silent spinner ────────────────────────────────────
  if (isInitializing) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-app)' }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid var(--border-default)', borderTopColor: WINE_ACCENT, animation: 'spin 700ms linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ── STEP 2 or 3: Full-screen premium layout ─────────────────────────
  if ((step === 2 || step === 3) && tenant) {
    const accent  = branding?.primary_color || WINE_ACCENT;
    const bgImage = branding?.login_bg_url;
    const logoUrl = branding?.logo_url;

    return (
      <div style={{ minHeight: '100vh', display: 'flex', position: 'relative' }}>

        {/* ── Left panel ──────────────────────────────────────────── */}
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
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.32)' }} />
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

        {/* ── Right panel ─────────────────────────────────────────── */}
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

            {logoUrl ? (
              <div style={{ marginBottom: 28 }}>
                <img src={logoUrl} alt={tenant.name} style={{ height: 52, objectFit: 'contain', display: 'block' }} />
              </div>
            ) : (
              <div style={{ marginBottom: 28 }} />
            )}

            {/* ── STEP 3: 2FA code ──────────────────────────────── */}
            {step === 3 ? (
              <>
                <h1 style={{ fontSize: '1.875rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 6px', letterSpacing: '-0.03em', lineHeight: 1.2 }}>
                  Two-Factor Authentication
                </h1>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '0 0 36px', lineHeight: 1.5 }}>
                  Enter the 6-digit code from your authenticator app
                </p>

                <form onSubmit={handle2FASubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  {error && <ErrorBanner message={error} />}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Verification Code
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      autoFocus
                      placeholder="000 000"
                      value={twoFaCode}
                      onChange={(e) => { setTwoFaCode(e.target.value.replace(/\D/g, '')); setError(''); }}
                      style={{
                        textAlign: 'center',
                        fontSize: 28,
                        fontWeight: 700,
                        letterSpacing: '0.35em',
                        padding: '14px 0',
                        border: '2px solid var(--border-default)',
                        borderRadius: 10,
                        background: 'var(--surface-subtle)',
                        color: 'var(--text-primary)',
                        outline: 'none',
                        fontFamily: 'monospace',
                        width: '100%',
                        transition: 'border-color 150ms',
                      }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = accent; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border-default)'; }}
                    />
                  </div>

                  <SubmitButton
                    accent={accent}
                    disabled={isVerifying || twoFaCode.length < 6}
                    isLoading={isVerifying}
                    label="Verify & Sign In"
                    loadingLabel="Verifying…"
                  />
                </form>

                <button
                  type="button"
                  onClick={() => { setStep(2); setTwoFaCode(''); setTempToken(''); setError(''); }}
                  style={{ marginTop: 20, display: 'block', width: '100%', textAlign: 'center', fontSize: 13, color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  ← Back to sign in
                </button>
              </>
            ) : (
              /* ── STEP 2: Username + password ──────────────────── */
              <>
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

                  <SubmitButton
                    accent={accent}
                    disabled={isLoggingIn || !username.trim() || !password}
                    isLoading={isLoggingIn}
                    label="Sign In"
                    loadingLabel="Signing in…"
                  />
                </form>

                {/* ── Passkey / Biometric button ─────────────────── */}
                {passkeySupported && (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0 0' }}>
                      <div style={{ flex: 1, height: 1, background: 'var(--border-default)' }} />
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>or</span>
                      <div style={{ flex: 1, height: 1, background: 'var(--border-default)' }} />
                    </div>

                    <button
                      type="button"
                      onClick={handlePasskeyLogin}
                      disabled={isPasskeyLoading}
                      style={{
                        marginTop: 14,
                        width: '100%',
                        padding: '12px 0',
                        borderRadius: 10,
                        border: '1.5px solid var(--border-default)',
                        background: 'var(--surface-subtle)',
                        color: 'var(--text-primary)',
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: isPasskeyLoading ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 10,
                        transition: 'background 150ms, border-color 150ms',
                        opacity: isPasskeyLoading ? 0.6 : 1,
                      }}
                      onMouseEnter={(e) => { if (!isPasskeyLoading) e.currentTarget.style.background = 'var(--surface-hover)'; }}
                      onMouseLeave={(e) => { if (!isPasskeyLoading) e.currentTarget.style.background = 'var(--surface-subtle)'; }}
                    >
                      <FingerprintIcon size={18} color={accent} />
                      {isPasskeyLoading ? 'Waiting for biometric…' : 'Sign in with Passkey'}
                    </button>
                  </>
                )}

                <div style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--text-tertiary)' }}>
                  Platform administrator?{' '}
                  <a href="/platform-login" style={{ color: 'var(--text-secondary)', textDecoration: 'underline' }}>
                    Use Platform Login →
                  </a>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── STEP 1: Company code entry ───────────────────────────────────────
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
          <Link href="/" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>← Back to home</Link>
        </div>

        <div style={{ textAlign: 'center', marginTop: 'var(--space-4)', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
          © {BRAND.year} {BRAND.name} – All Rights Reserved.
        </div>
      </div>
    </div>
  );
}

// ── Shared sub-components ────────────────────────────────────────────────────

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

function SubmitButton({ accent, disabled, isLoading, label, loadingLabel }: {
  accent: string; disabled: boolean; isLoading: boolean; label: string; loadingLabel: string;
}) {
  return (
    <button
      type="submit"
      disabled={disabled}
      style={{
        width: '100%', padding: '13px 0', borderRadius: 10,
        background: disabled ? 'var(--surface-subtle)' : accent,
        color: disabled ? 'var(--text-muted)' : '#fff',
        fontSize: 15, fontWeight: 700,
        border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background 150ms, opacity 150ms',
        letterSpacing: '0.01em', marginTop: 4,
      }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.opacity = '0.88'; }}
      onMouseLeave={(e) => { if (!disabled) e.currentTarget.style.opacity = '1'; }}
    >
      {isLoading ? loadingLabel : label}
    </button>
  );
}

function FingerprintIcon({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4" />
      <path d="M14 13.12c0 2.38 0 6.38-1 8.88" />
      <path d="M17.29 21.02c.12-.6.43-2.3.5-3.02" />
      <path d="M2 12a10 10 0 0 1 18-6" />
      <path d="M2 16h.01" />
      <path d="M21.8 16c.2-2 .131-5.354 0-6" />
      <path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2" />
      <path d="M17.5 10c.34-1.39.48-2.7.48-4a6 6 0 0 0-2.39-4.8" />
      <path d="M11 7.99C11 8 10 7 9 7" />
      <path d="M12 10a2 2 0 0 1 2 2c0 3 2 5 3 6" />
    </svg>
  );
}
