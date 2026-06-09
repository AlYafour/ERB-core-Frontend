'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { productsApi } from '@/lib/api/products';
import { PageShell } from '@/components/ui';
import MainLayout from '@/components/layout/MainLayout';
import Link from 'next/link';
import { formatPrice, formatPercentage, formatNumber } from '@/lib/utils/format';
import EntityHeader from '@/components/ui/EntityHeader';
import { useAuth } from '@/lib/hooks/use-auth';
import BilingualName from '@/components/domain/BilingualName';
import { useT } from '@/lib/i18n/useT';

function Field({ label, value, mono, full }: { label: string; value?: string | null; mono?: boolean; full?: boolean }) {
  return (
    <div className={full ? 'info-full' : undefined}>
      <div className="info-label">{label}</div>
      <div className={mono ? 'info-value-mono' : 'info-value'}>{value || '—'}</div>
    </div>
  );
}

export default function ProductDetailPage() {
  const t = useT();
  const params = useParams();
  const id = Number(params.id);
  const { user } = useAuth();

  const { data: product, isLoading } = useQuery({
    queryKey: ['products', id],
    queryFn: () => productsApi.getById(id),
  });

  const isAdmin = user?.role === 'admin' || user?.is_staff;

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
              <Link href={`/products/${id}`} className="btn btn-edit">
                {t('btn', 'edit')}
              </Link>
            ) : undefined
          }
        />

        <div className="card">
          {/* Product Identity */}
          <div className="info-section-title">Product Identity</div>
          <div className="info-grid">
            <div className="info-full">
              <div className="info-label">Product Name</div>
              <BilingualName nameEn={product.name} nameAr={product.name_ar} />
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
      </PageShell>
    </MainLayout>
  );
}
