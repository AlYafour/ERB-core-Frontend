'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { purchaseRequestsApi } from '@/lib/api/purchase-requests';
import MainLayout from '@/components/layout/MainLayout';
import RejectionReasonDialog from '@/components/features/RejectionReasonDialog';
import DropdownButton from '@/components/ui/DropdownButton';
import { Button, PageHeader, PageShell } from '@/components/ui';
import DetailCard, { DetailField } from '@/components/ui/DetailCard';
import { toast, confirm } from '@/lib/hooks/use-toast';
import { getApiError } from '@/lib/utils/error';
import { canCreateQuotationRequest, canCreatePurchaseOrder } from '@/lib/utils/workflow-guards';
import { useProcPermissions } from '@/lib/hooks/use-proc-permissions';
import { useAuth } from '@/lib/hooks/use-auth';
import { useT } from '@/lib/i18n/useT';
import { productsApi } from '@/lib/api/products';
import SearchableDropdown from '@/components/ui/SearchableDropdown';
import ProductSelector from '@/components/features/ProductSelector';
import { Product } from '@/types';
import { ReadOnlyItemsTable, ColumnDef } from '@/components/procurement/ReadOnlyItemsTable';
import { DocLoadState } from '@/components/procurement/shared/DocLoadState';
import { StickyDocBar } from '@/components/procurement/shared/StickyDocBar';
import { PR_STATUS } from '@/lib/utils/status-colors';
import { PR_LABEL } from '@/lib/constants/status-labels';

export default function PurchaseRequestDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params.id);
  const queryClient = useQueryClient();
  const t = useT();
  const { user } = useAuth();
  const { isAdmin, can } = useProcPermissions();

  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [editingForm, setEditingForm] = useState<{
    productId: number; quantity: number; unit: string; reason: string; notes: string;
  }>({ productId: 0, quantity: 1, unit: '', reason: '', notes: '' });
  const [addingProduct, setAddingProduct] = useState(false);
  const [newProduct, setNewProduct] = useState<Product | null>(null);
  const [newProductCategory, setNewProductCategory] = useState('');
  const [newItem, setNewItem] = useState({ quantity: 1, unit: '', reason: '', notes: '' });

  const canApprove = can('purchase_request', 'approve');
  const canReject  = can('purchase_request', 'reject');
  const canManageAdditionalOrders = isAdmin || user?.role === 'procurement_manager';

  const { data: request, isLoading } = useQuery({
    queryKey: ['purchase-requests', id],
    queryFn: () => purchaseRequestsApi.getById(id),
  });

  const { data: products } = useQuery({
    queryKey: ['products'],
    queryFn: () => productsApi.getAll({ page: 1, page_size: 200 }),
    enabled: isAdmin,
    staleTime: 10 * 60 * 1000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['purchase-requests', id] });
    queryClient.invalidateQueries({ queryKey: ['purchase-requests'] });
  };

  const approveMutation = useMutation({
    mutationFn: () => purchaseRequestsApi.approve(id),
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['pending-count'] });
    },
    onError: (err: any) => toast(getApiError(err, 'Failed to approve'), 'error'),
  });

  const rejectMutation = useMutation({
    mutationFn: (reason: string) => purchaseRequestsApi.reject(id, reason),
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['pending-count'] });
      setRejectDialogOpen(false);
    },
    onError: (err: any) => toast(getApiError(err, 'Failed to reject request'), 'error'),
  });

  const undoApprovalMutation = useMutation({
    mutationFn: () => purchaseRequestsApi.undoApproval(id),
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['pending-count'] });
    },
    onError: (err: any) => toast(getApiError(err, 'Failed to undo approval'), 'error'),
  });

  const allowAdditionalOrderMutation = useMutation({
    mutationFn: () => purchaseRequestsApi.allowAdditionalOrder(id),
    onSuccess: () => {
      invalidate();
      toast('Unlocked — one additional LPO/QR can now be created', 'success');
    },
    onError: () => toast('Failed to unlock additional order', 'error'),
  });

  const updateItemMutation = useMutation({
    mutationFn: ({ itemId, data }: { itemId: number; data: { product_id: number; quantity: number; unit?: string; reason?: string; notes?: string } }) =>
      purchaseRequestsApi.updateItem(itemId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-requests', id] });
      setEditingItemId(null);
      toast('Item updated', 'success');
    },
    onError: () => toast('Failed to update item', 'error'),
  });

  const addItemMutation = useMutation({
    mutationFn: (data: { product_id: number; quantity: number; unit?: string; reason?: string; notes?: string }) =>
      purchaseRequestsApi.addItem({ purchase_request_id: id, ...data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-requests', id] });
      setAddingProduct(false);
      setNewProduct(null);
      setNewProductCategory('');
      setNewItem({ quantity: 1, unit: '', reason: '', notes: '' });
      toast('Product added', 'success');
    },
    onError: () => toast('Failed to add product', 'error'),
  });

  const deleteItemMutation = useMutation({
    mutationFn: (itemId: number) => purchaseRequestsApi.deleteItem(itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-requests', id] });
      toast('Product removed', 'info');
    },
    onError: () => toast('Failed to remove product', 'error'),
  });

  if (isLoading) return <DocLoadState type="loading" />;
  if (!request)  return <DocLoadState type="not-found" message="Purchase Request not found." />;

  const canEditItems = (isAdmin || request.created_by === user?.id) && request.status === 'pending';

  type PRItem = (typeof request.items)[number];
  const cols: ColumnDef<PRItem>[] = [
    {
      header: t('col', 'product'),
      cell: (item) => editingItemId === item.id ? (
        <div style={{ minWidth: 220 }}>
          <SearchableDropdown
            options={products?.results?.map((p) => ({ value: p.id, label: `${p.name} (${p.code})`, searchText: `${p.name} ${p.code}` })) || []}
            value={editingForm.productId}
            onChange={(val) => setEditingForm(f => ({ ...f, productId: val ? Number(val) : 0 }))}
            placeholder="Select product…"
            searchPlaceholder="Search products…"
          />
        </div>
      ) : (
        <>
          <div style={{ fontWeight: 'var(--weight-medium)' }}>{item.product?.name || 'N/A'}</div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{item.product?.code}</div>
        </>
      ),
    },
    {
      header: t('col', 'quantity'),
      cell: (item) => editingItemId === item.id
        ? <input type="number" min="0.001" step="0.001" className="form-input" style={{ width: 90 }} value={editingForm.quantity} onChange={(e) => setEditingForm(f => ({ ...f, quantity: Number(e.target.value) || 0 }))} />
        : <span>{item.quantity}</span>,
    },
    {
      header: t('col', 'unit'),
      cell: (item) => editingItemId === item.id
        ? <input className="form-input" style={{ width: 100 }} value={editingForm.unit} onChange={(e) => setEditingForm(f => ({ ...f, unit: e.target.value }))} placeholder="Unit" />
        : <span style={{ color: 'var(--text-secondary)' }}>{item.unit || item.product?.unit || '—'}</span>,
    },
    { header: t('col', 'projectSite'), cell: (item) => <span style={{ color: 'var(--text-secondary)' }}>{item.project_site || '—'}</span> },
    {
      header: t('col', 'purpose'),
      cell: (item) => editingItemId === item.id
        ? <input className="form-input" style={{ minWidth: 120 }} value={editingForm.reason} onChange={(e) => setEditingForm(f => ({ ...f, reason: e.target.value }))} placeholder="Purpose…" />
        : <span style={{ color: 'var(--text-secondary)', maxWidth: 256, display: 'block' }}>{(item as any).reason || '—'}</span>,
    },
    {
      header: t('col', 'notes'),
      cell: (item) => editingItemId === item.id
        ? <input className="form-input" style={{ minWidth: 120 }} value={editingForm.notes} onChange={(e) => setEditingForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notes…" />
        : <span style={{ color: 'var(--text-secondary)', maxWidth: 256, display: 'block' }}>{item.notes || '—'}</span>,
    },
  ];

  if (canEditItems) {
    cols.push({
      header: '',
      cell: (item) => (
        <div style={{ display: 'flex', gap: 6 }}>
          {isAdmin && (editingItemId === item.id ? (
            <>
              <button className="btn btn-primary" style={{ fontSize: 'var(--text-xs)', padding: '4px 10px' }}
                disabled={!editingForm.productId || updateItemMutation.isPending}
                onClick={() => updateItemMutation.mutate({ itemId: item.id!, data: { product_id: editingForm.productId, quantity: editingForm.quantity, unit: editingForm.unit, reason: editingForm.reason, notes: editingForm.notes } })}>
                {updateItemMutation.isPending ? '…' : 'Save'}
              </button>
              <button className="btn btn-secondary" style={{ fontSize: 'var(--text-xs)', padding: '4px 10px' }} onClick={() => setEditingItemId(null)}>
                Cancel
              </button>
            </>
          ) : (
            <button className="btn btn-secondary" style={{ fontSize: 'var(--text-xs)', padding: '4px 10px' }}
              onClick={() => { setEditingItemId(item.id!); setEditingForm({ productId: item.product?.id || 0, quantity: item.quantity, unit: item.unit || item.product?.unit || '', reason: (item as any).reason || '', notes: item.notes || '' }); }}>
              Edit
            </button>
          ))}
          <Button variant="delete" size="sm" disabled={deleteItemMutation.isPending} onClick={() => deleteItemMutation.mutate(item.id!)}>
            {t('btn', 'delete')}
          </Button>
        </div>
      ),
    });
  }

  return (
    <MainLayout>
      <PageShell>
        <PageHeader
          backHref="/purchase-requests"
          title={`${t('page', 'purchaseRequests')}: ${request.code}`}
          breadcrumbs={[{ label: t('page', 'purchaseRequests'), href: '/purchase-requests' }, { label: request.code }]}
        />

        {/* ── Sticky action bar ── */}
        <StickyDocBar
          docTypeLabel="Purchase Request"
          docNumber={request.code}
          statusVariant={PR_STATUS[request.status] ?? 'default'}
          statusLabel={PR_LABEL[request.status] || request.status}
        >
          {request.allow_additional_orders && (
            <span style={{ fontSize: 11, fontWeight: 600, color: '#d97706', background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 6, padding: '3px 8px' }}>
              🔓 Additional Order Unlocked
            </span>
          )}
          <Button variant="secondary" size="sm" onClick={() => window.open(`/print/pr/${id}`, '_blank')}>Print</Button>

          {/* Pending actions */}
          {request.status === 'pending' && canApprove && (
            <Button variant="success" size="sm" isLoading={approveMutation.isPending} onClick={() => approveMutation.mutate()}>
              {t('btn', 'approve')}
            </Button>
          )}
          {request.status === 'pending' && canReject && (
            <Button variant="destructive" size="sm" disabled={rejectMutation.isPending} onClick={() => setRejectDialogOpen(true)}>
              {t('btn', 'reject')}
            </Button>
          )}

          {/* Approved actions */}
          {request.status === 'approved' && canApprove && !request.has_quotation_requests && !request.has_purchase_orders && (
            <Button variant="secondary" size="sm" isLoading={undoApprovalMutation.isPending} onClick={() => undoApprovalMutation.mutate()}>
              {t('btn', 'update')}
            </Button>
          )}
          {request.status === 'approved' && canManageAdditionalOrders && (request.has_purchase_orders || request.has_awarded_quotation) && !request.allow_additional_orders && (
            <Button variant="secondary" size="sm" isLoading={allowAdditionalOrderMutation.isPending} onClick={() => allowAdditionalOrderMutation.mutate()}>
              🔓 Allow Additional Order
            </Button>
          )}
          {request.status === 'approved' && (isAdmin || can('quotation_request', 'create') || can('purchase_order', 'create')) &&
           (!request.has_awarded_quotation || request.allow_additional_orders) &&
           (!request.has_purchase_orders || request.allow_additional_orders) && (
            <DropdownButton
              label={t('btn', 'create')}
              variant="primary"
              items={[
                {
                  label: t('page', 'newQR'),
                  onClick: () => {
                    if (!isAdmin && !can('quotation_request', 'create')) { toast('No permission to create a Quotation Request', 'error'); return; }
                    if (request.has_awarded_quotation) { toast('PR already has an awarded quotation.', 'error'); return; }
                    if (request.has_purchase_orders) { toast('PR already has purchase orders.', 'error'); return; }
                    const guard = canCreateQuotationRequest(request.status, can('quotation_request', 'create'));
                    if (!guard.canProceed) { toast(guard.reason || 'Cannot create QR', 'error'); return; }
                    router.push(`/quotation-requests/new?purchase_request_id=${id}`);
                  },
                },
                {
                  label: t('page', 'newPO'),
                  onClick: async () => {
                    if (!isAdmin && !can('purchase_order', 'create')) { toast('No permission to create a Purchase Order', 'error'); return; }
                    const guard = canCreatePurchaseOrder(undefined, request.status);
                    if (!guard.canProceed) { toast(guard.reason || 'Cannot create PO', 'error'); return; }
                    if (guard.warning && !await confirm(guard.warning + '\n\nDo you want to continue?')) return;
                    router.push(`/purchase-orders/new?purchase_request_id=${id}`);
                  },
                },
              ]}
            />
          )}
        </StickyDocBar>

        {/* Details */}
        <DetailCard title={t('col', 'title')}>
          <DetailField label={t('col', 'title')} value={request.title} />
          <DetailField label={t('col', 'requestDate')} value={new Date(request.request_date).toLocaleDateString('en-US')} />
          <DetailField label={t('col', 'requiredBy')} value={new Date(request.required_by).toLocaleDateString('en-US')} />
          <DetailField label={t('col', 'createdBy')} value={request.created_by_name} />
          {request.approved_by_name && (
            <DetailField label={t('section', 'authorization')} value={request.approved_by_name} />
          )}
          {request.notes && (
            <DetailField label={t('col', 'notes')} value={request.notes} span={3} />
          )}
          {request.rejection_reason && (
            <DetailField
              label={t('confirm', 'rejectReason')}
              span={3}
              value={
                <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-error-light)', border: '1px solid var(--color-error)', borderRadius: 'var(--radius-md)' }}>
                  <p style={{ fontSize: 'var(--text-sm)', color: '#991B1B', margin: 0 }}>{request.rejection_reason}</p>
                </div>
              }
            />
          )}
        </DetailCard>

        {/* Tracking link */}
        <div className="card" style={{ backgroundColor: 'var(--surface-inset)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-primary)', margin: 0, marginBottom: 'var(--space-1)' }}>
                {t('page', 'purchaseRequests')} — {t('section', 'statusInfo')}
              </h3>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0 }}>
                {t('page', 'prSubtitle')}
              </p>
            </div>
            <Link href={`/purchase-requests/${id}/tracking`} className="btn btn-primary" style={{ textDecoration: 'none' }}>
              {t('page', 'purchaseRequests')} →
            </Link>
          </div>
        </div>

        {/* Items */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
            <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-primary)', margin: 0 }}>
              {t('section', 'requestedItems')}
            </h3>
            {canEditItems && !addingProduct && (
              <Button variant="primary" onClick={() => setAddingProduct(true)}>+ {t('btn', 'addProduct')}</Button>
            )}
          </div>

          {addingProduct && (
            <div style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-4)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--surface-inset)' }}>
              <div style={{ marginBottom: 'var(--space-3)' }}>
                <ProductSelector
                  selectedProductId={newProduct?.id || null}
                  onProductSelect={(p) => { setNewProduct(p); if (p) setNewItem((prev) => ({ ...prev, unit: p.unit || '' })); }}
                  selectedCategory={newProductCategory}
                  onCategoryChange={setNewProductCategory}
                />
              </div>
              {newProduct && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div>
                    <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 3 }}>{t('col', 'quantity')} *</label>
                    <input type="number" min="0.001" step="0.001" className="form-input" style={{ width: 90 }} value={newItem.quantity} onChange={(e) => setNewItem({ ...newItem, quantity: Number(e.target.value) || 0 })} />
                  </div>
                  <div style={{ width: 130 }}>
                    <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 3 }}>{t('col', 'unit')}</label>
                    <input className="form-input" style={{ width: '100%' }} value={newItem.unit} onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })} placeholder="Unit…" />
                  </div>
                  <div style={{ flex: 1, minWidth: 150 }}>
                    <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 3 }}>{t('field', 'reason')}</label>
                    <input className="form-input" style={{ width: '100%' }} value={newItem.reason} onChange={(e) => setNewItem({ ...newItem, reason: e.target.value })} placeholder="Why is this needed?" />
                  </div>
                  <div style={{ flex: 1, minWidth: 150 }}>
                    <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 3 }}>{t('col', 'notes')}</label>
                    <input className="form-input" style={{ width: '100%' }} value={newItem.notes} onChange={(e) => setNewItem({ ...newItem, notes: e.target.value })} placeholder="Additional notes" />
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 'var(--space-3)' }}>
                <Button variant="primary" disabled={!newProduct || addItemMutation.isPending} isLoading={addItemMutation.isPending}
                  onClick={() => { if (!newProduct) return; addItemMutation.mutate({ product_id: newProduct.id, quantity: newItem.quantity, unit: newItem.unit, reason: newItem.reason, notes: newItem.notes }); }}>
                  {t('btn', 'addProduct')}
                </Button>
                <Button variant="secondary" onClick={() => { setAddingProduct(false); setNewProduct(null); setNewProductCategory(''); setNewItem({ quantity: 1, unit: '', reason: '', notes: '' }); }}>
                  {t('btn', 'cancel')}
                </Button>
              </div>
            </div>
          )}

          <ReadOnlyItemsTable items={request.items} columns={cols} />
        </div>

        {/* Status info banner */}
        {request.status === 'approved' && (request.has_awarded_quotation || request.has_purchase_orders) && (
          <div className="card" style={{ backgroundColor: 'var(--surface-inset)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
            <svg style={{ width: 20, height: 20, flexShrink: 0, color: 'var(--text-secondary)', marginTop: 2 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p style={{ margin: 0, fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: 'var(--text-primary)', marginBottom: 'var(--space-1)' }}>
                {request.has_purchase_orders ? 'Purchase Order Created' : 'Supplier Awarded'}
              </p>
              <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {request.has_purchase_orders
                  ? 'This PR has an active LPO. Modifications are no longer allowed.'
                  : 'This PR has an awarded supplier. You can proceed to create a Purchase Order (LPO).'}
              </p>
            </div>
          </div>
        )}

        <RejectionReasonDialog
          isOpen={rejectDialogOpen}
          onClose={() => setRejectDialogOpen(false)}
          onConfirm={(reason) => rejectMutation.mutate(reason)}
          title={`${t('btn', 'reject')} ${t('page', 'purchaseRequests')}`}
          message={t('confirm', 'rejectReason')}
        />
      </PageShell>
    </MainLayout>
  );
}
