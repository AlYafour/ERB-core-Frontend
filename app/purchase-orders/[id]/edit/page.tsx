'use client';

import { useState, useEffect } from 'react';
import { useDebounce } from '@/lib/hooks/use-debounce';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { purchaseOrdersApi } from '@/lib/api/purchase-orders';
import { suppliersApi } from '@/lib/api/suppliers';
import { productsApi } from '@/lib/api/products';
import MainLayout from '@/components/layout/MainLayout';
import Link from 'next/link';
import type { PurchaseOrder, PurchaseOrderItem, CostCode } from '@/types';
import { PurchaseOrderUpdateFormData, toPurchaseOrderUpdateData } from '@/lib/types/form-data';
import CostCodePicker from '@/components/domain/CostCodePicker';
import { toast } from '@/lib/hooks/use-toast';
import { getApiError } from '@/lib/utils/error';
import SearchableDropdown from '@/components/ui/SearchableDropdown';
import { formatPrice } from '@/lib/utils/format';
import RouteGuard from '@/components/auth/RouteGuard';
import { useMyPermissions } from '@/lib/hooks/use-my-permissions';
import { Button, PageHeader, PageShell } from '@/components/ui';
import { useT } from '@/lib/i18n/useT';
import { usePOFormTotals } from '@/lib/hooks/use-po-form-totals';
import { EditableStandardItemsTable } from '@/components/procurement/EditableStandardItemsTable';
import { AddItemPanel, AddItemState } from '@/components/procurement/shared/AddItemPanel';
import { POFormSummary } from '@/components/procurement/shared/POFormSummary';
import { DocLoadState } from '@/components/procurement/shared/DocLoadState';

export default function EditPurchaseOrderPage() {
  const params = useParams();
  const id = Number(params.id);
  return (
    <RouteGuard requiredPermission={{ category: 'purchase_order', action: 'update' }} redirectTo={`/purchase-orders/${id}`}>
      <EditPOContent />
    </RouteGuard>
  );
}

type FormItem = Omit<PurchaseOrderItem, 'product' | 'total' | 'created_at'>;

const BLANK_ITEM: AddItemState = { product_id: 0, quantity: 0, unit_price: 0, discount: 0, tax_rate: 0, notes: '' };

function EditPOContent() {
  const t = useT();
  const router = useRouter();
  const params = useParams();
  const id = Number(params.id);
  const queryClient = useQueryClient();
  const { isTenantAdmin, isPlatformAdmin } = useMyPermissions();
  const isAdmin = isTenantAdmin || isPlatformAdmin;

  const [productSearch, setProductSearch] = useState('');
  const debouncedProductSearch = useDebounce(productSearch, 300);

  const { data: order, isLoading } = useQuery({ queryKey: ['purchase-orders', id], queryFn: () => purchaseOrdersApi.getById(id) });
  const { data: suppliers }        = useQuery({ queryKey: ['suppliers-all-active'], queryFn: () => suppliersApi.getAllActive() });
  const { data: products, isFetching: productsLoading } = useQuery({
    queryKey: ['products', 'search', debouncedProductSearch],
    queryFn: () => productsApi.getAll({ search: debouncedProductSearch, page_size: 30 }),
    staleTime: 60_000,
  });

  const [formData, setFormData] = useState<PurchaseOrderUpdateFormData>({
    supplier_id: 0, order_date: new Date().toISOString().split('T')[0],
    delivery_date: '', delivery_method: '', payment_terms: '', delivery_terms: '',
    notes: '', terms_and_conditions: '', tax_rate: 0, discount: 0, status: 'draft', cost_code_id: null,
  });
  const [items, setItems]       = useState<FormItem[]>([]);
  const [newItem, setNewItem]   = useState<AddItemState>(BLANK_ITEM);
  const [costCode, setCostCode] = useState<CostCode | null>(null);

  useEffect(() => {
    if (!order) return;
    const supplierId = typeof order.supplier === 'object' ? order.supplier.id : order.supplier;
    const prId = typeof order.purchase_request === 'object' ? (order.purchase_request as { id: number })?.id : order.purchase_request;
    const pqId = typeof order.purchase_quotation === 'object' ? (order.purchase_quotation as { id: number })?.id : order.purchase_quotation;
    setFormData({
      supplier_id: supplierId,
      purchase_request_id: prId ?? undefined,
      purchase_quotation_id: pqId ?? undefined,
      order_date: order.order_date,
      delivery_date: order.delivery_date || '',
      delivery_method: order.delivery_method || '',
      payment_terms: order.payment_terms || '',
      delivery_terms: order.delivery_terms || '',
      notes: order.notes || '',
      terms_and_conditions: (order as { terms_and_conditions?: string }).terms_and_conditions || '',
      tax_rate: order.tax_rate || 0,
      discount: order.discount || 0,
      transportation_charge: Number(order.transportation_charge) || 0,
      transport_vat_included: order.transport_vat_included ?? true,
      status: order.status,
      cost_code_id: null,
    });
    setItems(order.items.map((item) => ({
      id: item.id,
      product_id: item.product?.id || item.product_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      discount: item.discount ?? 0,
      tax_rate: item.tax_rate ?? 0,
      notes: item.notes || '',
    })));
    if (order.cost_code) {
      const cc = order.cost_code as CostCode;
      setCostCode(cc);
      setFormData((prev) => ({ ...prev, cost_code_id: cc.id }));
    }
  }, [order]);

  const mutation = useMutation({
    mutationFn: (data: PurchaseOrderUpdateFormData) =>
      purchaseOrdersApi.update(id, toPurchaseOrderUpdateData(data, items) as unknown as Partial<PurchaseOrder>),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      toast('Purchase Order updated!', 'success');
      router.push(`/purchase-orders/${id}`);
    },
    onError: (err: unknown) => toast(getApiError(err, 'Failed to update purchase order'), 'error'),
  });

  const totals = usePOFormTotals(formData, items);
  const setForm = (patch: Partial<PurchaseOrderUpdateFormData>) => setFormData((p) => ({ ...p, ...patch }));
  const productOptions = (products?.results || []).map((p) => ({ value: p.id, label: `${p.name} (${p.code})`, searchText: `${p.name} ${p.code}` }));

  const handleAddItem = () => {
    if (!newItem.product_id || newItem.quantity <= 0 || newItem.unit_price <= 0) return;
    setItems((prev) => [...prev, { ...newItem }]);
    setNewItem(BLANK_ITEM);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.supplier_id) { toast('Please select a supplier', 'warning'); return; }
    if (items.length === 0)    { toast('Please add at least one product', 'warning'); return; }
    mutation.mutate(formData);
  };

  if (isLoading) return <DocLoadState type="loading" />;
  if (!order)    return <DocLoadState type="not-found" message="Purchase Order not found." />;

  if ((order.status === 'approved' || order.status === 'completed') && !isAdmin) {
    return (
      <MainLayout>
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <p style={{ marginBottom: 'var(--space-4)' }}>This purchase order cannot be edited because it is <strong>{order.status}</strong>.</p>
          <Link href={`/purchase-orders/${id}`}><Button variant="primary">Back to Order</Button></Link>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <PageShell>
        <PageHeader
          title={`${t('page', 'editPO')}: ${order.order_number}`}
          description="Update purchase order details"
          breadcrumbs={[
            { label: t('page', 'purchaseOrders'), href: '/purchase-orders' },
            { label: order.order_number, href: `/purchase-orders/${id}` },
            { label: 'Edit' },
          ]}
        />

        <form onSubmit={handleSubmit}>
          {/* Header info */}
          <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)' }}>
              <div>
                <SearchableDropdown
                  label={t('col', 'supplier')} required
                  options={(suppliers || []).map((s) => ({ value: s.id, label: s.name, searchText: `${s.name} ${s.business_name || ''} ${s.contact_person || ''}` }))}
                  value={formData.supplier_id}
                  onChange={(val) => setForm({ supplier_id: val ? Number(val) : 0 })}
                  placeholder={t('misc', 'selectSupplier')}
                  searchPlaceholder={t('misc', 'searchSuppliers')}
                />
              </div>

              <div>
                <label className="form-label">{t('col', 'orderDate')} <span style={{ color: 'var(--color-error)' }}>*</span></label>
                <input type="date" required className="form-input" value={formData.order_date}
                  onChange={(e) => setForm({ order_date: e.target.value })} />
              </div>

              <div>
                <label className="form-label">{t('field', 'deliveryDate')}</label>
                <input type="date" className="form-input" value={formData.delivery_date}
                  onChange={(e) => setForm({ delivery_date: e.target.value })} />
              </div>

              <div>
                <label className="form-label">{t('col', 'deliveryMethod')}</label>
                <select className="form-select" value={formData.delivery_method}
                  onChange={(e) => setForm({ delivery_method: e.target.value as 'pickup' | 'delivery' | '' })}>
                  <option value="">-- Select --</option>
                  <option value="pickup">Pick Up</option>
                  <option value="delivery">Delivery</option>
                </select>
              </div>

              <div>
                <label className="form-label">{t('col', 'status')}</label>
                <select className="form-select" value={formData.status}
                  onChange={(e) => setForm({ status: e.target.value as typeof formData.status })}>
                  <option value="draft">{t('status', 'draft')}</option>
                  <option value="pending">{t('status', 'pending')}</option>
                  {isAdmin && <option value="approved">{t('status', 'approved')}</option>}
                  {isAdmin && <option value="completed">{t('status', 'completed')}</option>}
                  <option value="rejected">{t('status', 'rejected')}</option>
                  <option value="cancelled">{t('status', 'cancelled')}</option>
                </select>
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Cost Code</label>
                <CostCodePicker value={costCode} onChange={(cc) => { setCostCode(cc); setForm({ cost_code_id: cc?.id ?? null }); }} />
              </div>
            </div>
          </div>

          {/* Items */}
          <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
            <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-semibold)', margin: '0 0 var(--space-4)' }}>{t('section', 'orderItems')}</h3>

            <AddItemPanel value={newItem} onChange={setNewItem} onAdd={handleAddItem} productOptions={productOptions} showTaxRate onProductSearch={setProductSearch} isProductsLoading={productsLoading} />

            {items.length > 0 && (
              <EditableStandardItemsTable
                items={items}
                onUpdate={(idx, field, val) => setItems((p) => p.map((it, i) => i === idx ? { ...it, [field]: val } : it))}
                onRemove={(idx) => setItems((p) => p.filter((_, i) => i !== idx))}
                showUnit={false}
                renderProduct={(item) => {
                  const prod = products?.results?.find((p) => p.id === item.product_id)
                    ?? order.items.find((oi) => (oi.product?.id ?? oi.product_id) === item.product_id)?.product;
                  return (
                    <>
                      <div style={{ fontWeight: 'var(--weight-medium)' }}>{prod?.name || 'N/A'}</div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{prod?.code || ''}</div>
                    </>
                  );
                }}
                formatPrice={formatPrice}
              />
            )}
          </div>

          {/* Terms */}
          <div className="card" style={{ marginBottom: 'var(--space-4)', background: 'var(--surface-inset)' }}>
            <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-semibold)', margin: '0 0 var(--space-4)' }}>{t('section', 'termsConditions')}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-4)' }}>
              <div>
                <label className="form-label">{t('field', 'paymentTerms')}</label>
                <textarea className="form-textarea" rows={3} placeholder="Payment terms…"
                  value={formData.payment_terms} onChange={(e) => setForm({ payment_terms: e.target.value })} />
              </div>
              <div>
                <label className="form-label">{t('field', 'deliveryTerms')}</label>
                <textarea className="form-textarea" rows={3} placeholder="Delivery terms…"
                  value={formData.delivery_terms} onChange={(e) => setForm({ delivery_terms: e.target.value })} />
              </div>
              <div>
                <label className="form-label">{t('col', 'notes')}</label>
                <textarea className="form-textarea" rows={3} placeholder="Notes…"
                  value={formData.notes} onChange={(e) => setForm({ notes: e.target.value })} />
              </div>
              <div>
                <label className="form-label">Standard Terms & Conditions</label>
                <textarea className="form-textarea" rows={3} placeholder="Terms & Conditions…" style={{ fontFamily: 'monospace', fontSize: 'var(--text-sm)' }}
                  value={formData.terms_and_conditions} onChange={(e) => setForm({ terms_and_conditions: e.target.value })} />
              </div>
            </div>
          </div>

          {/* Financial summary */}
          <POFormSummary
            totals={totals}
            discount={formData.discount ?? 0}
            taxRate={formData.tax_rate}
            transportationCharge={formData.transportation_charge}
            transportVatIncluded={formData.transport_vat_included}
            onDiscountChange={(v) => setForm({ discount: v })}
            onTaxRateChange={(v) => setForm({ tax_rate: v })}
            onTransportChange={(v) => setForm({ transportation_charge: v })}
            onTransportVatChange={(v) => setForm({ transport_vat_included: v })}
          />

          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <Button type="submit" variant="primary" isLoading={mutation.isPending} disabled={mutation.isPending}>
              {t('btn', 'update')} {t('page', 'purchaseOrders')}
            </Button>
            <Link href={`/purchase-orders/${id}`}><Button variant="secondary">Cancel</Button></Link>
          </div>
        </form>
      </PageShell>
    </MainLayout>
  );
}
