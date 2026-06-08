'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { purchaseOrdersApi } from '@/lib/api/purchase-orders';
import { goodsReceivingApi, GRNItem } from '@/lib/api/goods-receiving';
import { GRNFormData, toGRNCreateData } from '@/lib/types/form-data';
import { Button, PageHeader, PageShell } from '@/components/ui';
import MainLayout from '@/components/layout/MainLayout';
import { formatPrice } from '@/lib/utils/format';
import { toast } from '@/lib/hooks/use-toast';
import SearchableDropdown from '@/components/ui/SearchableDropdown';
import FormField from '@/components/ui/FormField';
import { validateRequired, validatePositiveNumber } from '@/lib/utils/validation';
import { getApiError } from '@/lib/utils/error';
import { canCreateGRN } from '@/lib/utils/workflow-guards';
import RouteGuard from '@/components/auth/RouteGuard';
import { useT } from '@/lib/i18n/useT';

export default function NewGRNPage() {
  return (
    <RouteGuard
      requiredPermission={{ category: 'goods_receiving', action: 'create' }}
      redirectTo="/goods-receiving"
    >
      <NewGRNPageContent />
    </RouteGuard>
  );
}

function NewGRNPageContent() {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const purchaseOrderId = searchParams.get('purchase_order_id');

  const [formData, setFormData] = useState<GRNFormData & { invoice_delivery_status: 'not_delivered' | 'delivered' }>({
    purchase_order_id: purchaseOrderId ? Number(purchaseOrderId) : 0,
    receipt_date: new Date().toISOString().split('T')[0],
    status: 'draft',
    notes: '',
    invoice_delivery_status: 'not_delivered',
  });

  const [items, setItems] = useState<GRNItem[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [materialImages, setMaterialImages] = useState<File[]>([]);
  const [materialImagePreviews, setMaterialImagePreviews] = useState<string[]>([]);
  const [supplierInvoiceFile, setSupplierInvoiceFile] = useState<File | null>(null);
  const [supplierInvoicePreview, setSupplierInvoicePreview] = useState<string | null>(null);

  const { data: purchaseOrder } = useQuery({
    queryKey: ['purchase-orders', purchaseOrderId],
    queryFn: () => purchaseOrdersApi.getById(Number(purchaseOrderId!)),
    enabled: !!purchaseOrderId,
  });

  useEffect(() => {
    if (purchaseOrder && purchaseOrder.items && purchaseOrder.items.length > 0) {
      // Pre-fill items from Purchase Order
      const grnItems: GRNItem[] = purchaseOrder.items.map((item) => ({
        purchase_order_item_id: item.id!,
        product_id: item.product?.id || item.product_id,
        ordered_quantity: Number(item.quantity) || 0,
        received_quantity: 0,
        rejected_quantity: 0,
        quality_status: 'good' as const,
        notes: '',
      }));
      setItems(grnItems);
    } else {
      setItems([]);
    }
  }, [purchaseOrder]);

  const mutation = useMutation({
    mutationFn: (data: {
      formData: GRNFormData & { invoice_delivery_status: 'not_delivered' | 'delivered' };
      items: GRNItem[];
      materialImages?: File[];
      supplierInvoiceFile?: File | null;
    }) => goodsReceivingApi.create(toGRNCreateData(
      data.formData,
      data.items,
      data.materialImages,
      data.supplierInvoiceFile
    )),
    onSuccess: (data) => {
      toast('GRN created successfully!', 'success');
      if (data && data.id) {
        router.push(`/goods-receiving/${data.id}`);
      } else {
        router.push(`/purchase-orders/${formData.purchase_order_id}`);
      }
    },
    onError: (e: unknown) => {
      toast(getApiError(e, 'Failed to create goods receipt'), 'error');
      
      // Set field-specific errors
      if (error?.response?.data) {
        const backendErrors: Record<string, string> = {};
        Object.entries(error.response.data).forEach(([key, value]) => {
          if (Array.isArray(value)) {
            backendErrors[key] = value[0] || 'Error';
          } else if (typeof value === 'string') {
            backendErrors[key] = value;
          } else if (typeof value === 'object' && value !== null) {
            Object.entries(value as Record<string, any>).forEach(([nestedKey, nestedValue]) => {
              backendErrors[`${key}.${nestedKey}`] = Array.isArray(nestedValue) ? nestedValue[0] : nestedValue;
            });
          }
        });
        setErrors(backendErrors);
      }
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    
    // Frontend validation
    const validationErrors: Record<string, string> = {};
    
    // Validate purchase order
    if (!formData.purchase_order_id || formData.purchase_order_id === 0) {
      validationErrors.purchase_order_id = 'Purchase order is required. Please select a purchase order.';
    } else if (purchaseOrder) {
      // Check workflow guard
      const guard = canCreateGRN(purchaseOrder.status);
      if (!guard.canProceed) {
        validationErrors.purchase_order_id = guard.reason || 'Cannot create GRN from this purchase order.';
        toast(guard.reason || 'Cannot create GRN', 'error');
      }
    }
    
    // Validate receipt date
    if (!formData.receipt_date) {
      validationErrors.receipt_date = 'Receipt date is required.';
    }
    
    // Validate items
    if (!items || items.length === 0) {
      validationErrors.items = 'هذا الحقل مطلوب';
      toast('يجب إضافة منتج واحد على الأقل', 'error');
      setErrors(validationErrors);
      return;
    }
    
    // Validate each item
    items.forEach((item, index) => {
      if (item.received_quantity < 0) {
        validationErrors[`items.${index}.received_quantity`] = `الكمية المستلمة للمنتج ${index + 1} لا يمكن أن تكون سالبة.`;
      }
      if (item.rejected_quantity < 0) {
        validationErrors[`items.${index}.rejected_quantity`] = `الكمية المرفوضة للمنتج ${index + 1} لا يمكن أن تكون سالبة.`;
      }
      const totalReceived = item.received_quantity + item.rejected_quantity;
      if (totalReceived > item.ordered_quantity) {
        validationErrors[`items.${index}.received_quantity`] = `الكمية المستلمة + الكمية المرفوضة (${totalReceived}) للمنتج ${index + 1} لا يمكن أن تتجاوز الكمية المطلوبة (${item.ordered_quantity}).`;
      }
      if (item.received_quantity === 0 && item.rejected_quantity === 0) {
        validationErrors[`items.${index}.received_quantity`] = `يرجى إدخال الكمية المستلمة أو المرفوضة للمنتج ${index + 1}.`;
      }
    });
    
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
    
    // Ensure items are properly formatted
    const formattedItems = items.map((item) => ({
      purchase_order_item_id: item.purchase_order_item_id,
      product_id: item.product_id,
      ordered_quantity: Number(item.ordered_quantity),
      received_quantity: Number(item.received_quantity) || 0,
      rejected_quantity: Number(item.rejected_quantity) || 0,
      quality_status: item.quality_status || 'good',
      notes: item.notes || '',
    }));
    
    if (!formattedItems || formattedItems.length === 0) {
      toast('يجب إضافة منتج واحد على الأقل', 'error');
      return;
    }
    
    mutation.mutate({ 
      formData,
      items: formattedItems,
      materialImages,
      supplierInvoiceFile,
    });
  };

  const updateItem = (index: number, field: keyof GRNItem, value: any) => {
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
          title="Create Goods Received Note (GRN)"
          description="Record the receipt of goods from Purchase Order"
          breadcrumbs={[{ label: 'Goods Receiving', href: '/goods-receiving' }, { label: 'New GRN' }]}
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
              {t('section', 'requestDetails')}
            </h3>
            <div style={{ 
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: 'var(--space-4)',
            }}>
              <div>
                <label className="form-label">
                  Receipt Date <span style={{ color: 'var(--color-error)' }}>*</span>
                </label>
                <input
                  type="date"
                  value={formData.receipt_date}
                  onChange={(e) => setFormData({ ...formData, receipt_date: e.target.value })}
                  className="form-input"
                  required
                />
              </div>
              <div>
                <label className="form-label">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) =>
                    setFormData({ ...formData, status: e.target.value as typeof formData.status })
                  }
                  className="form-select"
                >
                  <option value="draft">Draft</option>
                  <option value="partial">Partially Received</option>
                  <option value="completed">Fully Received</option>
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="form-textarea"
                  rows={3}
                />
              </div>
            </div>
          </div>

          {/* Material Images and Invoice Section */}
          <div className="card">
            <h3 style={{ 
              fontSize: 'var(--text-lg)',
              fontWeight: 'var(--weight-semibold)',
              color: 'var(--text-primary)',
              margin: 0,
              marginBottom: 'var(--space-4)',
            }}>
              Material Photos & Supplier Invoice
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {/* Material Images */}
              <div>
                <label className="form-label">
                  Material Photos (Proof of Delivery)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    setMaterialImages(files);
                    // Create previews
                    const previews: string[] = [];
                    files.forEach((file) => {
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        previews.push(event.target?.result as string);
                        if (previews.length === files.length) {
                          setMaterialImagePreviews(previews);
                        }
                      };
                      reader.readAsDataURL(file);
                    });
                  }}
                  className="form-input"
                />
                {materialImagePreviews.length > 0 && (
                  <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)', flexWrap: 'wrap' }}>
                    {materialImagePreviews.map((preview, index) => (
                      <div key={index} style={{ position: 'relative', width: '100px', height: '100px' }}>
                        <img
                          src={preview}
                          alt={`Material ${index + 1}`}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px' }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const newImages = [...materialImages];
                            const newPreviews = [...materialImagePreviews];
                            newImages.splice(index, 1);
                            newPreviews.splice(index, 1);
                            setMaterialImages(newImages);
                            setMaterialImagePreviews(newPreviews);
                          }}
                          style={{
                            position: 'absolute',
                            top: '-8px',
                            right: '-8px',
                            background: 'var(--color-error)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '50%',
                            width: '24px',
                            height: '24px',
                            cursor: 'pointer',
                            fontSize: '12px',
                          }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Supplier Invoice */}
              <div>
                <label className="form-label">
                  Supplier Invoice (Photo/PDF)
                </label>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setSupplierInvoiceFile(file);
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        setSupplierInvoicePreview(event.target?.result as string);
                      };
                      reader.readAsDataURL(file);
                    } else {
                      setSupplierInvoicePreview(null);
                    }
                  }}
                  className="form-input"
                />
                {supplierInvoicePreview && (
                  <div style={{ marginTop: 'var(--space-2)' }}>
                    {supplierInvoiceFile?.type.startsWith('image/') ? (
                      <img
                        src={supplierInvoicePreview}
                        alt="Supplier Invoice"
                        style={{ maxWidth: '200px', maxHeight: '200px', objectFit: 'contain', borderRadius: '4px' }}
                      />
                    ) : (
                      <div style={{ padding: 'var(--space-2)', background: 'var(--surface-subtle)', borderRadius: '4px' }}>
                        <p style={{ margin: 0, color: 'var(--text-primary)' }}>PDF: {supplierInvoiceFile?.name}</p>
                      </div>
                    )}
                    <Button
                      type="button"
                      variant="secondary"
                      style={{ marginTop: 'var(--space-2)' }}
                      onClick={() => { setSupplierInvoiceFile(null); setSupplierInvoicePreview(null); }}
                    >
                      Remove
                    </Button>
                  </div>
                )}
              </div>

              {/* Invoice Delivery Status */}
              <div>
                <label className="form-label">
                  Invoice Delivery Status
                </label>
                <select
                  value={formData.invoice_delivery_status}
                  onChange={(e) =>
                    setFormData({ ...formData, invoice_delivery_status: e.target.value as typeof formData.invoice_delivery_status })
                  }
                  className="form-select"
                >
                  <option value="not_delivered">Invoice Not Delivered to Office</option>
                  <option value="delivered">Invoice Delivered to Office</option>
                </select>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: 'var(--space-1)' }}>
                  Default: Invoice Not Delivered to Office. Procurement Officer will update this when invoice arrives at office.
                </p>
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
              Received Items
            </h3>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Unit</th>
                    <th>Ordered Qty</th>
                    <th>Received Qty</th>
                    <th>Rejected Qty</th>
                    <th>Quality Status</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
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
                      <td>{item.ordered_quantity}</td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          max={item.ordered_quantity}
                          step="0.01"
                          value={item.received_quantity}
                          onChange={(e) =>
                            updateItem(index, 'received_quantity', parseFloat(e.target.value) || 0)
                          }
                          className="form-input" style={{ width: 96 }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          max={item.ordered_quantity - item.received_quantity}
                          step="0.01"
                          value={item.rejected_quantity}
                          onChange={(e) =>
                            updateItem(index, 'rejected_quantity', parseFloat(e.target.value) || 0)
                          }
                          className="form-input" style={{ width: 96 }}
                        />
                      </td>
                      <td>
                        <select
                          value={item.quality_status}
                          onChange={(e) =>
                            updateItem(index, 'quality_status', e.target.value as GRNItem['quality_status'])
                          }
                          className="form-select"
                        >
                          <option value="good">Good</option>
                          <option value="damaged">Damaged</option>
                          <option value="defective">Defective</option>
                          <option value="missing">Missing</option>
                        </select>
                      </td>
                      <td>
                        <input
                          type="text"
                          value={item.notes || ''}
                          onChange={(e) => updateItem(index, 'notes', e.target.value)}
                          className="form-input"
                          placeholder="Notes..."
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Form Actions - Unified */}
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <Button type="submit" variant="primary" disabled={mutation.isPending} isLoading={mutation.isPending}>
              Create GRN
            </Button>
            <Button type="button" variant="secondary" onClick={() => router.back()}>Cancel</Button>
          </div>
        </form>
      </PageShell>
    </MainLayout>
  );
}

