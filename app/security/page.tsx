'use client';

import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import MainLayout from '@/components/layout/MainLayout';
import { authApi } from '@/lib/api/auth';
import { useAuthStore } from '@/lib/store/auth-store';
import { toast } from '@/lib/hooks/use-toast';
import { getApiError } from '@/lib/utils/error';
import {
  prepareRegistrationOptions,
  serializeRegistrationCredential,
  isPlatformAuthenticatorAvailable,
} from '@/lib/utils/webauthn';

// ── Section wrapper ──────────────────────────────────────────────────────────
function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--surface-card)',
      border: '1px solid var(--border-default)',
      borderRadius: 14,
      padding: '28px 32px',
      display: 'flex',
      flexDirection: 'column',
      gap: 20,
    }}>
      <div>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{title}</h2>
        {description && (
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0', lineHeight: 1.5 }}>{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}

// ── Field label + input helper ───────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>{label}</label>
      {children}
    </div>
  );
}

const INPUT_STYLE: React.CSSProperties = {
  padding: '10px 14px',
  borderRadius: 8,
  border: '1.5px solid var(--border-default)',
  background: 'var(--surface-subtle)',
  color: 'var(--text-primary)',
  fontSize: 14,
  outline: 'none',
  transition: 'border-color 150ms',
  width: '100%',
  boxSizing: 'border-box',
};

const BTN: React.CSSProperties = {
  padding: '10px 22px',
  borderRadius: 8,
  border: 'none',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'opacity 150ms',
};

// ── Change Password ──────────────────────────────────────────────────────────
function ChangePasswordSection() {
  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const { setTokens } = useAuthStore();

  const { mutate, isPending } = useMutation({
    mutationFn: () => authApi.changePassword(oldPwd, newPwd),
    onSuccess: (data) => {
      setTokens(data.tokens.access, data.tokens.refresh);
      toast('Password changed successfully.', 'success');
      setOldPwd(''); setNewPwd(''); setConfirm(''); setError('');
    },
    onError: (err: unknown) => {
      setError(getApiError(err, 'Failed to change password.'));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPwd !== confirm) { setError('New passwords do not match.'); return; }
    if (newPwd.length < 8)  { setError('Password must be at least 8 characters.'); return; }
    setError('');
    mutate();
  };

  return (
    <Section title="Change Password" description="After changing your password, all other sessions will be signed out.">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 400 }}>
        {error && (
          <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontSize: 13, border: '1px solid rgba(239,68,68,0.3)' }}>
            {error}
          </div>
        )}
        <Field label="Current Password">
          <input type="password" value={oldPwd} onChange={(e) => setOldPwd(e.target.value)} style={INPUT_STYLE} autoComplete="current-password" />
        </Field>
        <Field label="New Password">
          <input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} style={INPUT_STYLE} autoComplete="new-password" />
        </Field>
        <Field label="Confirm New Password">
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} style={INPUT_STYLE} autoComplete="new-password" />
        </Field>
        <div>
          <button
            type="submit"
            disabled={isPending || !oldPwd || !newPwd || !confirm}
            style={{ ...BTN, background: 'var(--brand)', color: '#fff', opacity: (isPending || !oldPwd || !newPwd || !confirm) ? 0.5 : 1 }}
          >
            {isPending ? 'Saving…' : 'Update Password'}
          </button>
        </div>
      </form>
    </Section>
  );
}

// ── 2FA Section ──────────────────────────────────────────────────────────────
function TwoFASection({ is2FAEnabled, onToggled }: { is2FAEnabled: boolean; onToggled: () => void }) {
  const [setupData, setSetupData] = useState<{ secret: string; qr_code: string } | null>(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [showDisable, setShowDisable] = useState(false);

  const setupMutation = useMutation({
    mutationFn: () => authApi.twofa.setup(),
    onSuccess: (data) => setSetupData(data),
    onError: (err: unknown) => toast(getApiError(err, 'Setup failed.'), 'error'),
  });

  const confirmMutation = useMutation({
    mutationFn: () => authApi.twofa.confirm(code),
    onSuccess: () => {
      toast('2FA enabled successfully.', 'success');
      setSetupData(null); setCode('');
      onToggled();
    },
    onError: (err: unknown) => toast(getApiError(err, 'Invalid code.'), 'error'),
  });

  const disableMutation = useMutation({
    mutationFn: () => authApi.twofa.disable(password, code),
    onSuccess: () => {
      toast('2FA disabled.', 'success');
      setShowDisable(false); setCode(''); setPassword('');
      onToggled();
    },
    onError: (err: unknown) => toast(getApiError(err, 'Failed to disable 2FA.'), 'error'),
  });

  if (is2FAEnabled) {
    return (
      <Section
        title="Two-Factor Authentication"
        description="Your account is protected with an authenticator app."
      >
        <StatusPill enabled />

        {!showDisable ? (
          <div>
            <button
              type="button"
              onClick={() => setShowDisable(true)}
              style={{ ...BTN, background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)' }}
            >
              Disable 2FA
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 380 }}>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
              Enter your password and current authenticator code to confirm.
            </p>
            <Field label="Password">
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={INPUT_STYLE} />
            </Field>
            <Field label="Authenticator Code">
              <input
                type="text" inputMode="numeric" maxLength={6} value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                style={{ ...INPUT_STYLE, fontFamily: 'monospace', fontSize: 20, letterSpacing: '0.25em', textAlign: 'center' }}
              />
            </Field>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => disableMutation.mutate()}
                disabled={disableMutation.isPending || code.length < 6 || !password}
                style={{ ...BTN, background: '#ef4444', color: '#fff', opacity: (disableMutation.isPending || code.length < 6 || !password) ? 0.5 : 1 }}
              >
                {disableMutation.isPending ? 'Disabling…' : 'Confirm Disable'}
              </button>
              <button type="button" onClick={() => { setShowDisable(false); setCode(''); setPassword(''); }} style={{ ...BTN, background: 'var(--surface-subtle)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </Section>
    );
  }

  // 2FA not enabled
  return (
    <Section
      title="Two-Factor Authentication"
      description="Add an extra layer of security using Google Authenticator, Authy, or any TOTP app."
    >
      <StatusPill enabled={false} />

      {!setupData ? (
        <div>
          <button
            type="button"
            onClick={() => setupMutation.mutate()}
            disabled={setupMutation.isPending}
            style={{ ...BTN, background: 'var(--brand)', color: '#fff', opacity: setupMutation.isPending ? 0.6 : 1 }}
          >
            {setupMutation.isPending ? 'Generating…' : 'Set Up 2FA'}
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', gap: 28, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            {/* QR Code */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <img src={setupData.qr_code} alt="Scan with authenticator app" style={{ width: 160, height: 160, borderRadius: 10, border: '1px solid var(--border-default)' }} />
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Scan with your app</span>
            </div>

            {/* Manual key */}
            <div style={{ flex: 1, minWidth: 200 }}>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 10px', lineHeight: 1.6 }}>
                Scan the QR code with Google Authenticator, Authy, or any compatible app. Or enter the key manually:
              </p>
              <div style={{ fontFamily: 'monospace', fontSize: 13, letterSpacing: '0.15em', padding: '8px 12px', background: 'var(--surface-subtle)', borderRadius: 8, border: '1px solid var(--border-default)', wordBreak: 'break-all', color: 'var(--text-primary)' }}>
                {setupData.secret}
              </div>
            </div>
          </div>

          <Field label="Enter the 6-digit code to confirm">
            <input
              type="text" inputMode="numeric" maxLength={6} autoFocus value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              style={{ ...INPUT_STYLE, fontFamily: 'monospace', fontSize: 22, letterSpacing: '0.3em', textAlign: 'center', maxWidth: 200 }}
            />
          </Field>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={() => confirmMutation.mutate()}
              disabled={confirmMutation.isPending || code.length < 6}
              style={{ ...BTN, background: 'var(--brand)', color: '#fff', opacity: (confirmMutation.isPending || code.length < 6) ? 0.5 : 1 }}
            >
              {confirmMutation.isPending ? 'Verifying…' : 'Activate 2FA'}
            </button>
            <button type="button" onClick={() => { setSetupData(null); setCode(''); }} style={{ ...BTN, background: 'var(--surface-subtle)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </Section>
  );
}

// ── Passkeys Section ─────────────────────────────────────────────────────────
function PasskeysSection() {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [credentials, setCredentials] = useState<{ device_name: string; credential_id?: string }[]>([]);
  const [deviceName, setDeviceName] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [showRegisterForm, setShowRegisterForm] = useState(false);

  useEffect(() => {
    isPlatformAuthenticatorAvailable().then(setSupported);
    authApi.me().then((u) => {
      if (u.webauthn_credentials) setCredentials(u.webauthn_credentials);
    }).catch(() => {});
  }, []);

  const handleRegister = async () => {
    if (!deviceName.trim()) return;
    setIsRegistering(true);
    try {
      const { options, challenge_token } = await authApi.webauthn.registerBegin(deviceName.trim());
      const browserOptions = prepareRegistrationOptions(options);
      const cred = await navigator.credentials.create({ publicKey: browserOptions }) as PublicKeyCredential | null;
      if (!cred) { toast('Registration cancelled.', 'warning'); return; }
      const serialized = serializeRegistrationCredential(cred);
      const result = await authApi.webauthn.registerComplete(serialized, challenge_token, deviceName.trim());
      setCredentials(result.credentials);
      setDeviceName('');
      setShowRegisterForm(false);
      toast('Passkey registered successfully.', 'success');
    } catch (err: unknown) {
      toast(getApiError(err, 'Failed to register passkey.'), 'error');
    } finally {
      setIsRegistering(false);
    }
  };

  const deleteMutation = useMutation({
    mutationFn: (credentialId: string) => authApi.webauthn.deleteCredential(credentialId),
    onSuccess: (data) => { setCredentials(data.credentials); toast('Passkey removed.', 'success'); },
    onError: (err: unknown) => toast(getApiError(err, 'Failed to remove passkey.'), 'error'),
  });

  if (supported === null) {
    return (
      <Section title="Passkeys & Biometric Login">
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Checking device support…</span>
      </Section>
    );
  }

  if (!supported) {
    return (
      <Section title="Passkeys & Biometric Login" description="Sign in using fingerprint, Face ID, or Windows Hello — no password needed.">
        <div style={{ padding: '14px 18px', borderRadius: 10, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', fontSize: 13, color: 'var(--text-secondary)' }}>
          Your current device or browser does not support biometric authentication. Try Chrome, Edge, or Safari on a device with a fingerprint reader or Face ID.
        </div>
      </Section>
    );
  }

  return (
    <Section title="Passkeys & Biometric Login" description="Sign in using fingerprint, Face ID, or Windows Hello — no password needed.">

      {/* Registered passkeys list */}
      {credentials.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {credentials.map((c, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 16px', borderRadius: 10,
                border: '1px solid var(--border-default)',
                background: 'var(--surface-subtle)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 20 }}>🔑</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{c.device_name}</span>
              </div>
              {c.credential_id && (
                <button
                  type="button"
                  onClick={() => deleteMutation.mutate(c.credential_id!)}
                  disabled={deleteMutation.isPending}
                  style={{ ...BTN, padding: '6px 14px', fontSize: 12, background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Register new passkey */}
      {!showRegisterForm ? (
        <div>
          <button
            type="button"
            onClick={() => setShowRegisterForm(true)}
            style={{ ...BTN, background: 'var(--brand)', color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <span>+ Add Passkey</span>
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 380 }}>
          <Field label="Device name (e.g. MacBook Touch ID, Phone)">
            <input
              type="text"
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              placeholder="My Laptop"
              style={INPUT_STYLE}
              autoFocus
            />
          </Field>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={handleRegister}
              disabled={isRegistering || !deviceName.trim()}
              style={{ ...BTN, background: 'var(--brand)', color: '#fff', opacity: (isRegistering || !deviceName.trim()) ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: 8 }}
            >
              {isRegistering ? 'Waiting for biometric…' : 'Register Passkey'}
            </button>
            <button type="button" onClick={() => { setShowRegisterForm(false); setDeviceName(''); }} style={{ ...BTN, background: 'var(--surface-subtle)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }}>
              Cancel
            </button>
          </div>
          {isRegistering && (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
              Follow your device's prompt (fingerprint scanner, Face ID, PIN, etc.)
            </p>
          )}
        </div>
      )}
    </Section>
  );
}

function StatusPill({ enabled }: { enabled: boolean }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: enabled ? 'rgba(16,185,129,0.12)' : 'rgba(107,114,128,0.12)', color: enabled ? '#10b981' : 'var(--text-muted)', border: `1px solid ${enabled ? 'rgba(16,185,129,0.3)' : 'rgba(107,114,128,0.2)'}` }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
      {enabled ? 'Enabled' : 'Not enabled'}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function SecurityPage() {
  const user = useAuthStore((s) => s.user);
  const [is2FAEnabled, setIs2FAEnabled] = useState<boolean>(false);

  useEffect(() => {
    authApi.me().then((u) => {
      setIs2FAEnabled(u.is_2fa_enabled ?? false);
    }).catch(() => {});
  }, []);

  return (
    <MainLayout>
      <div style={{ maxWidth: 780, margin: '0 auto', padding: '32px 20px 64px', display: 'flex', flexDirection: 'column', gap: 8 }}>

        {/* Page header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 4px', letterSpacing: '-0.02em' }}>
            Account Security
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0 }}>
            Manage your password, two-factor authentication, and biometric login settings.
          </p>
        </div>

        <ChangePasswordSection />
        <TwoFASection is2FAEnabled={is2FAEnabled} onToggled={() => setIs2FAEnabled((v) => !v)} />
        <PasskeysSection />

      </div>
    </MainLayout>
  );
}
