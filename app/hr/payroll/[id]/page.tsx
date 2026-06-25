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
          description={`${payroll.employee_name} — ${payroll.employee_id_code}`}
          breadcrumbs={[{ label: 'HR' }, { label: 'Payroll', href: '/hr/payroll' }, { label: `${payroll.month_name} ${payroll.year}` }]}
          actions={
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <Badge variant={(STATUS_VARIANT[payroll.status] as string | undefined) || 'default'}>{payroll.status.toUpperCase()}</Badge>
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

        <div className="card" style={{ maxWidth: '42rem', display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          {payroll.paid_at && (
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0 }}>Paid {new Date(payroll.paid_at).toLocaleDateString()}</p>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <p style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', margin: 0 }}>Earnings</p>
            {[
              ['Basic Salary',       payroll.basic_salary],
              ['Housing Allowance',  payroll.housing_allowance],
              ['Transport Allowance',payroll.transport_allowance],
              ['Other Allowances',   payroll.other_allowances],
              ['Overtime',           payroll.overtime_amount],
            ].map(([label, value]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                <span>{fmt(value)}</span>
              </div>
            ))}

            {/* Leave Encashment earning — expandable when approved_encashments exist */}
            {(() => {
              const encAmount  = parseFloat(payroll.leave_encashment ?? '0');
              const encRows    = payroll.approved_encashments ?? [];
              const hasEnc     = encRows.length > 0;

              return (
                <>
                  {(encAmount > 0 || hasEnc) && (
                    <div
                      onClick={() => hasEnc && setEncashmentExpanded(o => !o)}
                      style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        fontSize: 'var(--text-sm)',
                        cursor: hasEnc ? 'pointer' : 'default',
                        borderRadius: 'var(--radius-sm)',
                        padding: hasEnc ? '2px 4px' : undefined,
                        marginLeft: hasEnc ? -4 : undefined,
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-secondary)' }}>
                        {hasEnc && (
                          <span style={{ fontSize: 10, lineHeight: 1, color: 'var(--text-tertiary)', transition: 'transform 0.15s', display: 'inline-block', transform: encashmentExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                        )}
                        Leave Encashment
                        {hasEnc && <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>({encRows.length})</span>}
                      </span>
                      <span style={{ color: encAmount > 0 ? 'var(--color-success)' : 'var(--text-tertiary)' }}>
                        {encAmount > 0 ? `+${fmt(payroll.leave_encashment)}` : '—'}
                      </span>
                    </div>
                  )}

                  {encashmentExpanded && hasEnc && (
                    <div style={{
                      marginLeft: 12, marginTop: -4,
                      borderLeft: '2px solid var(--border-subtle)', paddingLeft: 10,
                      display: 'flex', flexDirection: 'column', gap: 6,
                    }}>
                      {encRows.map(e => (
                        <div key={e.id} style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                          fontSize: 'var(--text-xs)', gap: 8,
                        }}>
                          <span style={{ color: 'var(--text-secondary)' }}>
                            {e.leave_type === 'annual_leave' ? 'Annual Leave' : 'Sick Leave'}
                            <span style={{ color: 'var(--text-tertiary)', marginLeft: 4 }}>
                              · {e.days_encashed} days × AED {parseFloat(e.rate_per_day).toFixed(4)}/day
                            </span>
                          </span>
                          <span style={{ color: 'var(--color-success)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                            +{fmt(e.encashment_amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              );
            })()}

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-2)' }}>
              <span>Gross Salary</span>
              <span>{fmt(payroll.gross_salary)}</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <p style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', margin: 0 }}>Deductions</p>

            {/* Static deduction rows */}
            {[
              ['General Deductions', payroll.deductions],
              ['Absence Deduction',  payroll.absence_deduction],
            ].map(([label, value]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                <span style={{ color: 'var(--color-error)' }}>-{fmt(value)}</span>
              </div>
            ))}

            {/* Penalty deductions — expandable when confirmed penalties exist */}
            {(() => {
              const penaltyAmount = parseFloat(payroll.penalty_deduction ?? '0');
              const hasPenalties  = (payroll.confirmed_penalties ?? []).length > 0;

              return (
                <>
                  <div
                    onClick={() => hasPenalties && setPenaltyExpanded(o => !o)}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      fontSize: 'var(--text-sm)',
                      cursor: hasPenalties ? 'pointer' : 'default',
                      borderRadius: 'var(--radius-sm)',
                      padding: hasPenalties ? '2px 4px' : undefined,
                      marginLeft: hasPenalties ? -4 : undefined,
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-secondary)' }}>
                      {hasPenalties && (
                        <span style={{ fontSize: 10, lineHeight: 1, color: 'var(--text-tertiary)', transition: 'transform 0.15s', display: 'inline-block', transform: penaltyExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                      )}
                      Penalty Deductions
                      {hasPenalties && <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>({payroll.confirmed_penalties.length})</span>}
                    </span>
                    <span style={{ color: penaltyAmount > 0 ? 'var(--color-error)' : 'var(--text-tertiary)' }}>
                      {penaltyAmount > 0 ? `-${fmt(payroll.penalty_deduction)}` : '—'}
                    </span>
                  </div>

                  {penaltyExpanded && hasPenalties && (
                    <div style={{
                      marginLeft: 12, marginTop: -4,
                      borderLeft: '2px solid var(--border-subtle)', paddingLeft: 10,
                      display: 'flex', flexDirection: 'column', gap: 6,
                    }}>
                      {payroll.confirmed_penalties.map(p => (
                        <div key={p.id} style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                          fontSize: 'var(--text-xs)', gap: 8,
                        }}>
                          <span style={{ color: 'var(--text-secondary)' }}>
                            {p.date}
                            {p.rule_name && <> · {p.rule_name}</>}
                            {p.tier_label && <> · {p.tier_label}</>}
                            <span style={{ color: 'var(--text-tertiary)', marginLeft: 4 }}>({p.minutes_evaluated} min late)</span>
                          </span>
                          <span style={{ color: 'var(--color-error)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                            -{fmt(p.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              );
            })()}

            {/* Loan deductions — expandable when loan_installments exist */}
            {(() => {
              const loanAmount = parseFloat(payroll.loan_deduction ?? '0');
              const hasLoans   = (payroll.loan_installments ?? []).length > 0;

              return (
                <>
                  <div
                    onClick={() => hasLoans && setLoanExpanded(o => !o)}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      fontSize: 'var(--text-sm)',
                      cursor: hasLoans ? 'pointer' : 'default',
                      borderRadius: 'var(--radius-sm)',
                      padding: hasLoans ? '2px 4px' : undefined,
                      marginLeft: hasLoans ? -4 : undefined,
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-secondary)' }}>
                      {hasLoans && (
                        <span style={{ fontSize: 10, lineHeight: 1, color: 'var(--text-tertiary)', transition: 'transform 0.15s', display: 'inline-block', transform: loanExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                      )}
                      Loan Deductions
                      {hasLoans && <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>({payroll.loan_installments.length})</span>}
                    </span>
                    <span style={{ color: loanAmount > 0 ? 'var(--color-error)' : 'var(--text-tertiary)' }}>
                      {loanAmount > 0 ? `-${fmt(payroll.loan_deduction)}` : '—'}
                    </span>
                  </div>

                  {loanExpanded && hasLoans && (
                    <div style={{
                      marginLeft: 12, marginTop: -4,
                      borderLeft: '2px solid var(--border-subtle)', paddingLeft: 10,
                      display: 'flex', flexDirection: 'column', gap: 6,
                    }}>
                      {payroll.loan_installments.map(inst => (
                        <div key={inst.id} style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                          fontSize: 'var(--text-xs)', gap: 8,
                        }}>
                          <span style={{ color: 'var(--text-secondary)' }}>
                            {inst.loan_notes || `Loan #${inst.loan_id}`}
                            <span style={{ color: 'var(--text-tertiary)', marginLeft: 4 }}>
                              · remaining {fmt(inst.loan_remaining)}
                            </span>
                          </span>
                          <span style={{ color: 'var(--color-error)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                            -{fmt(inst.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              );
            })()}
          </div>{/* /deductions */}

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-base)', fontWeight: 'var(--weight-bold)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--sidebar-active-bg)', color: 'var(--sidebar-active-text)' }}>
            <span>Net Salary</span>
            <span>{fmt(payroll.net_salary)}</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-3)', borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-4)' }}>
            {[
              ['Working Days', payroll.working_days],
              ['Present', payroll.present_days],
              ['Absent', payroll.absent_days],
              ['Leave', payroll.leave_days],
            ].map(([label, value]) => (
              <div key={label} style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-bold)', margin: 0 }}>{value}</p>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: 'var(--space-1)', marginBottom: 0 }}>{label}</p>
              </div>
            ))}
          </div>

          {payroll.notes && (
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-3)' }}>
              <p style={{ fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', margin: '0 0 var(--space-1) 0' }}>Notes</p>
              <p style={{ fontSize: 'var(--text-sm)', margin: 0 }}>{payroll.notes}</p>
            </div>
          )}
        </div>
      </PageShell>
    </MainLayout>
  );
}
