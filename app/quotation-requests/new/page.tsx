'use client';

import { useState, useEffect } from 'react';
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
import { getApiError } from '@/lib/utils/error';
import { canCreateQuotationRequest } from '@/lib/utils/workflow-guards';
import RouteGuard from '@/components/auth/RouteGuard';
import { usePermissions } from '@/lib/hooks/use-permissions';
import { useAuth } from '@/lib/hooks/use-auth';
import { useT } from '@/lib/i18n/useT';

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
  const { user } = useAuth();

  // Only Procurement Officer and Super Admin can create Quotation Request
  // Procurement Manager should NOT be able to create Quotation Request
  if (user && user.role !== 'procurement_officer' && user.role !== 'super_admin' && !user.is_superuser) {
    router.push('/quotation-requests');
    return null;
  }
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
    onError: (e: unknown) => {
      toast(getApiError(e, 'Failed to create quotation request'), 'error');
      
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
      <PageShell>
        {/* Header Section */}
        <div>
          <Link
            href="/quotation-requests"
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
            ← {t('btn', 'back')} {t('page', 'quotationRequests')}
          </Link>
          <h1 style={{ 
            fontSize: 'var(--text-2xl)',
            fontWeight: 'var(--weight-semibold)',
            color: 'var(--text-primary)',
            margin: 0,
            marginBottom: 'var(--space-1)',
          }}>
            {t('page', 'newQR')}
          </h1>
          {purchaseRequest && (
            <p style={{ 
              fontSize: 'var(--text-sm)',
              color: 'var(--text-secondary)',
              margin: 0,
            }}>
              For Purchase Request: <span style={{ fontWeight: 'var(--weight-semibold)' }}>{purchaseRequest.code}</span>
            </p>
          )}
        </div>

        {/* Warning Banner */}
        {purchaseRequest && purchaseRequest.status !== 'approved' && (
          <div className="card" style={{
            backgroundColor: 'var(--color-warning-light)',
            borderColor: 'var(--color-warning)',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)' }}>
              <svg
                style={{
                  width: 20, height: 20, flexShrink: 0,
                  color: 'var(--color-warning)',
                  marginTop: '2px',
                }}
                fill="currentColor" 
                viewBox="0 0 20 20"
              >
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div>
                <p style={{ 
                  fontSize: 'var(--text-sm)',
                  fontWeight: 'var(--weight-semibold)',
                  color: '#854D0E',
                  margin: 0,
                  marginBottom: 'var(--space-1)',
                }}>
                  Warning
                </p>
                <p style={{ 
                  fontSize: 'var(--text-sm)',
                  color: '#854D0E',
                  margin: 0,
                }}>
                  Purchase request status: {purchaseRequest.status === 'pending' ? 'Pending' : purchaseRequest.status}. 
                  It is recommended to approve the purchase request first before creating a quotation request.
                </p>
              </div>
            </div>
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
                  ...(allSuppliers?.map((supplier) => ({
                      value: supplier.id,
                      label: supplier.business_name || supplier.name,
                      searchText: `${supplier.business_name || ''} ${supplier.name || ''} ${supplier.contact_person || ''} ${supplier.supplier_number || ''}`.trim(),
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

            <div style={{ gridColumn: 'span 2' }}>
              <FormField
                label={t('col', 'notes')}
                error={errors.notes}
                fieldName="notes"
              >
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={(e) => {
                    setFormData({ ...formData, notes: e.target.value });
                    if (errors.notes) {
                      setErrors({ ...errors, notes: '' });
                    }
                  }}
                  rows={3}
                  className="form-textarea"
                />
              </FormField>
            </div>
          </div>

          {/* Items Section */}
          {purchaseRequest && (
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
                {errors.items && (
                  <span style={{ 
                    fontSize: 'var(--text-sm)',
                    color: 'var(--color-error)',
                  }}>
                    {errors.items}
                  </span>
                )}
              </div>
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>{t('col', 'product')}</th>
                        <th>{t('col', 'code')}</th>
                        <th>{t('col', 'quantity')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, index) => {
                        const product = purchaseRequest.items.find(
                          (i) => (i.product?.id || i.product_id) === item.product_id
                        )?.product;
                        return (
                          <tr key={index}>
                            <td>
                              <div style={{ 
                                fontWeight: 'var(--weight-medium)',
                                color: 'var(--text-primary)',
                              }}>
                                {product?.name || 'N/A'}
                              </div>
                            </td>
                            <td>
                              <div style={{ color: 'var(--text-secondary)' }}>
                                {product?.code || ''}
                              </div>
                            </td>
                            <td>
                              <div style={{ color: 'var(--text-primary)' }}>
                                {item.quantity}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Form Actions */}
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <Button type="submit" variant="primary" disabled={mutation.isPending}>
              {mutation.isPending ? t('btn', 'loading') : t('page', 'newQR')}
            </Button>
            <Button variant="secondary" onClick={() => router.push('/quotation-requests')}>
              {t('btn', 'cancel')}
            </Button>
          </div>
        </form>
      </PageShell>
    </MainLayout>
  );
}
