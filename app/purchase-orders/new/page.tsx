'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { purchaseOrdersApi } from '@/lib/api/purchase-orders';
import { purchaseRequestsApi } from '@/lib/api/purchase-requests';
import { purchaseQuotationsApi } from '@/lib/api/purchase-quotations';
import { suppliersApi } from '@/lib/api/suppliers';
import { productsApi } from '@/lib/api/products';
import MainLayout from '@/components/layout/MainLayout';
import Link from 'next/link';
import { Button, PageShell } from '@/components/ui';
import type { CostCode, PurchaseOrderItem, Product } from '@/types';
import { PurchaseOrderFormData, toPurchaseOrderCreateData } from '@/lib/types/form-data';
import { toast } from '@/lib/hooks/use-toast';
import SearchableDropdown from '@/components/ui/SearchableDropdown';
import CostCodePicker from '@/components/domain/CostCodePicker';
import FormField from '@/components/ui/FormField';
import { formatPrice } from '@/lib/utils/format';
import { formatBackendError, validateDateAfter, validatePositiveNumber } from '@/lib/utils/validation';
import { canCreatePurchaseOrder } from '@/lib/utils/workflow-guards';
import RouteGuard from '@/components/auth/RouteGuard';
import { useT } from '@/lib/i18n/useT';
import { usePOFormTotals } from '@/lib/hooks/use-po-form-totals';
import { EditableStandardItemsTable } from '@/components/procurement/EditableStandardItemsTable';
import { AddItemPanel, AddItemState } from '@/components/procurement/shared/AddItemPanel';
import { POFormSummary } from '@/components/procurement/shared/POFormSummary';
import { DocInfoBanner } from '@/components/procurement/shared/DocInfoBanner';

export default function NewPurchaseOrderPage() {
  return (
    <RouteGuard requiredPermission={{ category: 'purchase_order', action: 'create' }} redirectTo="/purchase-orders">
      <NewPOContent />
    </RouteGuard>
  );
}

type FormItem = Omit<PurchaseOrderItem, 'product' | 'total' | 'created_at'> & { _product?: Product | null };

const BLANK_ITEM: AddItemState = { product_id: 0, quantity: 0, unit_price: 0, discount: 0, tax_rate: 0, notes: '' };

function NewPOContent() {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const purchaseRequestId   = searchParams.get('purchase_request_id');
  const purchaseQuotationId = searchParams.get('purchase_quotation_id');
  const missingSource = !purchaseRequestId && !purchaseQuotationId;

  // ── All hooks must run unconditionally ──────────────────────────────────
  const [formData, setFormData] = useState<PurchaseOrderFormData>({
    purchase_request_id:   purchaseRequestId  ? Number(purchaseRequestId)  : undefined,
    purchase_quotation_id: purchaseQuotationId ? Number(purchaseQuotationId) : undefined,
    supplier_id: 0,
    order_date: new Date().toISOString().split('T')[0],
    delivery_date: '', delivery_method: '', payment_terms: '', delivery_terms: '',
    notes: '', terms_and_conditions: 'Conditions: -',
    tax_rate: 0, discount: 0, transportation_charge: 0, transport_vat_included: true,
    status: 'pending',
  });
  const [items, setItems]       = useState<FormItem[]>([]);
  const [newItem, setNewItem]   = useState<AddItemState>(BLANK_ITEM);
  const [costCode, setCostCode] = useState<CostCode | null>(null);
  const [errors, setErrors]     = useState<Record<string, string>>({});

  const { data: purchaseRequest }   = useQuery({ queryKey: ['purchase-requests', purchaseRequestId], queryFn: () => purchaseRequestsApi.getById(Number(purchaseRequestId!)), enabled: !!purchaseRequestId });
  const { data: purchaseQuotation } = useQuery({ queryKey: ['purchase-quotations', purchaseQuotationId], queryFn: () => purchaseQuotationsApi.getById(Number(purchaseQuotationId!)), enabled: !!purchaseQuotationId });
  const { data: suppliers }         = useQuery({ queryKey: ['suppliers', 'all-active'], queryFn: () => suppliersApi.getAllActive() });
  const { data: products }          = useQuery({ queryKey: ['products'], queryFn: () => productsApi.getAll({ page: 1, page_size: 1000 }), staleTime: 10 * 60 * 1000 });

  // Redirect if no source document
  useEffect(() => { if (missingSource) router.push('/purchase-requests'); }, [missingSource, router]);

  // Auto-fill from linked document
  useEffect(() => {
    if (purchaseQuotation) {
      const supplierId = typeof purchaseQuotation.supplier === 'object' ? purchaseQuotation.supplier.id : purchaseQuotation.supplier;
      setFormData((p) => ({
        ...p, supplier_id: supplierId,
        payment_terms: purchaseQuotation.payment_terms || '',
        delivery_terms: purchaseQuotation.delivery_terms || '',
        notes: purchaseQuotation.notes || '',
        tax_rate: Number(purchaseQuotation.tax_rate || 0),
        discount: Number(purchaseQuotation.discount || 0),
        delivery_date: purchaseQuotation.valid_until || '',
        delivery_method: purchaseQuotation.delivery_method || '',
      }));
      if (purchaseQuotation.items?.length) {
        setItems(purchaseQuotation.items.map((item) => ({
          product_id: item.product?.id || item.product_id,
          quantity: Number(item.quantity || 0),
          unit_price: Number(item.unit_price || 0),
          discount: Number(item.discount ?? 0),
          tax_rate: Number((item as { tax_rate?: number }).tax_rate ?? (item as { tax?: number }).tax ?? 0),
          notes: item.notes || '',
          _product: item.product || null,
        })));
      }
    } else if (purchaseRequest) {
      if (purchaseRequest.items?.length) {
        setItems(purchaseRequest.items.map((item) => ({
          product_id: item.product?.id || item.product_id,
          quantity: Number(item.quantity || 0),
          unit_price: 0, discount: 0, tax_rate: 0,
          notes: item.notes || '',
          _product: item.product || null,
        })));
      }
    }
  }, [purchaseRequest, purchaseQuotation]);

  // Enrich items with product data once products list loads
  useEffect(() => {
    if (!products?.results || items.length === 0) return;
    setItems((prev) => prev.map((item) => {
      if (item._product) return item;
      const p = products.results.find((pr) => pr.id === item.product_id);
      return p ? { ...item, _product: p } : item;
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products?.results]);

  const totals = usePOFormTotals(formData, items);
  const setForm = (patch: Partial<PurchaseOrderFormData>) => setFormData((p) => ({ ...p, ...patch }));
  const productOptions = (products?.results || []).map((p) => ({ value: p.id, label: `${p.name} (${p.code})`, searchText: `${p.name} ${p.code}` }));

  const mutation = useMutation({
    mutationFn: purchaseOrdersApi.create,
    onSuccess: () => { toast('Purchase order created!', 'success'); router.push('/purchase-orders'); },
    onError: (err: { response?: { data?: Record<string, unknown> }; message?: string }) => {
      toast(formatBackendError(err), 'error');
      const data = err?.response?.data;
      if (data) {
        const be: Record<string, string> = {};
        Object.entries(data).forEach(([k, v]) => {
          if (Array.isArray(v)) be[k] = String(v[0]);
          else if (typeof v === 'string') be[k] = v;
          else if (v && typeof v === 'object') {
            Object.entries(v as Record<string, unknown>).forEach(([nk, nv]) => {
              be[`${k}.${nk}`] = Array.isArray(nv) ? String(nv[0]) : String(nv);
            });
          }
        });
        setErrors(be);
      }
    },
  });

  // Early return AFTER all hooks
  if (missingSource) return null;

  const fromQR = !!purchaseQuotation;

  const handleAddItem = () => {
    if (!newItem.product_id || newItem.quantity <= 0 || newItem.unit_price <= 0) return;
    const product = products?.results?.find((p) => p.id === newItem.product_id);
    setItems((prev) => [...prev, { ...newItem, _product: product || null }]);
    setNewItem(BLANK_ITEM);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    const errs: Record<string, string> = {};
    if (!formData.supplier_id) errs.supplier_id = 'Supplier is required.';
    if (!formData.order_date)  errs.order_date  = 'Order date is required.';
    if (formData.delivery_date) {
      const de = validateDateAfter(formData.delivery_date, formData.order_date, 'Delivery Date', 'Order Date');
      if (de) errs.delivery_date = de;
    }
    if (items.length === 0) errs.items = 'At least one product is required.';
    items.forEach((item, i) => {
      if (!item.product_id) errs[`items.${i}.product_id`] = 'Product required.';
      const qe = validatePositiveNumber(item.quantity, `Product ${i + 1} Quantity`);
      if (qe) errs[`items.${i}.quantity`] = qe;
      if (item.unit_price < 0) errs[`items.${i}.unit_price`] = `Unit price for product ${i + 1} cannot be negative.`;
    });
    const guard = fromQR ? canCreatePurchaseOrder(purchaseQuotation!.status) : canCreatePurchaseOrder(undefined, purchaseRequest?.status);
    if (!guard.canProceed) { toast(guard.reason || 'Cannot create PO', 'error'); return; }
    if (Object.keys(errs).length > 0) { setErrors(errs); toast('Please correct the errors', 'error'); return; }
    mutation.mutate({ ...toPurchaseOrderCreateData(formData, items), cost_code_id: costCode?.id ?? null });
  };

  return (
    <MainLayout>
      <PageShell>
        <div className="form-page-top">
          <Link href="/purchase-orders" className="form-page-top-back">← {t('page', 'purchaseOrders')}</Link>
          <h1 className="form-page-top-title">{t('page', 'newPO')}</h1>
        </div>

        {/* Context banner */}
        {purchaseQuotation && (
          <DocInfoBanner title="Quotation Information (Awarded)" fields={[
            { label: 'Quotation No.', value: purchaseQuotation.quotation_number },
            { label: 'Supplier', value: typeof purchaseQuotation.supplier === 'object' ? purchaseQuotation.supplier.name : 'N/A' },
            { label: 'Total', value: formatPrice(Number(purchaseQuotation.total || 0)) },
          ]} />
        )}
        {purchaseRequest && !purchaseQuotation && (
          <DocInfoBanner title="Purchase Request Information" fields={[
            { label: 'Code', value: purchaseRequest.code },
            { label: 'Title', value: purchaseRequest.title },
            ...(purchaseRequest.project_code ? [{ label: 'Project', value: purchaseRequest.project_code }] : []),
          ]} />
        )}

        <form onSubmit={handleSubmit}>
          {/* Header info */}
          <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-4)' }}>
              <div>
                <SearchableDropdown
                  label={t('col', 'supplier')} required
                  options={(suppliers || []).map((s) => ({ value: s.id, label: s.name, searchText: `${s.name} ${s.business_name || ''} ${s.contact_person || ''}` }))}
                  value={formData.supplier_id}
                  onChange={(val) => {
                    if (fromQR && purchaseQuotation?.status === 'awarded') { toast('Supplier is fixed for awarded quotations', 'error'); return; }
                    setForm({ supplier_id: val ? Number(val) : 0 });
                  }}
                  placeholder={t('misc', 'selectSupplier')}
                  searchPlaceholder={t('misc', 'searchSuppliers')}
                  disabled={fromQR && purchaseQuotation?.status === 'awarded'}
                />
                {errors.supplier_id && <p style={{ color: 'var(--color-error)', fontSize: 'var(--text-xs)', margin: 'var(--space-1) 0 0' }}>{errors.supplier_id}</p>}
              </div>

              <div>
                <label className="form-label">{t('col', 'orderDate')} <span style={{ color: 'var(--color-error)' }}>*</span></label>
                <input type="date" required className="form-input" value={formData.order_date}
                  onChange={(e) => setForm({ order_date: e.target.value })} />
              </div>

              <FormField label={t('field', 'deliveryDate')} error={errors.delivery_date} fieldName="delivery_date">
                <input type="date" name="delivery_date" className="form-input" value={formData.delivery_date}
                  onChange={(e) => setForm({ delivery_date: e.target.value })} />
              </FormField>

              <FormField label={t('col', 'deliveryMethod')} fieldName="delivery_method">
                <select className="form-select" value={formData.delivery_method}
                  onChange={(e) => setForm({ delivery_method: e.target.value as 'pickup' | 'delivery' | '' })}>
                  <option value="">-- Select --</option>
                  <option value="pickup">Pick Up</option>
                  <option value="delivery">Delivery</option>
                </select>
              </FormField>
            </div>

            <div style={{ marginTop: 'var(--space-4)', borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-4)' }}>
              <label className="form-label">Cost Code <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>(optional)</span></label>
              <CostCodePicker value={costCode} onChange={setCostCode} />
              {costCode && (
                <div style={{ marginTop: 6, padding: '6px 10px', background: 'var(--muted)', borderRadius: 6, fontSize: 13 }}>
                  <span style={{ fontWeight: 600, color: '#f97316' }}>{costCode.excel_code}</span>
                  <span style={{ color: 'var(--text-secondary)', marginLeft: 8 }}>{costCode.description}</span>
                </div>
              )}
            </div>
          </div>

          {/* Items */}
          <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
              <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-semibold)', margin: 0 }}>{t('section', 'orderItems')}</h3>
              {!fromQR && items.length > 0 && (
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  <button type="button" className="btn btn-secondary" style={{ fontSize: 'var(--text-xs)', padding: '4px 10px' }}
                    onClick={() => setItems((p) => p.map((i) => ({ ...i, tax_rate: 5 })))}>Apply 5% VAT to All</button>
                  {items.some((i) => (i.tax_rate ?? 0) > 0) && (
                    <button type="button" className="btn btn-secondary" style={{ fontSize: 'var(--text-xs)', padding: '4px 10px' }}
                      onClick={() => setItems((p) => p.map((i) => ({ ...i, tax_rate: 0 })))}>Clear VAT</button>
                  )}
                </div>
              )}
            </div>

            {!fromQR && !purchaseRequest && (
              <AddItemPanel value={newItem} onChange={setNewItem} onAdd={handleAddItem} productOptions={productOptions} showTaxRate />
            )}

            {errors.items && <p style={{ color: 'var(--color-error)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-3)' }}>{errors.items}</p>}

            {items.length > 0 ? (
              <EditableStandardItemsTable
                items={items}
                onUpdate={(idx, field, val) => setItems((p) => p.map((it, i) => i === idx ? { ...it, [field]: val } : it))}
                onRemove={fromQR ? undefined : (idx) => setItems((p) => p.filter((_, i) => i !== idx))}
                readOnly={fromQR}
                showUnit
                getUnit={(item) => (item as FormItem)._product?.unit?.toUpperCase() || '—'}
                renderProduct={(item) => {
                  const fItem = item as FormItem;
                  const prod = fItem._product || products?.results?.find((p) => p.id === item.product_id);
                  return (
                    <>
                      <div style={{ fontWeight: 'var(--weight-medium)' }}>{prod?.name || `Product #${item.product_id}`}</div>
                      {prod?.code && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{prod.code}</div>}
                    </>
                  );
                }}
                formatPrice={formatPrice}
              />
            ) : (
              <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--text-secondary)', background: 'var(--surface-subtle)', borderRadius: 'var(--radius-md)' }}>
                {fromQR ? 'No products in the awarded quotation.' : 'No products yet.'}
              </div>
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
                <textarea className="form-textarea" rows={3} placeholder="Additional notes…"
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
            discount={formData.discount}
            taxRate={formData.tax_rate}
            transportationCharge={formData.transportation_charge}
            transportVatIncluded={formData.transport_vat_included}
            lockDiscount={fromQR}
            onDiscountChange={fromQR ? undefined : (v) => setForm({ discount: v })}
            onTaxRateChange={(v) => setForm({ tax_rate: v })}
            onTransportChange={(v) => setForm({ transportation_charge: v })}
            onTransportVatChange={(v) => setForm({ transport_vat_included: v })}
          />

          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <Button type="submit" variant="primary" isLoading={mutation.isPending} disabled={mutation.isPending}>
              {mutation.isPending ? t('btn', 'creating') : t('btn', 'createPO')}
            </Button>
            <Link href={purchaseRequestId ? `/purchase-requests/${purchaseRequestId}` : '/purchase-requests'}>
              <Button variant="secondary">{t('btn', 'cancel')}</Button>
            </Link>
          </div>
        </form>
      </PageShell>
    </MainLayout>
  );
}
