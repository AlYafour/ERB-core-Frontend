'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { purchaseRequestsApi } from '@/lib/api/purchase-requests';
import MainLayout from '@/components/layout/MainLayout';
import RejectionReasonDialog from '@/components/features/RejectionReasonDialog';
import DropdownButton from '@/components/ui/DropdownButton';
import { Button, PageHeader, PageShell } from '@/components/ui';
import { useState } from 'react';
import { toast, confirm } from '@/lib/hooks/use-toast';
import { getApiError } from '@/lib/utils/error';
import { canCreateQuotationRequest, canCreatePurchaseOrder } from '@/lib/utils/workflow-guards';
import { usePermissions } from '@/lib/hooks/use-permissions';
import { useAuth } from '@/lib/hooks/use-auth';
import { useMyPermissions } from '@/lib/hooks/use-my-permissions';
import { useT } from '@/lib/i18n/useT';
import { productsApi } from '@/lib/api/products';
import SearchableDropdown from '@/components/ui/SearchableDropdown';
import ProductSelector from '@/components/features/ProductSelector';
import { Product } from '@/types';

const statusColors: Record<string, string> = {
  pending: 'badge-warning',
  approved: 'badge-success',
  rejected: 'badge-error',
};

export default function PurchaseRequestDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params.id);
  const queryClient = useQueryClient();
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const { hasPermission } = usePermissions();
  const t = useT();
  const statusLabels: Record<string, string> = {
    pending: t('status', 'pending'),
    approved: t('status', 'approved'),
    rejected: t('status', 'rejected'),
  };

  // Permission checks
  // Only Procurement Manager, Super Admin, and Superuser can approve/reject
  // Procurement Officer and Site Engineer should NOT be able to approve/reject
  const { user } = useAuth();
  const { isTenantAdmin, isPlatformAdmin } = useMyPermissions();
  const isAdmin = isTenantAdmin || isPlatformAdmin;

  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [editingForm, setEditingForm] = useState<{ productId: number; quantity: number; unit: string; reason: string; notes: string }>({ productId: 0, quantity: 1, unit: '', reason: '', notes: '' });

  const [addingProduct, setAddingProduct] = useState(false);
  const [newProduct, setNewProduct] = useState<Product | null>(null);
  const [newProductCategory, setNewProductCategory] = useState('');
  const [newItem, setNewItem] = useState({ quantity: 1, unit: '', reason: '', notes: '' });

  const { data: products } = useQuery({
    queryKey: ['products'],
    queryFn: () => productsApi.getAll({ page: 1, page_size: 200 }),
    enabled: isAdmin,
    staleTime: 10 * 60 * 1000,
  });

  const updateItemMutation = useMutation({
    mutationFn: ({ itemId, data }: { itemId: number; data: { product_id: number; quantity: number; unit?: string; reason?: string; notes?: string } }) =>
      purchaseRequestsApi.updateItem(itemId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-requests', id] });
      setEditingItemId(null);
      toast('Item updated successfully', 'success');
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
      toast('Product added successfully', 'success');
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

  const allowAdditionalOrderMutation = useMutation({
    mutationFn: () => purchaseRequestsApi.allowAdditionalOrder(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-requests', id] });
      toast('Unlocked — one additional LPO/QR can now be created', 'success');
    },
    onError: () => toast('Failed to unlock additional order', 'error'),
  });

  const canManageAdditionalOrders =
    isTenantAdmin ||
    user?.role === 'procurement_manager' ||
    isPlatformAdmin;
  const canApprove = isAdmin || ((hasPermission('purchase_request', 'approve') ?? false) &&
                     user?.role !== 'procurement_officer' &&
                     user?.role !== 'site_engineer');
  const canReject = isAdmin || ((hasPermission('purchase_request', 'reject') ?? false) &&
                    user?.role !== 'procurement_officer' &&
                    user?.role !== 'site_engineer');

  const { data: request, isLoading } = useQuery({
    queryKey: ['purchase-requests', id],
    queryFn: () => purchaseRequestsApi.getById(id),
  });

  const approveMutation = useMutation({
    mutationFn: purchaseRequestsApi.approve,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-requests'] });
      queryClient.invalidateQueries({ queryKey: ['pending-count'] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (reason: string) => purchaseRequestsApi.reject(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-requests'] });
      queryClient.invalidateQueries({ queryKey: ['pending-count'] });
      setRejectDialogOpen(false);
    },
    onError: (error: any) => {
      const message = getApiError(error, 'Failed to reject request');
      toast(message, 'error');
    },
  });

  const undoApprovalMutation = useMutation({
    mutationFn: purchaseRequestsApi.undoApproval,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-requests'] });
      queryClient.invalidateQueries({ queryKey: ['pending-count'] });
    },
  });

  if (isLoading) {
    return (
      <MainLayout>
        <div className="card empty-state">
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>{t('btn', 'loading')}</p>
        </div>
      </MainLayout>
    );
  }

  if (!request) {
    return (
      <MainLayout>
        <div className="card empty-state">
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>{t('empty', 'notFound')}</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <PageShell>
        {/* Header */}
        <PageHeader
          backHref="/purchase-requests"
          title={`${t('page', 'purchaseRequests')}: ${request.code}`}
          breadcrumbs={[{ label: t('page', 'purchaseRequests'), href: '/purchase-requests' }, { label: request.code }]}
          actions={
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {request.allow_additional_orders && (
                <span style={{ fontSize: 12, fontWeight: 600, color: '#d97706', background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 6, padding: '4px 10px' }}>
                  🔓 Additional Order Unlocked
                </span>
              )}
              <Button variant="secondary" onClick={() => window.open(`/print/pr/${id}`, '_blank')}>
                🖨 {t('btn', 'printPR')}
              </Button>
            </div>
          }
        />

        {/* Details Card - Unified */}
        <div className="card">
          <div style={{ 
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: 'var(--space-4)',
          }}>
            <div>
              <label style={{ 
                display: 'block',
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--weight-medium)',
                color: 'var(--text-secondary)',
                marginBottom: 'var(--space-2)',
              }}>
                {t('col', 'title')}
              </label>
              <p style={{ 
                fontSize: 'var(--text-base)',
                fontWeight: 'var(--weight-semibold)',
                color: 'var(--text-primary)',
                margin: 0,
              }}>
                {request.title}
              </p>
            </div>
            <div>
              <label style={{ 
                display: 'block',
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--weight-medium)',
                color: 'var(--text-secondary)',
                marginBottom: 'var(--space-2)',
              }}>
                {t('col', 'requestDate')}
              </label>
              <p style={{ 
                fontSize: 'var(--text-base)',
                color: 'var(--text-primary)',
                margin: 0,
              }}>
                {new Date(request.request_date).toLocaleDateString('en-US')}
              </p>
            </div>
            <div>
              <label style={{ 
                display: 'block',
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--weight-medium)',
                color: 'var(--text-secondary)',
                marginBottom: 'var(--space-2)',
              }}>
                {t('col', 'requiredBy')}
              </label>
              <p style={{ 
                fontSize: 'var(--text-base)',
                color: 'var(--text-primary)',
                margin: 0,
              }}>
                {new Date(request.required_by).toLocaleDateString('en-US')}
              </p>
            </div>
            <div>
              <label style={{ 
                display: 'block',
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--weight-medium)',
                color: 'var(--text-secondary)',
                marginBottom: 'var(--space-2)',
              }}>
                {t('col', 'createdBy')}
              </label>
              <p style={{ 
                fontSize: 'var(--text-base)',
                color: 'var(--text-primary)',
                margin: 0,
              }}>
                {request.created_by_name}
              </p>
            </div>
            {request.approved_by_name && (
              <div>
                <label style={{ 
                  display: 'block',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 'var(--weight-medium)',
                  color: 'var(--text-secondary)',
                  marginBottom: 'var(--space-2)',
                }}>
                  {t('section', 'authorization')}
                </label>
                <p style={{ 
                  fontSize: 'var(--text-base)',
                  color: 'var(--text-primary)',
                  margin: 0,
                }}>
                  {request.approved_by_name}
                </p>
              </div>
            )}
            {request.notes && (
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ 
                  display: 'block',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 'var(--weight-medium)',
                  color: 'var(--text-secondary)',
                  marginBottom: 'var(--space-2)',
                }}>
                  {t('col', 'notes')}
                </label>
                <p style={{ 
                  fontSize: 'var(--text-base)',
                  color: 'var(--text-primary)',
                  margin: 0,
                }}>
                  {request.notes}
                </p>
              </div>
            )}
            {request.rejection_reason && (
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ 
                  display: 'block',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 'var(--weight-medium)',
                  color: 'var(--text-secondary)',
                  marginBottom: 'var(--space-2)',
                }}>
                  {t('confirm', 'rejectReason')}
                </label>
                <div style={{ 
                  padding: 'var(--space-3)',
                  backgroundColor: 'var(--color-error-light)',
                  border: `1px solid var(--color-error)`,
                  borderRadius: 'var(--radius-md)',
                }}>
                  <p style={{ 
                    fontSize: 'var(--text-base)',
                    color: '#991B1B',
                    margin: 0,
                  }}>
                    {request.rejection_reason}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Tracking Timeline Link */}
        <div className="card" style={{ backgroundColor: 'var(--surface-inset)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{
                fontSize: 'var(--text-lg)',
                fontWeight: 'var(--weight-semibold)',
                color: 'var(--text-primary)',
                margin: 0,
                marginBottom: 'var(--space-1)',
              }}>
                {t('page', 'purchaseRequests')} - {t('section', 'statusInfo')}
              </h3>
              <p style={{
                fontSize: 'var(--text-sm)',
                color: 'var(--text-secondary)',
                margin: 0,
              }}>
                {t('page', 'prSubtitle')}
              </p>
            </div>
            <Link
              href={`/purchase-requests/${id}/tracking`}
              className="btn btn-primary"
              style={{ textDecoration: 'none' }}
            >
              {t('page', 'purchaseRequests')} →
            </Link>
          </div>
        </div>

        {/* Items Section - Unified */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
            <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-primary)', margin: 0 }}>
              {t('section', 'requestedItems')}
            </h3>
            {request.status === 'pending' && (isSuperAdmin || request.created_by === user?.id) && !addingProduct && (
              <Button variant="primary" onClick={() => setAddingProduct(true)}>
                + {t('btn', 'addProduct')}
              </Button>
            )}
          </div>

          {/* Add Product Form */}
          {addingProduct && request.status === 'pending' && (
            <div style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-4)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--surface-inset)' }}>
              <div style={{ marginBottom: 'var(--space-3)' }}>
                <ProductSelector
                  selectedProductId={newProduct?.id || null}
                  onProductSelect={(p) => {
                    setNewProduct(p);
                    if (p) setNewItem((prev) => ({ ...prev, unit: p.unit || '' }));
                  }}
                  selectedCategory={newProductCategory}
                  onCategoryChange={setNewProductCategory}
                />
              </div>
              {newProduct && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div>
                    <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 3 }}>{t('col', 'quantity')} *</label>
                    <input type="number" min="0.001" step="0.001" className="form-input" style={{ width: 90 }}
                      value={newItem.quantity}
                      onChange={(e) => setNewItem({ ...newItem, quantity: Number(e.target.value) || 0 })}
                    />
                  </div>
                  <div style={{ width: 130 }}>
                    <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 3 }}>{t('col', 'unit')}</label>
                    <input className="form-input" style={{ width: '100%' }}
                      value={newItem.unit}
                      onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
                      placeholder="Unit..."
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: 150 }}>
                    <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 3 }}>{t('field', 'reason')}</label>
                    <input className="form-input" style={{ width: '100%' }}
                      value={newItem.reason}
                      onChange={(e) => setNewItem({ ...newItem, reason: e.target.value })}
                      placeholder="Why is this needed?"
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: 150 }}>
                    <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 3 }}>{t('col', 'notes')}</label>
                    <input className="form-input" style={{ width: '100%' }}
                      value={newItem.notes}
                      onChange={(e) => setNewItem({ ...newItem, notes: e.target.value })}
                      placeholder="Additional notes"
                    />
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 'var(--space-3)' }}>
                <Button variant="primary" disabled={!newProduct || addItemMutation.isPending} isLoading={addItemMutation.isPending}
                  onClick={() => {
                    if (!newProduct) return;
                    addItemMutation.mutate({ product_id: newProduct.id, quantity: newItem.quantity, unit: newItem.unit, reason: newItem.reason, notes: newItem.notes });
                  }}>
                  {t('btn', 'addProduct')}
                </Button>
                <Button variant="secondary" onClick={() => { setAddingProduct(false); setNewProduct(null); setNewProductCategory(''); setNewItem({ quantity: 1, unit: '', reason: '', notes: '' }); }}>
                  {t('btn', 'cancel')}
                </Button>
              </div>
            </div>
          )}

          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>{t('col', 'product')}</th>
                  <th>{t('col', 'quantity')}</th>
                  <th>{t('col', 'unit')}</th>
                  <th>{t('col', 'projectSite')}</th>
                  <th>{t('col', 'purpose')}</th>
                  <th>{t('col', 'notes')}</th>
                  {(isSuperAdmin || request.created_by === user?.id) && request.status === 'pending' && <th></th>}
                </tr>
              </thead>
              <tbody>
                {request.items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      {editingItemId === item.id ? (
                        <div style={{ minWidth: '220px' }}>
                          <SearchableDropdown
                            options={
                              products?.results?.map((p) => ({
                                value: p.id,
                                label: `${p.name} (${p.code})`,
                                searchText: `${p.name} ${p.code}`,
                              })) || []
                            }
                            value={editingForm.productId}
                            onChange={(val) => setEditingForm(f => ({ ...f, productId: val ? Number(val) : 0 }))}
                            placeholder="Select product..."
                            searchPlaceholder="Search products..."
                          />
                        </div>
                      ) : (
                        <>
                          <div style={{ fontWeight: 'var(--weight-medium)', color: 'var(--text-primary)' }}>
                            {item.product?.name || 'N/A'}
                          </div>
                          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                            {item.product?.code || ''}
                          </div>
                        </>
                      )}
                    </td>
                    <td>
                      {editingItemId === item.id ? (
                        <input type="number" min="0.001" step="0.001" className="form-input" style={{ width: 90 }}
                          value={editingForm.quantity}
                          onChange={(e) => setEditingForm(f => ({ ...f, quantity: Number(e.target.value) || 0 }))}
                        />
                      ) : (
                        <div style={{ color: 'var(--text-primary)' }}>{item.quantity}</div>
                      )}
                    </td>
                    <td>
                      {editingItemId === item.id ? (
                        <input className="form-input" style={{ width: 100 }}
                          value={editingForm.unit}
                          onChange={(e) => setEditingForm(f => ({ ...f, unit: e.target.value }))}
                          placeholder="Unit"
                        />
                      ) : (
                        <div style={{ color: 'var(--text-secondary)' }}>{item.unit || item.product?.unit || '-'}</div>
                      )}
                    </td>
                    <td>
                      <div style={{ color: 'var(--text-secondary)' }}>{item.project_site || '-'}</div>
                    </td>
                    <td>
                      {editingItemId === item.id ? (
                        <input className="form-input" style={{ minWidth: 120 }}
                          value={editingForm.reason}
                          onChange={(e) => setEditingForm(f => ({ ...f, reason: e.target.value }))}
                          placeholder="Purpose..."
                        />
                      ) : (
                        <div style={{ color: 'var(--text-secondary)', maxWidth: '256px' }}>{item.reason || '-'}</div>
                      )}
                    </td>
                    <td>
                      {editingItemId === item.id ? (
                        <input className="form-input" style={{ minWidth: 120 }}
                          value={editingForm.notes}
                          onChange={(e) => setEditingForm(f => ({ ...f, notes: e.target.value }))}
                          placeholder="Notes..."
                        />
                      ) : (
                        <div style={{ color: 'var(--text-secondary)', maxWidth: '256px' }}>{item.notes || '-'}</div>
                      )}
                    </td>
                    {(isSuperAdmin || request.created_by === user?.id) && request.status === 'pending' && (
                      <td>
                        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                          {isSuperAdmin && (editingItemId === item.id ? (
                            <>
                              <button className="btn btn-primary" style={{ fontSize: 'var(--text-xs)', padding: '4px 10px' }}
                                disabled={!editingForm.productId || updateItemMutation.isPending}
                                onClick={() => updateItemMutation.mutate({ itemId: item.id!, data: { product_id: editingForm.productId, quantity: editingForm.quantity, unit: editingForm.unit, reason: editingForm.reason, notes: editingForm.notes } })}>
                                {updateItemMutation.isPending ? '...' : 'Save'}
                              </button>
                              <button className="btn btn-secondary" style={{ fontSize: 'var(--text-xs)', padding: '4px 10px' }}
                                onClick={() => setEditingItemId(null)}>
                                Cancel
                              </button>
                            </>
                          ) : (
                            <button className="btn btn-secondary" style={{ fontSize: 'var(--text-xs)', padding: '4px 10px' }}
                              onClick={() => { setEditingItemId(item.id!); setEditingForm({ productId: item.product?.id || 0, quantity: item.quantity, unit: item.unit || item.product?.unit || '', reason: (item as any).reason || '', notes: item.notes || '' }); }}>
                              Edit
                            </button>
                          ))}
                          <Button variant="delete" size="sm"
                            disabled={deleteItemMutation.isPending}
                            onClick={() => deleteItemMutation.mutate(item.id!)}>
                            {t('btn', 'delete')}
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Actions - Unified */}
        {request.status === 'pending' && (canApprove || canReject) && (
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            {canApprove && (
              <button
                onClick={() => approveMutation.mutate(id)}
                disabled={approveMutation.isPending}
                className="btn btn-primary"
                style={{
                  backgroundColor: 'var(--color-success)',
                  borderColor: 'var(--color-success)',
                  color: '#FFFFFF',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#16A34A';
                  e.currentTarget.style.borderColor = '#16A34A';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--color-success)';
                  e.currentTarget.style.borderColor = 'var(--color-success)';
                }}
                title={!canApprove ? 'You do not have permission to approve' : ''}
              >
                {approveMutation.isPending ? t('btn', 'loading') : t('btn', 'approve')}
              </button>
            )}
            {canReject && (
              <button
                onClick={() => setRejectDialogOpen(true)}
                disabled={rejectMutation.isPending}
                className="btn btn-primary"
                style={{
                  backgroundColor: 'var(--color-error)',
                  borderColor: 'var(--color-error)',
                  color: '#FFFFFF',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#DC2626';
                  e.currentTarget.style.borderColor = '#DC2626';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--color-error)';
                  e.currentTarget.style.borderColor = 'var(--color-error)';
                }}
                title={!canReject ? 'You do not have permission to reject' : ''}
              >
                {rejectMutation.isPending ? t('btn', 'loading') : t('btn', 'reject')}
              </button>
            )}
          </div>
        )}

        {request.status === 'approved' && (
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            {/* Undo Approval - Only for Procurement Manager and Super Admin, and only if no quotation requests or purchase orders exist */}
            {(canApprove || user?.role === 'super_admin' || user?.is_superuser) && 
             !request.has_quotation_requests && 
             !request.has_purchase_orders && (
              <button
                onClick={() => undoApprovalMutation.mutate(id)}
                disabled={undoApprovalMutation.isPending}
                className="btn btn-secondary"
              >
                {undoApprovalMutation.isPending ? t('btn', 'loading') : t('btn', 'update')}
              </button>
            )}
            {/* Allow Additional Order button - only for Procurement Manager/Admin */}
            {canManageAdditionalOrders &&
             (request.has_purchase_orders || request.has_awarded_quotation) &&
             !request.allow_additional_orders && (
              <Button
                variant="secondary"
                disabled={allowAdditionalOrderMutation.isPending}
                isLoading={allowAdditionalOrderMutation.isPending}
                onClick={() => allowAdditionalOrderMutation.mutate()}
              >
                🔓 Allow Additional Order
              </Button>
            )}

            {/* Create Quotation Request / LPO - Only for Procurement Officer and Super Admin (NOT Procurement Manager) */}
            {/* Hide if PR has awarded quotation or purchase orders — unless manager unlocked */}
            {(user?.role === 'procurement_officer' || user?.role === 'super_admin' || user?.is_superuser) &&
             (!request.has_awarded_quotation || request.allow_additional_orders) &&
             (!request.has_purchase_orders || request.allow_additional_orders) && (
              <DropdownButton
                label={t('btn', 'create')}
                variant="primary"
                items={[
                  {
                    label: t('page', 'newQR'),
                    onClick: () => {
                      const canCreateQR = hasPermission('quotation_request', 'create') ?? false;
                      // Only Procurement Officer can create Quotation Request
                      if (user?.role !== 'procurement_officer' && user?.role !== 'super_admin' && !user?.is_superuser) {
                        toast('Only Procurement Officer can create Quotation Request', 'error');
                        return;
                      }
                      // Check if PR has awarded quotation
                      if (request.has_awarded_quotation) {
                        toast('Cannot create quotation request. This Purchase Request already has an awarded quotation.', 'error');
                        return;
                      }
                      // Check if PR has purchase orders
                      if (request.has_purchase_orders) {
                        toast('Cannot create quotation request. This Purchase Request already has purchase orders.', 'error');
                        return;
                      }
                      const guard = canCreateQuotationRequest(request.status, canCreateQR);
                      if (!guard.canProceed) {
                        toast(guard.reason || 'Cannot create quotation request', 'error');
                        return;
                      }
                      router.push(`/quotation-requests/new?purchase_request_id=${id}`);
                    },
                  },
                  {
                    label: t('page', 'newPO'),
                    onClick: async () => {
                      // Only Procurement Officer can create LPO
                      if (user?.role !== 'procurement_officer' && user?.role !== 'super_admin' && !user?.is_superuser) {
                        toast('Only Procurement Officer can create Purchase Order', 'error');
                        return;
                      }
                      const guard = canCreatePurchaseOrder(undefined, request.status);
                      if (!guard.canProceed) {
                        toast(guard.reason || 'Cannot create purchase order', 'error');
                        return;
                      }
                      if (guard.warning) {
                        const shouldContinue = await confirm(guard.warning + '\n\nDo you want to continue?');
                        if (!shouldContinue) {
                          return;
                        }
                      }
                      router.push(`/purchase-orders/new?purchase_request_id=${id}`);
                    },
                  },
                ]}
              />
            )}
            {/* Show info banner if PR has awarded quotation or purchase orders */}
            {(request.has_awarded_quotation || request.has_purchase_orders) && (
              <div className="card" style={{
                backgroundColor: 'var(--surface-inset)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 'var(--space-3)',
              }}>
                <svg
                  style={{
                    width: 20, height: 20, flexShrink: 0,
                    color: 'var(--text-secondary)',
                    marginTop: '2px',
                  }}
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div style={{ flex: 1 }}>
                  <p style={{ 
                    margin: 0, 
                    fontSize: 'var(--text-sm)',
                    fontWeight: 'var(--weight-medium)',
                    color: 'var(--text-primary)',
                    marginBottom: 'var(--space-1)',
                  }}>
                    {request.has_purchase_orders
                      ? 'Purchase Order Created'
                      : 'Supplier Awarded'}
                  </p>
                  <p style={{ 
                    margin: 0, 
                    fontSize: 'var(--text-sm)',
                    color: 'var(--text-secondary)',
                    lineHeight: '1.5',
                  }}>
                    {request.has_purchase_orders
                      ? 'This Purchase Request has an active Purchase Order (LPO). Modifications to this request are no longer allowed as the procurement process has progressed to the order stage.'
                      : 'This Purchase Request has an awarded supplier. The quotation process is complete and modifications are restricted. You can proceed to create a Purchase Order (LPO) if needed.'}
                  </p>
                </div>
              </div>
            )}
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
