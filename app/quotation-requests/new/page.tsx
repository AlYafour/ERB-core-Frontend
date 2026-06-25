'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { quotationRequestsApi } from '@/lib/api/quotation-requests';
import { purchaseRequestsApi } from '@/lib/api/purchase-requests';
import { suppliersApi } from '@/lib/api/suppliers';
import MainLayout from '@/components/layout/MainLayout';
import Link from 'next/link';
import { QuotationRequestItem } from '@/types';
import { toast } from '@/lib/hooks/use-toast';
import SearchableDropdown from '@/components/ui/SearchableDropdown';
import FormField from '@/components/ui/FormField';
import { Button, PageShell } from '@/components/ui';
import { formatBackendError } from '@/lib/utils/validation';
import { canCreateQuotationRequest } from '@/lib/utils/workflow-guards';
import RouteGuard from '@/components/auth/RouteGuard';
import { usePermissions } from '@/lib/hooks/use-permissions';
import { useT } from '@/lib/i18n/useT';
import { ReadOnlyItemsTable } from '@/components/procurement/ReadOnlyItemsTable';
import { DocInfoBanner } from '@/components/procurement/shared/DocInfoBanner';

export default function NewQuotationRequestPage() {
  return (
    <RouteGuard
      requiredPermission={{ category: 'quotation_request', action: 'create' }}
      redirectTo="/quotation-requests"
    >
      <NewQuotationRequestPageContent />
    </RouteGuard>
  );
}

function NewQuotationRequestPageContent() {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const purchaseRequestId = searchParams.get('purchase_request_id');
  const { hasPermission } = usePermissions();
  const formRef = useRef<HTMLFormElement>(null);

  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState({
    purchase_request_id: purchaseRequestId ? Number(purchaseRequestId) : 0,
    supplier_id: 0,
    notes: '',
  });

  const [items, setItems] = useState<Omit<QuotationRequestItem, 'product' | 'created_at'>[]>([]);

  const { data: purchaseRequest } = useQuery({
    queryKey: ['purchase-requests', purchaseRequestId],
    queryFn: () => purchaseRequestsApi.getById(Number(purchaseRequestId!)),
    enabled: !!purchaseRequestId,
  });

  const { data: allSuppliers } = useQuery({
    queryKey: ['suppliers', 'all-active'],
    queryFn: () => suppliersApi.getAllActive(),
  });

  useEffect(() => {
    if (purchaseRequest) {
      setFormData((prev) => ({
        ...prev,
        purchase_request_id: purchaseRequest.id,
      }));
      const requestItems = purchaseRequest.items.map((item) => ({
        product_id: item.product?.id || item.product_id,
        quantity: item.quantity,
        notes: item.notes || '',
      }));
      setItems(requestItems);
    }
  }, [purchaseRequest]);

  const mutation = useMutation({
    mutationFn: quotationRequestsApi.create,
    onSuccess: () => {
      toast('Quotation request created successfully!', 'success');
      router.push('/quotation-requests');
    },
    onError: (error: unknown) => {
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
            // Handle nested errors
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
    
    // Validate purchase request
    if (!purchaseRequestId || !formData.purchase_request_id || formData.purchase_request_id === 0) {
      validationErrors.purchase_request_id = 'Purchase request is required. Please select a purchase request.';
    } else if (purchaseRequest) {
      // Check if PR has awarded quotation
      if (purchaseRequest.has_awarded_quotation) {
        validationErrors.purchase_request_id = 'This Purchase Request already has an awarded quotation. Cannot create new quotation requests after supplier has been awarded.';
        toast('This Purchase Request already has an awarded quotation. Cannot create new quotation requests.', 'error');
      }
      // Check if PR has purchase orders
      else if (purchaseRequest.has_purchase_orders) {
        validationErrors.purchase_request_id = 'This Purchase Request already has purchase orders. Cannot create new quotation requests after LPO has been created.';
        toast('This Purchase Request already has purchase orders. Cannot create new quotation requests.', 'error');
      }
      // Check workflow guard with permission
      else {
        const canCreateQR = hasPermission('quotation_request', 'create') ?? false;
        const guard = canCreateQuotationRequest(purchaseRequest.status, canCreateQR);
        if (!guard.canProceed) {
          validationErrors.purchase_request_id = guard.reason || 'Cannot create quotation request from this purchase request.';
          toast(guard.reason || 'Cannot create quotation request', 'error');
        }
      }
    }
    
    // Validate supplier
    if (!formData.supplier_id || formData.supplier_id === 0) {
      validationErrors.supplier_id = 'Supplier is required. Please select a supplier.';
    }
    
    // Validate items
    if (items.length === 0) {
      validationErrors.items = 'At least one product must be added.';
    }
    
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      toast('Please correct the errors in the form', 'error');
      // Scroll to first error
      setTimeout(() => {
        const firstErrorField = Object.keys(validationErrors)[0];
        const element = document.querySelector(`[name="${firstErrorField}"]`) || 
                       document.querySelector(`[data-field="${firstErrorField}"]`) ||
                       document.querySelector(`[aria-label*="${firstErrorField}"]`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          if ('focus' in element && typeof (element as any).focus === 'function') {
            (element as any).focus();
          }
        }
      }, 100);
      return;
    }
    
    mutation.mutate({ ...formData, items });
  };

  if (!purchaseRequestId) {
    return (
      <MainLayout>
        <div className="card empty-state">
          <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-4)', margin: '0 0 var(--space-4) 0' }}>No purchase request selected</p>
          <Button variant="primary" onClick={() => router.push('/purchase-requests')}>
            {t('btn', 'back')} {t('page', 'purchaseRequests')}
          </Button>
        </div>
      </MainLayout>
    );
  }

  if (purchaseRequest && purchaseRequest.status === 'rejected') {
    return (
      <MainLayout>
        <div className="card empty-state">
          <p style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-semibold)', color: 'var(--color-error)', margin: '0 0 var(--space-2) 0' }}>
            Cannot Create Quotation Request
          </p>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-error)', margin: '0 0 var(--space-4) 0' }}>
            This purchase request is rejected and cannot be used to create a quotation request.
          </p>
          <Button variant="secondary" onClick={() => router.push(`/purchase-requests/${purchaseRequest.id}`)}>
            {t('btn', 'back')} {t('page', 'purchaseRequests')}
          </Button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <PageShell compact>

        {/* ── Sticky form bar ── */}
        <div className="proc-form-bar">
          <Link href="/quotation-requests" className="proc-form-bar-back">← {t('page', 'quotationRequests')}</Link>
          <span className="proc-form-bar-sep" />
          <span className="proc-form-bar-badge">QR</span>
          <h1 className="proc-form-bar-title">{t('page', 'newQR')}</h1>
          <div className="proc-form-bar-actions">
            <Button type="button" variant="primary" disabled={mutation.isPending}
              onClick={() => formRef.current?.requestSubmit()}>
              {mutation.isPending ? t('btn', 'loading') : t('page', 'newQR')}
            </Button>
            <Button type="button" variant="secondary" onClick={() => router.push('/quotation-requests')}>
              {t('btn', 'cancel')}
            </Button>
          </div>
        </div>

        {/* ── Split layout ── */}
        <div className="proc-form-split">

          {/* ── LEFT: form ── */}
          <form ref={formRef} onSubmit={handleSubmit} className="proc-form-main">

            {/* Details section */}
            <div className="proc-sh">
              <span className="proc-sh-label">Quotation Request Details</span>
            </div>
            <div className="proc-form-section">
              <div className="form-grid form-grid--2col">
                <div style={{ gridColumn: '1 / -1' }}>
                  <FormField label={t('col', 'supplier')} required error={errors.supplier_id} fieldName="supplier_id">
                    <SearchableDropdown
                      options={[
                        { value: 0, label: 'Select Supplier' },
                        ...(allSuppliers?.map((supplier) => ({
                          value: supplier.id,
                          label: supplier.business_name || supplier.name,
                          searchText: `${supplier.business_name || ''} ${supplier.name || ''} ${supplier.contact_person || ''} ${supplier.supplier_number || ''}`.trim(),
                        })) || []),
                      ]}
                      value={formData.supplier_id}
                      onChange={(val) => { setFormData({ ...formData, supplier_id: Number(val) }); if (errors.supplier_id) setErrors({ ...errors, supplier_id: '' }); }}
                      placeholder="Select Supplier"
                      allowClear
                    />
                  </FormField>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <FormField label={t('col', 'notes')} error={errors.notes} fieldName="notes">
                    <textarea name="notes" value={formData.notes}
                      onChange={(e) => { setFormData({ ...formData, notes: e.target.value }); if (errors.notes) setErrors({ ...errors, notes: '' }); }}
                      rows={2} className="form-textarea" />
                  </FormField>
                </div>
              </div>
            </div>

            {/* Products section */}
            {purchaseRequest && (
              <>
                <div className="proc-sh">
                  <span className="proc-sh-label">{t('col', 'product')} · {items.length}</span>
                  <div className="proc-sh-right">
                    {errors.items && <span style={{ fontSize: 11, color: 'var(--color-error)' }}>{errors.items}</span>}
                  </div>
                </div>
                <div style={{ padding: '10px 12px' }}>
                  <ReadOnlyItemsTable
                    items={items}
                    columns={[
                      {
                        header: t('col', 'product'),
                        cell: (item) => {
                          const product = purchaseRequest.items.find((i) => (i.product?.id || i.product_id) === item.product_id)?.product;
                          return <div className="cell-product-name">{product?.name || 'N/A'}</div>;
                        },
                      },
                      {
                        header: t('col', 'code'),
                        cell: (item) => {
                          const product = purchaseRequest.items.find((i) => (i.product?.id || i.product_id) === item.product_id)?.product;
                          return <span className="cell-product-code">{product?.code || '—'}</span>;
                        },
                      },
                      { header: t('col', 'quantity'), cell: (item) => <span>{item.quantity}</span> },
                    ]}
                  />
                </div>
              </>
            )}

          </form>

          {/* ── RIGHT: aside ── */}
          <div className="proc-form-aside">
            {purchaseRequest && (
              <DocInfoBanner
                title="Purchase Request"
                variant={purchaseRequest.status !== 'approved' ? 'warning' : 'info'}
                fields={[
                  { label: 'Reference', value: purchaseRequest.code },
                  { label: 'Status', value: purchaseRequest.status },
                  { label: 'Items', value: purchaseRequest.items.length },
                ]}
              />
            )}
          </div>

        </div>
      </PageShell>
    </MainLayout>
  );
}
