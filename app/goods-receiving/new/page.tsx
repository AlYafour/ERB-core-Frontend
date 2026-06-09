'use client';

import { useState, useEffect, useRef, type FormEvent } from 'react';
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

export default function NewGRNPage() {
  return (
    <RouteGuard requiredPermission={{ category: 'goods_receiving', action: 'create' }} redirectTo="/goods-receiving">
      <NewGRNPageContent />
    </RouteGuard>
  );
}

/* ── Styled upload zone ─────────────────────────────────────────── */
function UploadZone({
  label, accept, multiple, files, previews,
  onChange, onRemove,
}: {
  label: string; accept: string; multiple?: boolean;
  files: File[]; previews: string[];
  onChange: (files: File[], previews: string[]) => void;
  onRemove: (index: number) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);

  const handleFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    const arr = multiple ? Array.from(incoming) : [incoming[0]];
    const newPreviews: string[] = [];
    arr.forEach((f, i) => {
      const reader = new FileReader();
      reader.onload = e => {
        newPreviews[i] = e.target?.result as string;
        if (newPreviews.filter(Boolean).length === arr.length) onChange(arr, newPreviews);
      };
      reader.readAsDataURL(f);
    });
  };

  return (
    <div>
      <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{label}</div>
      <input ref={ref} type="file" accept={accept} multiple={multiple} style={{ display: 'none' }} onChange={e => handleFiles(e.target.files)} />

      {files.length === 0 ? (
        <button
          type="button"
          onClick={() => ref.current?.click()}
          style={{
            width: '100%', padding: '20px 16px', border: '1.5px dashed var(--border)',
            borderRadius: 'var(--radius-md)', backgroundColor: 'var(--surface-subtle)',
            color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
            transition: 'border-color 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.color = 'var(--color-primary)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
        >
          <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 16v-8m0 0-3 3m3-3 3 3M20 16.7A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25" /></svg>
          <span>Click to upload</span>
        </button>
      ) : (
        <div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            {previews.map((src, i) => (
              <div key={i} style={{ position: 'relative', width: 72, height: 72, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border)' }}>
                {files[i]?.type?.startsWith('image/') ? (
                  <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-subtle)', fontSize: 11, color: 'var(--text-secondary)', textAlign: 'center', padding: 4 }}>PDF</div>
                )}
                <button
                  type="button"
                  onClick={() => onRemove(i)}
                  style={{ position: 'absolute', top: 2, right: 2, width: 18, height: 18, background: 'rgba(0,0,0,0.6)', color: 'white', border: 'none', borderRadius: '50%', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}
                >×</button>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => ref.current?.click()} style={{ fontSize: 12, color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            + Add more
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Main page ──────────────────────────────────────────────────── */
function NewGRNPageContent() {
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
  const [materialPreviews, setMaterialPreviews] = useState<string[]>([]);
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [invoicePreview, setInvoicePreview] = useState<string>('');

  /* Fetch approved POs */
  const { data: posData } = useQuery({
    queryKey: ['purchase-orders-approved'],
    queryFn: () => purchaseOrdersApi.getAll({ status: 'approved', page_size: 200 } as any),
    staleTime: 2 * 60 * 1000,
  });

  const poOptions = (Array.isArray(posData?.results) ? posData!.results : []).map((po: PurchaseOrder) => ({
    value: po.id,
    label: `${po.order_number}${po.project_name ? ` — ${po.project_name}` : ''}${typeof po.supplier === 'object' ? ` · ${po.supplier.name}` : ''}`,
  }));

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
    mutationFn: (payload: {
      formData: GRNFormData & { invoice_delivery_status: 'not_delivered' | 'delivered' };
      items: GRNItem[]; materialImages?: File[]; supplierInvoiceFile?: File | null;
    }) => goodsReceivingApi.create(toGRNCreateData(payload.formData, payload.items, payload.materialImages, payload.supplierInvoiceFile)),
    onSuccess: (data) => {
      toast('GRN created successfully!', 'success');
      router.push(data?.id ? `/goods-receiving/${data.id}` : `/purchase-orders/${formData.purchase_order_id}`);
    },
    onError: (e: unknown) => toast(getApiError(e, 'Failed to create GRN'), 'error'),
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrors({});
    const ve: Record<string, string> = {};

    if (!formData.purchase_order_id) {
      ve.purchase_order_id = 'Please select a purchase order.';
    } else if (purchaseOrder) {
      const guard = canCreateGRN(purchaseOrder.status);
      if (!guard.canProceed) { ve.purchase_order_id = guard.reason || ''; toast(guard.reason || 'Cannot create GRN', 'error'); }
    }
    if (!formData.receipt_date) ve.receipt_date = 'Required.';
    if (!items.length) { toast('Select a purchase order with items first', 'error'); setErrors(ve); return; }

    items.forEach((item, i) => {
      const tot = item.received_quantity + item.rejected_quantity;
      if (tot > item.ordered_quantity) ve[`items.${i}.received_quantity`] = `Qty exceeds ordered (${item.ordered_quantity}).`;
      if (item.received_quantity === 0 && item.rejected_quantity === 0) ve[`items.${i}.received_quantity`] = 'Enter a quantity.';
    });

    if (Object.keys(ve).length) { setErrors(ve); toast('Please fix the errors', 'error'); return; }

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
      supplierInvoiceFile: invoiceFile,
    });
  };

  const updateItem = (index: number, field: keyof GRNItem, value: unknown) => {
    setItems(prev => { const n = [...prev]; n[index] = { ...n[index], [field]: value }; return n; });
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)',
    textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6,
  };

  return (
    <MainLayout>
      <PageShell>
        <PageHeader
          title="New Goods Received Note"
          description="Record goods received against a purchase order"
          breadcrumbs={[{ label: 'Goods Receiving', href: '/goods-receiving' }, { label: 'New GRN' }]}
        />

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>

          {/* ── Purchase Order ───────────────────────────────────────── */}
          <div className="card" style={{ padding: '20px 24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: purchaseOrderIdParam ? '1fr' : '1fr 1fr', gap: 'var(--space-4)', alignItems: 'start' }}>
              <div>
                <label style={labelStyle}>Purchase Order <span style={{ color: 'var(--color-error)' }}>*</span></label>
                {purchaseOrderIdParam ? (
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-primary)' }}>
                    {purchaseOrder?.order_number ?? '—'}
                  </div>
                ) : (
                  <>
                    <SearchableDropdown
                      options={poOptions}
                      value={formData.purchase_order_id || ''}
                      onChange={val => setFormData(f => ({ ...f, purchase_order_id: Number(val) }))}
                      placeholder="Search by order number, project or supplier…"
                      searchPlaceholder="Search…"
                      emptyMessage="No approved purchase orders found"
                      className="w-full"
                    />
                    {errors.purchase_order_id && <p style={{ color: 'var(--color-error)', fontSize: 12, marginTop: 4 }}>{errors.purchase_order_id}</p>}
                  </>
                )}
              </div>

              {purchaseOrder && (
                <div style={{ display: 'flex', gap: 'var(--space-6)', fontSize: 'var(--text-sm)', flexWrap: 'wrap' }}>
                  {[
                    ['Supplier', typeof purchaseOrder.supplier === 'object' ? purchaseOrder.supplier.name : '—'],
                    ['Total', formatPrice(Number(purchaseOrder.total || 0))],
                    ...(purchaseOrder.project_name ? [['Project', purchaseOrder.project_name]] : []),
                  ].map(([k, v]) => (
                    <div key={k}>
                      <div style={{ ...labelStyle, marginBottom: 2 }}>{k}</div>
                      <div style={{ color: 'var(--text-primary)', fontWeight: 'var(--weight-medium)' }}>{v}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── GRN Details ─────────────────────────────────────────── */}
          <div className="card" style={{ padding: '20px 24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-4)' }}>
              <div>
                <label style={labelStyle}>Receipt Date <span style={{ color: 'var(--color-error)' }}>*</span></label>
                <input type="date" value={formData.receipt_date}
                  onChange={e => setFormData({ ...formData, receipt_date: e.target.value })}
                  className="form-input" required />
                {errors.receipt_date && <p style={{ color: 'var(--color-error)', fontSize: 12, marginTop: 4 }}>{errors.receipt_date}</p>}
              </div>

              <div>
                <label style={labelStyle}>Status</label>
                <select value={formData.status}
                  onChange={e => setFormData({ ...formData, status: e.target.value as typeof formData.status })}
                  className="form-select">
                  <option value="draft">Draft</option>
                  <option value="partial">Partially Received</option>
                  <option value="completed">Fully Received</option>
                </select>
              </div>

              <div>
                <label style={labelStyle}>Invoice Status</label>
                <select value={formData.invoice_delivery_status}
                  onChange={e => setFormData({ ...formData, invoice_delivery_status: e.target.value as typeof formData.invoice_delivery_status })}
                  className="form-select">
                  <option value="not_delivered">Not Delivered to Office</option>
                  <option value="delivered">Delivered to Office</option>
                </select>
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Notes</label>
                <textarea value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  className="form-textarea" rows={2} placeholder="Optional notes…" />
              </div>
            </div>
          </div>

          {/* ── Attachments ─────────────────────────────────────────── */}
          <div className="card" style={{ padding: '20px 24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-5)' }}>
              <UploadZone
                label="Material Photos"
                accept="image/*"
                multiple
                files={materialImages}
                previews={materialPreviews}
                onChange={(files, previews) => { setMaterialImages(files); setMaterialPreviews(previews); }}
                onRemove={i => {
                  const f = [...materialImages]; f.splice(i, 1);
                  const p = [...materialPreviews]; p.splice(i, 1);
                  setMaterialImages(f); setMaterialPreviews(p);
                }}
              />
              <UploadZone
                label="Supplier Invoice"
                accept="image/*,.pdf"
                files={invoiceFile ? [invoiceFile] : []}
                previews={invoicePreview ? [invoicePreview] : []}
                onChange={(files, previews) => { setInvoiceFile(files[0] ?? null); setInvoicePreview(previews[0] ?? ''); }}
                onRemove={() => { setInvoiceFile(null); setInvoicePreview(''); }}
              />
            </div>
          </div>

          {/* ── Items Table ─────────────────────────────────────────── */}
          <div className="card" style={{ padding: '20px 24px' }}>
            <div style={{ ...labelStyle as any, marginBottom: 12 }}>Received Items</div>
            {!items.length ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', margin: 0 }}>
                {selectedPoId > 0 ? 'Loading items…' : 'Select a purchase order above to load items.'}
              </p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ fontSize: 'var(--text-sm)' }}>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th style={{ width: 72 }}>Unit</th>
                      <th style={{ width: 90 }}>Ordered</th>
                      <th style={{ width: 110 }}>Received</th>
                      <th style={{ width: 110 }}>Rejected</th>
                      <th style={{ width: 130 }}>Quality</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, i) => {
                      const poItem = purchaseOrder?.items?.find(p => p.id === item.purchase_order_item_id);
                      const hasError = !!errors[`items.${i}.received_quantity`];
                      return (
                        <tr key={i}>
                          <td>
                            <div style={{ fontWeight: 'var(--weight-medium)' }}>{poItem?.product?.name || 'N/A'}</div>
                            {poItem?.product?.code && <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{poItem.product.code}</div>}
                          </td>
                          <td style={{ color: 'var(--text-secondary)' }}>{poItem?.product?.unit?.toUpperCase() || '—'}</td>
                          <td style={{ fontWeight: 'var(--weight-medium)' }}>{item.ordered_quantity}</td>
                          <td>
                            <input type="number" min="0" max={item.ordered_quantity} step="0.01"
                              value={item.received_quantity}
                              onChange={e => updateItem(i, 'received_quantity', parseFloat(e.target.value) || 0)}
                              className="form-input"
                              style={{ width: 90, borderColor: hasError ? 'var(--color-error)' : undefined }} />
                            {hasError && <div style={{ color: 'var(--color-error)', fontSize: 11, marginTop: 2 }}>{errors[`items.${i}.received_quantity`]}</div>}
                          </td>
                          <td>
                            <input type="number" min="0" max={item.ordered_quantity - item.received_quantity} step="0.01"
                              value={item.rejected_quantity}
                              onChange={e => updateItem(i, 'rejected_quantity', parseFloat(e.target.value) || 0)}
                              className="form-input" style={{ width: 90 }} />
                          </td>
                          <td>
                            <select value={item.quality_status}
                              onChange={e => updateItem(i, 'quality_status', e.target.value as GRNItem['quality_status'])}
                              className="form-select" style={{ fontSize: 'var(--text-xs)' }}>
                              <option value="good">Good</option>
                              <option value="damaged">Damaged</option>
                              <option value="defective">Defective</option>
                              <option value="missing">Missing</option>
                            </select>
                          </td>
                          <td>
                            <input type="text" value={item.notes || ''}
                              onChange={e => updateItem(i, 'notes', e.target.value)}
                              className="form-input" placeholder="—" />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Actions ─────────────────────────────────────────────── */}
          <div style={{ display: 'flex', gap: 'var(--space-3)', paddingBottom: 'var(--space-6)' }}>
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
