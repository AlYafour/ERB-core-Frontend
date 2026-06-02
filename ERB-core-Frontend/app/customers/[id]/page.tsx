'use client';

import { use } from 'react';
import Link from 'next/link';
import MainLayout from '@/components/layout/MainLayout';
import { useQuery } from '@tanstack/react-query';
import { customersApi } from '@/lib/api/customers';
import { useT } from '@/lib/i18n/useT';
import { Button, Badge, PageHeader, PageShell } from '@/components/ui';

const TYPE_BADGE: Record<string, 'info' | 'warning' | 'default'> = {
  owner:      'info',
  commercial: 'warning',
  consultant: 'default',
};

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div style={{ display: 'flex', gap: 'var(--space-3)', paddingBlock: 'var(--space-2)', borderBottom: '1px solid var(--border-subtle)' }}>
      <span style={{ width: 160, flexShrink: 0, fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', fontWeight: 'var(--weight-medium)' }}>
        {label}
      </span>
      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>{value}</span>
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
          <div className="card empty-state">
            <p style={{ color: 'var(--text-secondary)' }}>{t('btn', 'loading')}</p>
          </div>
        ) : error || !customer ? (
          <div className="card empty-state">
            <p style={{ color: 'var(--status-error)' }}>Customer not found or failed to load.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 'var(--space-6)', alignItems: 'flex-start' }}>
            {/* Left: Summary card */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 'var(--space-3)' }}>
              <div
                className="av-initials"
                style={{ width: 80, height: 80, fontSize: '1.75rem', background: 'var(--brand)', color: '#fff' }}
              >
                {(customer.full_name_english || '?')[0].toUpperCase()}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                <p style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-primary)', margin: 0 }}>
                  {customer.full_name_english}
                </p>
                {customer.full_name_arabic && (
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0 }}>
                    {customer.full_name_arabic}
                  </p>
                )}
                {customer.code && (
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', fontFamily: 'monospace', margin: 0 }}>
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div className="card">
                <div className="info-section-title">Contact Information</div>
                <InfoRow label="Email"      value={customer.email} />
                <InfoRow label="Telephone"  value={customer.telephone_number} />
                <InfoRow label="WhatsApp"   value={customer.whatsapp_number} />
                <InfoRow label="Language"   value={customer.preferred_language} />
              </div>

              <div className="card">
                <div className="info-section-title">General Information</div>
                <InfoRow label="Customer Type" value={customer.customer_type} />
                <InfoRow label="Status"        value={customer.status} />
              </div>

              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
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
