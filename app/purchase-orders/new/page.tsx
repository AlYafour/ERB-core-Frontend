'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { purchaseOrdersApi } from '@/lib/api/purchase-orders';
import { purchaseRequestsApi } from '@/lib/api/purchase-requests';
import { purchaseQuotationsApi } from '@/lib/api/purchase-quotations';
import { suppliersApi } from '@/lib/api/suppliers';
import { productsApi } from '@/lib/api/products';
import MainLayout from '@/components/layout/MainLayout';
import Link from 'next/link';
import { PageShell, PageHeader } from '@/components/ui';
import { PurchaseOrderItem } from '@/types';
import { PurchaseOrderFormData, toPurchaseOrderCreateData } from '@/lib/types/form-data';
import { toast } from '@/lib/hooks/use-toast';
import SearchableDropdown from '@/components/ui/SearchableDropdown';
import CostCodePicker from '@/components/domain/CostCodePicker';
import FormField from '@/components/ui/FormField';
import { formatPrice } from '@/lib/utils/format';
import { formatBackendError, validateRequired, validatePositiveNumber, validateDateAfter } from '@/lib/utils/validation';
import { canCreatePurchaseOrder } from '@/lib/utils/workflow-guards';
import RouteGuard from '@/components/auth/RouteGuard';
import { useAuth } from '@/lib/hooks/use-auth';
import { useT } from '@/lib/i18n/useT';

export default function NewPurchaseOrderPage() {
  return (
    <RouteGuard
      requiredPermission={{ category: 'purchase_order', action: 'create' }}
      redirectTo="/purchase-orders"
    >
      <NewPurchaseOrderPageContent />
    </RouteGuard>
  );
}

function NewPurchaseOrderPageContent() {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const purchaseRequestId = searchParams.get('purchase_request_id');
  const purchaseQuotationId = searchParams.get('purchase_quotation_id');
  const { user } = useAuth();

  const [formData, setFormData] = useState<PurchaseOrderFormData>({
    purchase_request_id: purchaseRequestId ? Number(purchaseRequestId) : undefined,
    purchase_quotation_id: purchaseQuotationId ? Number(purchaseQuotationId) : undefined,
    supplier_id: 0,
    order_date: new Date().toISOString().split('T')[0],
    delivery_date: '',
    delivery_method: '',
    payment_terms: '',
    delivery_terms: '',
    notes: '',
    terms_and_conditions: '',
    tax_rate: 0,
    discount: 0,
    status: 'pending',
  });

  const [selectedCostCode, setSelectedCostCode] = useState<import('@/types').CostCode | null>(null);

  const [items, setItems] = useState<
    (Omit<PurchaseOrderItem, 'product' | 'total' | 'created_at'> & { _product?: any })[]
  >([]);
  const [currentItem, setCurrentItem] = useState({
    product_id: 0,
    quantity: 0,
    unit_price: 0,
    discount: 0,
    tax_rate: 0,
    notes: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: poDefaults } = useQuery({
    queryKey: ['purchase-orders', 'defaults'],
    queryFn: () => purchaseOrdersApi.getDefaults(),
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (poDefaults?.default_terms_and_conditions) {
      setFormData(prev => ({ ...prev, terms_and_conditions: poDefaults.default_terms_and_conditions }));
    }
  }, [poDefaults]);

  const { data: purchaseRequest } = useQuery({
    queryKey: ['purchase-requests', purchaseRequestId],
    queryFn: () => purchaseRequestsApi.getById(Number(purchaseRequestId!)),
    enabled: !!purchaseRequestId,
  });

  const { data: purchaseQuotation } = useQuery({
    queryKey: ['purchase-quotations', purchaseQuotationId],
    queryFn: () => purchaseQuotationsApi.getById(Number(purchaseQuotationId!)),
    enabled: !!purchaseQuotationId,
  });

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers', 'all-active'],
    queryFn: () => suppliersApi.getAllActive(),
  });

  const { data: products } = useQuery({
    queryKey: ['products'],
    queryFn: () => productsApi.getAll({ page: 1, page_size: 1000 }),
    staleTime: 10 * 60 * 1000,
  });

  useEffect(() => {
    if (purchaseQuotation) {
      // Auto-fill from quotation (priority) - COMPLETE MAPPING
      const supplierId = typeof purchaseQuotation.supplier === 'object' 
        ? purchaseQuotation.supplier.id 
        : purchaseQuotation.supplier;
      
      // If quotation is awarded, supplier is fixed and cannot be changed
      const isAwarded = purchaseQuotation.status === 'awarded';
      
      setFormData((prev) => ({
        ...prev,
        purchase_quotation_id: purchaseQuotation.id,
        supplier_id: supplierId,
        payment_terms: purchaseQuotation.payment_terms || '',
        delivery_terms: purchaseQuotation.delivery_terms || '',
        notes: purchaseQuotation.notes || '',
        tax_rate: Number(purchaseQuotation.tax_rate || 0),
        discount: Number(purchaseQuotation.discount || 0),
        delivery_date: purchaseQuotation.valid_until || '', // Map valid_until to delivery_date
        delivery_method: purchaseQuotation.delivery_method || '',
      }));
      
      // Auto-fill items from quotation with ALL pricing data and product objects
      if (purchaseQuotation.items && purchaseQuotation.items.length > 0) {
        const quotationItems = purchaseQuotation.items.map((item) => ({
          product_id: item.product?.id || item.product_id,
          quantity: Number(item.quantity || 0),
          unit_price: Number(item.unit_price || 0),
          discount: Number(item.discount ?? 0),
          tax_rate: Number(item.tax_rate ?? item.tax ?? 0),
          notes: item.notes || '',
          _product: item.product || null, // Store product for display
        }));
        setItems(quotationItems);
      }
    } else if (purchaseRequest) {
      // Auto-fill from purchase request (no quotation)
      setFormData((prev) => ({
        ...prev,
        purchase_request_id: purchaseRequest.id,
      }));
      // Auto-fill items from purchase request (no prices)
      if (purchaseRequest.items && purchaseRequest.items.length > 0) {
        const requestItems = purchaseRequest.items.map((item) => ({
          product_id: item.product?.id || item.product_id,
          quantity: Number(item.quantity || 0),
          unit_price: 0,
          discount: 0,
          tax_rate: 0,
          notes: item.notes || '',
          _product: item.product || null,
        }));
        setItems(requestItems);
      }
    }
  }, [purchaseRequest, purchaseQuotation]);

  // Update product info in items when products list is loaded
  useEffect(() => {
    if (products?.results && items.length > 0) {
      setItems((prevItems) => 
        prevItems.map((item) => {
          if (!(item as any)._product) {
            const product = products.results.find((p) => p.id === item.product_id);
            if (product) {
              return { ...item, _product: product };
            }
          }
          return item;
        })
      );
    }
  }, [products, items.length]);

  const mutation = useMutation({
    mutationFn: purchaseOrdersApi.create,
    onSuccess: () => {
      toast('Purchase order created successfully!', 'success');
      router.push('/purchase-orders');
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

  const handleAddItem = () => {
    if (currentItem.product_id && currentItem.quantity > 0 && currentItem.unit_price > 0) {
      setItems([...items, { ...currentItem }]);
      setCurrentItem({
        product_id: 0,
        quantity: 0,
        unit_price: 0,
        discount: 0,
        tax_rate: 0,
        notes: '',
      });
    }
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleUpdateItem = (index: number, field: string, value: any) => {
    const updatedItems = [...items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    setItems(updatedItems);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    
    // Frontend validation
    const validationErrors: Record<string, string> = {};

    // Enforce that PO must be linked to PR or PQ
    if (!formData.purchase_request_id && !formData.purchase_quotation_id) {
      toast('ÙŠØ¬Ø¨ Ø¥Ù†Ø´Ø§Ø¡ Ø£Ù…Ø± Ø§Ù„Ø´Ø±Ø§Ø¡ Ù…Ù† Ø·Ù„Ø¨ Ø´Ø±Ø§Ø¡ Ø£Ùˆ Ø¹Ø±Ø¶ Ø³Ø¹Ø±.', 'error');
      router.push('/purchase-requests');
      return;
    }

    // Validate supplier
    if (!formData.supplier_id || formData.supplier_id === 0) {
      validationErrors.supplier_id = 'Supplier is required. Please select a supplier.';
    }
    
    // Validate order date
    if (!formData.order_date) {
      validationErrors.order_date = 'Order date is required.';
    }
    
    // Validate delivery date
    if (formData.delivery_date) {
      const dateError = validateDateAfter(formData.delivery_date, formData.order_date, 'Delivery Date', 'Order Date');
      if (dateError) {
        validationErrors.delivery_date = dateError;
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
    
    // Check workflow guard
    if (purchaseQuotation) {
      const guard = canCreatePurchaseOrder(purchaseQuotation.status);
      if (!guard.canProceed) {
        validationErrors.purchase_quotation_id = guard.reason || 'Cannot create purchase order from this quotation.';
        toast(guard.reason || 'Cannot create purchase order', 'error');
      }
    } else if (purchaseRequest) {
      const guard = canCreatePurchaseOrder(undefined, purchaseRequest.status);
      if (!guard.canProceed) {
        validationErrors.purchase_request_id = guard.reason || 'Cannot create purchase order from this purchase request.';
        toast(guard.reason || 'Cannot create purchase order', 'error');
      }
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
    
    const payload = { ...toPurchaseOrderCreateData(formData, items), cost_code_id: selectedCostCode?.id ?? null };
    mutation.mutate(payload);
  };

  const calculateSubtotal = useMemo(() => items.reduce((sum, item) => {
    const itemSubtotal = item.quantity * item.unit_price;
    const discountAmount = itemSubtotal * ((item.discount ?? 0) / 100) || 0;
    return sum + itemSubtotal - discountAmount;
  }, 0), [items]);

  const calculateTaxAmount = useMemo(() => items.reduce((sum, item) => {
    const itemSubtotal = item.quantity * item.unit_price;
    const discountAmount = itemSubtotal * ((item.discount ?? 0) / 100) || 0;
    const afterDiscount = itemSubtotal - discountAmount;
    return sum + afterDiscount * ((item.tax_rate ?? 0) / 100);
  }, 0), [items]);

  const calculateTotal = useMemo(() => {
    const discountAmount = calculateSubtotal * (formData.discount / 100) || 0;
    const afterDiscount = calculateSubtotal - discountAmount;
    return afterDiscount + calculateTaxAmount;
  }, [calculateSubtotal, calculateTaxAmount, formData.discount]);

  const applyVatToAll = (rate: number) => {
    setItems(items.map((item) => ({ ...item, tax_rate: rate })));
  };

  const selectedProduct = products?.results?.find((p) => p.id === currentItem.product_id);

  if (!purchaseRequestId && !purchaseQuotationId) {
    router.push('/purchase-requests');
    return null;
  }

  if (user && user.role !== 'procurement_officer' && user.role !== 'super_admin' && !user.is_superuser) {
    router.push('/purchase-orders');
    return null;
  }

  return (
    <MainLayout>
      <PageShell>
        <PageHeader
          title={t('page', 'newPO')}
          description={purchaseQuotationId ? 'Create a purchase order from awarded quotation' : 'Create a purchase order from purchase request'}
          backHref="/purchase-orders"
          breadcrumbs={[
            { label: t('page', 'purchaseOrders'), href: '/purchase-orders' },
            { label: t('page', 'newPO') },
          ]}
        />

        
        {/* Info Banner - Unified */}
        {purchaseQuotation && (
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
              Quotation Information (Awarded)
            </h3>
            <div style={{ 
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 'var(--space-2)',
              fontSize: 'var(--text-sm)',
            }}>
              <div>
                <span style={{ color: 'var(--info-banner-text)' }}>Quotation Number:</span>{' '}
                <span style={{ fontWeight: 'var(--weight-medium)', color: 'var(--text-primary)' }}>{purchaseQuotation.quotation_number}</span>
              </div>
              <div>
                <span style={{ color: 'var(--info-banner-text)' }}>Supplier:</span>{' '}
                <span style={{ fontWeight: 'var(--weight-medium)', color: 'var(--text-primary)' }}>
                  {typeof purchaseQuotation.supplier === 'object' 
                    ? purchaseQuotation.supplier.name 
                    : 'N/A'}
                </span>
              </div>
              <div>
                <span style={{ color: 'var(--info-banner-text)' }}>Total:</span>{' '}
                <span style={{ fontWeight: 'var(--weight-medium)', color: 'var(--text-primary)' }}>{formatPrice(Number(purchaseQuotation.total || 0))}</span>
              </div>
            </div>
          </div>
        )}

        {purchaseRequest && !purchaseQuotation && (
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
              Purchase Request Information
            </h3>
            <div style={{ 
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 'var(--space-2)',
              fontSize: 'var(--text-sm)',
            }}>
              <div>
                <span style={{ color: 'var(--info-banner-text)' }}>Request Code:</span>{' '}
                <span style={{ fontWeight: 'var(--weight-medium)', color: 'var(--text-primary)' }}>{purchaseRequest.code}</span>
              </div>
              <div>
                <span style={{ color: 'var(--info-banner-text)' }}>Title:</span>{' '}
                <span style={{ fontWeight: 'var(--weight-medium)', color: 'var(--text-primary)' }}>{purchaseRequest.title}</span>
              </div>
              {(purchaseRequest.project || purchaseRequest.project_code) && (
                <div>
                  <span style={{ color: 'var(--info-banner-text)' }}>Project:</span>{' '}
                  <span style={{ fontWeight: 'var(--weight-medium)', color: 'var(--text-primary)' }}>
                    {typeof purchaseRequest.project === 'object' && purchaseRequest.project
                      ? purchaseRequest.project.name
                      : purchaseRequest.project_code}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Form Card - Unified */}
        <form onSubmit={handleSubmit} className="card">
          {/* Form Fields Grid - Unified Spacing */}
          <div style={{ 
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: 'var(--space-4)',
            marginBottom: 'var(--space-6)',
          }}>
            <div>
              <SearchableDropdown
                label={t('col', 'supplier')}
                required
                options={
                  (suppliers || []).map((supplier) => ({
                    value: supplier.id,
                    label: supplier.name,
                    searchText: `${supplier.name} ${supplier.business_name || ''} ${supplier.contact_person || ''}`,
                  }))
                }
                value={formData.supplier_id}
                onChange={(val) => {
                  // If creating from awarded quotation, prevent supplier change
                  if (purchaseQuotation && purchaseQuotation.status === 'awarded') {
                    toast('Cannot change supplier. This quotation has been awarded and the supplier is fixed.', 'error');
                    return;
                  }
                  setFormData({ ...formData, supplier_id: val ? Number(val) : 0 });
                }}
                placeholder={t('misc', 'selectSupplier')}
                searchPlaceholder={t('misc', 'searchSuppliers')}
                disabled={purchaseQuotation?.status === 'awarded'}
              />
              {purchaseQuotation?.status === 'awarded' && (
                <p style={{ 
                  fontSize: 'var(--text-xs)', 
                  color: 'var(--text-secondary)', 
                  marginTop: 'var(--space-1)' 
                }}>
                  Supplier is fixed because this quotation has been awarded.
                </p>
              )}
            </div>

            <div>
              <label className="form-label">
                {t('col', 'orderDate')} <span style={{ color: 'var(--color-error)' }}>*</span>
              </label>
              <input
                type="date"
                required
                value={formData.order_date}
                onChange={(e) => setFormData({ ...formData, order_date: e.target.value })}
                className="form-input"
              />
            </div>

            <FormField
              label={t('field', 'deliveryDate')}
              error={errors.delivery_date}
              fieldName="delivery_date"
            >
              <input
                type="date"
                name="delivery_date"
                value={formData.delivery_date}
                onChange={(e) => {
                  setFormData({ ...formData, delivery_date: e.target.value });
                  if (errors.delivery_date) {
                    setErrors({ ...errors, delivery_date: '' });
                  }
                }}
                className="form-input"
                style={errors.delivery_date ? { borderColor: 'var(--color-error)' } : undefined}
              />
            </FormField>

            <FormField
              label={t('col', 'deliveryMethod')}
              fieldName="delivery_method"
            >
              <select
                name="delivery_method"
                value={formData.delivery_method}
                onChange={(e) => {
                  setFormData({ ...formData, delivery_method: e.target.value as 'pickup' | 'delivery' | '' });
                }}
                className="form-select"
              >
                <option value="">-- Select Delivery Method --</option>
                <option value="pickup">Pick Up</option>
                <option value="delivery">Delivery</option>
              </select>
            </FormField>
          </div>

          {/* Items Section - Unified */}
          <div style={{ marginBottom: 'var(--space-6)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
              <h3 style={{
                fontSize: 'var(--text-lg)',
                fontWeight: 'var(--weight-semibold)',
                color: 'var(--text-primary)',
                margin: 0,
              }}>
                {t('section', 'orderItems')}
              </h3>
              {items.length > 0 && !purchaseQuotation && (
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  <button type="button" onClick={() => applyVatToAll(5)} className="btn btn-secondary" style={{ fontSize: 'var(--text-xs)', padding: '4px 10px' }}>
                    Apply 5% VAT to All
                  </button>
                  {items.some((i) => (i.tax_rate ?? 0) > 0) && (
                    <button type="button" onClick={() => applyVatToAll(0)} className="btn btn-secondary" style={{ fontSize: 'var(--text-xs)', padding: '4px 10px' }}>
                      Clear VAT
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Add Item Form - Only show if NOT from quotation and NOT from PR */}
            {!purchaseQuotation && !purchaseRequest && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--space-3)', marginBottom: 'var(--space-4)', padding: 'var(--space-4)', backgroundColor: 'var(--surface-subtle)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ gridColumn: 'span 2' }}>
                <SearchableDropdown
                  options={
                    products?.results?.map((product) => ({
                      value: product.id,
                      label: `${product.name} (${product.code})`,
                      searchText: `${product.name} ${product.code} ${product.category || ''}`,
                    })) || []
                  }
                  value={currentItem.product_id}
                  onChange={(val) =>
                    setCurrentItem({ ...currentItem, product_id: val ? Number(val) : 0 })
                  }
                  placeholder="Select Product"
                  searchPlaceholder="Search products..."
                />
              </div>

              <div>
                <label className="form-label">{t('col', 'quantity')}</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={currentItem.quantity || ''}
                  onChange={(e) =>
                    setCurrentItem({ ...currentItem, quantity: parseFloat(e.target.value) || 0 })
                  }
                  className="form-input"
                />
              </div>

              <div>
                <label className="form-label">{t('col', 'unitPrice')}</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={currentItem.unit_price || ''}
                  onChange={(e) =>
                    setCurrentItem({ ...currentItem, unit_price: parseFloat(e.target.value) || 0 })
                  }
                  className="form-input"
                />
              </div>

              <div>
                <label className="form-label">{t('col', 'discountPct')}</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={currentItem.discount || ''}
                  onChange={(e) =>
                    setCurrentItem({ ...currentItem, discount: parseFloat(e.target.value) || 0 })
                  }
                  className="form-input"
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button
                  type="button"
                  onClick={handleAddItem}
                  disabled={!currentItem.product_id || currentItem.quantity <= 0 || currentItem.unit_price <= 0}
                  className="btn btn-primary"
                  style={{ width: '100%' }}
                >
                  Add
                </button>
              </div>
            </div>
            )}

            {/* Items Table */}
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
                        <th>{t('col', 'discountPct')}</th>
                        <th>{t('col', 'taxPct')}</th>
                        <th>{t('col', 'total')}</th>
                        {!purchaseQuotation && <th>{t('col', 'actions')}</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, index) => {
                        // Get product from stored _product, products list, or quotation
                        let product = (item as any)._product;
                        if (!product && products?.results) {
                          product = products.results.find((p) => p.id === item.product_id);
                          if (product) {
                            (item as any)._product = product;
                          }
                        }
                        if (!product && purchaseQuotation?.items) {
                          const quotationItem = purchaseQuotation.items.find((qi: any) => {
                            const qiProductId = qi.product?.id || qi.product_id;
                            return qiProductId === item.product_id;
                          });
                          if (quotationItem?.product) {
                            product = quotationItem.product;
                            (item as any)._product = product;
                          }
                        }

                        const itemSubtotal = item.quantity * item.unit_price;
                        const discountAmount = itemSubtotal * ((item.discount ?? 0) / 100) || 0;
                        const afterDiscount = itemSubtotal - discountAmount;
                        const taxAmount = afterDiscount * ((item.tax_rate ?? 0) / 100) || 0;
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
                            <td style={{ color: 'var(--text-secondary)' }}>{product?.unit?.toUpperCase() || 'â€"'}</td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.quantity}
                                onChange={(e) =>
                                  handleUpdateItem(index, 'quantity', parseFloat(e.target.value) || 0)
                                }
                                className="form-input"
                                style={{ width: '80px' }}
                                disabled={!!purchaseQuotation} // Read-only when from quotation
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.unit_price}
                                onChange={(e) =>
                                  handleUpdateItem(index, 'unit_price', parseFloat(e.target.value) || 0)
                                }
                                className="form-input"
                                style={{ width: '96px' }}
                                disabled={!!purchaseQuotation} // Read-only when from quotation
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.01"
                                value={item.discount ?? 0}
                                onChange={(e) =>
                                  handleUpdateItem(index, 'discount', parseFloat(e.target.value) || 0)
                                }
                                className="form-input"
                                style={{ width: '80px' }}
                                disabled={!!purchaseQuotation} // Read-only when from quotation
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.01"
                                value={item.tax_rate ?? 0}
                                onChange={(e) =>
                                  handleUpdateItem(index, 'tax_rate', parseFloat(e.target.value) || 0)
                                }
                                className="form-input"
                                style={{ width: '80px' }}
                                disabled={!!purchaseQuotation} // Read-only when from quotation
                              />
                            </td>
                            <td>
                              <div style={{ 
                                fontWeight: 'var(--weight-semibold)',
                                color: 'var(--text-primary)',
                              }}>
                                {formatPrice(itemTotal)}
                              </div>
                            </td>
                            {!purchaseQuotation && (
                              <td>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItem(index)}
                                  className="btn btn-destructive"
                                >
                                  {t('btn', 'delete')}
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="card" style={{ 
                textAlign: 'center', 
                padding: 'var(--space-8)',
                color: 'var(--text-secondary)',
              }}>
                <p style={{ margin: 0 }}>
                  {purchaseQuotation 
                    ? 'No products found in the awarded quotation.'
                    : purchaseRequest
                    ? 'No products found in the Purchase Request. Please add products first.'
                    : 'No products added. Please add products to create the purchase order.'}
                </p>
              </div>
            )}
          </div>

          {/* Cost Code Section */}
          <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
            <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-primary)', margin: 0, marginBottom: 'var(--space-4)' }}>
              Cost Code
            </h3>
            <div>
              <label className="form-label">Direct Cost Code <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>(optional)</span></label>
              <CostCodePicker
                value={selectedCostCode}
                onChange={setSelectedCostCode}
              />
              {selectedCostCode && (
                <div style={{ marginTop: 8, padding: '6px 10px', background: 'var(--muted)', borderRadius: 6, fontSize: 13 }}>
                  <span style={{ fontWeight: 600, color: '#f97316' }}>{selectedCostCode.excel_code}</span>
                  <span style={{ color: 'var(--text-secondary)', marginLeft: 8 }}>{selectedCostCode.description}</span>
                </div>
              )}
            </div>
          </div>

          {/* Terms & Conditions Section - Unified */}
          <div className="card" style={{ 
            backgroundColor: 'var(--surface-inset)',
            marginBottom: 'var(--space-6)',
          }}>
            <h3 style={{ 
              fontSize: 'var(--text-lg)',
              fontWeight: 'var(--weight-semibold)',
              color: 'var(--text-primary)',
              margin: 0,
              marginBottom: 'var(--space-4)',
            }}>
              {t('section', 'termsConditions')}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div>
                <label className="form-label">{t('field', 'paymentTerms')}</label>
                <textarea
                  value={formData.payment_terms}
                  onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
                  className="form-textarea"
                  rows={3}
                  placeholder="Enter payment terms..."
                />
              </div>

              <div>
                <label className="form-label">{t('field', 'deliveryTerms')}</label>
                <textarea
                  value={formData.delivery_terms}
                  onChange={(e) => setFormData({ ...formData, delivery_terms: e.target.value })}
                  className="input"
                  rows={3}
                  placeholder="Enter delivery terms..."
                />
              </div>

              <div>
                <label className="form-label">{t('col', 'notes')}</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="form-textarea"
                  rows={3}
                  placeholder="Enter any additional notes..."
                />
              </div>

              <div>
                <label className="form-label">Standard Terms & Conditions</label>
                <textarea
                  value={formData.terms_and_conditions}
                  onChange={(e) => setFormData({ ...formData, terms_and_conditions: e.target.value })}
                  className="form-textarea"
                  rows={12}
                  placeholder="Standard Terms & Conditions..."
                  style={{ 
                    fontFamily: 'monospace',
                    fontSize: 'var(--text-sm)',
                    lineHeight: '1.6',
                  }}
                />
                <p style={{ 
                  fontSize: 'var(--text-xs)',
                  color: 'var(--text-secondary)',
                  marginTop: 'var(--space-1)',
                  margin: 0,
                }}>
                  This section will appear on the printed Purchase Order. Default terms are pre-filled but can be customized.
                </p>
              </div>
            </div>
          </div>

          {/* Summary Section */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--space-6)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', width: 320 }}>
              {!purchaseQuotation && (
                <div>
                  <label className="form-label">Discount (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={formData.discount}
                    onChange={(e) => setFormData({ ...formData, discount: parseFloat(e.target.value) || 0 })}
                    className="form-input"
                  />
                </div>
              )}

              <div className="card" style={{
                backgroundColor: 'var(--surface-inset)',
                padding: 'var(--space-4)',
              }}>
                <h3 style={{
                  fontSize: 'var(--text-base)',
                  fontWeight: 'var(--weight-semibold)',
                  color: 'var(--text-primary)',
                  margin: 0,
                  marginBottom: 'var(--space-4)',
                }}>
                  {t('section', 'orderInfo')}
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Subtotal:</span>
                    <span style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--text-primary)' }}>
                      {formatPrice(calculateSubtotal)}
                    </span>
                  </div>
                  {formData.discount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Discount ({formData.discount}%):</span>
                      <span style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--color-error)' }}>
                        - {formatPrice(calculateSubtotal * (formData.discount / 100) || 0)}
                      </span>
                    </div>
                  )}
                  {calculateTaxAmount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>VAT:</span>
                      <span style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--text-primary)' }}>
                        {formatPrice(calculateTaxAmount)}
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
                    <span style={{ fontWeight: 'var(--weight-bold)', color: 'var(--text-primary)' }}>Total:</span>
                    <span style={{ fontWeight: 'var(--weight-bold)', color: 'var(--text-primary)' }}>
                      {formatPrice(calculateTotal)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Form Actions - Unified */}
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="btn btn-primary"
            >
              {mutation.isPending ? t('btn', 'creating') : t('btn', 'createPO')}
            </button>
            <Link href={purchaseRequestId ? `/purchase-requests/${purchaseRequestId}` : '/purchase-requests'} className="btn btn-secondary">
              {t('btn', 'cancel')}
            </Link>
          </div>
        </form>
      </PageShell>
    </MainLayout>
  );
}

