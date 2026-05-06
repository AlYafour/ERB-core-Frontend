'use client';

import { useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { hrEmployeesApi } from '@/lib/api/hr';
import { HREmployee } from '@/types';
import Link from 'next/link';
import { toast } from '@/lib/hooks/use-toast';
import { confirm } from '@/lib/hooks/use-toast';
import { useAuth } from '@/lib/hooks/use-auth';
import FilterPanel, { FilterField } from '@/components/ui/FilterPanel';
import FilterTags from '@/components/ui/FilterTags';
import { Button, TextField, Badge, Loader } from '@/components/ui';
import { useT } from '@/lib/i18n/useT';

const employmentTypeColors: Record<string, string> = {
  full_time: 'badge-success',
  part_time: 'badge-warning',
  contract: 'badge-info',
  intern: 'badge-default',
};

const employmentTypeLabels: Record<string, string> = {
  full_time: 'Full Time',
  part_time: 'Part Time',
  contract: 'Contract',
  intern: 'Intern',
};

export default function HREmployeesPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Record<string, any>>({});
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const t = useT();
  const isAdmin = user?.role === 'super_admin' || user?.is_staff || user?.is_superuser;

  const { data, isLoading, error } = useQuery({
    queryKey: ['hr-employees', page, search, filters],
    queryFn: () => hrEmployeesApi.getAll({ page, search, ...filters }),
  });

  const filterFields: FilterField[] = [
    {
      name: 'employment_type',
      label: 'Employment Type',
      type: 'select',
      group: 'Filters',
      options: [
        { value: 'full_time', label: 'Full Time' },
        { value: 'part_time', label: 'Part Time' },
        { value: 'contract', label: 'Contract' },
        { value: 'intern', label: 'Intern' },
      ],
    },
    {
      name: 'is_active',
      label: 'Status',
      type: 'select',
      group: 'Filters',
      options: [
        { value: 'true', label: 'Active' },
        { value: 'false', label: 'Inactive' },
      ],
    },
    { name: 'join_date_after',  label: 'Joined From', type: 'date', group: 'Dates' },
    { name: 'join_date_before', label: 'Joined To',   type: 'date', group: 'Dates' },
  ];

  const deleteMutation = useMutation({
    mutationFn: hrEmployeesApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-employees'] });
      toast('Employee deleted', 'success');
    },
    onError: () => toast('Failed to delete employee', 'error'),
  });

  const handleDelete = async (id: number) => {
    const confirmed = await confirm('Delete this employee record?');
    if (confirmed) deleteMutation.mutate(id);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">{t('page', 'hrEmployees')}</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage company employees</p>
          </div>
          {isAdmin && (
            <Link href="/hr/employees/new">
              <Button variant="primary">New Employee</Button>
            </Link>
          )}
        </div>

        {/* Search + Filters */}
        <div className="card flex items-center gap-4">
          <TextField
            type="text"
            placeholder="Search employees..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="flex-1 max-w-md"
          />
          <FilterPanel
            fields={filterFields}
            filters={filters}
            onFilterChange={(f) => { setFilters(f); setPage(1); }}
            onReset={() => { setFilters({}); setPage(1); }}
            saveKey="hr-employees"
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
            <p className="text-destructive text-sm">Error loading employees.</p>
          </div>
        ) : !data?.results?.length ? (
          <div className="card text-center py-12">
            <p className="text-muted-foreground">{t('empty', 'noEmployees')}</p>
          </div>
        ) : (
          <>
            <div className="card p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Name</th>
                      <th>Department</th>
                      <th>Position</th>
                      <th>Type</th>
                      <th>Join Date</th>
                      <th>Status</th>
                      <th>{t('col', 'actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.results.map((emp: HREmployee) => (
                      <tr key={emp.id}>
                        <td>
                          <span className="font-mono text-sm font-medium">{emp.employee_id}</span>
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            {emp.avatar ? (
                              <img src={emp.avatar} alt="" className="w-7 h-7 rounded-full object-cover" />
                            ) : (
                              <div
                                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                                style={{ backgroundColor: 'var(--sidebar-active-bg)', color: 'var(--sidebar-active-text)' }}
                              >
                                {(emp.full_name || emp.email || '?')[0].toUpperCase()}
                              </div>
                            )}
                            <div>
                              <div className="font-medium text-foreground">{emp.full_name}</div>
                              <div className="text-xs text-muted-foreground">{emp.email}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="text-sm text-foreground">{emp.department_name || '—'}</span>
                        </td>
                        <td>
                          <span className="text-sm text-foreground">{emp.position_title || '—'}</span>
                        </td>
                        <td>
                          <Badge className={employmentTypeColors[emp.employment_type] || 'badge-default'}>
                            {employmentTypeLabels[emp.employment_type] || emp.employment_type}
                          </Badge>
                        </td>
                        <td>
                          <span className="text-sm text-muted-foreground">
                            {new Date(emp.join_date).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        </td>
                        <td>
                          <Badge className={emp.is_active ? 'badge-success' : 'badge-error'}>
                            {emp.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <Link href={`/hr/employees/${emp.id}`}>
                              <Button variant="view" size="sm">{t('btn', 'view')}</Button>
                            </Link>
                            {isAdmin && (
                              <Button
                                variant="delete"
                                size="sm"
                                onClick={() => handleDelete(emp.id)}
                                disabled={deleteMutation.isPending}
                              >
                                {t('btn', 'delete')}
                              </Button>
                            )}
                          </div>
                        </td>
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
