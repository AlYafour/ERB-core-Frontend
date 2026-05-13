'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { purchaseOrdersApi } from '@/lib/api/purchase-orders';
import { purchaseInvoicesApi } from '@/lib/api/purchase-invoices';
import { PurchaseInvoiceItem } from '@/types';
import { PurchaseInvoiceFormData, toPurchaseInvoiceCreateData } from '@/lib/types/form-data';
import { Button, PageHeader, PageShell } from '@/components/ui';
import MainLayout from '@/components/layout/MainLayout';
import { formatPrice } from '@/lib/utils/format';
import { toast } from '@/lib/hooks/use-toast';
import SearchableDropdown from '@/components/ui/SearchableDropdown';
import FormField from '@/components/ui/FormField';
import { formatBackendError, validateRequired, validatePositiveNumber, validateDateAfter } from '@/lib/utils/validation';
import { canCreateInvoice } from '@/lib/utils/workflow-guards';
import RouteGuard from '@/components/auth/RouteGuard';
import { useT } from '@/lib/i18n/useT';

export default function NewPurchaseInvoicePage() {
  return (
    <RouteGuard
      requiredPermission={{ category: 'purchase_invoice', action: 'create' }}
      redirectTo="/purchase-invoices"
    >
      <NewPurchaseInvoicePageContent />
    </RouteGuard>
  );
}

function NewPurchaseInvoicePageContent() {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const purchaseOrderId = searchParams.get('purchase_order_id');

  const [formData, setFormData] = useState<PurchaseInvoiceFormData>({
    purchase_order_id: purchaseOrderId ? Number(purchaseOrderId) : 0,
    grn_id: undefined,
    invoice_date: new Date().toISOString().split('T')[0],
    due_date: '',
    status: 'draft',
    tax_rate: 0,
    discount: 0,
    notes: '',
  });

  const [items, setItems] = useState<PurchaseInvoiceItem[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: purchaseOrder } = useQuery({
    queryKey: ['purchase-orders', purchaseOrderId],
    queryFn: () => purchaseOrdersApi.getById(Number(purchaseOrderId!)),
    enabled: !!purchaseOrderId,
  });

  useEffect(() => {
    if (purchaseOrder && purchaseOrder.items) {
      // Pre-fill items from Purchase Order
      const invoiceItems: PurchaseInvoiceItem[] = purchaseOrder.items.map((item) => {
        // Calculate total for each item
        const subtotal = item.quantity * (item.unit_price || 0);
        const discountAmount = subtotal * ((item.discount || 0) / 100);
        const afterDiscount = subtotal - discountAmount;
        const taxAmount = afterDiscount * ((item.tax_rate || 0) / 100);
        const total = afterDiscount + taxAmount;
        
        return {
          purchase_order_item_id: item.id!,
          product_id: item.product?.id || item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price || 0,
          discount: item.discount || 0,
          tax_rate: item.tax_rate || 0,
          total: total, // Add calculated total
          notes: item.notes || '',
        };
      });
      setItems(invoiceItems);
      
      // Pre-fill form data
      setFormData((prev) => ({
        ...prev,
        tax_rate: purchaseOrder.tax_rate || 0,
        discount: purchaseOrder.discount || 0,
        notes: purchaseOrder.notes || '',
      }));
    }
  }, [purchaseOrder]);

  const mutation = useMutation({
    mutationFn: (data: PurchaseInvoiceFormData) => 
      purchaseInvoicesApi.create(toPurchaseInvoiceCreateData(data, items)),
    onSuccess: (data) => {
      toast('Purchase invoice created successfully!', 'success');
      if (data && data.id) {
        router.push(`/purchase-invoices/${data.id}`);
      } else {
        router.push(`/purchase-orders/${formData.purchase_order_id}`);
      }
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    
    // Frontend validation
    const validationErrors: Record<string, string> = {};
    
    // Validate purchase order
    if (!formData.purchase_order_id || formData.purchase_order_id === 0) {
      validationErrors.purchase_order_id = 'Purchase order is required. Please select a purchase order.';
    } else if (purchaseOrder) {
      // Check workflow guard
      const guard = canCreateInvoice(purchaseOrder.status);
      if (!guard.canProceed) {
        validationErrors.purchase_order_id = guard.reason || 'Cannot create invoice from this purchase order.';
        toast(guard.reason || 'Cannot create invoice', 'error');
      }
      if (guard.warning) {
        toast(guard.warning, 'warning');
      }
    }
    
    // Validate invoice date
    if (!formData.invoice_date) {
      validationErrors.invoice_date = 'Invoice date is required.';
    }
    
    // Validate due date
    if (formData.due_date) {
      const dateError = validateDateAfter(formData.due_date, formData.invoice_date, 'Due Date', 'Invoice Date');
      if (dateError) {
        validationErrors.due_date = dateError;
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
    
    // Validate tax_rate and discount
    if (formData.tax_rate < 0 || formData.tax_rate > 100) {
      validationErrors.tax_rate = 'Tax rate must be between 0 and 100.';
    }
    if (formData.discount < 0) {
      validationErrors.discount = 'Discount cannot be negative.';
    }
    
    // Edge Case 4: Invoice amount mismatch - Check if invoice total differs from PO
    if (purchaseOrder && items.length > 0) {
      const invoiceSubtotal = items.reduce((sum, item) => {
        const itemSubtotal = item.quantity * item.unit_price;
        const discountAmount = itemSubtotal * ((item.discount || 0) / 100);
        return sum + itemSubtotal - discountAmount;
      }, 0);
      const invoiceTax = invoiceSubtotal * (formData.tax_rate / 100);
      const invoiceTotal = invoiceSubtotal - formData.discount + invoiceTax;
      const poTotal = Number(purchaseOrder.total || 0);
      const difference = Math.abs(invoiceTotal - poTotal);
      const differencePercentage = poTotal > 0 ? (difference / poTotal * 100) : 0;
      
      if (differencePercentage > 5 || difference > 1000) {
        // Show warning but allow proceed with confirmation
        const warningMessage = `Warning: Invoice total (${invoiceTotal.toFixed(2)}) differs from Purchase Order total (${poTotal.toFixed(2)}) by ${differencePercentage.toFixed(2)}%.\n\nDo you want to continue?`;
        if (!confirm(warningMessage)) {
          return;
        }
      }
    }
    
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      toast('Please correct the errors in the form', 'error');
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
    
    mutation.mutate(formData);
  };

  const updateItem = (index: number, field: keyof PurchaseInvoiceItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  if (!purchaseOrderId) {
    return (
      <MainLayout>
        <PageShell>
          <div className="card empty-state">
            <p style={{ color: 'var(--text-secondary)', margin: '0 0 var(--space-4)' }}>Purchase Order ID is required</p>
            <Button variant="primary" onClick={() => router.back()}>Go Back</Button>
          </div>
        </PageShell>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <PageShell>
        <PageHeader
          title={t('page', 'newInvoice')}
          description="Create invoice for Purchase Order"
          breadcrumbs={[{ label: 'Purchase Invoices', href: '/purchase-invoices' }, { label: t('page', 'newInvoice') }]}
        />

        {/* Info Banner - Unified */}
        {purchaseOrder && (
          <div className="card" style={{ 
            backgroundColor: 'var(--info-banner-bg)',
            borderColor: 'var(--info-banner-border)',
            borderWidth: '1px',
            borderStyle: 'solid',
          }}>
            <h3 style={{ 
              fontSize: 'var(--text-sm)',
              fontWeight: 'var(--weight-semibold)',
              color: 'var(--info-banner-text)',
              margin: 0,
              marginBottom: 'var(--space-2)',
            }}>
              Purchase Order Information
            </h3>
            <div style={{ 
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 'var(--space-2)',
              fontSize: 'var(--text-sm)',
            }}>
              <div>
                <span style={{ color: 'var(--info-banner-text)' }}>Order Number:</span>{' '}
                <span style={{ fontWeight: 'var(--weight-medium)', color: 'var(--text-primary)' }}>{purchaseOrder.order_number}</span>
              </div>
              <div>
                <span style={{ color: 'var(--info-banner-text)' }}>Supplier:</span>{' '}
                <span style={{ fontWeight: 'var(--weight-medium)', color: 'var(--text-primary)' }}>
                  {typeof purchaseOrder.supplier === 'object'
                    ? purchaseOrder.supplier.name
                    : 'N/A'}
                </span>
              </div>
              <div>
                <span style={{ color: 'var(--info-banner-text)' }}>Total:</span>{' '}
                <span style={{ fontWeight: 'var(--weight-medium)', color: 'var(--text-primary)' }}>{formatPrice(Number(purchaseOrder.total || 0))}</span>
              </div>
            </div>
          </div>
        )}

        {/* Form Card - Unified */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          <div className="card">
            <h3 style={{ 
              fontSize: 'var(--text-lg)',
              fontWeight: 'var(--weight-semibold)',
              color: 'var(--text-primary)',
              margin: 0,
              marginBottom: 'var(--space-4)',
            }}>
              {t('section', 'invoiceInfo')}
            </h3>
            <div style={{ 
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: 'var(--space-4)',
            }}>
              <div>
                <label className="form-label">
                  {t('field', 'invoiceDate')} <span style={{ color: 'var(--color-error)' }}>*</span>
                </label>
                <input
                  type="date"
                  value={formData.invoice_date}
                  onChange={(e) => setFormData({ ...formData, invoice_date: e.target.value })}
                  className="form-input"
                  required
                />
              </div>
              <div>
                <label className="form-label">{t('field', 'dueDate')}</label>
                <input
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  className="form-input"
                />
              </div>
              <div>
                <label className="form-label">{t('col', 'taxPct')}</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={formData.tax_rate}
                  onChange={(e) => setFormData({ ...formData, tax_rate: parseFloat(e.target.value) || 0 })}
                  className="form-input"
                />
              </div>
              <div>
                <label className="form-label">{t('col', 'discountPct')}</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.discount}
                  onChange={(e) => setFormData({ ...formData, discount: parseFloat(e.target.value) || 0 })}
                  className="form-input"
                />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">{t('field', 'notes')}</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="form-textarea"
                  rows={3}
                />
              </div>
            </div>
          </div>

          <div className="card">
            <h3 style={{ 
              fontSize: 'var(--text-lg)',
              fontWeight: 'var(--weight-semibold)',
              color: 'var(--text-primary)',
              margin: 0,
              marginBottom: 'var(--space-4)',
            }}>
              {t('section', 'invoiceItems')}
            </h3>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>{t('col', 'product')}</th>
                    <th>{t('col', 'unit')}</th>
                    <th>{t('col', 'quantity')}</th>
                    <th>{t('col', 'unitPrice')}</th>
                    <th>{t('col', 'discountPct')}</th>
                    <th>{t('col', 'taxPct')}</th>
                    <th>{t('col', 'total')}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => {
                    const subtotal = item.quantity * item.unit_price;
                    const discountAmount = subtotal * ((item.discount || 0) / 100);
                    const afterDiscount = subtotal - discountAmount;
                    const taxAmount = afterDiscount * ((item.tax_rate || 0) / 100);
                    const total = afterDiscount + taxAmount;
                    
                    return (
                      <tr key={index}>
                        <td>
                          <div style={{ fontWeight: 'var(--weight-medium)' }}>
                            {purchaseOrder?.items?.find((poItem) => poItem.id === item.purchase_order_item_id)
                              ?.product?.name || 'N/A'}
                          </div>
                          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                            {purchaseOrder?.items?.find((poItem) => poItem.id === item.purchase_order_item_id)
                              ?.product?.code || ''}
                          </div>
                        </td>
                        <td style={{ color: 'var(--text-secondary)' }}>
                          {purchaseOrder?.items?.find((poItem) => poItem.id === item.purchase_order_item_id)
                            ?.product?.unit?.toUpperCase() || '—'}
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.quantity}
                            onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                            className="form-input" style={{ width: 96 }}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unit_price}
                            onChange={(e) => updateItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                            className="form-input" style={{ width: 128 }}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.discount || 0}
                            onChange={(e) => updateItem(index, 'discount', parseFloat(e.target.value) || 0)}
                            className="form-input" style={{ width: 96 }}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.tax_rate || 0}
                            onChange={(e) => updateItem(index, 'tax_rate', parseFloat(e.target.value) || 0)}
                            className="form-input" style={{ width: 96 }}
                          />
                        </td>
                        <td>
                          <div style={{ fontWeight: 'var(--weight-semibold)' }}>
                            {formatPrice(total)}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Form Actions - Unified */}
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <Button type="submit" variant="primary" disabled={mutation.isPending} isLoading={mutation.isPending}>
              {t('btn', 'create')}
            </Button>
            <Button type="button" variant="secondary" onClick={() => router.back()}>{t('btn', 'cancel')}</Button>
          </div>
        </form>
      </PageShell>
    </MainLayout>
  );
}

