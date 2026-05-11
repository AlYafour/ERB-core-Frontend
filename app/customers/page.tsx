'use client';

import { useState } from 'react';
import Link from 'next/link';
import MainLayout from '@/components/layout/MainLayout';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customersApi, Customer } from '@/lib/api/customers';
import { useAuth } from '@/lib/hooks/use-auth';
import { useT } from '@/lib/i18n/useT';
import { toast } from '@/lib/hooks/use-toast';
import { confirm } from '@/lib/hooks/use-toast';
import { Button, TextField, Badge, Loader } from '@/components/ui';

const TYPE_BADGE: Record<string, 'info' | 'warning' | 'default'> = {
  owner:      'info',
  commercial: 'warning',
  consultant: 'default',
};

const TYPE_LABEL: Record<string, string> = {
  owner:      'Owner / مالك',
  commercial: 'Commercial / تجاري',
  consultant: 'Consultant / استشاري',
};

export default function CustomersPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const t = useT();
  const isSuperuser = user?.is_superuser ?? false;

  const { data, isLoading, error } = useQuery({
    queryKey: ['customers', page, search, typeFilter],
    queryFn: () => customersApi.getAll({ page, search: search || undefined, customer_type: typeFilter || undefined }),
  });

  const deleteMutation = useMutation({
    mutationFn: customersApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast('Customer deleted', 'success');
    },
    onError: () => toast('Failed to delete customer', 'error'),
  });

  const handleDelete = async (id: number) => {
    const ok = await confirm('Are you sure you want to delete this customer?');
    if (ok) deleteMutation.mutate(id);
  };

  const customers: Customer[] = data?.results || [];

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
              {t('nav', 'customers')}
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              {t('page', 'customersSubtitle')}
            </p>
          </div>
          <Link href="/customers/new">
            <Button variant="primary">{t('btn', 'addCustomer')}</Button>
          </Link>
        </div>

        {/* Search & Filter */}
        <div className="card flex flex-wrap items-center gap-3">
          <TextField
            type="text"
            placeholder="Search by name, email, phone..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="flex-1 min-w-48"
          />
          <select
            className="rounded-md border px-3 py-2 text-sm"
            style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text-primary)' }}
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
          >
            <option value="">All Types</option>
            <option value="owner">Owner / مالك</option>
            <option value="commercial">Commercial / تجاري</option>
            <option value="consultant">Consultant / استشاري</option>
          </select>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="card text-center py-12">
            <Loader className="mx-auto mb-4" />
            <p style={{ color: 'var(--text-secondary)' }}>{t('btn', 'loading')}</p>
          </div>
        ) : error ? (
          <div className="card border-destructive bg-destructive/10 text-center py-8">
            <p className="text-destructive text-sm font-medium">
              Could not connect to the Customers backend. Make sure the CLIENT backend is running at the configured URL.
            </p>
          </div>
        ) : customers.length === 0 ? (
          <div className="card text-center py-12">
            <p style={{ color: 'var(--text-secondary)' }}>No customers found.</p>
            <Link href="/customers/new" className="mt-3 inline-block">
              <Button variant="primary">{t('btn', 'addCustomer')}</Button>
            </Link>
          </div>
        ) : (
          <>
            <div className="card p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table>
                  <thead>
                    <tr>
                      <th>{t('col', 'code')}</th>
                      <th>{t('col', 'name')}</th>
                      <th>Type</th>
                      <th>{t('col', 'email')}</th>
                      <th>{t('col', 'phone')}</th>
                      <th>{t('col', 'status')}</th>
                      <th>{t('col', 'actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.map((c) => (
                      <tr key={c.id} style={c.delete_requested ? { opacity: 0.6 } : {}}>
                        <td>
                          <span className="text-xs font-mono" style={{ color: 'var(--text-tertiary)' }}>
                            {c.code || '—'}
                          </span>
                        </td>
                        <td>
                          <div className="font-medium" style={{ color: 'var(--text-primary)' }}>
                            {c.full_name_english}
                          </div>
                          {c.full_name_arabic && (
                            <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                              {c.full_name_arabic}
                            </div>
                          )}
                        </td>
                        <td>
                          <Badge variant={TYPE_BADGE[c.customer_type] ?? 'default'}>
                            {TYPE_LABEL[c.customer_type] || c.customer_type}
                          </Badge>
                        </td>
                        <td>
                          <span style={{ color: 'var(--text-secondary)' }}>{c.email || '—'}</span>
                        </td>
                        <td>
                          <span style={{ color: 'var(--text-secondary)' }}>{c.telephone_number || c.whatsapp_number || '—'}</span>
                        </td>
                        <td>
                          {c.delete_requested ? (
                            <Badge variant="error">Delete Requested</Badge>
                          ) : (
                            <Badge variant="success">Active</Badge>
                          )}
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <Link href={`/customers/${c.id}`}>
                              <Button variant="view" size="sm">{t('btn', 'view')}</Button>
                            </Link>
                            {isSuperuser && (
                              <Button
                                variant="delete"
                                size="sm"
                                onClick={() => handleDelete(c.id)}
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

            {/* Pagination */}
            {data && data.count > 20 && (
              <div className="flex items-center justify-between card">
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {((page - 1) * 20) + 1}–{Math.min(page * 20, data.count)} of {data.count} customers
                </p>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={!data.previous}>
                    {t('btn', 'previous')}
                  </Button>
                  <Button variant="secondary" onClick={() => setPage(p => p + 1)} disabled={!data.next}>
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
