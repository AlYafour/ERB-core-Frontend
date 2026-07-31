'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import MainLayout from '@/components/layout/MainLayout';
import { hrPayrollApi } from '@/lib/api/hr';
import { useAuth } from '@/lib/hooks/use-auth';
import { useMyPermissions } from '@/lib/hooks/use-my-permissions';
import { toast, confirm } from '@/lib/hooks/use-toast';
import { Button, Badge, Loader, PageHeader, PageShell } from '@/components/ui';

const STATUS_VARIANT: Record<string, string> = {
  draft: 'default', processed: 'info', paid: 'success',
};

const fmt = (v: string | number) =>
  `AED ${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

const num = (v: string | number | null | undefined) => Number(v ?? 0);

const CARD: React.CSSProperties = {
  background: 'var(--surface-primary)', border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)',
};
const SECTION_TITLE: React.CSSProperties = {
  fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', textTransform: 'uppercase',
  letterSpacing: '0.07em', color: 'var(--text-tertiary)', margin: '0 0 var(--space-4)',
};
const MONO: React.CSSProperties = { fontFamily: 'var(--font-mono, monospace)', fontVariantNumeric: 'tabular-nums' };
const ROW: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  fontSize: 'var(--text-sm)', padding: '3px 0',
};
const CHEVRON = (open: boolean): React.CSSProperties => ({
  fontSize: 9, lineHeight: 1, color: 'var(--text-tertiary)', display: 'inline-block',
  transition: 'transform 0.15s', transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
});

function KpiCard({ label, value, tone }: { label: string; value: string; tone: 'neutral' | 'error' | 'net' }) {
  const isNet = tone === 'net';
  return (
    <div style={{
      ...CARD,
      display: 'flex', flexDirection: 'column', gap: 'var(--space-2)',
      background: isNet ? 'var(--brand)' : 'var(--surface-primary)',
      border: isNet ? 'none' : '1px solid var(--border-subtle)',
    }}>
      <span style={{
        fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '0.06em',
        fontWeight: 'var(--weight-semibold)',
        color: isNet ? 'var(--primary-foreground)' : 'var(--text-tertiary)', opacity: isNet ? 0.85 : 1,
      }}>{label}</span>
      <span style={{
        ...MONO, fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-bold)', lineHeight: 1.1,
        color: isNet ? 'var(--primary-foreground)' : tone === 'error' ? 'var(--status-error)' : 'var(--text-primary)',
      }}>{value}</span>
    </div>
  );
}

export default function PayrollDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { hasPermission } = useMyPermissions();
  const isAdmin = hasPermission('hr.hr_payroll.view');
  const [penaltyExpanded,     setPenaltyExpanded]     = useState(false);
  const [loanExpanded,        setLoanExpanded]         = useState(false);
  const [encashmentExpanded,  setEncashmentExpanded]   = useState(false);

  const { data: payroll, isLoading, error } = useQuery({
    queryKey: ['hr-payroll', id],
    queryFn: () => hrPayrollApi.getById(Number(id)),
  });

  const markPaidMutation = useMutation({
    mutationFn: () => hrPayrollApi.markPaid(Number(id)),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['hr-payroll', id] }); toast('Marked as paid', 'success'); },
    onError: () => toast('Failed', 'error'),
  });

  const handleMarkPaid = async () => {
    const ok = await confirm('Mark this payroll as paid?');
    if (ok) markPaidMutation.mutate();
  };

  if (isLoading) return <MainLayout><div className="card empty-state"><Loader /></div></MainLayout>;
  if (error || !payroll) return <MainLayout><div className="card empty-state"><p style={{ color: 'var(--color-error)', margin: 0 }}>Payroll record not found.</p></div></MainLayout>;

  return (
    <MainLayout>
      <PageShell>
        <PageHeader
          title={`${payroll.month_name} ${payroll.year}`}
          description={
            payroll.period_start && payroll.period_end
              ? `${payroll.employee_name} — ${payroll.employee_id_code} · الفترة ${fmtDate(payroll.period_start)} → ${fmtDate(payroll.period_end)}`
              : `${payroll.employee_name} — ${payroll.employee_id_code}`
          }
          breadcrumbs={[{ label: 'HR' }, { label: 'Payroll', href: '/hr/payroll' }, { label: `${payroll.month_name} ${payroll.year}` }]}
          actions={
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <Badge variant={(STATUS_VARIANT[payroll.status] as import('@/components/ui/Badge').BadgeProps['variant']) || 'default'}>{payroll.status.toUpperCase()}</Badge>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  const url = hrPayrollApi.payslipUrl(payroll.id);
                  window.open(url, '_blank', 'noopener,noreferrer');
                }}
              >
                Download Payslip
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  const url = hrPayrollApi.salaryCertificateUrl(payroll.id);
                  window.open(url, '_blank', 'noopener,noreferrer');
                }}
              >
                Salary Certificate
              </Button>
              {isAdmin && payroll.status === 'processed' && (
                <Button variant="primary" size="sm" onClick={handleMarkPaid} isLoading={markPaidMutation.isPending}>
                  Mark as Paid
                </Button>
              )}
            </div>
          }
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', maxWidth: '56rem' }}>

          {/* ── Employee + period meta ─────────────────────────────────── */}
          <div style={{ ...CARD, display: 'flex', flexWrap: 'wrap', gap: 'var(--space-5)', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <div style={{
                width: 46, height: 46, borderRadius: '50%', flexShrink: 0,
                background: 'var(--brand)', color: 'var(--primary-foreground)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-lg)',
              }}>{(payroll.employee_name || '?').trim().slice(0, 1).toUpperCase()}</div>
              <div>
                <p style={{ margin: 0, fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-md)' }}>{payroll.employee_name}</p>
                <p style={{ margin: '2px 0 0', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', ...MONO }}>{payroll.employee_id_code}</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-6)', flexWrap: 'wrap' }}>
              <div>
                <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pay Period</p>
                <p style={{ margin: '3px 0 0', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)' }}>
                  {payroll.period_start && payroll.period_end
                    ? `${fmtDate(payroll.period_start)} → ${fmtDate(payroll.period_end)}`
                    : `${payroll.month_name} ${payroll.year}`}
                </p>
              </div>
              {payroll.paid_at && (
                <div>
                  <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Paid On</p>
                  <p style={{ margin: '3px 0 0', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)' }}>{fmtDate(payroll.paid_at)}</p>
                </div>
              )}
            </div>
          </div>

          {/* ── KPI hero ────────────────────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-4)' }}>
            <KpiCard label="Gross Salary" value={fmt(payroll.gross_salary)} tone="neutral" />
            <KpiCard label="Total Deductions" value={`-${fmt(Math.max(0, num(payroll.gross_salary) - num(payroll.net_salary)))}`} tone="error" />
            <KpiCard label="Net Pay" value={fmt(payroll.net_salary)} tone="net" />
          </div>

          {/* ── Earnings + Deductions ───────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-4)', alignItems: 'start' }}>

            {/* Earnings */}
            <div style={CARD}>
              <p style={SECTION_TITLE}>Earnings</p>
              {([
                ['Basic Salary',        payroll.basic_salary],
                ['Housing Allowance',   payroll.housing_allowance],
                ['Transport Allowance', payroll.transport_allowance],
                ['Other Allowances',    payroll.other_allowances],
                ['Overtime',            payroll.overtime_amount],
              ] as [string, string | number][]).map(([label, value]) => (
                <div key={label} style={ROW}>
                  <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                  <span style={{ ...MONO, color: num(value) > 0 ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>{fmt(value)}</span>
                </div>
              ))}

              {/* Leave encashment (expandable) */}
              {(() => {
                const encAmount = num(payroll.leave_encashment);
                const encRows   = payroll.approved_encashments ?? [];
                const hasEnc    = encRows.length > 0;
                if (encAmount <= 0 && !hasEnc) return null;
                return (
                  <>
                    <div onClick={() => hasEnc && setEncashmentExpanded(o => !o)} style={{ ...ROW, cursor: hasEnc ? 'pointer' : 'default' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)' }}>
                        {hasEnc && <span style={CHEVRON(encashmentExpanded)}>▶</span>}
                        Leave Encashment {hasEnc && <span style={{ color: 'var(--text-tertiary)' }}>({encRows.length})</span>}
                      </span>
                      <span style={{ ...MONO, color: encAmount > 0 ? 'var(--status-success)' : 'var(--text-tertiary)' }}>{encAmount > 0 ? `+${fmt(payroll.leave_encashment)}` : '—'}</span>
                    </div>
                    {encashmentExpanded && hasEnc && (
                      <div style={{ marginInlineStart: 14, borderInlineStart: '2px solid var(--border-subtle)', paddingInlineStart: 10, display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 4 }}>
                        {encRows.map(e => (
                          <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', gap: 8 }}>
                            <span style={{ color: 'var(--text-tertiary)' }}>{e.leave_type === 'annual_leave' ? 'Annual' : 'Sick'} · {e.days_encashed}d × {parseFloat(e.rate_per_day).toFixed(2)}</span>
                            <span style={{ ...MONO, color: 'var(--status-success)', flexShrink: 0 }}>+{fmt(e.encashment_amount)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                );
              })()}

              <div style={{ ...ROW, borderTop: '1px solid var(--border-subtle)', marginTop: 'var(--space-2)', paddingTop: 'var(--space-3)', fontWeight: 'var(--weight-bold)' }}>
                <span>Gross Salary</span>
                <span style={MONO}>{fmt(payroll.gross_salary)}</span>
              </div>
            </div>

            {/* Deductions */}
            <div style={CARD}>
              <p style={SECTION_TITLE}>Deductions</p>

              <div style={ROW}>
                <span style={{ color: 'var(--text-secondary)' }}>General Deductions</span>
                <span style={{ ...MONO, color: num(payroll.deductions) > 0 ? 'var(--status-error)' : 'var(--text-tertiary)' }}>{num(payroll.deductions) > 0 ? `-${fmt(payroll.deductions)}` : '—'}</span>
              </div>

              <div style={ROW}>
                <span style={{ color: 'var(--text-secondary)' }}>Absence Deduction</span>
                <span style={{ ...MONO, color: num(payroll.absence_deduction) > 0 ? 'var(--status-error)' : 'var(--text-tertiary)' }}>{num(payroll.absence_deduction) > 0 ? `-${fmt(payroll.absence_deduction)}` : '—'}</span>
              </div>
              {num(payroll.partial_deduct_days) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', paddingInlineStart: 'var(--space-3)' }}>
                  <span>↳ WFH / partial days · أيام جزئية</span>
                  <span style={MONO}>{num(payroll.partial_deduct_days)} d</span>
                </div>
              )}

              {/* Penalty (expandable) */}
              {(() => {
                const penaltyAmount = num(payroll.penalty_deduction);
                const hasPenalties  = (payroll.confirmed_penalties ?? []).length > 0;
                return (
                  <>
                    <div onClick={() => hasPenalties && setPenaltyExpanded(o => !o)} style={{ ...ROW, cursor: hasPenalties ? 'pointer' : 'default' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)' }}>
                        {hasPenalties && <span style={CHEVRON(penaltyExpanded)}>▶</span>}
                        Penalty Deductions {hasPenalties && <span style={{ color: 'var(--text-tertiary)' }}>({payroll.confirmed_penalties.length})</span>}
                      </span>
                      <span style={{ ...MONO, color: penaltyAmount > 0 ? 'var(--status-error)' : 'var(--text-tertiary)' }}>{penaltyAmount > 0 ? `-${fmt(payroll.penalty_deduction)}` : '—'}</span>
                    </div>
                    {penaltyExpanded && hasPenalties && (
                      <div style={{ marginInlineStart: 14, borderInlineStart: '2px solid var(--border-subtle)', paddingInlineStart: 10, display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 4 }}>
                        {payroll.confirmed_penalties.map(p => (
                          <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', gap: 8 }}>
                            <span style={{ color: 'var(--text-tertiary)' }}>{p.date}{p.tier_label ? ` · ${p.tier_label}` : ''} ({p.minutes_evaluated}m)</span>
                            <span style={{ ...MONO, color: 'var(--status-error)', flexShrink: 0 }}>-{fmt(p.amount)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                );
              })()}

              {/* Loan (expandable) */}
              {(() => {
                const loanAmount = num(payroll.loan_deduction);
                const hasLoans   = (payroll.loan_installments ?? []).length > 0;
                return (
                  <>
                    <div onClick={() => hasLoans && setLoanExpanded(o => !o)} style={{ ...ROW, cursor: hasLoans ? 'pointer' : 'default' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)' }}>
                        {hasLoans && <span style={CHEVRON(loanExpanded)}>▶</span>}
                        Loan Deductions {hasLoans && <span style={{ color: 'var(--text-tertiary)' }}>({payroll.loan_installments.length})</span>}
                      </span>
                      <span style={{ ...MONO, color: loanAmount > 0 ? 'var(--status-error)' : 'var(--text-tertiary)' }}>{loanAmount > 0 ? `-${fmt(payroll.loan_deduction)}` : '—'}</span>
                    </div>
                    {loanExpanded && hasLoans && (
                      <div style={{ marginInlineStart: 14, borderInlineStart: '2px solid var(--border-subtle)', paddingInlineStart: 10, display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 4 }}>
                        {payroll.loan_installments.map(inst => (
                          <div key={inst.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', gap: 8 }}>
                            <span style={{ color: 'var(--text-tertiary)' }}>{inst.loan_notes || `Loan #${inst.loan_id}`} · rem {fmt(inst.loan_remaining)}</span>
                            <span style={{ ...MONO, color: 'var(--status-error)', flexShrink: 0 }}>-{fmt(inst.amount)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                );
              })()}

              <div style={{ ...ROW, borderTop: '1px solid var(--border-subtle)', marginTop: 'var(--space-2)', paddingTop: 'var(--space-3)', fontWeight: 'var(--weight-bold)' }}>
                <span>Total Deductions</span>
                <span style={{ ...MONO, color: 'var(--status-error)' }}>-{fmt(Math.max(0, num(payroll.gross_salary) - num(payroll.net_salary)))}</span>
              </div>
            </div>
          </div>

          {/* ── Attendance ──────────────────────────────────────────────── */}
          <div style={CARD}>
            <p style={SECTION_TITLE}>Attendance Summary</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: 'var(--space-3)' }}>
              {([
                ['Working Days', payroll.working_days, 'var(--text-primary)'],
                ['Present',      payroll.present_days, 'var(--status-success)'],
                ['Leave',        payroll.leave_days,   'var(--status-warning)'],
                ['Absent',       payroll.absent_days,  'var(--status-error)'],
              ] as [string, number, string][]).map(([label, value, color]) => (
                <div key={label} style={{
                  textAlign: 'center', padding: 'var(--space-3) var(--space-2)',
                  background: 'var(--surface-subtle)', borderRadius: 'var(--radius-md)',
                }}>
                  <p style={{ ...MONO, fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-bold)', margin: 0, color }}>{value ?? 0}</p>
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: '4px 0 0' }}>{label}</p>
                </div>
              ))}
            </div>
          </div>

          {payroll.notes && (
            <div style={CARD}>
              <p style={SECTION_TITLE}>Notes</p>
              <p style={{ fontSize: 'var(--text-sm)', margin: 0, color: 'var(--text-secondary)' }}>{payroll.notes}</p>
            </div>
          )}
        </div>
      </PageShell>
    </MainLayout>
  );
}
