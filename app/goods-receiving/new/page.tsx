'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { purchaseOrdersApi } from '@/lib/api/purchase-orders';
import { goodsReceivingApi, GRNItem } from '@/lib/api/goods-receiving';
import { GRNFormData, toGRNCreateData } from '@/lib/types/form-data';
import { PurchaseOrder } from '@/types';
import { Button, PageHeader, PageShell } from '@/components/ui';
import MainLayout from '@/components/layout/MainLayout';
import { formatPrice } from '@/lib/utils/format';
import { toast } from '@/lib/hooks/use-toast';
import SearchableDropdown from '@/components/ui/SearchableDropdown';
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
  const purchaseOrderIdParam = searchParams.get('purchase_order_id');

  const [formData, setFormData] = useState<GRNFormData & { invoice_delivery_status: 'not_delivered' | 'delivered' }>({
    purchase_order_id: purchaseOrderIdParam ? Number(purchaseOrderIdParam) : 0,
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

  /* Fetch approved POs for the selector */
  const { data: posData } = useQuery({
    queryKey: ['purchase-orders-approved'],
    queryFn: () => purchaseOrdersApi.getAll({ status: 'approved', page_size: 200 } as any),
    staleTime: 2 * 60 * 1000,
  });

  const poOptions = (Array.isArray(posData?.results) ? posData!.results : []).map((po: PurchaseOrder) => ({
    value: po.id,
    label: `${po.order_number}${po.project_name ? ` — ${po.project_name}` : ''}${typeof po.supplier === 'object' ? ` (${po.supplier.name})` : ''}`,
  }));

  /* Load the selected PO details */
  const selectedPoId = formData.purchase_order_id || 0;
  const { data: purchaseOrder } = useQuery({
    queryKey: ['purchase-orders', selectedPoId],
    queryFn: () => purchaseOrdersApi.getById(selectedPoId),
    enabled: selectedPoId > 0,
  });

  useEffect(() => {
    if (purchaseOrder?.items?.length) {
      setItems(purchaseOrder.items.map(item => ({
        purchase_order_item_id: item.id!,
        product_id: item.product?.id || item.product_id,
        ordered_quantity: Number(item.quantity) || 0,
        received_quantity: 0,
        rejected_quantity: 0,
        quality_status: 'good' as const,
        notes: '',
      })));
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
    }) => goodsReceivingApi.create(toGRNCreateData(data.formData, data.items, data.materialImages, data.supplierInvoiceFile)),
    onSuccess: (data) => {
      toast('GRN created successfully!', 'success');
      router.push(data?.id ? `/goods-receiving/${data.id}` : `/purchase-orders/${formData.purchase_order_id}`);
    },
    onError: (e: unknown) => toast(getApiError(e, 'Failed to create goods receipt'), 'error'),
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrors({});
    const validationErrors: Record<string, string> = {};

    if (!formData.purchase_order_id || formData.purchase_order_id === 0) {
      validationErrors.purchase_order_id = 'Please select a purchase order.';
    } else if (purchaseOrder) {
      const guard = canCreateGRN(purchaseOrder.status);
      if (!guard.canProceed) {
        validationErrors.purchase_order_id = guard.reason || 'Cannot create GRN from this purchase order.';
        toast(guard.reason || 'Cannot create GRN', 'error');
      }
    }

    if (!formData.receipt_date) validationErrors.receipt_date = 'Receipt date is required.';

    if (!items.length) {
      validationErrors.items = 'At least one item is required.';
      toast('Please select a purchase order with items first', 'error');
      setErrors(validationErrors);
      return;
    }

    items.forEach((item, index) => {
      if (item.received_quantity < 0) validationErrors[`items.${index}.received_quantity`] = `Item ${index + 1}: received qty cannot be negative.`;
      if (item.rejected_quantity < 0) validationErrors[`items.${index}.rejected_quantity`] = `Item ${index + 1}: rejected qty cannot be negative.`;
      const total = item.received_quantity + item.rejected_quantity;
      if (total > item.ordered_quantity) validationErrors[`items.${index}.received_quantity`] = `Item ${index + 1}: received + rejected (${total}) exceeds ordered (${item.ordered_quantity}).`;
      if (item.received_quantity === 0 && item.rejected_quantity === 0) validationErrors[`items.${index}.received_quantity`] = `Item ${index + 1}: enter received or rejected quantity.`;
    });

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      toast('Please correct the errors in the form', 'error');
      return;
    }

    mutation.mutate({
      formData,
      items: items.map(item => ({
        purchase_order_item_id: item.purchase_order_item_id,
        product_id: item.product_id,
        ordered_quantity: Number(item.ordered_quantity),
        received_quantity: Number(item.received_quantity) || 0,
        rejected_quantity: Number(item.rejected_quantity) || 0,
        quality_status: item.quality_status || 'good',
        notes: item.notes || '',
      })),
      materialImages,
      supplierInvoiceFile,
    });
  };

  const updateItem = (index: number, field: keyof GRNItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  return (
    <MainLayout>
      <PageShell>
        <PageHeader
          title="Create Goods Received Note (GRN)"
          description="Record the receipt of goods from a Purchase Order"
          breadcrumbs={[{ label: 'Goods Receiving', href: '/goods-receiving' }, { label: 'New GRN' }]}
        />

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>

          {/* ── PO Selector ─────────────────────────────────────────── */}
          <div className="card">
            <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-primary)', margin: '0 0 var(--space-4)' }}>
              Purchase Order
            </h3>

            {purchaseOrderIdParam ? (
              /* Came from PO page — read-only display */
              purchaseOrder && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-3)', fontSize: 'var(--text-sm)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--surface-subtle)' }}>
                  <div><span style={{ color: 'var(--text-secondary)' }}>Order:</span> <span style={{ fontWeight: 'var(--weight-semibold)' }}>{purchaseOrder.order_number}</span></div>
                  <div><span style={{ color: 'var(--text-secondary)' }}>Supplier:</span> <span style={{ fontWeight: 'var(--weight-medium)' }}>{typeof purchaseOrder.supplier === 'object' ? purchaseOrder.supplier.name : '—'}</span></div>
                  <div><span style={{ color: 'var(--text-secondary)' }}>Total:</span> <span style={{ fontWeight: 'var(--weight-medium)' }}>{formatPrice(Number(purchaseOrder.total || 0))}</span></div>
                  {purchaseOrder.project_name && <div><span style={{ color: 'var(--text-secondary)' }}>Project:</span> <span style={{ fontWeight: 'var(--weight-medium)' }}>{purchaseOrder.project_name}</span></div>}
                </div>
              )
            ) : (
              /* Direct access — show selector */
              <div>
                <label className="form-label">Select Purchase Order <span style={{ color: 'var(--color-error)' }}>*</span></label>
                <SearchableDropdown
                  options={poOptions}
                  value={formData.purchase_order_id || ''}
                  onChange={val => setFormData(f => ({ ...f, purchase_order_id: Number(val) }))}
                  placeholder="Search by order number, project or supplier…"
                  searchPlaceholder="Search…"
                  emptyMessage="No approved purchase orders found"
                  className="w-full"
                />
                {errors.purchase_order_id && <p style={{ color: 'var(--color-error)', fontSize: 'var(--text-xs)', marginTop: 4 }}>{errors.purchase_order_id}</p>}

                {/* Show PO summary once selected */}
                {purchaseOrder && (
                  <div style={{ marginTop: 'var(--space-3)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-3)', fontSize: 'var(--text-sm)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--surface-subtle)' }}>
                    <div><span style={{ color: 'var(--text-secondary)' }}>Supplier:</span> <span style={{ fontWeight: 'var(--weight-medium)' }}>{typeof purchaseOrder.supplier === 'object' ? purchaseOrder.supplier.name : '—'}</span></div>
                    <div><span style={{ color: 'var(--text-secondary)' }}>Total:</span> <span style={{ fontWeight: 'var(--weight-medium)' }}>{formatPrice(Number(purchaseOrder.total || 0))}</span></div>
                    {purchaseOrder.project_name && <div><span style={{ color: 'var(--text-secondary)' }}>Project:</span> <span style={{ fontWeight: 'var(--weight-medium)' }}>{purchaseOrder.project_name}</span></div>}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── GRN Details ─────────────────────────────────────────── */}
          <div className="card">
            <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-primary)', margin: '0 0 var(--space-4)' }}>
              {t('section', 'requestDetails')}
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 'var(--space-4)' }}>
              <div>
                <label className="form-label">Receipt Date <span style={{ color: 'var(--color-error)' }}>*</span></label>
                <input
                  type="date"
                  value={formData.receipt_date}
                  onChange={e => setFormData({ ...formData, receipt_date: e.target.value })}
                  className="form-input"
                  required
                />
              </div>
              <div>
                <label className="form-label">Status</label>
                <select
                  value={formData.status}
                  onChange={e => setFormData({ ...formData, status: e.target.value as typeof formData.status })}
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
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  className="form-textarea"
                  rows={3}
                />
              </div>
            </div>
          </div>

          {/* ── Material Photos & Supplier Invoice ──────────────────── */}
          <div className="card">
            <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-primary)', margin: '0 0 var(--space-4)' }}>
              Material Photos & Supplier Invoice
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div>
                <label className="form-label">Material Photos (Proof of Delivery)</label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={e => {
                    const files = Array.from(e.target.files || []);
                    setMaterialImages(files);
                    const previews: string[] = [];
                    files.forEach(file => {
                      const reader = new FileReader();
                      reader.onload = event => {
                        previews.push(event.target?.result as string);
                        if (previews.length === files.length) setMaterialImagePreviews([...previews]);
                      };
                      reader.readAsDataURL(file);
                    });
                  }}
                  className="form-input"
                />
                {materialImagePreviews.length > 0 && (
                  <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)', flexWrap: 'wrap' }}>
                    {materialImagePreviews.map((preview, index) => (
                      <div key={index} style={{ position: 'relative', width: 100, height: 100 }}>
                        <img src={preview} alt={`Material ${index + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 4 }} />
                        <button
                          type="button"
                          onClick={() => {
                            const imgs = [...materialImages]; imgs.splice(index, 1);
                            const prevs = [...materialImagePreviews]; prevs.splice(index, 1);
                            setMaterialImages(imgs); setMaterialImagePreviews(prevs);
                          }}
                          style={{ position: 'absolute', top: -8, right: -8, background: 'var(--color-error)', color: 'white', border: 'none', borderRadius: '50%', width: 24, height: 24, cursor: 'pointer', fontSize: 12 }}
                        >×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="form-label">Supplier Invoice (Photo/PDF)</label>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={e => {
                    const file = e.target.files?.[0] || null;
                    setSupplierInvoiceFile(file);
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = event => setSupplierInvoicePreview(event.target?.result as string);
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
                      <img src={supplierInvoicePreview} alt="Invoice" style={{ maxWidth: 200, maxHeight: 200, objectFit: 'contain', borderRadius: 4 }} />
                    ) : (
                      <div style={{ padding: 'var(--space-2)', background: 'var(--surface-subtle)', borderRadius: 4 }}>
                        <p style={{ margin: 0 }}>PDF: {supplierInvoiceFile?.name}</p>
                      </div>
                    )}
                    <Button type="button" variant="secondary" style={{ marginTop: 'var(--space-2)' }} onClick={() => { setSupplierInvoiceFile(null); setSupplierInvoicePreview(null); }}>Remove</Button>
                  </div>
                )}
              </div>

              <div>
                <label className="form-label">Invoice Delivery Status</label>
                <select
                  value={formData.invoice_delivery_status}
                  onChange={e => setFormData({ ...formData, invoice_delivery_status: e.target.value as typeof formData.invoice_delivery_status })}
                  className="form-select"
                >
                  <option value="not_delivered">Invoice Not Delivered to Office</option>
                  <option value="delivered">Invoice Delivered to Office</option>
                </select>
              </div>
            </div>
          </div>

          {/* ── Items Table ──────────────────────────────────────────── */}
          <div className="card">
            <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-primary)', margin: '0 0 var(--space-4)' }}>
              Received Items
            </h3>
            {!items.length ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
                {selectedPoId > 0 ? 'Loading items…' : 'Select a purchase order above to load items.'}
              </p>
            ) : (
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
                    {items.map((item, index) => {
                      const poItem = purchaseOrder?.items?.find(p => p.id === item.purchase_order_item_id);
                      return (
                        <tr key={index}>
                          <td>
                            <div style={{ fontWeight: 'var(--weight-medium)' }}>{poItem?.product?.name || 'N/A'}</div>
                            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{poItem?.product?.code || ''}</div>
                          </td>
                          <td style={{ color: 'var(--text-secondary)' }}>{poItem?.product?.unit?.toUpperCase() || '—'}</td>
                          <td>{item.ordered_quantity}</td>
                          <td>
                            <input type="number" min="0" max={item.ordered_quantity} step="0.01"
                              value={item.received_quantity}
                              onChange={e => updateItem(index, 'received_quantity', parseFloat(e.target.value) || 0)}
                              className="form-input" style={{ width: 96 }} />
                            {errors[`items.${index}.received_quantity`] && (
                              <p style={{ color: 'var(--color-error)', fontSize: 11, margin: '2px 0 0' }}>{errors[`items.${index}.received_quantity`]}</p>
                            )}
                          </td>
                          <td>
                            <input type="number" min="0" max={item.ordered_quantity - item.received_quantity} step="0.01"
                              value={item.rejected_quantity}
                              onChange={e => updateItem(index, 'rejected_quantity', parseFloat(e.target.value) || 0)}
                              className="form-input" style={{ width: 96 }} />
                          </td>
                          <td>
                            <select value={item.quality_status}
                              onChange={e => updateItem(index, 'quality_status', e.target.value as GRNItem['quality_status'])}
                              className="form-select">
                              <option value="good">Good</option>
                              <option value="damaged">Damaged</option>
                              <option value="defective">Defective</option>
                              <option value="missing">Missing</option>
                            </select>
                          </td>
                          <td>
                            <input type="text" value={item.notes || ''} onChange={e => updateItem(index, 'notes', e.target.value)}
                              className="form-input" placeholder="Notes…" />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

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
