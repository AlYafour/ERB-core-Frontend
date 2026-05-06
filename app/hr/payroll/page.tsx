'use client';

import { useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { hrPayrollApi } from '@/lib/api/hr';
import { HRPayroll } from '@/types';
import { toast } from '@/lib/hooks/use-toast';
import { confirm } from '@/lib/hooks/use-toast';
import { useAuth } from '@/lib/hooks/use-auth';
import FilterPanel, { FilterField } from '@/components/ui/FilterPanel';
import FilterTags from '@/components/ui/FilterTags';
import { Button, TextField, Badge, Loader } from '@/components/ui';
import { useT } from '@/lib/i18n/useT';

const statusColors: Record<string, string> = {
  draft:     'badge-default',
  processed: 'badge-info',
  paid:      'badge-success',
};

const statusLabels: Record<string, string> = {
  draft:     'Draft',
  processed: 'Processed',
  paid:      'Paid',
};

const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function formatCurrency(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '—';
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function HRPayrollPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Record<string, any>>({});
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const t = useT();
  const isAdmin = user?.role === 'super_admin' || user?.is_staff || user?.is_superuser;

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => ({
    value: String(currentYear - i),
    label: String(currentYear - i),
  }));

  const { data, isLoading, error } = useQuery({
    queryKey: ['hr-payroll', page, search, filters],
    queryFn: () => hrPayrollApi.getAll({ page, search, ...filters }),
  });

  const filterFields: FilterField[] = [
    {
      name: 'status',
      label: 'Status',
      type: 'select',
      group: 'Filters',
      options: [
        { value: 'draft',     label: 'Draft' },
        { value: 'processed', label: 'Processed' },
        { value: 'paid',      label: 'Paid' },
      ],
    },
    {
      name: 'month',
      label: 'Month',
      type: 'select',
      group: 'Period',
      options: MONTH_NAMES.slice(1).map((name, i) => ({ value: String(i + 1), label: name })),
    },
    {
      name: 'year',
      label: 'Year',
      type: 'select',
      group: 'Period',
      options: yearOptions,
    },
  ];

  const markPaidMutation = useMutation({
    mutationFn: (id: number) => hrPayrollApi.markPaid(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-payroll'] });
      toast('Payroll marked as paid', 'success');
    },
    onError: () => toast('Failed to mark as paid', 'error'),
  });

  const handleMarkPaid = async (id: number, employeeName: string, monthName: string) => {
    const confirmed = await confirm(`Mark payroll for ${employeeName} (${monthName}) as paid?`);
    if (confirmed) markPaidMutation.mutate(id);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">{t('page', 'hrPayroll')}</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage employee payroll records</p>
          </div>
        </div>

        {/* Search + Filters */}
        <div className="card flex items-center gap-4">
          <TextField
            type="text"
            placeholder="Search by employee name or ID..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="flex-1 max-w-md"
          />
          <FilterPanel
            fields={filterFields}
            filters={filters}
            onFilterChange={(f) => { setFilters(f); setPage(1); }}
            onReset={() => { setFilters({}); setPage(1); }}
            saveKey="hr-payroll"
          />
        </div>

        {Object.keys(filters).length > 0 && (
          <FilterTags
            filters={filters}
            fields={filterFields}
            onRemoveFilter={(k) => {
              const f = { ...filters };
              delete f[k];
              setFilters(f);
              setPage(1);
            }}
            onClearAll={() => { setFilters({}); setPage(1); }}
          />
        )}

        {/* Content */}
        {isLoading ? (
          <div className="card text-center py-12">
            <Loader className="mx-auto mb-4" />
            <p className="text-muted-foreground">{t('btn', 'loading')}</p>
          </div>
        ) : error ? (
          <div className="card border-destructive bg-destructive/10">
            <p className="text-destructive text-sm">Error loading payroll records.</p>
          </div>
        ) : !data?.results?.length ? (
          <div className="card text-center py-12">
            <p className="text-muted-foreground">{t('empty', 'noPayroll')}</p>
          </div>
        ) : (
          <>
            <div className="card p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table>
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Period</th>
                      <th>Basic Salary</th>
                      <th>Gross Salary</th>
                      <th>Deductions</th>
                      <th>Net Salary</th>
                      <th>Days</th>
                      <th>Status</th>
                      {isAdmin && <th>{t('col', 'actions')}</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {data.results.map((payroll: HRPayroll) => (
                      <tr key={payroll.id}>
                        <td>
                          <div>
                            <div className="font-medium text-foreground">{payroll.employee_name}</div>
                            <div className="text-xs text-muted-foreground font-mono">{payroll.employee_id_code}</div>
                          </div>
                        </td>
                        <td>
                          <div>
                            <div className="font-medium text-foreground">
                              {payroll.month_name || MONTH_NAMES[payroll.month]}
                            </div>
                            <div className="text-xs text-muted-foreground">{payroll.year}</div>
                          </div>
                        </td>
                        <td>
                          <span className="text-sm text-foreground font-mono">
                            AED {formatCurrency(payroll.basic_salary)}
                          </span>
                        </td>
                        <td>
                          <span className="text-sm text-foreground font-mono font-medium">
                            AED {formatCurrency(payroll.gross_salary)}
                          </span>
                        </td>
                        <td>
                          <span className="text-sm text-destructive font-mono">
                            {parseFloat(payroll.deductions) > 0 || parseFloat(payroll.absence_deduction) > 0
                              ? `AED ${formatCurrency(
                                  (parseFloat(payroll.deductions) + parseFloat(payroll.absence_deduction)).toString()
                                )}`
                              : '—'}
                          </span>
                        </td>
                        <td>
                          <span className="text-sm font-semibold text-foreground font-mono">
                            AED {formatCurrency(payroll.net_salary)}
                          </span>
                        </td>
                        <td>
                          <div className="text-sm text-foreground">
                            <span className="text-green-600">{payroll.present_days}P</span>
                            {' / '}
                            <span className="text-red-500">{payroll.absent_days}A</span>
                            {' / '}
                            <span className="text-muted-foreground">{payroll.working_days}W</span>
                          </div>
                        </td>
                        <td>
                          <Badge className={statusColors[payroll.status] || 'badge-default'}>
                            {statusLabels[payroll.status] || payroll.status}
                          </Badge>
                        </td>
                        {isAdmin && (
                          <td>
                            <div className="flex items-center gap-2">
                              {payroll.status === 'processed' && (
                                <Button
                                  variant="success"
                                  size="sm"
                                  onClick={() => handleMarkPaid(
                                    payroll.id,
                                    payroll.employee_name,
                                    payroll.month_name || MONTH_NAMES[payroll.month]
                                  )}
                                  disabled={markPaidMutation.isPending}
                                >
                                  Mark Paid
                                </Button>
                              )}
                              {payroll.status === 'paid' && payroll.paid_at && (
                                <span className="text-xs text-muted-foreground">
                                  {new Date(payroll.paid_at).toLocaleDateString('en-US', {
                                    year: 'numeric', month: 'short', day: 'numeric',
                                  })}
                                </span>
                              )}
                              {payroll.status === 'draft' && (
                                <span className="text-xs text-muted-foreground">Not processed</span>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {data.count > 50 && (
              <div className="flex items-center justify-between card">
                <p className="text-sm text-muted-foreground">
                  {t('misc', 'showing')} {((page - 1) * 50) + 1} {t('misc', 'pageTo')} {Math.min(page * 50, data.count)} {t('misc', 'pageOf')} {data.count}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={!data.previous}
                  >
                    {t('btn', 'previous')}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => setPage(p => p + 1)}
                    disabled={!data.next}
                  >
                    {t('btn', 'next')}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </MainLayout>
  );
}
