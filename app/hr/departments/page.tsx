'use client';

import { useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { hrDepartmentsApi } from '@/lib/api/hr';
import { HRDepartment } from '@/types';
import { toast } from '@/lib/hooks/use-toast';
import { confirm } from '@/lib/hooks/use-toast';
import { useAuth } from '@/lib/hooks/use-auth';
import { Button, TextField, Loader } from '@/components/ui';
import { useT } from '@/lib/i18n/useT';

export default function HRDepartmentsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const t = useT();
  const isAdmin = user?.role === 'super_admin' || user?.is_staff || user?.is_superuser;

  const { data, isLoading, error } = useQuery({
    queryKey: ['hr-departments', page, search],
    queryFn: () => hrDepartmentsApi.getAll({ page, search }),
  });

  const deleteMutation = useMutation({
    mutationFn: hrDepartmentsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-departments'] });
      toast('Department deleted', 'success');
    },
    onError: () => toast('Failed to delete department', 'error'),
  });

  const handleDelete = async (id: number) => {
    const ok = await confirm('Delete this department?');
    if (ok) deleteMutation.mutate(id);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">{t('page', 'hrDepartments')}</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage company departments</p>
          </div>
        </div>

        {/* Search */}
        <div className="card flex items-center gap-4">
          <TextField
            type="text"
            placeholder="Search departments..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="flex-1 max-w-md"
          />
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="card text-center py-12">
            <Loader className="mx-auto mb-4" />
            <p className="text-muted-foreground">{t('btn', 'loading')}</p>
          </div>
        ) : error ? (
          <div className="card border-destructive bg-destructive/10">
            <p className="text-destructive text-sm">Error loading departments.</p>
          </div>
        ) : !data?.results?.length ? (
          <div className="card text-center py-12">
            <p className="text-muted-foreground">No departments found.</p>
          </div>
        ) : (
          <>
            <div className="card p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Name (AR)</th>
                      <th>Manager</th>
                      <th>Parent Department</th>
                      <th>Employees</th>
                      {isAdmin && <th>{t('col', 'actions')}</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {data.results.map((dept: HRDepartment) => (
                      <tr key={dept.id}>
                        <td>
                          <div className="font-medium text-foreground">{dept.name}</div>
                          {dept.description && (
                            <div className="text-xs text-muted-foreground mt-0.5 max-w-xs truncate">{dept.description}</div>
                          )}
                        </td>
                        <td>
                          <div className="text-foreground">{dept.name_ar || '—'}</div>
                        </td>
                        <td>
                          <div className="text-sm text-foreground">{dept.manager_name || '—'}</div>
                        </td>
                        <td>
                          <div className="text-sm text-muted-foreground">{dept.parent_name || '—'}</div>
                        </td>
                        <td>
                          <span className="font-semibold text-foreground">{dept.employee_count}</span>
                        </td>
                        {isAdmin && (
                          <td>
                            <Button
                              variant="delete"
                              size="sm"
                              onClick={() => handleDelete(dept.id)}
                              disabled={deleteMutation.isPending}
                            >
                              {t('btn', 'delete')}
                            </Button>
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
