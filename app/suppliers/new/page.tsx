'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { suppliersApi } from '@/lib/api/suppliers';
import MainLayout from '@/components/layout/MainLayout';
import Link from 'next/link';
import SearchableDropdown from '@/components/ui/SearchableDropdown';
import FormField from '@/components/ui/FormField';
import { PageShell, PageHeader } from '@/components/ui';
import { useT } from '@/lib/i18n/useT';

const currencies = [
  { value: 'AED', label: 'AED - UAE Dirham' },
  { value: 'USD', label: 'USD - US Dollar' },
  { value: 'EUR', label: 'EUR - Euro' },
  { value: 'EGP', label: 'EGP - Egyptian Pound' },
  { value: 'SAR', label: 'SAR - Saudi Riyal' },
];

const countries = [
  'United Arab Emirates',
  'Saudi Arabia',
  'Egypt',
  'United States',
  'United Kingdom',
  'Other',
];

export default function NewSupplierPage() {
  const t = useT();
  const router = useRouter();
  const [formData, setFormData] = useState({
    business_name: '',
    business_name_ar: '',
    supplier_number: '',
    first_name: '',
    last_name: '',
    contact_person: '',
    email: '',
    telephone: '',
    phone: '',
    mobile: '',
    street_address_1: '',
    street_address_2: '',
    city: '',
    state: '',
    postal_code: '',
    country: 'United Arab Emirates',
    tax_id: '',
    trn: '',
    currency: 'AED',
    bank_name: '',
    bank_account: '',
    notes: '',
    is_active: true,
  });

  const mutation = useMutation({
    mutationFn: suppliersApi.create,
    onSuccess: () => {
      router.push('/suppliers');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  return (
    <MainLayout>
      <PageShell>
        <PageHeader
          title={t('page', 'newSupplier')}
          description="Add a new supplier to your network"
          backHref="/suppliers"
          breadcrumbs={[
            { label: t('page', 'suppliers'), href: '/suppliers' },
            { label: t('page', 'newSupplier') },
          ]}
        />

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          {/* Supplier Details */}
          <div className="card">
            <h2 className="section-title">Supplier Details</h2>
            <div className="form-grid">
              <FormField label={t('field', 'businessNameEn')} required>
                <input type="text" required className="form-input"
                  value={formData.business_name}
                  onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
                />
              </FormField>

              <FormField label="اسم الشركة بالعربي">
                <input type="text" className="form-input" dir="rtl" placeholder="اسم المورد بالعربي"
                  value={formData.business_name_ar}
                  onChange={(e) => setFormData({ ...formData, business_name_ar: e.target.value })}
                />
              </FormField>

              <FormField label="First Name">
                <input type="text" className="form-input"
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                />
              </FormField>

              <FormField label="Last Name">
                <input type="text" className="form-input"
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                />
              </FormField>

              <FormField label="Telephone">
                <input type="tel" className="form-input"
                  value={formData.telephone}
                  onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                />
              </FormField>

              <FormField label="Mobile">
                <input type="tel" className="form-input"
                  value={formData.mobile}
                  onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                />
              </FormField>

              <FormField label="Phone">
                <input type="tel" className="form-input"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </FormField>

              <div style={{ gridColumn: 'span 2' }}>
                <FormField label="Street Address 1">
                  <input type="text" className="form-input"
                    value={formData.street_address_1}
                    onChange={(e) => setFormData({ ...formData, street_address_1: e.target.value })}
                  />
                </FormField>
              </div>

              <div style={{ gridColumn: 'span 2' }}>
                <FormField label="Street Address 2">
                  <input type="text" className="form-input"
                    value={formData.street_address_2}
                    onChange={(e) => setFormData({ ...formData, street_address_2: e.target.value })}
                  />
                </FormField>
              </div>

              <FormField label="City">
                <input type="text" className="form-input"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                />
              </FormField>

              <FormField label="State">
                <input type="text" className="form-input"
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                />
              </FormField>

              <FormField label="Postal Code">
                <input type="text" className="form-input"
                  value={formData.postal_code}
                  onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                />
              </FormField>

              <FormField label="Country">
                <SearchableDropdown
                  options={countries.map((c) => ({ value: c, label: c }))}
                  value={formData.country}
                  onChange={(val) => setFormData({ ...formData, country: val as string })}
                  placeholder="Select Country"
                />
              </FormField>

              <FormField label="TRN (Optional)">
                <input type="text" className="form-input"
                  value={formData.trn}
                  onChange={(e) => setFormData({ ...formData, trn: e.target.value })}
                />
              </FormField>
            </div>
          </div>

          {/* Account Details */}
          <div className="card">
            <h2 className="section-title">Account Details</h2>
            <div className="form-grid">
              <FormField label="Supplier Number" required>
                <input type="text" required className="form-input"
                  value={formData.supplier_number}
                  onChange={(e) => setFormData({ ...formData, supplier_number: e.target.value })}
                />
              </FormField>

              <FormField label="Currency">
                <SearchableDropdown
                  options={currencies.map((c) => ({ value: c.value, label: c.label }))}
                  value={formData.currency}
                  onChange={(val) => setFormData({ ...formData, currency: val as string })}
                  placeholder="Select Currency"
                />
              </FormField>

              <FormField label="Email">
                <input type="email" className="form-input"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </FormField>

              <FormField label="Contact Person">
                <input type="text" className="form-input"
                  value={formData.contact_person}
                  onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                />
              </FormField>

              <FormField label="Tax ID">
                <input type="text" className="form-input"
                  value={formData.tax_id}
                  onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                />
              </FormField>

              <FormField label="Bank Name">
                <input type="text" className="form-input"
                  value={formData.bank_name}
                  onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                />
              </FormField>

              <FormField label="Bank Account">
                <input type="text" className="form-input"
                  value={formData.bank_account}
                  onChange={(e) => setFormData({ ...formData, bank_account: e.target.value })}
                />
              </FormField>

              <div style={{ gridColumn: '1 / -1' }}>
                <FormField label="Notes">
                  <textarea rows={4} className="form-textarea"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  />
                </FormField>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  style={{ width: 16, height: 16, cursor: 'pointer' }}
                />
                <label htmlFor="is_active" style={{
                  fontSize: 'var(--text-sm)',
                  fontWeight: 'var(--weight-medium)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                }}>
                  {t('col', 'active')}
                </label>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <button type="submit" disabled={mutation.isPending} className="btn btn-primary">
              {mutation.isPending ? t('btn', 'saving') : t('btn', 'save')}
            </button>
            <Link href="/suppliers" className="btn btn-secondary">
              {t('btn', 'cancel')}
            </Link>
          </div>
        </form>
      </PageShell>
    </MainLayout>
  );
}
