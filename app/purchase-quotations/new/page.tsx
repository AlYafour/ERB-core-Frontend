'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { purchaseQuotationsApi } from '@/lib/api/purchase-quotations';
import { quotationRequestsApi } from '@/lib/api/quotation-requests';
import { purchaseRequestsApi } from '@/lib/api/purchase-requests';
import { suppliersApi } from '@/lib/api/suppliers';
import MainLayout from '@/components/layout/MainLayout';
import Link from 'next/link';
import { Product, PurchaseQuotationItem } from '@/types';
import { PurchaseQuotationFormData, toPurchaseQuotationCreateData } from '@/lib/types/form-data';
import { toast } from '@/lib/hooks/use-toast';
import SearchableDropdown from '@/components/ui/SearchableDropdown';
import FormField from '@/components/ui/FormField';
import { Button, PageShell } from '@/components/ui';
import { formatBackendError, validatePositiveNumber, validateDateAfter } from '@/lib/utils/validation';
import { formatPrice } from '@/lib/utils/format';
import RouteGuard from '@/components/auth/RouteGuard';
import { useT } from '@/lib/i18n/useT';
import { EditableStandardItemsTable } from '@/components/procurement/EditableStandardItemsTable';
import { DocInfoBanner } from '@/components/procurement/shared/DocInfoBanner';

type PurchaseQuotationFormItem = Omit<PurchaseQuotationItem, 'product' | 'total' | 'created_at'> & {
  _product?: Product | null;
};

export default function NewPurchaseQuotationPage() {
  return (
    <RouteGuard
      requiredPermission={{ category: 'purchase_quotation', action: 'create' }}
      redirectTo="/purchase-quotations"
    >
      <NewPurchaseQuotationPageContent />
    </RouteGuard>
  );
}

function NewPurchaseQuotationPageContent() {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const quotationRequestId = searchParams.get('quotation_request_id');
  const formRef = useRef<HTMLFormElement>(null);

  const [formData, setFormData] = useState<PurchaseQuotationFormData>({
    quotation_request_id: quotationRequestId ? Number(quotationRequestId) : undefined,
    purchase_request_id: undefined,
    supplier_id: 0,
    quotation_number: '',
    quotation_date: new Date().toISOString().split('T')[0],
    valid_until: '',
    payment_terms: '',
    delivery_terms: '',
    delivery_method: '',
    notes: '',
    tax_rate: 0,
    discount: 0,
  });

  const [items, setItems] = useState<PurchaseQuotationFormItem[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: quotationRequest } = useQuery({
    queryKey: ['quotation-requests', quotationRequestId],
    queryFn: () => quotationRequestsApi.getById(Number(quotationRequestId!)),
    enabled: !!quotationRequestId,
  });

  // Get purchase request if we have purchase_request_id
  const purchaseRequestIdFromQR = quotationRequest 
    ? (typeof quotationRequest.purchase_request === 'object' 
        ? quotationRequest.purchase_request.id 
        : quotationRequest.purchase_request)
    : null;

  const { data: purchaseRequest } = useQuery({
    queryKey: ['purchase-requests', purchaseRequestIdFromQR],
    queryFn: () => purchaseRequestsApi.getById(Number(purchaseRequestIdFromQR!)),
    enabled: !!purchaseRequestIdFromQR,
  });

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => suppliersApi.getAll({ page: 1 }),
  });

  useEffect(() => {
    if (quotationRequest) {
      // Get supplier ID (handle both object and number)
      const supplierId = typeof quotationRequest.supplier === 'object' 
        ? quotationRequest.supplier.id 
        : quotationRequest.supplier;
      
      // Get purchase_request_id from quotation_request
      const purchaseRequestId = typeof quotationRequest.purchase_request === 'object'
        ? quotationRequest.purchase_request.id
        : quotationRequest.purchase_request;
      
      setFormData((prev) => ({
        ...prev,
        quotation_request_id: quotationRequest.id,
        purchase_request_id: purchaseRequestId ?? undefined,
        supplier_id: supplierId,
      }));
      
      // Pre-fill items from Quotation Request
      if (quotationRequest.items && quotationRequest.items.length > 0) {
        const requestItems = quotationRequest.items.map((item): PurchaseQuotationFormItem | null => {
          // Get product_id (handle both object and number)
          const productId = item.product?.id || item.product_id;
          
          if (!productId) return null;
          
          return {
            product_id: productId,
            quantity: item.quantity || 0,
            unit_price: 0, // User will enter price
            discount: 0,
            tax_rate: 0,
            notes: item.notes || '',
            // Store product info if available for display
            _product: item.product || null,
          };
        }).filter((item): item is PurchaseQuotationFormItem => item !== null); // Remove any null items
        
        if (requestItems.length > 0) {
          setItems(requestItems);
        }
      }
    }
  }, [quotationRequest]);

  const mutation = useMutation({
    mutationFn: purchaseQuotationsApi.create,
    onSuccess: () => {
      toast('Purchase quotation created successfully!', 'success');
      router.push('/purchase-quotations');
    },
    onError: (error: any) => {
      const errorMessage = formatBackendError(error);
      toast(errorMessage, 'error');
      
      // Set field-specific errors
      if (error?.response?.data) {
        const backendErrors: Record<string, string> = {};
        Object.entries(error.response.data).forEach(([key, value]) => {
          if (Array.isArray(value)) {
            backendErrors[key] = value[0];
          } else if (typeof value === 'string') {
            backendErrors[key] = value;
          } else if (typeof value === 'object') {
            Object.entries(value as Record<string, any>).forEach(([nestedKey, nestedValue]) => {
              backendErrors[`${key}.${nestedKey}`] = Array.isArray(nestedValue) ? nestedValue[0] : nestedValue;
            });
          }
        });
        setErrors(backendErrors);
      }
    },
  });


  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleUpdateItem = (index: number, field: string, value: any) => {
    const updatedItems = [...items];
    const currentItem = items[index];
    updatedItems[index] = { 
      ...currentItem, 
      [field]: value,
      // Always preserve _product
      _product: currentItem._product || null,
    };
    setItems(updatedItems);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    
    // Frontend validation
    const validationErrors: Record<string, string> = {};
    
    // Check if PR has awarded quotation or purchase orders
    if (purchaseRequest) {
      if (purchaseRequest.has_awarded_quotation) {
        validationErrors.purchase_request_id = 'This Purchase Request already has an awarded quotation. Cannot create new purchase quotations after supplier has been awarded.';
        toast('This Purchase Request already has an awarded quotation. Cannot create new purchase quotations.', 'error');
      } else if (purchaseRequest.has_purchase_orders) {
        validationErrors.purchase_request_id = 'This Purchase Request already has purchase orders. Cannot create new purchase quotations after LPO has been created.';
        toast('This Purchase Request already has purchase orders. Cannot create new purchase quotations.', 'error');
      }
    }
    
    // Validate supplier
    if (!formData.supplier_id || formData.supplier_id === 0) {
      validationErrors.supplier_id = 'Supplier is required. Please select a supplier.';
    }
    
    // Validate quotation date
    if (!formData.quotation_date) {
      validationErrors.quotation_date = 'Quotation date is required.';
    }
    
    // Validate valid_until
    if (formData.valid_until) {
      const dateError = validateDateAfter(formData.valid_until, formData.quotation_date, 'Valid Until', 'Quotation Date');
      if (dateError) {
        validationErrors.valid_until = dateError;
      }
    }
    
    // Validate items
    if (items.length === 0) {
      validationErrors.items = 'At least one product must be added.';
    } else {
      // Validate each item
      items.forEach((item, index) => {
        if (!item.product_id || item.product_id === 0) {
          validationErrors[`items.${index}.product_id`] = 'Product is required.';
        }
        const qtyError = validatePositiveNumber(item.quantity, `Product ${index + 1} Quantity`);
        if (qtyError) {
          validationErrors[`items.${index}.quantity`] = qtyError;
        }
        if (item.unit_price < 0) {
          validationErrors[`items.${index}.unit_price`] = `Unit price for product ${index + 1} cannot be negative.`;
        }
        if ((item.discount ?? 0) < 0) {
          validationErrors[`items.${index}.discount`] = `Discount for product ${index + 1} cannot be negative.`;
        }
        const taxRate = item.tax_rate ?? 0;
        if (taxRate < 0 || taxRate > 100) {
          validationErrors[`items.${index}.tax_rate`] = `Tax rate for product ${index + 1} must be between 0 and 100.`;
        }
      });
    }
    
    if (formData.discount < 0) {
      validationErrors.discount = 'Discount cannot be negative.';
    }
    
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      toast('Please correct the errors in the form', 'error');
      // Scroll to first error
      setTimeout(() => {
        const firstErrorField = Object.keys(validationErrors)[0];
        const element = document.querySelector(`[name="${firstErrorField}"]`) || 
                       document.querySelector(`[data-field="${firstErrorField}"]`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          if ('focus' in element && typeof (element as any).focus === 'function') {
            (element as any).focus();
          }
        }
      }, 100);
      return;
    }
    
    mutation.mutate(toPurchaseQuotationCreateData(formData, items));
  };

  const calculateSubtotal = () => {
    return items.reduce((sum, item) => {
      const itemTotal = item.quantity * item.unit_price;
      const discountAmount = itemTotal * ((item.discount ?? 0) / 100);
      return sum + itemTotal - discountAmount;
    }, 0);
  };

  const calculateTax = () => {
    return items.reduce((sum, item) => {
      const itemSubtotal = item.quantity * item.unit_price;
      const discountAmount = itemSubtotal * ((item.discount ?? 0) / 100);
      const afterDiscount = itemSubtotal - discountAmount;
      return sum + afterDiscount * ((item.tax_rate ?? 0) / 100);
    }, 0);
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    const discountAmount = subtotal * (formData.discount / 100);
    const afterDiscount = subtotal - discountAmount;
    return afterDiscount + calculateTax();
  };

  const applyVatToAll = (rate: number) => {
    setItems(items.map((item) => ({ ...item, tax_rate: rate })));
  };

  return (
    <MainLayout>
      <PageShell compact>

        {/* ── Sticky form bar ── */}
        <div className="proc-form-bar">
          <Link href="/purchase-quotations" className="proc-form-bar-back">← {t('page', 'purchaseQuotations')}</Link>
          <span className="proc-form-bar-sep" />
          <span className="proc-form-bar-badge">PQ</span>
          <h1 className="proc-form-bar-title">{t('page', 'newQuotation')}</h1>
          <div className="proc-form-bar-actions">
            <Button type="button" variant="primary" disabled={mutation.isPending} isLoading={mutation.isPending}
              onClick={() => formRef.current?.requestSubmit()}>
              {t('page', 'newQuotation')}
            </Button>
            <Button type="button" variant="secondary" onClick={() => router.push('/purchase-quotations')}>
              {t('btn', 'cancel')}
            </Button>
          </div>
        </div>

        {/* ── Validation errors ── */}
        {Object.keys(errors).length > 0 && (
          <div style={{ backgroundColor: 'var(--color-error-light)', border: '1px solid var(--color-error)', borderRadius: 8, padding: '10px 14px' }}>
            <p style={{ fontWeight: 600, color: 'var(--color-error)', margin: '0 0 6px 0', fontSize: 'var(--text-sm)' }}>Please fix the following errors:</p>
            <ul style={{ margin: 0, paddingInlineStart: '1.25rem', display: 'flex', flexDirection: 'column', gap: 3 }}>
              {Object.entries(errors).map(([key, msg]) => msg ? (
                <li key={key} style={{ fontSize: 'var(--text-sm)', color: 'var(--color-error)' }}>{msg}</li>
              ) : null)}
            </ul>
          </div>
        )}

        {/* ── Split layout: form left, summary right ── */}
        <div className="proc-form-split">

          {/* ── LEFT: main form ── */}
          <form ref={formRef} onSubmit={handleSubmit} className="proc-form-main">

            {/* Section 1: Quotation Details */}
            <div className="proc-sh">
              <span className="proc-sh-label">Quotation Details</span>
            </div>
            <div className="proc-form-section">
              <div className="form-grid form-grid--2col">
                <FormField label={t('col', 'supplier')} required error={errors.supplier_id} fieldName="supplier_id">
                  <SearchableDropdown
                    options={[
                      { value: 0, label: 'Select Supplier' },
                      ...(suppliers?.results.filter((s) => s.is_active).map((supplier) => ({
                        value: supplier.id, label: supplier.business_name || supplier.name,
                        searchText: `${supplier.business_name || ''} ${supplier.name || ''} ${supplier.contact_person || ''}`,
                      })) || []),
                    ]}
                    value={formData.supplier_id}
                    onChange={(val) => { setFormData({ ...formData, supplier_id: Number(val) }); if (errors.supplier_id) setErrors({ ...errors, supplier_id: '' }); }}
                    placeholder="Select Supplier"
                    allowClear
                  />
                </FormField>

                <FormField label="Quotation Date" required error={errors.quotation_date} fieldName="quotation_date">
                  <input type="date" name="quotation_date" value={formData.quotation_date}
                    onChange={(e) => { setFormData({ ...formData, quotation_date: e.target.value }); if (errors.quotation_date) setErrors({ ...errors, quotation_date: '' }); }}
                    className="form-input" />
                </FormField>

                <FormField label="Valid Until" error={errors.valid_until} fieldName="valid_until">
                  <input type="date" name="valid_until" value={formData.valid_until}
                    onChange={(e) => { setFormData({ ...formData, valid_until: e.target.value }); if (errors.valid_until) setErrors({ ...errors, valid_until: '' }); }}
                    className="form-input" />
                </FormField>

                <FormField label="Discount (%)" error={errors.discount} fieldName="discount">
                  <input type="number" name="discount" step="0.01" min="0" value={formData.discount}
                    onChange={(e) => { setFormData({ ...formData, discount: Number(e.target.value) }); if (errors.discount) setErrors({ ...errors, discount: '' }); }}
                    className="form-input" />
                </FormField>

                <FormField label="Delivery Method">
                  <select value={formData.delivery_method}
                    onChange={(e) => setFormData({ ...formData, delivery_method: e.target.value as 'pickup' | 'delivery' | '' })}
                    className="form-select">
                    <option value="">— Select —</option>
                    <option value="pickup">Pick Up</option>
                    <option value="delivery">Delivery</option>
                  </select>
                </FormField>

                <FormField label="Payment Terms">
                  <textarea value={formData.payment_terms} onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })} rows={2} className="form-textarea" />
                </FormField>

                <FormField label="Delivery Terms">
                  <textarea value={formData.delivery_terms} onChange={(e) => setFormData({ ...formData, delivery_terms: e.target.value })} rows={2} className="form-textarea" />
                </FormField>

                <FormField label="Notes">
                  <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={2} className="form-textarea" />
                </FormField>
              </div>
            </div>

            {/* Section 2: Products */}
            <div className="proc-sh">
              <span className="proc-sh-label">{`Products${items.length > 0 ? ` · ${items.length}` : ''}`}</span>
              <div className="proc-sh-right">
                {errors.items && <span style={{ fontSize: 11, color: 'var(--color-error)' }}>{errors.items}</span>}
                {items.length > 0 && <Button type="button" variant="secondary" size="sm" onClick={() => applyVatToAll(5)}>Apply 5% VAT</Button>}
                {items.length > 0 && items.some((i) => (i.tax_rate ?? 0) > 0) && <Button type="button" variant="secondary" size="sm" onClick={() => applyVatToAll(0)}>Clear VAT</Button>}
              </div>
            </div>
            <div style={{ padding: '10px 12px' }}>
              {items.length > 0 ? (
                <EditableStandardItemsTable
                  items={items}
                  onUpdate={handleUpdateItem}
                  onRemove={handleRemoveItem}
                  renderProduct={(item) => (
                    <>
                      <div style={{ fontWeight: 'var(--weight-medium)' }}>{item._product?.name || `Product #${item.product_id}`}</div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{item._product?.code || ''}</div>
                    </>
                  )}
                  showUnit={true}
                  getUnit={(item) => item._product?.unit?.toUpperCase() || '—'}
                  formatPrice={formatPrice}
                />
              ) : (
                <div style={{ padding: '20px 12px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                  <p style={{ margin: 0, fontSize: 'var(--text-sm)' }}>
                    {quotationRequestId ? 'No products found in the Quotation Request.' : 'Please create a Quotation Request with products first.'}
                  </p>
                </div>
              )}
            </div>

          </form>

          {/* ── RIGHT: sticky aside ── */}
          <div className="proc-form-aside">

            {/* Source QR info */}
            {quotationRequest && (
              <DocInfoBanner
                title="Quotation Request"
                variant="info"
                fields={[
                  { label: 'Request #', value: `#${quotationRequest.id}` },
                  { label: 'Supplier', value: typeof quotationRequest.supplier === 'object' ? (quotationRequest.supplier.name || quotationRequest.supplier.business_name || '—') : '—' },
                  { label: 'Items', value: quotationRequest.items ? `${quotationRequest.items.length} pre-loaded` : '—' },
                ]}
              />
            )}

            {/* Live financial summary */}
            <div className="proc-aside-card">
              <div className="proc-sh" style={{ borderRadius: 0 }}>
                <span className="proc-sh-label">Summary</span>
              </div>
              <div style={{ padding: '10px 14px' }} className="proc-aside-summary">
                <div className="proc-summary-row">
                  <span className="proc-summary-label">Subtotal</span>
                  <span className="proc-summary-value">{formatPrice(calculateSubtotal())}</span>
                </div>
                {formData.discount > 0 && (
                  <div className="proc-summary-row">
                    <span className="proc-summary-label">Discount ({formData.discount}%)</span>
                    <span className="proc-summary-value" style={{ color: 'var(--color-error)' }}>− {formatPrice(calculateSubtotal() * (formData.discount / 100))}</span>
                  </div>
                )}
                {calculateTax() > 0 && (
                  <div className="proc-summary-row">
                    <span className="proc-summary-label">VAT</span>
                    <span className="proc-summary-value">{formatPrice(calculateTax())}</span>
                  </div>
                )}
                <div className="proc-summary-row proc-summary-total">
                  <span className="proc-summary-label">{t('col', 'total')}</span>
                  <span className="proc-summary-value">{formatPrice(calculateTotal())}</span>
                </div>
              </div>
            </div>

          </div>
        </div>

      </PageShell>
    </MainLayout>
  );
}
