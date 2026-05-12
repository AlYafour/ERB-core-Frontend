'use client';

import { use } from 'react';
import Link from 'next/link';
import MainLayout from '@/components/layout/MainLayout';
import { useQuery } from '@tanstack/react-query';
import { customersApi } from '@/lib/api/customers';
import { useT } from '@/lib/i18n/useT';
import { Button, Badge, Loader, PageHeader, PageShell } from '@/components/ui';

const TYPE_BADGE: Record<string, 'info' | 'warning' | 'default'> = {
  owner:      'info',
  commercial: 'warning',
  consultant: 'default',
};

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex gap-2 py-1.5" style={{ borderBottom: '1px solid var(--border)' }}>
      <span className="w-40 flex-shrink-0 text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
        {label}
      </span>
      <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{value}</span>
    </div>
  );
}

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useT();

  const { data: customer, isLoading, error } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => customersApi.getOne(Number(id)),
  });

  return (
    <MainLayout>
      <PageShell>
        <PageHeader
          title="Customer Details"
          breadcrumbs={[{ label: 'Customers', href: '/customers' }, { label: 'Details' }]}
        />

        {isLoading ? (
          <div className="card text-center py-12">
            <Loader className="mx-auto mb-4" />
            <p style={{ color: 'var(--text-secondary)' }}>{t('btn', 'loading')}</p>
          </div>
        ) : error || !customer ? (
          <div className="card text-center py-12">
            <p className="text-destructive">Customer not found or failed to load.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Summary card */}
            <div className="card flex flex-col items-center text-center gap-3">
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold"
                style={{ background: 'var(--sidebar-active-bg)', color: 'var(--sidebar-active-text)' }}
              >
                {(customer.full_name_english || '?')[0].toUpperCase()}
              </div>
              <div>
                <p className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {customer.full_name_english}
                </p>
                {customer.full_name_arabic && (
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {customer.full_name_arabic}
                  </p>
                )}
                {customer.code && (
                  <p className="text-xs font-mono mt-1" style={{ color: 'var(--text-tertiary)' }}>
                    #{customer.code}
                  </p>
                )}
              </div>
              <Badge variant={TYPE_BADGE[customer.customer_type] ?? 'default'}>
                {customer.customer_type}
              </Badge>
              {customer.delete_requested && (
                <Badge variant="error">Delete Requested</Badge>
              )}
            </div>

            {/* Right: Details */}
            <div className="lg:col-span-2 space-y-4">
              <div className="card">
                <h2 className="text-base font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
                  Contact Information
                </h2>
                <InfoRow label="Email"           value={customer.email} />
                <InfoRow label="Telephone"       value={customer.telephone_number} />
                <InfoRow label="WhatsApp"        value={customer.whatsapp_number} />
                <InfoRow label="Language"        value={customer.preferred_language} />
              </div>

              <div className="card">
                <h2 className="text-base font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
                  General Information
                </h2>
                <InfoRow label="Customer Type"  value={customer.customer_type} />
                <InfoRow label="Status"         value={customer.status} />
              </div>

              <div className="flex gap-2">
                <Link href="/customers">
                  <Button variant="secondary">{t('btn', 'back')}</Button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </PageShell>
    </MainLayout>
  );
}
