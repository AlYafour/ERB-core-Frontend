'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { productsApi } from '@/lib/api/products';
import { suppliersApi } from '@/lib/api/suppliers';
import MainLayout from '@/components/layout/MainLayout';
import Link from 'next/link';
import FormField from '@/components/ui/FormField';
import SearchableDropdown from '@/components/ui/SearchableDropdown';
import { Button, PageHeader, PageShell } from '@/components/ui';
import { toast } from '@/lib/hooks/use-toast';
import { getApiError } from '@/lib/utils/error';
import { ProductFormData } from '@/lib/types/form-data';

const UNITS = [
  'piece','pcs','kg','kl','meter','lm','liter','box','pack','pkt','bag','roll',
  'ctn','ton','trip','sqm','cbm','pump','sheet','brd','drm','doz','ls','set',
  'ream','bundle','nos','mtr','qty','pair','can','gal','day','hour','month',
];

const defaultForm: ProductFormData = {
  name: '',
  name_ar: '',
  code: '',
  sku: '',
  barcode: '',
  description: '',
  notes: '',
  internal_notes: '',
  brand: '',
  category: '',
  tags: '',
  unit: 'piece',
  supplier: undefined,
  sell_price: 0,
  buy_price: 0,
  minimum_price: 0,
  discount: 0,
  discount_type: 'percentage',
  tax1: 0,
  tax2: 0,
  track_stock: false,
  stock_balance: 0,
  low_stock_threshold: 0,
  profit_margin: 0,
  status: 'active',
  is_active: true,
};

export default function NewProductPage() {
  const router = useRouter();
  const [form, setForm] = useState<ProductFormData>(defaultForm);

  const { data: suppliersData } = useQuery({
    queryKey: ['suppliers-all'],
    queryFn: () => suppliersApi.getAll({ page: 1, page_size: 1000 }),
  });

  const mutation = useMutation({
    mutationFn: () => productsApi.create(form as any),
    onSuccess: (data) => {
      toast('Product created successfully!', 'success');
      router.push(`/products/view/${data.id}`);
    },
    onError: (error: any) => {
      toast(getApiError(error, 'Failed to create product'), 'error');
    },
  });

  const set = (key: keyof ProductFormData, value: any) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const supplierOptions = (suppliersData?.results ?? []).map(s => ({
    value: s.id,
    label: s.business_name || s.name,
  }));

  const unitOptions = UNITS.map(u => ({ value: u, label: u }));

  return (
    <MainLayout>
      <PageShell>
        <PageHeader
          title="New Product"
          breadcrumbs={[{ label: 'Products', href: '/products' }, { label: 'New Product' }]}
        />

        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          {/* Basic Info */}
          <div className="card">
            <h2 className="section-title">Basic Information</h2>
            <div className="form-grid">
              <FormField label="Product Name (EN)" required>
                <input className="input" value={form.name} onChange={e => set('name', e.target.value)} required />
              </FormField>
              <FormField label="Product Name (AR)">
                <input className="input" dir="rtl" value={form.name_ar} onChange={e => set('name_ar', e.target.value)} />
              </FormField>
              <FormField label="Code">
                <input className="input" value={form.code} onChange={e => set('code', e.target.value)} />
              </FormField>
              <FormField label="SKU">
                <input className="input" value={form.sku} onChange={e => set('sku', e.target.value)} />
              </FormField>
              <FormField label="Barcode">
                <input className="input" value={form.barcode} onChange={e => set('barcode', e.target.value)} />
              </FormField>
              <FormField label="Brand">
                <input className="input" value={form.brand} onChange={e => set('brand', e.target.value)} />
              </FormField>
              <FormField label="Category">
                <input className="input" value={form.category} onChange={e => set('category', e.target.value)} />
              </FormField>
              <FormField label="Tags">
                <input className="input" value={form.tags} onChange={e => set('tags', e.target.value)} />
              </FormField>
              <FormField label="Unit" required>
                <SearchableDropdown
                  options={unitOptions}
                  value={form.unit}
                  onChange={v => set('unit', v)}
                />
              </FormField>
              <FormField label="Supplier">
                <SearchableDropdown
                  options={supplierOptions}
                  value={form.supplier ?? null}
                  onChange={v => set('supplier', v ?? undefined)}
                  allowClear
                />
              </FormField>
              <FormField label="Status">
                <SearchableDropdown
                  options={[
                    { value: 'active', label: 'Active' },
                    { value: 'inactive', label: 'Inactive' },
                    { value: 'archived', label: 'Archived' },
                  ]}
                  value={form.status}
                  onChange={v => set('status', v)}
                />
              </FormField>
              <FormField label="Description">
                <textarea className="input" rows={3} value={form.description} onChange={e => set('description', e.target.value)} />
              </FormField>
              <FormField label="Notes">
                <textarea className="input" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />
              </FormField>
            </div>
          </div>

          {/* Pricing */}
          <div className="card">
            <h2 className="section-title">Pricing</h2>
            <div className="form-grid">
              <FormField label="Unit Price">
                <input className="input" type="number" step="0.01" min="0" value={form.sell_price} onChange={e => set('sell_price', parseFloat(e.target.value) || 0)} />
              </FormField>
              <FormField label="Buy Price">
                <input className="input" type="number" step="0.01" min="0" value={form.buy_price} onChange={e => set('buy_price', parseFloat(e.target.value) || 0)} />
              </FormField>
              <FormField label="Minimum Price">
                <input className="input" type="number" step="0.01" min="0" value={form.minimum_price} onChange={e => set('minimum_price', parseFloat(e.target.value) || 0)} />
              </FormField>
              <FormField label="Discount">
                <input className="input" type="number" step="0.01" min="0" value={form.discount} onChange={e => set('discount', parseFloat(e.target.value) || 0)} />
              </FormField>
              <FormField label="Tax 1 (%)">
                <input className="input" type="number" step="0.01" min="0" value={form.tax1} onChange={e => set('tax1', parseFloat(e.target.value) || 0)} />
              </FormField>
              <FormField label="Tax 2 (%)">
                <input className="input" type="number" step="0.01" min="0" value={form.tax2} onChange={e => set('tax2', parseFloat(e.target.value) || 0)} />
              </FormField>
            </div>
          </div>

          {/* Stock */}
          <div className="card">
            <h2 className="section-title">Stock</h2>
            <div className="form-grid">
              <FormField label="Track Stock">
                <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.track_stock} onChange={e => set('track_stock', e.target.checked)} />
                  <span style={{ fontSize: 'var(--text-sm)' }}>Track inventory</span>
                </label>
              </FormField>
              {form.track_stock && (
                <>
                  <FormField label="Stock Balance">
                    <input className="input" type="number" min="0" value={form.stock_balance} onChange={e => set('stock_balance', parseFloat(e.target.value) || 0)} />
                  </FormField>
                  <FormField label="Low Stock Threshold">
                    <input className="input" type="number" min="0" value={form.low_stock_threshold} onChange={e => set('low_stock_threshold', parseFloat(e.target.value) || 0)} />
                  </FormField>
                </>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <Button type="submit" variant="primary" isLoading={mutation.isPending}>
              Create Product
            </Button>
            <Link href="/products">
              <Button type="button" variant="secondary">Cancel</Button>
            </Link>
          </div>
        </form>
      </PageShell>
    </MainLayout>
  );
}
