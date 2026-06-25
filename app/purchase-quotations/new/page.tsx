'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { purchaseQuotationsApi } from '@/lib/api/purchase-quotations';
import { quotationRequestsApi } from '@/lib/api/quotation-requests';
import { purchaseRequestsApi } from '@/lib/api/purchase-requests';
import { suppliersApi } from '@/lib/api/suppliers';
import { productsApi } from '@/lib/api/products';
import MainLayout from '@/components/layout/MainLayout';
import Link from 'next/link';
import { Product, PurchaseQuotationItem } from '@/types';
import { PurchaseQuotationFormData, toPurchaseQuotationCreateData } from '@/lib/types/form-data';
import { toast } from '@/lib/hooks/use-toast';
import SearchableDropdown from '@/components/ui/SearchableDropdown';
import FormField from '@/components/ui/FormField';
import { Button, PageShell } from '@/components/ui';
import { formatBackendError, validateRequired, validatePositiveNumber, validateDateAfter } from '@/lib/utils/validation';
import { formatPrice } from '@/lib/utils/format';
import RouteGuard from '@/components/auth/RouteGuard';
import { useAuth } from '@/lib/hooks/use-auth';
import { useT } from '@/lib/i18n/useT';

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
  const { user } = useAuth();

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

  const { data: products } = useQuery({
    queryKey: ['products'],
    queryFn: () => productsApi.getAll({ page: 1, page_size: 1000 }),
    staleTime: 10 * 60 * 1000,
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

  // Update products in items when products list is loaded
  useEffect(() => {
    if (products?.results && items.length > 0) {
      const updatedItems = items.map((item) => {
        // If item doesn't have _product, try to find it in products list
        if (!item._product) {
          const product = products.results.find((p) => p.id === item.product_id);
          if (product) {
            return { ...item, _product: product };
          }
        }
        return item;
      });
      // Only update if there are changes
      const hasChanges = updatedItems.some((item, index) => 
        item._product !== items[index]._product
      );
      if (hasChanges) {
        setItems(updatedItems);
      }
    }
  }, [products?.results]);

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
          if (element instanceof HTMLElement) {
            element.focus();
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
      <PageShell>
        {/* Header Section */}
        <div>
          <Link
            href="/purchase-quotations"
            style={{
              fontSize: 'var(--text-sm)',
              marginBottom: 'var(--space-2)',
              display: 'inline-block',
              color: 'var(--text-secondary)',
              textDecoration: 'none',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
          >
            ← {t('btn', 'back')} {t('page', 'purchaseQuotations')}
          </Link>
          <h1 style={{ 
            fontSize: 'var(--text-2xl)',
            fontWeight: 'var(--weight-semibold)',
            color: 'var(--text-primary)',
            margin: 0,
            marginBottom: 'var(--space-1)',
          }}>
            {t('page', 'newQuotation')}
          </h1>
          <p style={{ 
            fontSize: 'var(--text-sm)',
            color: 'var(--text-secondary)',
            margin: 0,
          }}>
            Create a new purchase quotation with pricing details
          </p>
        </div>

        {/* Info Banner */}
        {quotationRequest && (
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
              Quotation Request Information
            </h3>
            <div style={{ 
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 'var(--space-2)',
              fontSize: 'var(--text-sm)',
            }}>
              <div>
                <span style={{ color: 'var(--info-banner-text)' }}>Request ID:</span>{' '}
                <span style={{ fontWeight: 'var(--weight-medium)', color: 'var(--text-primary)' }}>#{quotationRequest.id}</span>
              </div>
              <div>
                <span style={{ color: 'var(--info-banner-text)' }}>Supplier:</span>{' '}
                <span style={{ fontWeight: 'var(--weight-medium)', color: 'var(--text-primary)' }}>
                  {typeof quotationRequest.supplier === 'object'
                    ? quotationRequest.supplier.name || quotationRequest.supplier.business_name
                    : 'N/A'}
                </span>
              </div>
              {quotationRequest.items && (
                <div>
                  <span style={{ color: 'var(--info-banner-text)' }}>Items:</span>{' '}
                  <span style={{ fontWeight: 'var(--weight-medium)', color: 'var(--text-primary)' }}>{quotationRequest.items.length} items loaded automatically</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Validation Error Summary */}
        {Object.keys(errors).length > 0 && (
          <div style={{
            backgroundColor: 'var(--color-error-light)',
            border: '1px solid var(--color-error)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-4)',
          }}>
            <p style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--color-error)', marginBottom: 'var(--space-2)' }}>
              Please fix the following errors:
            </p>
            <ul style={{ margin: 0, paddingInlineStart: '1.25rem', display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
              {Object.entries(errors).map(([key, msg]) => msg ? (
                <li key={key} style={{ fontSize: 'var(--text-sm)', color: 'var(--color-error)' }}>{msg}</li>
              ) : null)}
            </ul>
          </div>
        )}

        {/* Form Card */}
        <form onSubmit={handleSubmit} className="card">
          {/* Form Fields Grid */}
          <div style={{ 
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: 'var(--space-4)',
            marginBottom: 'var(--space-6)',
          }}>
            <FormField
              label={t('col', 'supplier')}
              required
              error={errors.supplier_id}
              fieldName="supplier_id"
            >
              <SearchableDropdown
                options={[
                  { value: 0, label: 'Select Supplier' },
                  ...(suppliers?.results
                    .filter((s) => s.is_active)
                    .map((supplier) => ({
                      value: supplier.id,
                      label: supplier.business_name || supplier.name,
                      searchText: `${supplier.business_name || ''} ${supplier.name || ''} ${supplier.contact_person || ''}`,
                    })) || []),
                ]}
                value={formData.supplier_id}
                onChange={(val) => {
                  setFormData({ ...formData, supplier_id: Number(val) });
                  if (errors.supplier_id) {
                    setErrors({ ...errors, supplier_id: '' });
                  }
                }}
                placeholder="Select Supplier"
                allowClear
              />
            </FormField>

            <FormField
              label="Quotation Date"
              required
              error={errors.quotation_date}
              fieldName="quotation_date"
            >
              <input
                type="date"
                name="quotation_date"
                value={formData.quotation_date}
                onChange={(e) => {
                  setFormData({ ...formData, quotation_date: e.target.value });
                  if (errors.quotation_date) {
                    setErrors({ ...errors, quotation_date: '' });
                  }
                }}
                className="form-input"
              />
            </FormField>

            <FormField
              label="Valid Until"
              error={errors.valid_until}
              fieldName="valid_until"
            >
              <input
                type="date"
                name="valid_until"
                value={formData.valid_until}
                onChange={(e) => {
                  setFormData({ ...formData, valid_until: e.target.value });
                  if (errors.valid_until) {
                    setErrors({ ...errors, valid_until: '' });
                  }
                }}
                className="form-input"
              />
            </FormField>

            <FormField
              label="Discount (%)"
              error={errors.discount}
              fieldName="discount"
            >
              <input
                type="number"
                name="discount"
                step="0.01"
                min="0"
                value={formData.discount}
                onChange={(e) => {
                  setFormData({ ...formData, discount: Number(e.target.value) });
                  if (errors.discount) {
                    setErrors({ ...errors, discount: '' });
                  }
                }}
                className="form-input"
              />
            </FormField>

            <div style={{ gridColumn: 'span 2' }}>
              <FormField label="Payment Terms">
                <textarea
                  value={formData.payment_terms}
                  onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
                  rows={3}
                  className="form-textarea"
                />
              </FormField>
            </div>

            <div style={{ gridColumn: 'span 2' }}>
              <FormField label="Delivery Method (Optional)">
                <select
                  value={formData.delivery_method}
                  onChange={(e) => setFormData({ ...formData, delivery_method: e.target.value as 'pickup' | 'delivery' | '' })}
                  className="form-select"
                >
                  <option value="">-- Select Delivery Method --</option>
                  <option value="pickup">Pick Up</option>
                  <option value="delivery">Delivery</option>
                </select>
              </FormField>

              <FormField label="Delivery Terms (Optional)">
                <textarea
                  value={formData.delivery_terms}
                  onChange={(e) => setFormData({ ...formData, delivery_terms: e.target.value })}
                  rows={3}
                  className="form-textarea"
                />
              </FormField>
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <FormField label="Notes">
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="form-textarea"
                />
              </FormField>
            </div>
          </div>

          {/* Items Section */}
          <div style={{ marginBottom: 'var(--space-6)' }}>
            <div style={{ 
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 'var(--space-4)',
            }}>
              <h3 style={{
                fontSize: 'var(--text-lg)',
                fontWeight: 'var(--weight-semibold)',
                color: 'var(--text-primary)',
                margin: 0,
              }}>
                {t('col', 'product')}
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                {errors.items && (
                  <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-error)' }}>
                    {errors.items}
                  </span>
                )}
                {items.length > 0 && (
                  <Button type="button" variant="secondary" size="sm" onClick={() => applyVatToAll(5)}>
                    Apply 5% VAT to All
                  </Button>
                )}
                {items.length > 0 && items.some((i) => (i.tax_rate ?? 0) > 0) && (
                  <Button type="button" variant="secondary" size="sm" onClick={() => applyVatToAll(0)}>
                    Clear VAT
                  </Button>
                )}
              </div>
            </div>

            {items.length > 0 ? (
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>{t('col', 'product')}</th>
                        <th>{t('col', 'unit')}</th>
                        <th>{t('col', 'quantity')}</th>
                        <th>{t('col', 'unitPrice')}</th>
                        <th>Disc %</th>
                        <th>Tax %</th>
                        <th>{t('col', 'total')}</th>
                        <th>{t('col', 'actions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, index) => {
                        // Try to get product from stored _product first, then from products list
                        let product = item._product;
                        
                        // If no product in stored _product, try to get from products list
                        if (!product && products?.results) {
                          product = products.results.find((p) => p.id === item.product_id);
                          // Store it if found
                          if (product) {
                            item._product = product;
                          }
                        }
                        
                        // If still no product, try to fetch it from quotationRequest items
                        if (!product && quotationRequest?.items) {
                          const requestItem = quotationRequest.items.find((ri: any) => {
                            const riProductId = ri.product?.id || ri.product_id;
                            return riProductId === item.product_id;
                          });
                          if (requestItem?.product) {
                            product = requestItem.product;
                            // Store it for future use
                            item._product = product;
                          }
                        }
                        
                        const itemSubtotal = item.quantity * item.unit_price;
                        const discountAmount = itemSubtotal * ((item.discount ?? 0) / 100);
                        const afterDiscount = itemSubtotal - discountAmount;
                        const taxAmount = afterDiscount * ((item.tax_rate ?? 0) / 100);
                        const itemTotal = afterDiscount + taxAmount;

                        return (
                          <tr key={index}>
                            <td>
                              <div style={{ 
                                fontWeight: 'var(--weight-medium)',
                                color: 'var(--text-primary)',
                              }}>
                                {product?.name || `Product ID: ${item.product_id}`}
                              </div>
                              {product?.code && (
                                <div style={{
                                  fontSize: 'var(--text-xs)',
                                  color: 'var(--text-secondary)',
                                }}>
                                  {product.code}
                                </div>
                              )}
                            </td>
                            <td style={{ color: 'var(--text-secondary)' }}>{product?.unit?.toUpperCase() || '—'}</td>
                            <td>
                              <input
                                type="number"
                                min="1"
                                step="0.01"
                                value={item.quantity}
                                onChange={(e) => handleUpdateItem(index, 'quantity', Number(e.target.value))}
                                className="form-input"
                                style={{ width: '80px' }}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.unit_price}
                                onChange={(e) => handleUpdateItem(index, 'unit_price', Number(e.target.value))}
                                className="form-input"
                                style={{ width: '96px' }}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.01"
                                value={item.discount ?? 0}
                                onChange={(e) => handleUpdateItem(index, 'discount', Math.min(100, Number(e.target.value)))}
                                className="form-input"
                                style={{ width: '80px' }}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.01"
                                value={item.tax_rate ?? 0}
                                onChange={(e) => handleUpdateItem(index, 'tax_rate', Math.min(100, Number(e.target.value)))}
                                className="form-input"
                                style={{ width: '80px' }}
                              />
                            </td>
                            <td>
                              <div style={{ 
                                fontWeight: 'var(--weight-semibold)',
                                color: 'var(--text-primary)',
                              }}>
                                {itemTotal.toFixed(2)}
                              </div>
                            </td>
                            <td>
                              <Button type="button" variant="delete" size="sm" onClick={() => handleRemoveItem(index)}>
                                {t('btn', 'delete')}
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="card empty-state">
                <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
                  {quotationRequestId
                    ? 'No products found in the Quotation Request. Please add products to the Quotation Request first.'
                    : 'No products loaded. Please create a Quotation Request first with products.'}
                </p>
              </div>
            )}
          </div>

          {/* Summary */}
          <div className="card" style={{ 
            backgroundColor: 'var(--surface-inset)',
            marginBottom: 'var(--space-6)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <div style={{ width: '256px', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                <div style={{ 
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 'var(--text-sm)',
                }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Subtotal:</span>
                  <span style={{ 
                    fontWeight: 'var(--weight-semibold)',
                    color: 'var(--text-primary)',
                  }}>
                    {formatPrice(calculateSubtotal())}
                  </span>
                </div>
                {formData.discount > 0 && (
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 'var(--text-sm)',
                  }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Discount ({formData.discount}%):</span>
                    <span style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--color-error)' }}>
                      - {formatPrice(calculateSubtotal() * (formData.discount / 100))}
                    </span>
                  </div>
                )}
                {calculateTax() > 0 && (
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 'var(--text-sm)',
                  }}>
                    <span style={{ color: 'var(--text-secondary)' }}>VAT:</span>
                    <span style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--text-primary)' }}>
                      {formatPrice(calculateTax())}
                    </span>
                  </div>
                )}
                <div style={{ 
                  display: 'flex',
                  justifyContent: 'space-between',
                  borderTop: `1px solid var(--border-subtle)`,
                  paddingTop: 'var(--space-2)',
                  fontSize: 'var(--text-base)',
                }}>
                  <span style={{
                    fontWeight: 'var(--weight-bold)',
                    color: 'var(--text-primary)',
                  }}>
                    {t('col', 'total')}:
                  </span>
                  <span style={{ 
                    fontWeight: 'var(--weight-bold)',
                    color: 'var(--text-primary)',
                  }}>
                    {formatPrice(calculateTotal())}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <Button type="submit" variant="primary" disabled={mutation.isPending} isLoading={mutation.isPending}>
              {t('page', 'newQuotation')}
            </Button>
            <Button variant="secondary" onClick={() => router.push('/purchase-quotations')}>
              {t('btn', 'cancel')}
            </Button>
          </div>
        </form>
      </PageShell>
    </MainLayout>
  );
}
