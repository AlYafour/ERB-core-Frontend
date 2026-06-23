'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { productsApi } from '@/lib/api/products';
import { PageShell } from '@/components/ui';
import MainLayout from '@/components/layout/MainLayout';
import { formatPrice, formatPercentage, formatNumber } from '@/lib/utils/format';
import EntityHeader from '@/components/ui/EntityHeader';
import { useAuth } from '@/lib/hooks/use-auth';
import { useMyPermissions } from '@/lib/hooks/use-my-permissions';
import BilingualName from '@/components/domain/BilingualName';
import { useT } from '@/lib/i18n/useT';
import Drawer from '@/components/ui/Drawer';
import { toast } from '@/lib/hooks/use-toast';
import { Product } from '@/types';

function Field({ label, value, mono, full }: { label: string; value?: string | null; mono?: boolean; full?: boolean }) {
  return (
    <div className={full ? 'info-full' : undefined}>
      <div className="info-label">{label}</div>
      <div className={mono ? 'info-value-mono' : 'info-value'}>{value || '—'}</div>
    </div>
  );
}

const UNITS: Product['unit'][] = [
  'piece','pcs','kg','kl','meter','lm','liter','box','pack','pkt','bag',
  'roll','ctn','ton','trip','sqm','cbm','pump','sheet','brd','drm','doz',
  'ls','set','ream','bundle','nos','mtr','qty','pair','can','gal','day','hour','month',
];

export default function ProductDetailPage() {
  const t = useT();
  const params = useParams();
  const id = Number(params.id);
  const { user } = useAuth();
  const { isTenantAdmin, isPlatformAdmin } = useMyPermissions();
  const queryClient = useQueryClient();

  const { data: product, isLoading } = useQuery({
    queryKey: ['products', id],
    queryFn: () => productsApi.getById(id),
    staleTime: 2 * 60 * 1000,
  });

  // ── all state before any early return ──────────────────────────────────
  const [copied, setCopied] = React.useState(false);
  const [isEditOpen, setIsEditOpen] = React.useState(false);
  const [form, setForm] = React.useState<Partial<Product>>({});

  const isAdmin = isTenantAdmin || isPlatformAdmin;

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Product>) => productsApi.update(id, data),
    onSuccess: (updated) => {
      queryClient.setQueryData(['products', id], updated);
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setIsEditOpen(false);
      toast('Product updated successfully', 'success');
    },
    onError: () => {
      toast('Failed to update product', 'error');
    },
  });

  const openEdit = () => {
    if (!product) return;
    setForm({
      name:        product.name,
      name_ar:     product.name_ar ?? '',
      code:        product.code,
      sku:         product.sku ?? '',
      brand:       product.brand ?? '',
      unit:        product.unit,
      buy_price:   product.buy_price,
      sell_price:  product.sell_price ?? product.unit_price,
      description: product.description ?? '',
      is_active:   product.is_active,
    });
    setIsEditOpen(true);
  };

  const handleSave = () => {
    if (!form.name?.trim()) { toast('Product name is required', 'error'); return; }
    updateMutation.mutate(form);
  };

  const handleCopyCode = () => {
    if (!product?.code) return;
    navigator.clipboard.writeText(product.code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  // ───────────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <MainLayout>
        <PageShell>
          <div className="card animate-pulse" style={{ height: 120 }} />
          <div className="card animate-pulse" style={{ height: 320 }} />
        </PageShell>
      </MainLayout>
    );
  }

  if (!product) {
    return (
      <MainLayout>
        <PageShell>
          <div className="card empty-state">
            <p className="empty-state-title">{t('empty', 'notFound')}</p>
          </div>
        </PageShell>
      </MainLayout>
    );
  }

  const getStatusVariant = () => {
    if (!product.is_active) return 'error';
    if (product.status === 'inactive') return 'error';
    return 'success';
  };

  const isLowStock =
    product.stock_balance !== undefined &&
    product.low_stock_threshold !== undefined &&
    product.stock_balance <= product.low_stock_threshold;

  const supplierName = product.supplier
    ? typeof product.supplier === 'object'
      ? (product.supplier as any).business_name || (product.supplier as any).name
      : `Supplier #${product.supplier}`
    : null;

  return (
    <MainLayout>
      <PageShell>
        <EntityHeader
          title={product.name}
          subtitle={product.code}
          image={product.image_url || product.image}
          imageAlt={product.name}
          entityType="product"
          statusBadge={product.is_active ? (product.status === 'inactive' ? t('status', 'inactive') : t('status', 'active')) : t('status', 'inactive')}
          statusVariant={getStatusVariant()}
          backHref="/products"
          backLabel={`${t('btn', 'back')} ${t('page', 'products')}`}
          actions={
            isAdmin ? (
              <button onClick={openEdit} className="btn btn-edit">
                {t('btn', 'edit')}
              </button>
            ) : undefined
          }
        />

        <div className="card">
          {/* Product Identity */}
          <div className="info-section-title">Product Identity</div>
          <div className="info-grid">
            <div className="info-full">
              <div className="info-label">Product Name</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)', flexWrap: 'wrap' }}>
                <BilingualName nameEn={product.name} nameAr={product.name_ar} />
                {product.code && (
                  <button
                    onClick={handleCopyCode}
                    title="Copy product code"
                    style={{
                      background: 'none',
                      border: '1px solid var(--border-primary)',
                      borderRadius: 'var(--radius-md)',
                      padding: '2px 8px',
                      cursor: 'pointer',
                      fontSize: 'var(--font-xs)',
                      color: copied ? 'var(--color-success)' : 'var(--text-secondary)',
                      fontFamily: 'monospace',
                      transition: 'color 0.2s',
                    }}
                  >
                    {copied ? '✓ Copied' : product.code}
                  </button>
                )}
              </div>
            </div>
            <Field label="Product Code" value={product.code} mono />
            <Field label="SKU" value={product.sku} mono />
            <Field label="Barcode" value={product.barcode} mono />
            <Field label="Brand" value={product.brand} />
            <Field label="Unit" value={product.unit} />
            <Field label="Category" value={product.category} />
            <Field label="Supplier" value={supplierName} />
          </div>

          {/* Pricing */}
          <div className="info-section">
            <div className="info-section-title">Pricing</div>
            <div className="info-grid">
              <Field label="Purchase Price" value={formatPrice(product.buy_price)} />
              <Field label="Selling Price" value={formatPrice(product.sell_price ?? product.unit_price)} />
              <Field label="Minimum Price" value={formatPrice(product.minimum_price)} />
              <Field label="Average Cost" value={formatPrice(product.average_cost)} />
              <Field
                label="Discount"
                value={product.discount_type === 'fixed' ? formatPrice(product.discount) : formatPercentage(product.discount)}
              />
              <Field label="Profit Margin" value={formatPercentage(product.profit_margin)} />
            </div>
          </div>

          {/* Tax & Discount */}
          <div className="info-section">
            <div className="info-section-title">Tax & Discount</div>
            <div className="info-grid">
              <Field label="Tax 1" value={formatPercentage(product.tax1)} />
              <Field label="Tax 2" value={formatPercentage(product.tax2)} />
              <Field label="Discount Type" value={product.discount_type} />
              <div>
                <div className="info-label">Track Stock</div>
                <span className={`badge ${product.track_stock ? 'badge-success' : 'badge-info'}`}>
                  {product.track_stock ? 'Yes' : 'No'}
                </span>
              </div>
            </div>
          </div>

          {/* Inventory */}
          {product.track_stock && (
            <div className="info-section">
              <div className="info-section-title">Inventory</div>
              <div className="info-grid">
                <Field label="Stock Balance" value={formatNumber(product.stock_balance, 2)} />
                <Field label="Low Stock Threshold" value={formatNumber(product.low_stock_threshold, 2)} />
                <div>
                  <div className="info-label">Stock Status</div>
                  <span className={`badge ${isLowStock ? 'badge-error' : 'badge-success'}`}>
                    {isLowStock ? 'Low Stock' : 'In Stock'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Tags */}
          {product.tags && (
            <div className="info-section">
              <div className="info-section-title">Tags</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginTop: 'var(--space-1)' }}>
                {product.tags.split(',').map((tag, i) => (
                  <span key={i} className="badge badge-info">{tag.trim()}</span>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          {product.description && (
            <div className="info-section">
              <div className="info-section-title">Description</div>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-wrap', margin: 0 }}>
                {product.description}
              </p>
            </div>
          )}

          {/* Internal Notes */}
          {product.internal_notes && (
            <div className="info-section">
              <div className="info-section-title">Internal Notes</div>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-wrap', margin: 0 }}>
                {product.internal_notes}
              </p>
            </div>
          )}
        </div>

        {/* ── Edit Drawer ───────────────────────────────────────────────── */}
        <Drawer
          isOpen={isEditOpen}
          onClose={() => setIsEditOpen(false)}
          title="Edit Product"
          description={product.code}
          size="md"
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setIsEditOpen(false)} disabled={updateMutation.isPending}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSave} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
              </button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Name EN */}
            <div>
              <label className="info-label" style={{ display: 'block', marginBottom: 4 }}>
                Product Name (English) <span style={{ color: 'var(--color-error)' }}>*</span>
              </label>
              <input
                className="input"
                value={form.name ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Product name in English"
                autoFocus
              />
            </div>

            {/* Name AR */}
            <div>
              <label className="info-label" style={{ display: 'block', marginBottom: 4 }}>اسم المنتج (عربي)</label>
              <input
                className="input"
                dir="rtl"
                value={form.name_ar ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, name_ar: e.target.value }))}
                placeholder="اسم المنتج بالعربي"
              />
            </div>

            {/* Code + SKU */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label className="info-label" style={{ display: 'block', marginBottom: 4 }}>Product Code</label>
                <input
                  className="input"
                  style={{ fontFamily: 'monospace' }}
                  value={form.code ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                  placeholder="MAT-0000"
                />
              </div>
              <div>
                <label className="info-label" style={{ display: 'block', marginBottom: 4 }}>SKU</label>
                <input
                  className="input"
                  style={{ fontFamily: 'monospace' }}
                  value={form.sku ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
                  placeholder="Optional"
                />
              </div>
            </div>

            {/* Unit + Brand */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label className="info-label" style={{ display: 'block', marginBottom: 4 }}>Unit</label>
                <select
                  className="input"
                  value={form.unit ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value as Product['unit'] }))}
                >
                  {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label className="info-label" style={{ display: 'block', marginBottom: 4 }}>Brand</label>
                <input
                  className="input"
                  value={form.brand ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
                  placeholder="Optional"
                />
              </div>
            </div>

            {/* Buy Price + Sell Price */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label className="info-label" style={{ display: 'block', marginBottom: 4 }}>Purchase Price (AED)</label>
                <input
                  className="input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.buy_price ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, buy_price: Number(e.target.value) }))}
                />
              </div>
              <div>
                <label className="info-label" style={{ display: 'block', marginBottom: 4 }}>Selling Price (AED)</label>
                <input
                  className="input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.sell_price ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, sell_price: Number(e.target.value) }))}
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="info-label" style={{ display: 'block', marginBottom: 4 }}>Description</label>
              <textarea
                className="input"
                rows={3}
                style={{ resize: 'vertical' }}
                value={form.description ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Optional product description"
              />
            </div>

            {/* Active toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                type="checkbox"
                id="is_active"
                checked={form.is_active ?? true}
                onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                style={{ width: 16, height: 16, cursor: 'pointer' }}
              />
              <label htmlFor="is_active" style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', cursor: 'pointer' }}>
                Active product
              </label>
            </div>

          </div>
        </Drawer>

      </PageShell>
    </MainLayout>
  );
}
