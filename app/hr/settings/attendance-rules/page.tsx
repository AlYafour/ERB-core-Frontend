'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import MainLayout from '@/components/layout/MainLayout';
import { PageShell, PageHeader, Button, Loader } from '@/components/ui';
import { hrAttendancePoliciesApi } from '@/lib/api/hr';
import { toast } from '@/lib/hooks/use-toast';
import { getApiError } from '@/lib/utils/error';
import type { AttendancePolicy } from '@/types';

const CARD: React.CSSProperties = {
  background: 'var(--surface-primary)', border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)',
};
const SECTION: React.CSSProperties = {
  fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', textTransform: 'uppercase',
  letterSpacing: '0.07em', color: 'var(--text-tertiary)', margin: '0 0 var(--space-4)',
};
const LBL: React.CSSProperties = {
  display: 'block', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)',
  color: 'var(--text-secondary)', marginBottom: 4,
};
const INPUT: React.CSSProperties = {
  width: '100%', padding: '7px 10px', borderRadius: 'var(--radius-md)',
  border: '1px solid var(--input-border)', background: 'var(--input-bg)',
  color: 'var(--text-primary)', fontSize: 'var(--text-sm)', boxSizing: 'border-box',
};
const GRID: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)',
};

type Draft = Partial<AttendancePolicy>;

const DEFAULTS: Draft = {
  name: 'Attendance Policy', enforce_punch_windows: false,
  checkin_opens_before_min: 30, checkin_closes_after_min: 240, checkin_minor_late_min: 30,
  break_opens_before_min: 60, break_closes_after_min: 30, break_max_min: 60, break_grace_min: 5,
  checkout_opens_after_min: 0, checkout_closes_after_min: 60,
  emergency_enabled: true, emergency_monthly_limit: 2, emergency_validity_min: 15,
  emergency_min_reason_chars: 100, emergency_followup_days: 3,
  missing_punch_detection_enabled: true, missing_punch_lookback_days: 7,
  missing_checkout_assume_shift_end: true,
  verify_wifi: false, verify_beacon: false, verify_device: false,
  verification_mode: 'any', device_trust_on_first_use: true,
};

function NumField({ label, hint, value, onChange }: {
  label: string; hint?: string; value: number | undefined; onChange: (v: number) => void;
}) {
  return (
    <div>
      <label style={LBL}>{label}</label>
      <input style={INPUT} type="number" min={0} step={5} value={value ?? 0}
        onChange={e => onChange(Number(e.target.value))} />
      {hint && <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', margin: '4px 0 0' }}>{hint}</p>}
    </div>
  );
}

export default function AttendanceRulesPage() {
  const qc = useQueryClient();
  const { data: policies, isLoading } = useQuery({
    queryKey: ['attendance-policies'],
    queryFn: () => hrAttendancePoliciesApi.getAll(),
  });

  // We manage the tenant-wide catch-all policy (employee_group = null).
  const catchAll = (policies ?? []).find(p => p.employee_group == null);
  const [form, setForm] = useState<Draft>(DEFAULTS);

  useEffect(() => {
    if (catchAll) setForm(catchAll);
  }, [catchAll]);

  const set = (k: keyof Draft) => (v: number | boolean | string) => setForm(f => ({ ...f, [k]: v }));

  const saveMut = useMutation({
    mutationFn: (data: Draft) =>
      catchAll ? hrAttendancePoliciesApi.update(catchAll.id, data)
               : hrAttendancePoliciesApi.create({ ...data, employee_group: null }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['attendance-policies'] }); toast('Attendance rules saved', 'success'); },
    onError: (e) => toast(getApiError(e, 'Save failed'), 'error'),
  });

  if (isLoading) return <MainLayout><div className="card empty-state"><Loader /></div></MainLayout>;

  return (
    <MainLayout>
      <PageShell>
        <PageHeader
          title="Attendance Rules · قواعد البصمة"
          description="كل الأوقات والحدود من هنا — لا شيء مكتوب في الكود. النوافذ محسوبة نسبةً لجدول دوام الموظف (فالجمعة تتعدّل تلقائياً)."
          breadcrumbs={[{ label: 'HR' }, { label: 'Settings', href: '/hr/settings' }, { label: 'Attendance Rules' }]}
          actions={
            <Button variant="primary" size="sm" isLoading={saveMut.isPending} onClick={() => saveMut.mutate(form)}>
              Save
            </Button>
          }
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', maxWidth: '52rem' }}>
          {/* Master toggle */}
          <div style={{ ...CARD, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-4)' }}>
            <div>
              <p style={{ margin: 0, fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-sm)' }}>تفعيل نوافذ الأزرار</p>
              <p style={{ margin: '2px 0 0', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                لمّا مُفعّل: كل زر يُقبل فقط داخل نافذته. مُطفأ: البصمة مسموحة أي وقت.
              </p>
            </div>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={!!form.enforce_punch_windows}
                onChange={e => set('enforce_punch_windows')(e.target.checked)} />
              <span style={{ fontSize: 'var(--text-sm)' }}>{form.enforce_punch_windows ? 'مُفعّل' : 'مُطفأ'}</span>
            </label>
          </div>

          {/* Check-in */}
          <div style={CARD}>
            <p style={SECTION}>🟢 الدخول · Check-in</p>
            <div style={GRID}>
              <NumField label="يفتح قبل بداية الدوام (دقيقة)" hint="مثال 30 → يفتح 8:00 لدوام 8:30"
                value={form.checkin_opens_before_min} onChange={set('checkin_opens_before_min') as (v: number) => void} />
              <NumField label="يقفل بعد بداية الدوام (دقيقة)" hint="بعده = غياب. 240 → 12:30"
                value={form.checkin_closes_after_min} onChange={set('checkin_closes_after_min') as (v: number) => void} />
              <NumField label="حد التأخر البسيط (دقيقة)" hint="لِحدّه بسيط، بعده شديد"
                value={form.checkin_minor_late_min} onChange={set('checkin_minor_late_min') as (v: number) => void} />
            </div>
          </div>

          {/* Break */}
          <div style={CARD}>
            <p style={SECTION}>🟡 الاستراحة · Break</p>
            <div style={GRID}>
              <NumField label="يفتح قبل موعد الاستراحة (دقيقة)" value={form.break_opens_before_min}
                onChange={set('break_opens_before_min') as (v: number) => void} />
              <NumField label="يقفل بعد موعد الاستراحة (دقيقة)" value={form.break_closes_after_min}
                onChange={set('break_closes_after_min') as (v: number) => void} />
              <NumField label="أقصى مدة استراحة (دقيقة)" value={form.break_max_min}
                onChange={set('break_max_min') as (v: number) => void} />
              <NumField label="تسامح بعد المدة (دقيقة)" hint="النهاية = البداية + المدة + التسامح"
                value={form.break_grace_min} onChange={set('break_grace_min') as (v: number) => void} />
            </div>
          </div>

          {/* Check-out */}
          <div style={CARD}>
            <p style={SECTION}>🔴 الانصراف · Check-out</p>
            <div style={GRID}>
              <NumField label="يفتح بعد نهاية الدوام (دقيقة)" hint="0 = عند النهاية بالضبط"
                value={form.checkout_opens_after_min} onChange={set('checkout_opens_after_min') as (v: number) => void} />
              <NumField label="يقفل بعد نهاية الدوام (دقيقة)" hint="60 → يقفل 6:30 لدوام ينتهي 5:30"
                value={form.checkout_closes_after_min} onChange={set('checkout_closes_after_min') as (v: number) => void} />
            </div>
          </div>

          {/* Emergency exit */}
          <div style={CARD}>
            <p style={SECTION}>🚨 زر الطوارئ · Emergency Exit</p>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 'var(--space-4)' }}>
              <input type="checkbox" checked={!!form.emergency_enabled}
                onChange={e => set('emergency_enabled')(e.target.checked)} />
              <span style={{ fontSize: 'var(--text-sm)' }}>تفعيل زر الطوارئ</span>
            </label>
            <div style={GRID}>
              <NumField label="الحد الشهري (عدد الطلبات)" value={form.emergency_monthly_limit}
                onChange={set('emergency_monthly_limit') as (v: number) => void} />
              <NumField label="مدة صلاحية الطلب (دقيقة)" value={form.emergency_validity_min}
                onChange={set('emergency_validity_min') as (v: number) => void} />
              <NumField label="أقل عدد حروف للسبب" value={form.emergency_min_reason_chars}
                onChange={set('emergency_min_reason_chars') as (v: number) => void} />
              <NumField label="أيام تقديم المستند" value={form.emergency_followup_days}
                onChange={set('emergency_followup_days') as (v: number) => void} />
            </div>
          </div>

          {/* Smart missing-punch */}
          <div style={CARD}>
            <p style={SECTION}>🧩 البصمة الناقصة الذكية · Missing-punch</p>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 'var(--space-3)' }}>
              <input type="checkbox" checked={!!form.missing_punch_detection_enabled}
                onChange={e => set('missing_punch_detection_enabled')(e.target.checked)} />
              <span style={{ fontSize: 'var(--text-sm)' }}>اكتشاف الأيام غير المكتملة واقتراح تصحيح</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', marginBottom: 'var(--space-4)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
              <input type="checkbox" checked={!!form.missing_checkout_assume_shift_end} style={{ marginTop: 3 }}
                onChange={e => set('missing_checkout_assume_shift_end')(e.target.checked)} />
              <span>اقتراح وقت الانصراف المنسي = نهاية الدوام (يقدر الموظف يعدّله)</span>
            </label>
            <div style={GRID}>
              <NumField label="عدد الأيام السابقة للفحص" hint="يفحص آخر كام يوم للأيام الناقصة"
                value={form.missing_punch_lookback_days} onChange={set('missing_punch_lookback_days') as (v: number) => void} />
            </div>
          </div>

          {/* Verification layers */}
          <div style={CARD}>
            <p style={SECTION}>🛡️ طبقات التحقق · Verification layers</p>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', margin: '0 0 var(--space-4)', lineHeight: 1.6 }}>
              طبقات إضافية فوق الـGPS. تطبيق الموبايل يبعت إشارة الواي-فاي/البيكون؛ الويب يبعت معرّف الجهاز فقط.
              كل الطبقات مطفأة افتراضياً — تشتغل بس لما تفعّلها.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
              {[
                ['verify_wifi', 'واي-فاي المكتب (BSSID معروف) — من الموبايل'],
                ['verify_beacon', 'بيكون المكتب (BLE) — من الموبايل'],
                ['verify_device', 'جهاز موثوق — يمنع البصم بجهاز شخص آخر'],
              ].map(([k, label]) => (
                <label key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 'var(--text-sm)' }}>
                  <input type="checkbox" checked={!!form[k as keyof Draft]}
                    onChange={e => set(k as keyof Draft)(e.target.checked)} />
                  <span>{label}</span>
                </label>
              ))}
            </div>
            <div style={GRID}>
              <div>
                <label style={LBL}>طريقة الدمج</label>
                <select style={INPUT} value={form.verification_mode ?? 'any'}
                  onChange={e => set('verification_mode')(e.target.value)}>
                  <option value="any">أي طبقة مفعّلة تكفي (any)</option>
                  <option value="all">كل الطبقات المفعّلة لازم تنجح (all)</option>
                </select>
              </div>
              <label style={{ display: 'flex', alignItems: 'flex-end', gap: 8, cursor: 'pointer', fontSize: 'var(--text-sm)', paddingBottom: 8 }}>
                <input type="checkbox" checked={!!form.device_trust_on_first_use}
                  onChange={e => set('device_trust_on_first_use')(e.target.checked)} />
                <span>الثقة بأول جهاز تلقائياً (وإلا يعتمده المدير)</span>
              </label>
            </div>
            <a href="/hr/settings/verification" style={{ display: 'inline-block', marginTop: 'var(--space-4)', fontSize: 'var(--text-sm)', color: 'var(--brand)', textDecoration: 'none', fontWeight: 'var(--weight-semibold)' }}>
              إدارة الأجهزة الموثوقة وإشارات المكتب →
            </a>
          </div>
        </div>
      </PageShell>
    </MainLayout>
  );
}
