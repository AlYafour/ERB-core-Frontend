'use client';

import Link from 'next/link';
import MainLayout from '@/components/layout/MainLayout';
import CustomerFormWizard from '@/components/customers/CustomerFormWizard';
import { useT } from '@/lib/i18n/useT';
import { Button } from '@/components/ui';

export default function NewCustomerPage() {
  const t = useT();
  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
              {t('page', 'newCustomer')}
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              {t('page', 'newCustomerSubtitle')}
            </p>
          </div>
          <Link href="/customers">
            <Button variant="secondary">{t('btn', 'back')}</Button>
          </Link>
        </div>

        <CustomerFormWizard />
      </div>
    </MainLayout>
  );
}
