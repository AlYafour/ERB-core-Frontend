'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { productsApi } from '@/lib/api/products';
import { PageShell, Badge, Button, PageHeader } from '@/components/ui';
import { ProcField } from '@/components/procurement/shared/ProcField';
import MainLayout from '@/components/layout/MainLayout';
import { formatPrice, formatPercentage, formatNumber } from '@/lib/utils/format';
import { useMyPermissions } from '@/lib/hooks/use-my-permissions';
import BilingualName from '@/components/domain/BilingualName';
import { useT } from '@/lib/i18n/useT';
import Drawer from '@/components/ui/Drawer';
import { toast } from '@/lib/hooks/use-toast';
import { accountingApi } from '@/lib/api/accounting';
import { Product } from '@/types';

const UNITS: Product['unit'][] = [
  'piece','pcs','kg','kl','meter','lm','liter','box','pack','pkt','bag',
  'roll','ctn','ton','trip','sqm','cbm','pump','sheet','brd','drm','doz',
  'ls','set','ream','bundle','nos','mtr','qty','pair','can','gal','day','hour','month',
];

export default function ProductDetailPage() {
  const t = useT();
  const params = useParams();
  const id = Number(params.id);
  const { isTenantAdmin, isPlatformAdmin } = useMyPermissions();
  const queryClient = useQueryClient();

  const { data: product, isLoading } = useQuery({
    queryKey: ['products', id],
    queryFn: () => productsApi.getById(id),
    staleTime: 2 * 60 * 1000,
  });

  const [copied, setCopied] = React.useState(false);
  const [isEditOpen, setIsEditOpen] = React.useState(false);
  const [form, setForm] = React.useState<Partial<Product>>({});

  const isAdmin = isTenantAdmin || isPlatformAdmin;

  const { data: glAccountsData } = useQuery({
    queryKey: ['acc-postable-accounts-product'],
    queryFn: () => accountingApi.listAccounts({ is_postable: true, is_active: true, page_size: 500 }),
    retry: false,
  });
  const glAccounts = glAccountsData?.results ?? [];
  const accLabel = (accId: unknown) => {
    if (!accId) return null;
    const a = glAccounts.find(x => String(x.id) === String(accId));
    return a ? `${a.code} — ${a.name}` : null;
  };

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Product>) => productsApi.update(id, data),
    onSuccess: (updated) => {
      queryClient.setQueryData(['products', id], updated);
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setIsEditOpen(false);
      toast('Product updated successfully', 'success');
    },
    onError: () => toast('Failed to update product', 'error'),
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
      expense_account:   (product as any).expense_account ?? null,
      inventory_account: (product as any).inventory_account ?? null,
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

  if (isLoading) {
    return (
      <MainLayout><PageShell>
        <div className="animate-pulse" style={{ height: 40, width: 320, background: 'var(--bg-secondary)', borderRadius: 8, marginBottom: 12 }} />
        <div className="animate-pulse" style={{ height: 300, background: 'var(--bg-secondary)', borderRadius: 8 }} />
      </PageShell></MainLayout>
    );
  }
  if (!product) {
    return (
      <MainLayout><PageShell>
        <PageHeader title={t('empty', 'notFound')} breadcrumbs={[{ label: 'Home', href: '/' }, { label: t('page', 'products'), href: '/products' }, { label: t('empty', 'notFound') }]} backHref="/products" />
      </PageShell></MainLayout>
    );
  }

  const statusVariant: 'success' | 'error' =
    (!product.is_active || product.status === 'inactive') ? 'error' : 'success';
  const isLowStock =
    product.stock_balance !== undefined &&
    product.low_stock_threshold !== undefined &&
    product.stock_balance <= product.low_stock_threshold;
  const supplierName = product.supplier
    ? typeof product.supplier === 'object'
      ? (product.supplier as any).business_name || (product.supplier as any).name
      : `Supplier #${product.supplier}`
    : null;
  const expenseAcc   = accLabel((product as any).expense_account);
  const inventoryAcc = accLabel((product as any).inventory_account);

  return (
    <MainLayout>
      <PageShell>
        <PageHeader
          title={product.name}
          description={product.code ? `Product ${product.code}` : 'Product'}
          breadcrumbs={[{ label: 'Home', href: '/' }, { label: t('page', 'products'), href: '/products' }, { label: product.name }]}
          backHref="/products"
          actions={
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Badge variant={statusVariant}>
                {product.is_active ? (product.status === 'inactive' ? t('status', 'inactive') : t('status', 'active')) : t('status', 'inactive')}
              </Badge>
              {isAdmin && <Button variant="edit" size="sm" onClick={openEdit}>{t('btn', 'edit')}</Button>}
            </div>
          }
        />

        {/* Identity */}
        <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
          <div className="proc-section-head"><h3 className="proc-section-title">Product Identity</h3></div>
          <div className="proc-info-grid">
            <ProcField label="Product Name" value={<BilingualName nameEn={product.name} nameAr={product.name_ar} />} />
            <ProcField label="Product Code" value={
              product.code ? (
                <button onClick={handleCopyCode} title="Copy product code" style={{
                  background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)',
                  padding: '2px 8px', cursor: 'pointer', fontSize: 'var(--text-xs)',
                  color: copied ? 'var(--status-success)' : 'var(--text-secondary)', fontFamily: 'monospace',
                }}>{copied ? '✓ Copied' : product.code}</button>
              ) : undefined
            } />
            <ProcField label="SKU" value={product.sku ? <span style={{ fontFamily: 'monospace' }}>{product.sku}</span> : undefined} />
            <ProcField label="Barcode" value={product.barcode ? <span style={{ fontFamily: 'monospace' }}>{product.barcode}</span> : undefined} />
            <ProcField label="Brand" value={product.brand} />
            <ProcField label="Unit" value={product.unit} />
            <ProcField label="Category" value={product.category} />
            <ProcField label="Supplier" value={supplierName} />
          </div>
        </div>

        {/* Pricing */}
        <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
          <div className="proc-section-head"><h3 className="proc-section-title">Pricing</h3></div>
          <div className="proc-info-grid">
            <ProcField label="Purchase Price" value={formatPrice(product.buy_price)} />
            <ProcField label="Selling Price" value={formatPrice(product.sell_price ?? product.unit_price)} />
            <ProcField label="Minimum Price" value={formatPrice(product.minimum_price)} />
            <ProcField label="Average Cost" value={formatPrice(product.average_cost)} />
            <ProcField label="Discount" value={product.discount_type === 'fixed' ? formatPrice(product.discount) : formatPercentage(product.discount)} />
            <ProcField label="Profit Margin" value={formatPercentage(product.profit_margin)} />
            <ProcField label="Tax 1" value={formatPercentage(product.tax1)} />
            <ProcField label="Tax 2" value={formatPercentage(product.tax2)} />
          </div>
        </div>

        {/* Accounting — item-master GL defaults */}
        <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
          <div className="proc-section-head"><h3 className="proc-section-title">Accounting</h3></div>
          <div className="proc-info-grid">
            <ProcField label="Track Stock" value={<Badge variant={product.track_stock ? 'success' : 'info'}>{product.track_stock ? 'Yes' : 'No'}</Badge>} />
            <ProcField label="Default Expense Account" value={
              expenseAcc
                ? <span style={{ fontFamily: 'monospace', fontSize: 'var(--text-sm)' }}>{expenseAcc}</span>
                : <span style={{ color: 'var(--text-tertiary)' }}>Company default</span>
            } />
            <ProcField label="Default Inventory Account" value={
              inventoryAcc
                ? <span style={{ fontFamily: 'monospace', fontSize: 'var(--text-sm)' }}>{inventoryAcc}</span>
                : <span style={{ color: 'var(--text-tertiary)' }}>Company default</span>
            } />
          </div>
        </div>

        {/* Inventory */}
        {product.track_stock && (
          <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
            <div className="proc-section-head"><h3 className="proc-section-title">Inventory</h3></div>
            <div className="proc-info-grid">
              <ProcField label="Stock Balance" value={formatNumber(product.stock_balance, 2)} />
              <ProcField label="Low Stock Threshold" value={formatNumber(product.low_stock_threshold, 2)} />
              <ProcField label="Stock Status" value={<Badge variant={isLowStock ? 'error' : 'success'}>{isLowStock ? 'Low Stock' : 'In Stock'}</Badge>} />
            </div>
          </div>
        )}

        {/* Tags */}
        {product.tags && (
          <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
            <div className="proc-section-head"><h3 className="proc-section-title">Tags</h3></div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
              {product.tags.split(',').map((tag, i) => <Badge key={i} variant="info">{tag.trim()}</Badge>)}
            </div>
          </div>
        )}

        {/* Description / Notes */}
        {(product.description || product.internal_notes) && (
          <div className="card">
            {product.description && (
              <>
                <div className="proc-section-head"><h3 className="proc-section-title">Description</h3></div>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-wrap', margin: '0 0 var(--space-3)' }}>{product.description}</p>
              </>
            )}
            {product.internal_notes && (
              <>
                <div className="proc-section-head"><h3 className="proc-section-title">Internal Notes</h3></div>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-wrap', margin: 0 }}>{product.internal_notes}</p>
              </>
            )}
          </div>
        )}

        {/* ── Edit Drawer (unchanged) ─────────────────────────────────────── */}
        <Drawer
          isOpen={isEditOpen}
          onClose={() => setIsEditOpen(false)}
          title="Edit Product"
          description={product.code}
          size="md"
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setIsEditOpen(false)} disabled={updateMutation.isPending}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
              </button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label className="info-label" style={{ display: 'block', marginBottom: 4 }}>
                Product Name (English) <span style={{ color: 'var(--color-error)' }}>*</span>
              </label>
              <input className="input" value={form.name ?? ''} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Product name in English" autoFocus />
            </div>
            <div>
              <label className="info-label" style={{ display: 'block', marginBottom: 4 }}>اسم المنتج (عربي)</label>
              <input className="input" dir="rtl" value={form.name_ar ?? ''} onChange={(e) => setForm((f) => ({ ...f, name_ar: e.target.value }))} placeholder="اسم المنتج بالعربي" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label className="info-label" style={{ display: 'block', marginBottom: 4 }}>Product Code</label>
                <input className="input" style={{ fontFamily: 'monospace' }} value={form.code ?? ''} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} placeholder="MAT-0000" />
              </div>
              <div>
                <label className="info-label" style={{ display: 'block', marginBottom: 4 }}>SKU</label>
                <input className="input" style={{ fontFamily: 'monospace' }} value={form.sku ?? ''} onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))} placeholder="Optional" />
              </div>
            </div>
            {glAccounts.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="info-label" style={{ display: 'block', marginBottom: 4 }}>Default Expense Account</label>
                  <select className="input" value={(form as any).expense_account ?? ''} onChange={(e) => setForm((f) => ({ ...f, expense_account: e.target.value ? Number(e.target.value) : null } as any))}>
                    <option value="">— company default —</option>
                    {glAccounts.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="info-label" style={{ display: 'block', marginBottom: 4 }}>Default Inventory Account</label>
                  <select className="input" value={(form as any).inventory_account ?? ''} onChange={(e) => setForm((f) => ({ ...f, inventory_account: e.target.value ? Number(e.target.value) : null } as any))}>
                    <option value="">— company default —</option>
                    {glAccounts.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                  </select>
                </div>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label className="info-label" style={{ display: 'block', marginBottom: 4 }}>Unit</label>
                <select className="input" value={form.unit ?? ''} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value as Product['unit'] }))}>
                  {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label className="info-label" style={{ display: 'block', marginBottom: 4 }}>Brand</label>
                <input className="input" value={form.brand ?? ''} onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))} placeholder="Optional" />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label className="info-label" style={{ display: 'block', marginBottom: 4 }}>Purchase Price (AED)</label>
                <input className="input" type="number" min="0" step="0.01" value={form.buy_price ?? ''} onChange={(e) => setForm((f) => ({ ...f, buy_price: Number(e.target.value) }))} />
              </div>
              <div>
                <label className="info-label" style={{ display: 'block', marginBottom: 4 }}>Selling Price (AED)</label>
                <input className="input" type="number" min="0" step="0.01" value={form.sell_price ?? ''} onChange={(e) => setForm((f) => ({ ...f, sell_price: Number(e.target.value) }))} />
              </div>
            </div>
            <div>
              <label className="info-label" style={{ display: 'block', marginBottom: 4 }}>Description</label>
              <textarea className="input" rows={3} style={{ resize: 'vertical' }} value={form.description ?? ''} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Optional product description" />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="checkbox" id="is_active" checked={form.is_active ?? true} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} style={{ width: 16, height: 16, cursor: 'pointer' }} />
              <label htmlFor="is_active" style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', cursor: 'pointer' }}>Active product</label>
            </div>
          </div>
        </Drawer>
      </PageShell>
    </MainLayout>
  );
}
