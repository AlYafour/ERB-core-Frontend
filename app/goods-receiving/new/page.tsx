'use client';

import { useState, useEffect, useRef, useMemo, type FormEvent } from 'react';
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
import { useAuth } from '@/lib/hooks/use-auth';

export default function NewGRNPage() {
  return (
    <RouteGuard requiredPermission={{ category: 'goods_receiving', action: 'create' }} redirectTo="/goods-receiving">
      <NewGRNPageContent />
    </RouteGuard>
  );
}

/* ── Upload zone ────────────────────────────────────────────────── */
function UploadZone({ label, accept, multiple, files, previews, onChange, onRemove }: {
  label: string; accept: string; multiple?: boolean;
  files: File[]; previews: string[];
  onChange: (files: File[], previews: string[]) => void;
  onRemove: (i: number) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const handleFiles = (list: FileList | null) => {
    if (!list) return;
    const arr = multiple ? Array.from(list) : [list[0]];
    const prevs: string[] = new Array(arr.length);
    arr.forEach((f, i) => {
      const r = new FileReader();
      r.onload = e => { prevs[i] = e.target?.result as string; if (prevs.filter(Boolean).length === arr.length) onChange(arr, prevs); };
      r.readAsDataURL(f);
    });
  };
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>{label}</div>
      <input ref={ref} type="file" accept={accept} multiple={multiple} style={{ display: 'none' }} onChange={e => handleFiles(e.target.files)} />
      {files.length === 0 ? (
        <button type="button" onClick={() => ref.current?.click()}
          style={{ width: '100%', minHeight: 90, border: '1.5px dashed var(--border)', borderRadius: 10, backgroundColor: 'var(--surface-subtle)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, color: 'var(--text-tertiary)', fontSize: 13, transition: 'all 0.15s' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-wine-500)'; e.currentTarget.style.color = 'var(--color-wine-500)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-tertiary)'; }}>
          <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 16V8m0 0-3 3m3-3 3 3M20 17a5 5 0 0 0-2-9.6H16.3A8 8 0 1 0 4 15.3" /></svg>
          Click to upload
        </button>
      ) : (
        <div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
            {previews.map((src, i) => (
              <div key={i} style={{ position: 'relative', width: 64, height: 64, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border)' }}>
                {files[i]?.type?.startsWith('image/') ? <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-subtle)', fontSize: 10, color: 'var(--text-secondary)' }}>PDF</div>}
                <button type="button" onClick={() => onRemove(i)} style={{ position: 'absolute', top: 2, right: 2, width: 16, height: 16, background: 'rgba(0,0,0,0.65)', color: '#fff', border: 'none', borderRadius: '50%', cursor: 'pointer', fontSize: 10, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => ref.current?.click()} style={{ fontSize: 12, color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>+ Add more</button>
        </div>
      )}
    </div>
  );
}

/* ── Main ───────────────────────────────────────────────────────── */
function NewGRNPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const purchaseOrderIdParam = searchParams.get('purchase_order_id');
  const { user } = useAuth();
  /* Only actual admins and platform superusers see all — site engineers see only their own */
  const isAdmin = user?.role === 'admin' || user?.is_superuser === true;

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
  const [invoicePreview, setInvoicePreview] = useState('');

  /* Fetch POs available for GRN — smart: approved + no completed GRN + scoped to current user (unless admin) */
  const { data: posData, isLoading: posLoading } = useQuery({
    queryKey: ['purchase-orders-available-grn', user?.id, isAdmin],
    queryFn: () => purchaseOrdersApi.getAll({
      available_for_grn: true,
      page_size: 200,
      ...(!isAdmin && user?.id ? { pr_created_by: user.id } : {}),
    } as any),
    enabled: !purchaseOrderIdParam && !!user,
    staleTime: 60 * 1000,
  });

  const availablePos = useMemo(() =>
    Array.isArray(posData?.results) ? posData!.results : [],
    [posData]
  );

  const poOptions = useMemo(() =>
    availablePos.map((po: PurchaseOrder) => ({
      value: po.id,
      label: `${po.order_number}${po.project_name ? ` — ${po.project_name}` : ''}${typeof po.supplier === 'object' ? ` · ${po.supplier.name}` : ''}`,
    })),
    [availablePos]
  );

  /* Auto-select if only one PO available */
  useEffect(() => {
    if (!purchaseOrderIdParam && availablePos.length === 1 && !formData.purchase_order_id) {
      setFormData(f => ({ ...f, purchase_order_id: availablePos[0].id }));
    }
  }, [availablePos, purchaseOrderIdParam, formData.purchase_order_id]);

  /* Load selected PO details */
  const selectedPoId = formData.purchase_order_id || 0;
  const { data: purchaseOrder } = useQuery({
    queryKey: ['purchase-orders', selectedPoId],
    queryFn: () => purchaseOrdersApi.getById(selectedPoId),
    enabled: selectedPoId > 0,
  });

  /* Pre-fill items when PO loads */
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
    if (!formData.purchase_order_id) { ve.purchase_order_id = 'Please select a purchase order.'; }
    else if (purchaseOrder) {
      const guard = canCreateGRN(purchaseOrder.status);
      if (!guard.canProceed) { ve.purchase_order_id = guard.reason || ''; toast(guard.reason || 'Cannot create GRN', 'error'); }
    }
    if (!formData.receipt_date) ve.receipt_date = 'Required.';
    if (!items.length) { toast('Select a purchase order first', 'error'); setErrors(ve); return; }
    items.forEach((item, i) => {
      const tot = item.received_quantity + item.rejected_quantity;
      if (tot > item.ordered_quantity) ve[`items.${i}.rq`] = `Exceeds ordered (${item.ordered_quantity}).`;
      if (!item.received_quantity && !item.rejected_quantity) ve[`items.${i}.rq`] = 'Enter a quantity.';
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

  const updateItem = (i: number, field: keyof GRNItem, value: unknown) =>
    setItems(prev => { const n = [...prev]; n[i] = { ...n[i], [field]: value }; return n; });

  /* ── Label style ─────────────────────────────────────────────── */
  const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 6 };

  /* ── Inline PO summary ───────────────────────────────────────── */
  const POSummary = purchaseOrder ? (
    <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border-subtle)' }}>
      {[
        ['Supplier', typeof purchaseOrder.supplier === 'object' ? purchaseOrder.supplier.name : '—'],
        ['Total', formatPrice(Number(purchaseOrder.total || 0))],
        ['Items', String(purchaseOrder.items?.length ?? 0)],
        ...(purchaseOrder.project_name ? [['Project', purchaseOrder.project_name]] : []),
        ...(purchaseOrder.pr_created_by_name ? [['Engineer', purchaseOrder.pr_created_by_name]] : []),
      ].map(([k, v]) => (
        <div key={k}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>{k}</div>
          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>{v}</div>
        </div>
      ))}
    </div>
  ) : null;

  return (
    <MainLayout>
      <PageShell>
        <PageHeader
          title="New Goods Received Note"
          description="Record goods received against a purchase order"
          breadcrumbs={[{ label: 'Goods Receiving', href: '/goods-receiving' }, { label: 'New GRN' }]}
        />

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>

          {/* ── 1. Purchase Order ─────────────────────────────────── */}
          <div className="card" style={{ padding: '20px 24px' }}>
            <label style={lbl}>
              Purchase Order
              {!purchaseOrderIdParam && !posLoading && availablePos.length > 0 && (
                <span style={{ marginLeft: 8, fontWeight: 400, color: 'var(--color-warning)', textTransform: 'none', letterSpacing: 0, fontSize: 12 }}>
                  {availablePos.length} pending GRN
                </span>
              )}
              {' '}<span style={{ color: 'var(--color-error)' }}>*</span>
            </label>

            {purchaseOrderIdParam ? (
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>{purchaseOrder?.order_number ?? '—'}</div>
            ) : posLoading ? (
              <div style={{ height: 40, borderRadius: 8, background: 'var(--surface-subtle)', animation: 'pulse 1.5s infinite' }} />
            ) : availablePos.length === 0 ? (
              <div style={{ padding: '16px', borderRadius: 10, background: 'var(--surface-subtle)', color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', textAlign: 'center' }}>
                No approved purchase orders pending GRN.{' '}
                <a href="/purchase-orders" style={{ color: 'var(--color-primary)', textDecoration: 'none' }}>View all orders →</a>
              </div>
            ) : (
              <>
                <SearchableDropdown
                  options={poOptions}
                  value={formData.purchase_order_id || ''}
                  onChange={val => setFormData(f => ({ ...f, purchase_order_id: Number(val) }))}
                  placeholder="Select purchase order…"
                  searchPlaceholder="Search…"
                  emptyMessage="No orders found"
                  className="w-full"
                />
                {errors.purchase_order_id && <p style={{ color: 'var(--color-error)', fontSize: 12, margin: '4px 0 0' }}>{errors.purchase_order_id}</p>}
              </>
            )}
            {POSummary}
          </div>

          {/* ── 2. Receipt details (3-col) ────────────────────────── */}
          <div className="card" style={{ padding: '20px 24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-4)' }}>
              <div>
                <label style={lbl}>Receipt Date <span style={{ color: 'var(--color-error)' }}>*</span></label>
                <input type="date" value={formData.receipt_date}
                  onChange={e => setFormData({ ...formData, receipt_date: e.target.value })}
                  className="form-input" required />
                {errors.receipt_date && <p style={{ color: 'var(--color-error)', fontSize: 12, marginTop: 4 }}>{errors.receipt_date}</p>}
              </div>
              <div>
                <label style={lbl}>Status</label>
                <select
                  value={formData.status}
                  onChange={e => {
                    const s = e.target.value as typeof formData.status;
                    if (s === 'completed') {
                      setItems(prev => prev.map(item => ({ ...item, received_quantity: item.ordered_quantity, rejected_quantity: 0, quality_status: 'good' as const })));
                      setFormData(f => ({ ...f, status: s, notes: f.notes || 'All items received in full — goods verified and in good condition.' }));
                    } else {
                      setFormData(f => ({ ...f, status: s }));
                    }
                  }}
                  className="form-select"
                >
                  <option value="draft">Draft</option>
                  <option value="partial">Partially Received</option>
                  <option value="completed">Fully Received</option>
                </select>
              </div>
              <div>
                <label style={lbl}>Invoice Status</label>
                <select value={formData.invoice_delivery_status} onChange={e => setFormData({ ...formData, invoice_delivery_status: e.target.value as typeof formData.invoice_delivery_status })} className="form-select">
                  <option value="not_delivered">Not Delivered to Office</option>
                  <option value="delivered">Delivered to Office</option>
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={lbl}>Notes</label>
                <textarea value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} className="form-textarea" rows={2} placeholder="Optional…" />
              </div>
            </div>
          </div>

          {/* ── 3. Attachments ────────────────────────────────────── */}
          <div className="card" style={{ padding: '20px 24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-5)' }}>
              <UploadZone label="Material Photos" accept="image/*" multiple
                files={materialImages} previews={materialPreviews}
                onChange={(f, p) => { setMaterialImages(f); setMaterialPreviews(p); }}
                onRemove={i => { const f = [...materialImages]; f.splice(i, 1); const p = [...materialPreviews]; p.splice(i, 1); setMaterialImages(f); setMaterialPreviews(p); }}
              />
              <UploadZone label="Supplier Invoice" accept="image/*,.pdf"
                files={invoiceFile ? [invoiceFile] : []} previews={invoicePreview ? [invoicePreview] : []}
                onChange={(f, p) => { setInvoiceFile(f[0] ?? null); setInvoicePreview(p[0] ?? ''); }}
                onRemove={() => { setInvoiceFile(null); setInvoicePreview(''); }}
              />
            </div>
          </div>

          {/* ── 4. Items ──────────────────────────────────────────── */}
          <div className="card" style={{ padding: '20px 24px' }}>
            <div style={{ ...lbl as object, marginBottom: 14 }}>Received Items</div>
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
                      <th style={{ width: 68 }}>Unit</th>
                      <th style={{ width: 80 }}>Ordered</th>
                      <th style={{ width: 108 }}>Received</th>
                      <th style={{ width: 108 }}>Rejected</th>
                      <th style={{ width: 126 }}>Quality</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, i) => {
                      const poItem = purchaseOrder?.items?.find(p => p.id === item.purchase_order_item_id);
                      const hasErr = !!errors[`items.${i}.rq`];
                      return (
                        <tr key={i}>
                          <td>
                            <div style={{ fontWeight: 600 }}>{poItem?.product?.name || 'N/A'}</div>
                            {poItem?.product?.code && <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{poItem.product.code}</div>}
                          </td>
                          <td style={{ color: 'var(--text-secondary)' }}>{poItem?.product?.unit?.toUpperCase() || '—'}</td>
                          <td style={{ fontWeight: 600 }}>{item.ordered_quantity}</td>
                          <td>
                            <input type="number" min="0" max={item.ordered_quantity} step="0.01" value={item.received_quantity}
                              onChange={e => updateItem(i, 'received_quantity', parseFloat(e.target.value) || 0)}
                              className="form-input" style={{ width: 90, borderColor: hasErr ? 'var(--color-error)' : undefined }} />
                            {hasErr && <div style={{ color: 'var(--color-error)', fontSize: 11, marginTop: 2 }}>{errors[`items.${i}.rq`]}</div>}
                          </td>
                          <td>
                            <input type="number" min="0" max={item.ordered_quantity - item.received_quantity} step="0.01" value={item.rejected_quantity}
                              onChange={e => updateItem(i, 'rejected_quantity', parseFloat(e.target.value) || 0)}
                              className="form-input" style={{ width: 90 }} />
                          </td>
                          <td>
                            <select value={item.quality_status}
                              onChange={e => updateItem(i, 'quality_status', e.target.value as GRNItem['quality_status'])}
                              className="form-select" style={{ fontSize: 12 }}>
                              <option value="good">Good</option>
                              <option value="damaged">Damaged</option>
                              <option value="defective">Defective</option>
                              <option value="missing">Missing</option>
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Actions ──────────────────────────────────────────── */}
          <div style={{ display: 'flex', gap: 'var(--space-3)', paddingBottom: 'var(--space-6)' }}>
            <Button type="submit" variant="primary" disabled={mutation.isPending || !items.length} isLoading={mutation.isPending}>
              Create GRN
            </Button>
            <Button type="button" variant="secondary" onClick={() => router.back()}>Cancel</Button>
          </div>
        </form>
      </PageShell>
    </MainLayout>
  );
}
