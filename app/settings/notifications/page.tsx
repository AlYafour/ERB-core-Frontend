'use client';

import { useEffect, useState } from 'react';
import { notificationsApi, NotificationPreference, NotificationPreferenceUpdate } from '@/lib/api/notifications';

const NOTIFICATION_TYPES = [
  { key: 'purchase_request_created',  label: 'Purchase Request Created' },
  { key: 'purchase_request_approved', label: 'Purchase Request Approved' },
  { key: 'purchase_request_rejected', label: 'Purchase Request Rejected' },
  { key: 'quotation_request_created', label: 'Quotation Request Created' },
  { key: 'purchase_quotation_created',label: 'Purchase Quotation Created' },
  { key: 'purchase_order_created',    label: 'Purchase Order Created' },
  { key: 'purchase_order_approved',   label: 'Purchase Order Approved' },
  { key: 'purchase_order_rejected',   label: 'Purchase Order Rejected' },
  { key: 'product_created',  label: 'Product Created' },
  { key: 'product_updated',  label: 'Product Updated' },
  { key: 'supplier_created', label: 'Supplier Created' },
  { key: 'supplier_updated', label: 'Supplier Updated' },
  { key: 'hr_request_submitted', label: 'HR Request Submitted' },
  { key: 'hr_request_approved',  label: 'HR Request Approved' },
  { key: 'hr_request_rejected',  label: 'HR Request Rejected' },
  { key: 'payroll_generated',    label: 'Payroll Generated' },
  { key: 'task_assigned',  label: 'Task Assigned' },
  { key: 'task_completed', label: 'Task Completed' },
  { key: 'task_mention',   label: 'Task Mention' },
  { key: 'general',        label: 'General Notifications' },
];

const TIMEZONES = ['UTC', 'Asia/Dubai', 'Asia/Riyadh', 'Europe/London', 'America/New_York'];

export default function NotificationPreferencesPage() {
  const [prefs, setPrefs] = useState<NotificationPreference | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    notificationsApi.getPreferences()
      .then(setPrefs)
      .catch(() => setError('Failed to load preferences'))
      .finally(() => setLoading(false));
  }, []);

  const toggleMutedType = (key: string) => {
    if (!prefs) return;
    const muted = prefs.muted_types.includes(key)
      ? prefs.muted_types.filter(t => t !== key)
      : [...prefs.muted_types, key];
    setPrefs({ ...prefs, muted_types: muted });
  };

  const handleSave = async () => {
    if (!prefs) return;
    setSaving(true);
    setError('');
    try {
      const updated = await notificationsApi.updatePreferences({
        inapp_enabled: prefs.inapp_enabled,
        email_enabled: prefs.email_enabled,
        sms_enabled: prefs.sms_enabled,
        push_enabled: prefs.push_enabled,
        quiet_hours_start: prefs.quiet_hours_start,
        quiet_hours_end: prefs.quiet_hours_end,
        quiet_hours_timezone: prefs.quiet_hours_timezone,
        muted_types: prefs.muted_types,
      });
      setPrefs(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', color: 'var(--text-secondary, #666)' }}>
        Loading preferences…
      </div>
    );
  }

  if (!prefs) {
    return (
      <div style={{ padding: '2rem', color: '#dc2626' }}>
        {error || 'Unable to load preferences.'}
      </div>
    );
  }

  const sectionStyle: React.CSSProperties = {
    background: 'var(--card-bg, #fff)',
    border: '1px solid var(--border, #e5e7eb)',
    borderRadius: '8px',
    padding: '1.5rem',
    marginBottom: '1.5rem',
  };

  const toggleRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.5rem 0',
    borderBottom: '1px solid var(--border, #f3f4f6)',
  };

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', padding: '2rem 1rem' }}>
      <h1 style={{ fontSize: '1.375rem', fontWeight: 600, marginBottom: '0.25rem' }}>
        Notification Preferences
      </h1>
      <p style={{ color: 'var(--text-secondary, #6b7280)', marginBottom: '2rem', fontSize: '0.9rem' }}>
        Control how and when you receive notifications.
      </p>

      {/* Channel toggles */}
      <section style={sectionStyle}>
        <h2 style={{ fontSize: '0.875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem', color: 'var(--text-secondary, #6b7280)' }}>
          Delivery Channels
        </h2>
        {[
          { key: 'inapp_enabled',  label: 'In-App notifications',  desc: 'Show notifications inside the app' },
          { key: 'email_enabled',  label: 'Email notifications',    desc: 'Send notifications to your email address' },
          { key: 'sms_enabled',    label: 'SMS notifications',      desc: 'Send SMS alerts for urgent notifications' },
          { key: 'push_enabled',   label: 'Push notifications',     desc: 'Browser push alerts' },
        ].map(({ key, label, desc }) => (
          <div key={key} style={toggleRowStyle}>
            <div>
              <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>{label}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #9ca3af)' }}>{desc}</div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={prefs[key as keyof NotificationPreference] as boolean}
                onChange={e => setPrefs({ ...prefs, [key]: e.target.checked })}
                style={{ width: '16px', height: '16px' }}
              />
            </label>
          </div>
        ))}
      </section>

      {/* Quiet hours */}
      <section style={sectionStyle}>
        <h2 style={{ fontSize: '0.875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem', color: 'var(--text-secondary, #6b7280)' }}>
          Quiet Hours
        </h2>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #9ca3af)', marginBottom: '1rem' }}>
          External notifications (email, SMS) are suppressed during this window unless priority is Urgent.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.25rem', fontWeight: 500 }}>Start</label>
            <input
              type="time"
              value={prefs.quiet_hours_start?.slice(0, 5) || ''}
              onChange={e => setPrefs({ ...prefs, quiet_hours_start: e.target.value ? `${e.target.value}:00` : null })}
              style={{ width: '100%', padding: '0.4rem', border: '1px solid var(--border, #d1d5db)', borderRadius: '4px', fontSize: '0.875rem' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.25rem', fontWeight: 500 }}>End</label>
            <input
              type="time"
              value={prefs.quiet_hours_end?.slice(0, 5) || ''}
              onChange={e => setPrefs({ ...prefs, quiet_hours_end: e.target.value ? `${e.target.value}:00` : null })}
              style={{ width: '100%', padding: '0.4rem', border: '1px solid var(--border, #d1d5db)', borderRadius: '4px', fontSize: '0.875rem' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.25rem', fontWeight: 500 }}>Timezone</label>
            <select
              value={prefs.quiet_hours_timezone}
              onChange={e => setPrefs({ ...prefs, quiet_hours_timezone: e.target.value })}
              style={{ width: '100%', padding: '0.4rem', border: '1px solid var(--border, #d1d5db)', borderRadius: '4px', fontSize: '0.875rem' }}
            >
              {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </div>
        </div>
      </section>

      {/* Muted notification types */}
      <section style={sectionStyle}>
        <h2 style={{ fontSize: '0.875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem', color: 'var(--text-secondary, #6b7280)' }}>
          Muted Notification Types
        </h2>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #9ca3af)', marginBottom: '1rem' }}>
          Checked types will not generate any notification.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.25rem' }}>
          {NOTIFICATION_TYPES.map(({ key, label }) => (
            <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.35rem 0', cursor: 'pointer', fontSize: '0.85rem' }}>
              <input
                type="checkbox"
                checked={prefs.muted_types.includes(key)}
                onChange={() => toggleMutedType(key)}
              />
              <span style={{ color: prefs.muted_types.includes(key) ? 'var(--text-secondary, #9ca3af)' : 'inherit' }}>
                {label}
              </span>
            </label>
          ))}
        </div>
      </section>

      {/* Save button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: '0.6rem 1.5rem',
            background: saving ? '#9ca3af' : '#2563eb',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            fontWeight: 600,
            fontSize: '0.9rem',
            cursor: saving ? 'not-allowed' : 'pointer',
          }}
        >
          {saving ? 'Saving…' : 'Save Preferences'}
        </button>
        {saved && (
          <span style={{ color: '#16a34a', fontSize: '0.875rem', fontWeight: 500 }}>
            Saved
          </span>
        )}
        {error && (
          <span style={{ color: '#dc2626', fontSize: '0.875rem' }}>
            {error}
          </span>
        )}
      </div>
    </div>
  );
}
