'use client';

export const dynamic = 'force-dynamic';

import MainLayout from '@/components/layout/MainLayout';
import CustomerFormWizard from '@/components/customers/CustomerFormWizard';
import { useT } from '@/lib/i18n/useT';
import { PageHeader, PageShell } from '@/components/ui';

export default function NewCustomerPage() {
  const t = useT();
  return (
    <MainLayout>
      <PageShell>
        <PageHeader
          title={t('page', 'newCustomer')}
          description={t('page', 'newCustomerSubtitle')}
          breadcrumbs={[{ label: 'Customers', href: '/customers' }, { label: t('page', 'newCustomer') }]}
        />
        <CustomerFormWizard />
      </PageShell>
    </MainLayout>
  );
}
