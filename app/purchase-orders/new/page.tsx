'use client';

import { useState, useEffect, useRef } from 'react';
import { useDebounce } from '@/lib/hooks/use-debounce';
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
type FormCharge = { pr_charge_id?: number | null; description: string; charge_type: 'lump_sum' | 'per_unit'; rate: string; quantity: string };

const BLANK_ITEM: AddItemState = { product_id: 0, quantity: 0, unit_price: 0, discount: 0, tax_rate: 0, notes: '' };

function NewPOContent() {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const purchaseRequestId   = searchParams.get('purchase_request_id');
  const purchaseQuotationId = searchParams.get('purchase_quotation_id');
  const missingSource = !purchaseRequestId && !purchaseQuotationId;
  const formRef = useRef<HTMLFormElement>(null);

  // ── All hooks must run unconditionally ──────────────────────────────────
  const [productSearch, setProductSearch] = useState('');
  const debouncedProductSearch = useDebounce(productSearch, 300);

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
  const [charges, setCharges]   = useState<FormCharge[]>([]);
  const [newItem, setNewItem]   = useState<AddItemState>(BLANK_ITEM);
  const [costCode, setCostCode] = useState<CostCode | null>(null);
  const [errors, setErrors]     = useState<Record<string, string>>({});

  const { data: purchaseRequest }   = useQuery({ queryKey: ['purchase-requests', purchaseRequestId], queryFn: () => purchaseRequestsApi.getById(Number(purchaseRequestId!)), enabled: !!purchaseRequestId });
  const { data: purchaseQuotation } = useQuery({ queryKey: ['purchase-quotations', purchaseQuotationId], queryFn: () => purchaseQuotationsApi.getById(Number(purchaseQuotationId!)), enabled: !!purchaseQuotationId });
  const { data: suppliers }         = useQuery({ queryKey: ['suppliers', 'all-active'], queryFn: () => suppliersApi.getAllActive() });
  const { data: products, isFetching: productsLoading } = useQuery({
    queryKey: ['products', 'search', debouncedProductSearch],
    queryFn: () => productsApi.getAll({ search: debouncedProductSearch, page_size: 30 }),
    staleTime: 60_000,
  });

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
      if (purchaseRequest.charges?.length) {
        setCharges(purchaseRequest.charges.map((c) => ({
          pr_charge_id: c.id,
          description: c.description,
          charge_type: c.charge_type,
          rate: '',
          quantity: c.charge_type === 'per_unit' ? String(c.quantity || 1) : '1',
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
    const chargesToSubmit = charges
      .filter((c) => c.description.trim())
      .map((c) => ({
        pr_charge_id: c.pr_charge_id ?? null,
        description: c.description,
        charge_type: c.charge_type,
        rate: parseFloat(c.rate) || 0,
        quantity: parseFloat(c.quantity) || 1,
      }));
    mutation.mutate({ ...toPurchaseOrderCreateData(formData, items), cost_code_id: costCode?.id ?? null, charges: chargesToSubmit });
  };

  return (
    <MainLayout>
      <PageShell compact>
        {/* ── Sticky form bar ── */}
        <div className="proc-form-bar">
          <Link href="/purchase-orders" className="proc-form-bar-back">← {t('page', 'purchaseOrders')}</Link>
          <span className="proc-form-bar-sep" />
          <span className="proc-form-bar-badge">LPO</span>
          <h1 className="proc-form-bar-title">{t('page', 'newPO')}</h1>
          <div className="proc-form-bar-actions">
            <Button type="button" variant="primary" isLoading={mutation.isPending} disabled={mutation.isPending}
              onClick={() => formRef.current?.requestSubmit()}>
              {mutation.isPending ? t('btn', 'creating') : t('btn', 'createPO')}
            </Button>
            <Link href={purchaseRequestId ? `/purchase-requests/${purchaseRequestId}` : '/purchase-requests'}>
              <Button type="button" variant="secondary">{t('btn', 'cancel')}</Button>
            </Link>
          </div>
        </div>

        {/* ── Split layout ── */}
        <div className="proc-form-split">

          {/* ── LEFT: main form ── */}
          <form ref={formRef} onSubmit={handleSubmit} className="proc-form-main">

            {/* Order Details */}
            <div className="proc-sh">
              <span className="proc-sh-label">Order Details</span>
            </div>
            <div className="proc-form-section">
              <div className="form-grid form-grid--2col">
                <div style={{ gridColumn: '1 / -1' }}>
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
                  {errors.supplier_id && <p style={{ color: 'var(--color-error)', fontSize: 'var(--text-xs)', margin: '4px 0 0' }}>{errors.supplier_id}</p>}
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

                <div style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Cost Code <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>(optional)</span></label>
                  <CostCodePicker value={costCode} onChange={setCostCode} />
                  {costCode && (
                    <div style={{ marginTop: 5, padding: '5px 10px', background: 'var(--muted)', borderRadius: 6, fontSize: 13 }}>
                      <span style={{ fontWeight: 600, color: '#f97316' }}>{costCode.excel_code}</span>
                      <span style={{ color: 'var(--text-secondary)', marginLeft: 8 }}>{costCode.description}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Items */}
            <div className="proc-sh">
              <span className="proc-sh-label">{t('section', 'orderItems')}</span>
              <div className="proc-sh-right">
                {!fromQR && items.length > 0 && (
                  <>
                    <button type="button" className="btn btn-secondary" style={{ fontSize: 11, padding: '3px 8px' }}
                      onClick={() => setItems((p) => p.map((i) => ({ ...i, tax_rate: 5 })))}>Apply 5% VAT</button>
                    {items.some((i) => (i.tax_rate ?? 0) > 0) && (
                      <button type="button" className="btn btn-secondary" style={{ fontSize: 11, padding: '3px 8px' }}
                        onClick={() => setItems((p) => p.map((i) => ({ ...i, tax_rate: 0 })))}>Clear VAT</button>
                    )}
                  </>
                )}
                {errors.items && <span style={{ fontSize: 11, color: 'var(--color-error)' }}>{errors.items}</span>}
              </div>
            </div>
            <div style={{ padding: '10px 12px' }}>
              {!fromQR && !purchaseRequest && (
                <div style={{ marginBottom: 12 }}>
                  <AddItemPanel value={newItem} onChange={setNewItem} onAdd={handleAddItem} productOptions={productOptions} showTaxRate onProductSearch={setProductSearch} isProductsLoading={productsLoading} />
                </div>
              )}
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
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)', background: 'var(--surface-subtle)', borderRadius: 8 }}>
                  {fromQR ? 'No products in the awarded quotation.' : 'No products yet.'}
                </div>
              )}
            </div>

            {/* Additional Charges — pre-filled from PR */}
            {charges.length > 0 && (
              <>
                <div className="proc-sh" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  <span className="proc-sh-label">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display:'inline', marginRight: 5, verticalAlign: 'middle' }}>
                      <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
                    </svg>
                    Additional Charges
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--brand)', background: 'var(--brand-subtle)', borderRadius: 5, padding: '2px 8px' }}>
                    {charges.length} from PR
                  </span>
                </div>
                <div className="proc-form-section">
                  <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '0 0 12px', padding: '8px 12px', background: 'var(--surface-subtle)', borderRadius: 6, borderLeft: '3px solid var(--brand)' }}>
                    These charges were flagged in the Purchase Request. Enter the rate for each.
                  </p>
                  <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 10, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: 'var(--surface-subtle)' }}>
                          {['Description', 'Type', 'Rate (AED)', 'Qty', 'Total'].map((h) => (
                            <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--border-subtle)' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {charges.map((c, i) => {
                          const rate = parseFloat(c.rate) || 0;
                          const qty  = parseFloat(c.quantity) || 1;
                          const total = c.charge_type === 'lump_sum' ? rate : rate * qty;
                          return (
                            <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                              <td style={{ padding: '8px 12px', fontWeight: 600 }}>{c.description}</td>
                              <td style={{ padding: '8px 12px' }}>
                                <span style={{ fontSize: 10, fontWeight: 700, color: c.charge_type === 'lump_sum' ? 'var(--text-secondary)' : 'var(--brand)', background: 'var(--surface-subtle)', borderRadius: 4, padding: '2px 6px' }}>
                                  {c.charge_type === 'lump_sum' ? 'Lump Sum' : 'Per Unit'}
                                </span>
                              </td>
                              <td style={{ padding: '6px 12px', width: 130 }}>
                                <input type="number" min="0" step="0.01" className="form-input" placeholder="0.00"
                                  value={c.rate}
                                  onChange={(e) => {
                                    const updated = [...charges];
                                    updated[i] = { ...updated[i], rate: e.target.value };
                                    setCharges(updated);
                                  }} />
                              </td>
                              <td style={{ padding: '6px 12px', width: 90 }}>
                                {c.charge_type === 'per_unit' ? (
                                  <input type="number" min="0.0001" step="0.0001" className="form-input"
                                    value={c.quantity}
                                    onChange={(e) => {
                                      const updated = [...charges];
                                      updated[i] = { ...updated[i], quantity: e.target.value };
                                      setCharges(updated);
                                    }} />
                                ) : (
                                  <span style={{ color: 'var(--text-tertiary)', paddingLeft: 4 }}>—</span>
                                )}
                              </td>
                              <td style={{ padding: '8px 12px', fontWeight: 700, color: total > 0 ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                                {total > 0 ? `AED ${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      {charges.some((c) => parseFloat(c.rate) > 0) && (
                        <tfoot>
                          <tr style={{ background: 'var(--surface-subtle)' }}>
                            <td colSpan={4} style={{ padding: '8px 12px', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total Charges</td>
                            <td style={{ padding: '8px 12px', fontWeight: 800, color: 'var(--brand)', fontSize: 13 }}>
                              AED {charges.reduce((s, c) => {
                                const rate = parseFloat(c.rate) || 0;
                                const qty  = parseFloat(c.quantity) || 1;
                                return s + (c.charge_type === 'lump_sum' ? rate : rate * qty);
                              }, 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>
              </>
            )}

            {/* Terms */}
            <div className="proc-sh">
              <span className="proc-sh-label">{t('section', 'termsConditions')}</span>
            </div>
            <div className="proc-form-section">
              <div className="form-grid form-grid--2col">
                <div>
                  <label className="form-label">{t('field', 'paymentTerms')}</label>
                  <textarea className="form-textarea" rows={2} placeholder="Payment terms…"
                    value={formData.payment_terms} onChange={(e) => setForm({ payment_terms: e.target.value })} />
                </div>
                <div>
                  <label className="form-label">{t('field', 'deliveryTerms')}</label>
                  <textarea className="form-textarea" rows={2} placeholder="Delivery terms…"
                    value={formData.delivery_terms} onChange={(e) => setForm({ delivery_terms: e.target.value })} />
                </div>
                <div>
                  <label className="form-label">{t('col', 'notes')}</label>
                  <textarea className="form-textarea" rows={2} placeholder="Additional notes…"
                    value={formData.notes} onChange={(e) => setForm({ notes: e.target.value })} />
                </div>
                <div>
                  <label className="form-label">Standard Terms & Conditions</label>
                  <textarea className="form-textarea" rows={2} placeholder="Terms & Conditions…"
                    value={formData.terms_and_conditions} onChange={(e) => setForm({ terms_and_conditions: e.target.value })} />
                </div>
              </div>
            </div>

          </form>

          {/* ── RIGHT: sticky aside ── */}
          <div className="proc-form-aside">

            {purchaseQuotation && (
              <DocInfoBanner title="Quotation (Awarded)" fields={[
                { label: 'Quotation No.', value: purchaseQuotation.quotation_number },
                { label: 'Supplier', value: typeof purchaseQuotation.supplier === 'object' ? purchaseQuotation.supplier.name : 'N/A' },
                { label: 'Total', value: formatPrice(Number(purchaseQuotation.total || 0)) },
              ]} />
            )}
            {purchaseRequest && !purchaseQuotation && (
              <DocInfoBanner title="Purchase Request" fields={[
                { label: 'Code', value: purchaseRequest.code },
                { label: 'Title', value: purchaseRequest.title },
                ...(purchaseRequest.project_code ? [{ label: 'Project', value: purchaseRequest.project_code }] : []),
              ]} />
            )}

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

          </div>
        </div>
      </PageShell>
    </MainLayout>
  );
}
