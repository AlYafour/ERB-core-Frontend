'use client';

import MainLayout from '@/components/layout/MainLayout';
import SecuritySettings from '@/components/users/SecuritySettings';

// Thin route around the shared <SecuritySettings/> widget. The same widget is
// also embedded in the employee's own profile (/hr/my-profile) — one source,
// no duplication. This route stays so it remains reachable for users without
// an employee record, and for the Sidebar / clock-in shortcuts.
export default function SecurityPage() {
  return (
    <MainLayout>
      <div style={{ maxWidth: 780, margin: '0 auto', padding: '32px 20px 64px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 4px', letterSpacing: '-0.02em' }}>
            Account Security
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0 }}>
            Manage your password, two-factor authentication, and biometric login settings.
          </p>
        </div>

        <SecuritySettings />
      </div>
    </MainLayout>
  );
}
