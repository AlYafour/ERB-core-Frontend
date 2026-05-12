'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { suppliersApi } from '@/lib/api/suppliers';
import MainLayout from '@/components/layout/MainLayout';
import Link from 'next/link';
import SearchableDropdown from '@/components/ui/SearchableDropdown';
import { useT } from '@/lib/i18n/useT';
import { PageHeader, PageShell } from '@/components/ui';

const currencies = [
  { value: 'AED', label: 'AED - UAE Dirham' },
];

const countries = [
  'United Arab Emirates',
  'Saudi Arabia',
  'Egypt',
  'United States',
  'United Kingdom',
  'Other',
];

export default function EditSupplierPage() {
  const router = useRouter();
  const params = useParams();
  const id = Number(params.id);
  const queryClient = useQueryClient();
  const t = useT();

  const { data: supplier, isLoading } = useQuery({
    queryKey: ['suppliers', id],
    queryFn: () => suppliersApi.getById(id),
  });

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

  useEffect(() => {
    if (supplier) {
      setFormData({
        business_name: supplier.business_name || supplier.name || '',
        business_name_ar: supplier.business_name_ar || '',
        supplier_number: supplier.supplier_number || '',
        first_name: supplier.first_name || '',
        last_name: supplier.last_name || '',
        contact_person: supplier.contact_person || '',
        email: supplier.email || '',
        telephone: supplier.telephone || '',
        phone: supplier.phone || '',
        mobile: supplier.mobile || '',
        street_address_1: supplier.street_address_1 || '',
        street_address_2: supplier.street_address_2 || '',
        city: supplier.city || '',
        state: supplier.state || '',
        postal_code: supplier.postal_code || '',
        country: supplier.country || 'United Arab Emirates',
        tax_id: supplier.tax_id || '',
        trn: supplier.trn || '',
        currency: supplier.currency || 'AED',
        bank_name: supplier.bank_name || '',
        bank_account: supplier.bank_account || '',
        notes: supplier.notes || '',
        is_active: supplier.is_active ?? true,
      });
    }
  }, [supplier]);

  const mutation = useMutation({
    mutationFn: (data: typeof formData) => suppliersApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      router.push('/suppliers');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="space-y-6">
          <div className="card text-center py-12">
            <p className="text-muted-foreground">{t('btn', 'loading')}</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <PageShell>
        <PageHeader
          title={t('page', 'editSupplier')}
          description="Update supplier information"
          breadcrumbs={[{ label: t('page', 'suppliers'), href: '/suppliers' }, { label: t('page', 'editSupplier') }]}
        />

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Supplier Details Section */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4 text-foreground">Supplier Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Business Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.business_name}
                  onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  اسم الشركة بالعربي
                </label>
                <input
                  type="text"
                  dir="rtl"
                  placeholder="اسم المورد بالعربي"
                  value={formData.business_name_ar}
                  onChange={(e) => setFormData({ ...formData, business_name_ar: e.target.value })}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  First Name
                </label>
                <input
                  type="text"
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Last Name
                </label>
                <input
                  type="text"
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Telephone
                </label>
                <input
                  type="tel"
                  value={formData.telephone}
                  onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Mobile
                </label>
                <input
                  type="tel"
                  value={formData.mobile}
                  onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Phone
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-foreground mb-2">
                  Street Address 1
                </label>
                <input
                  type="text"
                  value={formData.street_address_1}
                  onChange={(e) => setFormData({ ...formData, street_address_1: e.target.value })}
                  className="w-full"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-foreground mb-2">
                  Street Address 2
                </label>
                <input
                  type="text"
                  value={formData.street_address_2}
                  onChange={(e) => setFormData({ ...formData, street_address_2: e.target.value })}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  City
                </label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  State
                </label>
                <input
                  type="text"
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Postal Code
                </label>
                <input
                  type="text"
                  value={formData.postal_code}
                  onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Country
                </label>
                <SearchableDropdown
                  label="Country"
                  options={countries.map((country) => ({
                    value: country,
                    label: country,
                  }))}
                  value={formData.country}
                  onChange={(val) => setFormData({ ...formData, country: val as string })}
                  placeholder="Select Country"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  TRN (Optional)
                </label>
                <input
                  type="text"
                  value={formData.trn}
                  onChange={(e) => setFormData({ ...formData, trn: e.target.value })}
                  className="w-full"
                />
              </div>
            </div>
          </div>

          {/* Account Details Section */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4 text-foreground">Account Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Supplier Number *
                </label>
                <input
                  type="text"
                  required
                  value={formData.supplier_number}
                  onChange={(e) => setFormData({ ...formData, supplier_number: e.target.value })}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Currency
                </label>
                <SearchableDropdown
                  label="Currency"
                  options={currencies.map((currency) => ({
                    value: currency.value,
                    label: currency.label,
                  }))}
                  value={formData.currency}
                  onChange={(val) => setFormData({ ...formData, currency: val as string })}
                  placeholder="Select Currency"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Contact Person
                </label>
                <input
                  type="text"
                  value={formData.contact_person}
                  onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Tax ID
                </label>
                <input
                  type="text"
                  value={formData.tax_id}
                  onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Bank Name
                </label>
                <input
                  type="text"
                  value={formData.bank_name}
                  onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Bank Account
                </label>
                <input
                  type="text"
                  value={formData.bank_account}
                  onChange={(e) => setFormData({ ...formData, bank_account: e.target.value })}
                  className="w-full"
                />
              </div>

              <div className="md:col-span-3">
                <label className="block text-sm font-medium text-foreground mb-2">
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={4}
                  className="w-full"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-medium text-foreground">Active</span>
                </label>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={mutation.isPending}
              className="btn btn-primary"
            >
              {mutation.isPending ? t('btn', 'loading') : t('btn', 'saveChanges')}
            </button>
            <Link href="/suppliers" className="btn btn-secondary">
              Cancel
            </Link>
          </div>
        </form>
      </PageShell>
    </MainLayout>
  );
}
