'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import MainLayout from '@/components/layout/MainLayout';
import { PageShell, PageHeader, Button, Loader } from '@/components/ui';
import HRSettingsNav from '@/components/hr/HRSettingsNav';
import { hrTrustedDevicesApi, hrLocationSignalsApi, hrOfficeLocationsApi } from '@/lib/api/hr';
import { toast, confirm } from '@/lib/hooks/use-toast';
import { getApiError } from '@/lib/utils/error';
import type { LocationSignal } from '@/types';

const CARD: React.CSSProperties = {
  background: 'var(--surface-primary)', border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)',
};
const SECTION: React.CSSProperties = {
  fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', textTransform: 'uppercase',
  letterSpacing: '0.07em', color: 'var(--text-tertiary)', margin: '0 0 var(--space-4)',
};
const INPUT: React.CSSProperties = {
  padding: '7px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--input-border)',
  background: 'var(--input-bg)', color: 'var(--text-primary)', fontSize: 'var(--text-sm)', boxSizing: 'border-box',
};
const TH: React.CSSProperties = {
  textAlign: 'left', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)',
  color: 'var(--text-tertiary)', padding: '6px 8px', textTransform: 'uppercase', letterSpacing: '0.05em',
};
const TD: React.CSSProperties = { padding: '8px', fontSize: 'var(--text-sm)', color: 'var(--text-primary)', borderTop: '1px solid var(--border-subtle)' };

function fmt(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
}

export default function VerificationManagementPage() {
  const qc = useQueryClient();

  // ── Trusted devices ─────────────────────────────────────────────────────────
  const { data: devices, isLoading: devLoading } = useQuery({
    queryKey: ['trusted-devices'],
    queryFn: () => hrTrustedDevicesApi.getAll(),
  });
  const devToggle = useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) => hrTrustedDevicesApi.update(id, { is_active }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['trusted-devices'] }); toast('Device updated', 'success'); },
    onError: (e) => toast(getApiError(e, 'Update failed'), 'error'),
  });
  const devRemove = useMutation({
    mutationFn: (id: number) => hrTrustedDevicesApi.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['trusted-devices'] }); toast('Device removed', 'success'); },
    onError: (e) => toast(getApiError(e, 'Remove failed'), 'error'),
  });

  // ── Office signals (Wi-Fi / Beacon) ─────────────────────────────────────────
  const { data: locResp } = useQuery({
    queryKey: ['office-locations-lookup'],
    queryFn: () => hrOfficeLocationsApi.getAll({ is_active: true }),
  });
  const locations = locResp?.results ?? [];
  const [locId, setLocId] = useState<number | null>(null);
  const activeLoc = locId ?? locations[0]?.id ?? null;

  const { data: signals, isLoading: sigLoading } = useQuery({
    queryKey: ['location-signals', activeLoc],
    queryFn: () => hrLocationSignalsApi.getAll({ office_location: activeLoc! }),
    enabled: !!activeLoc,
  });

  const [kind, setKind] = useState<'wifi' | 'beacon'>('wifi');
  const [identifier, setIdentifier] = useState('');
  const [label, setLabel] = useState('');

  const sigAdd = useMutation({
    mutationFn: () => hrLocationSignalsApi.create({ office_location: activeLoc!, kind, identifier, label }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['location-signals', activeLoc] }); setIdentifier(''); setLabel(''); toast('Signal added', 'success'); },
    onError: (e) => toast(getApiError(e, 'Add failed'), 'error'),
  });
  const sigRemove = useMutation({
    mutationFn: (id: number) => hrLocationSignalsApi.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['location-signals', activeLoc] }); toast('Signal removed', 'success'); },
    onError: (e) => toast(getApiError(e, 'Remove failed'), 'error'),
  });

  return (
    <MainLayout>
      <PageShell>
        <PageHeader
          title="Verification · التحقق"
          description="الأجهزة الموثوقة وإشارات المكتب (واي-فاي / بيكون) المستخدمة في طبقات التحقق. الإعدادات نفسها في صفحة قواعد البصمة."
          breadcrumbs={[{ label: 'HR' }, { label: 'Settings', href: '/hr/settings' }, { label: 'Verification' }]}
        />

        <div style={{ display: 'flex', gap: 'var(--space-6)', alignItems: 'flex-start' }}>
          <HRSettingsNav />
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', maxWidth: '56rem' }}>
          {/* Trusted devices */}
          <div style={CARD}>
            <p style={SECTION}>📱 الأجهزة الموثوقة · Trusted devices</p>
            {devLoading ? <Loader /> : (devices?.length ?? 0) === 0 ? (
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0 }}>
                لا توجد أجهزة بعد — تُسجَّل تلقائياً عند أول بصمة.
              </p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>
                    <th style={TH}>الموظف</th><th style={TH}>المنصّة</th><th style={TH}>آخر ظهور</th>
                    <th style={TH}>الحالة</th><th style={TH}></th>
                  </tr></thead>
                  <tbody>
                    {devices!.map(d => (
                      <tr key={d.id}>
                        <td style={TD}>{d.employee_name ?? d.employee_id_code ?? `#${d.employee}`}<br /><span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>{d.device_uuid.slice(0, 18)}…</span></td>
                        <td style={TD}>{d.platform}</td>
                        <td style={TD}>{fmt(d.last_seen_at)}</td>
                        <td style={TD}>
                          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, padding: '2px 10px', borderRadius: 999, background: d.is_active ? 'var(--status-success-bg)' : 'var(--surface-subtle)', color: d.is_active ? 'var(--status-success)' : 'var(--text-tertiary)' }}>
                            {d.is_active ? 'موثوق' : 'موقوف'}
                          </span>
                        </td>
                        <td style={{ ...TD, whiteSpace: 'nowrap' }}>
                          <Button variant={d.is_active ? 'secondary' : 'success'} size="sm"
                            onClick={() => devToggle.mutate({ id: d.id, is_active: !d.is_active })}>
                            {d.is_active ? 'إيقاف' : 'اعتماد'}
                          </Button>{' '}
                          <Button variant="destructive" size="sm"
                            onClick={async () => { if (await confirm('حذف هذا الجهاز؟')) devRemove.mutate(d.id); }}>
                            حذف
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Office signals */}
          <div style={CARD}>
            <p style={SECTION}>📡 إشارات المكتب · Wi-Fi / Beacon</p>
            {locations.length === 0 ? (
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0 }}>
                أضف موقع مكتب أولاً من صفحة المواقع.
              </p>
            ) : (
              <>
                <div style={{ marginBottom: 'var(--space-4)' }}>
                  <select style={{ ...INPUT, width: '100%', maxWidth: 360 }} value={activeLoc ?? ''}
                    onChange={e => setLocId(Number(e.target.value))}>
                    {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>

                {/* Add form */}
                <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                  <select style={INPUT} value={kind} onChange={e => setKind(e.target.value as 'wifi' | 'beacon')}>
                    <option value="wifi">Wi-Fi BSSID</option>
                    <option value="beacon">Beacon UUID</option>
                  </select>
                  <input style={{ ...INPUT, flex: 1, minWidth: 200 }} placeholder={kind === 'wifi' ? 'aa:bb:cc:dd:ee:ff' : 'beacon UUID'}
                    value={identifier} onChange={e => setIdentifier(e.target.value)} />
                  <input style={{ ...INPUT, width: 160 }} placeholder="اسم (اختياري)" value={label} onChange={e => setLabel(e.target.value)} />
                  <Button variant="primary" size="sm" isLoading={sigAdd.isPending}
                    disabled={!identifier.trim()} onClick={() => sigAdd.mutate()}>
                    إضافة
                  </Button>
                </div>

                {sigLoading ? <Loader /> : (signals?.length ?? 0) === 0 ? (
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0 }}>لا توجد إشارات لهذا الموقع.</p>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead><tr>
                        <th style={TH}>النوع</th><th style={TH}>المُعرّف</th><th style={TH}>الاسم</th><th style={TH}></th>
                      </tr></thead>
                      <tbody>
                        {(signals as LocationSignal[]).map(s => (
                          <tr key={s.id}>
                            <td style={TD}>{s.kind === 'wifi' ? 'Wi-Fi' : 'Beacon'}</td>
                            <td style={{ ...TD, fontFamily: 'monospace', fontSize: 'var(--text-xs)' }}>{s.identifier}</td>
                            <td style={TD}>{s.label || '—'}</td>
                            <td style={{ ...TD, whiteSpace: 'nowrap' }}>
                              <Button variant="destructive" size="sm"
                                onClick={async () => { if (await confirm('حذف هذه الإشارة؟')) sigRemove.mutate(s.id); }}>
                                حذف
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
          </div>
        </div>
      </PageShell>
    </MainLayout>
  );
}
