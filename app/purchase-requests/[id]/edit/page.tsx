'use client';

import { useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { purchaseRequestsApi } from '@/lib/api/purchase-requests';
import { projectsApi } from '@/lib/api/projects';
import MainLayout from '@/components/layout/MainLayout';
import Link from 'next/link';
import { Button, PageShell } from '@/components/ui';
import { Product, Project, PurchaseRequest } from '@/types';
import { toast } from '@/lib/hooks/use-toast';
import { getApiError } from '@/lib/utils/error';
import ProductSelector from '@/components/features/ProductSelector';
import QuantityInput from '@/components/ui/QuantityInput';
import SearchableDropdown from '@/components/ui/SearchableDropdown';
import DateInput from '@/components/ui/DateInput';
import { EditablePRItemsTable } from '@/components/procurement/EditablePRItemsTable';
import { UNIT_OPTIONS } from '@/lib/constants/unit-options';
import FormField from '@/components/ui/FormField';
import RouteGuard from '@/components/auth/RouteGuard';
import { useT } from '@/lib/i18n/useT';
import { fmtDate } from '@/lib/utils/format';
import { DocLoadState } from '@/components/procurement/shared/DocLoadState';

type LocalItem = {
  product_id: number;
  product?: Product;
  quantity: number;
  unit: string;
  project_site: string;
  reason: string;
  notes: string;
};

export default function EditPurchaseRequestPage() {
  return (
    <RouteGuard
      requiredPermission={{ category: 'purchase_request', action: 'update' }}
      redirectTo="/purchase-requests"
    >
      <EditPurchaseRequestLoader />
    </RouteGuard>
  );
}

function EditPurchaseRequestLoader() {
  const params = useParams();
  const id = Number(params.id);
  const router = useRouter();

  const { data: pr, isLoading } = useQuery({
    queryKey: ['purchase-request-edit', id],
    queryFn: () => purchaseRequestsApi.getById(id),
    enabled: !!id,
    staleTime: 0,
  });

  if (isLoading) return <DocLoadState type="loading" />;
  if (!pr) return <DocLoadState type="not-found" message="Purchase Request not found." />;

  if (pr.status !== 'draft') {
    router.replace(`/purchase-requests/${id}`);
    return null;
  }

  return <EditPurchaseRequestContent pr={pr} />;
}

function EditPurchaseRequestContent({ pr }: { pr: PurchaseRequest }) {
  const t = useT();
  const router = useRouter();
  const queryClient = useQueryClient();
  const formRef = useRef<HTMLFormElement>(null);

  const initialProjectId =
    pr.project_id ??
    (typeof pr.project === 'object' && pr.project
      ? (pr.project as Project).id
      : typeof pr.project === 'number'
        ? pr.project
        : undefined);

  const initialProjectCode =
    pr.project_code ??
    (typeof pr.project === 'object' && pr.project ? (pr.project as Project).code : '');

  const [formData, setFormData] = useState({
    project_id: initialProjectId as number | undefined,
    project_code: initialProjectCode,
    title: pr.title,
    request_date: pr.request_date,
    required_by: pr.required_by,
    notes: pr.notes || '',
  });

  const [items, setItems] = useState<LocalItem[]>(
    pr.items.map((item) => ({
      product_id: item.product_id,
      product: item.product,
      quantity: item.quantity,
      unit: item.unit || '',
      project_site: item.project_site || '',
      reason: item.reason || '',
      notes: item.notes || '',
    }))
  );

  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [currentItem, setCurrentItem] = useState({
    quantity: 1,
    unit: '',
    project_site: '',
    reason: '',
    notes: '',
  });

  const { data: projectsData } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.getAll({ page: 1, page_size: 1000, is_active: true }),
  });

  const handleProjectChange = (projectId: number | null | undefined) => {
    if (projectId) {
      const proj = projectsData?.results?.find((p: Project) => p.id === projectId);
      if (proj) {
        setFormData({ ...formData, project_id: projectId, project_code: proj.code, title: proj.name });
      }
    } else {
      setFormData({ ...formData, project_id: undefined, project_code: '', title: '' });
    }
  };

  const buildPayload = () => ({
    project_id: formData.project_id,
    title: formData.title,
    request_date: formData.request_date,
    required_by: formData.required_by,
    notes: formData.notes,
    items: items.map((item) => ({
      product_id: item.product_id,
      quantity: item.quantity,
      unit: item.unit,
      project_site: item.project_site || '',
      reason: item.reason || '',
      notes: item.notes || '',
    })),
  });

  const saveMutation = useMutation({
    mutationFn: async (submitAfter: boolean) => {
      const updated = await purchaseRequestsApi.updateDraft(pr.id, buildPayload());
      if (submitAfter) {
        await purchaseRequestsApi.submit(updated.id);
      }
      return { submitAfter };
    },
    onSuccess: ({ submitAfter }) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-requests'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-requests', pr.id] });
      if (submitAfter) {
        toast('Request saved and submitted for approval', 'success');
        queryClient.invalidateQueries({ queryKey: ['pending-count'] });
      } else {
        toast('Draft saved', 'success');
      }
      router.push(`/purchase-requests/${pr.id}`);
    },
    onError: (error: unknown) => {
      toast(getApiError(error, 'Failed to save changes'), 'error');
    },
  });

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) { toast('Please add at least one product', 'warning'); return; }
    saveMutation.mutate(false);
  };

  const handleSaveAndSubmit = () => {
    if (items.length === 0) { toast('Please add at least one product', 'warning'); return; }
    saveMutation.mutate(true);
  };

  const handleProductSelect = (product: Product | null) => {
    setSelectedProduct(product);
    if (product) {
      setCurrentItem((prev) => ({ ...prev, unit: product.unit || '' }));
    } else {
      setCurrentItem({ quantity: 1, unit: '', project_site: '', reason: '', notes: '' });
    }
  };

  const handleAddItem = () => {
    if (!selectedProduct) { toast('Please select a product first', 'warning'); return; }
    if (currentItem.quantity < 1) { toast('Quantity must be at least 1', 'warning'); return; }
    setItems([...items, {
      product_id: selectedProduct.id,
      product: selectedProduct,
      quantity: Math.floor(currentItem.quantity),
      unit: currentItem.unit || selectedProduct.unit || '',
      project_site: currentItem.project_site || '',
      reason: currentItem.reason || '',
      notes: currentItem.notes || '',
    }]);
    setSelectedProduct(null);
    setCurrentItem({ quantity: 1, unit: '', project_site: '', reason: '', notes: '' });
    toast('Product added', 'success');
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleUpdateItem = (index: number, field: string, value: unknown) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
  };

  const selectedProject = projectsData?.results?.find((p: Project) => p.id === formData.project_id);

  return (
    <MainLayout>
      <PageShell compact>

        {/* ── Sticky form bar ── */}
        <div className="proc-form-bar">
          <Link href={`/purchase-requests/${pr.id}`} className="proc-form-bar-back">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M5 12l7-7M5 12l7 7"/>
            </svg>
            {pr.code}
          </Link>
          <span className="proc-form-bar-sep" />
          <span className="proc-form-bar-badge">PR</span>
          <h1 className="proc-form-bar-title">Edit Draft</h1>
          <div className="proc-form-bar-actions">
            <Button
              type="button"
              variant="primary"
              disabled={saveMutation.isPending}
              isLoading={saveMutation.isPending}
              onClick={() => formRef.current?.requestSubmit()}
            >
              {t('btn', 'save')}
            </Button>
            <Button type="button" variant="secondary" onClick={() => router.push(`/purchase-requests/${pr.id}`)}>
              {t('btn', 'cancel')}
            </Button>
          </div>
        </div>

        {/* ── Split layout ── */}
        <div className="proc-form-split">

          {/* ── Main form ── */}
          <form ref={formRef} onSubmit={handleFormSubmit} className="proc-form-main">

            {/* Section 1: Request Information */}
            <div className="proc-sh">
              <span className="proc-sh-label">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', marginRight: 5, verticalAlign: 'middle' }}>
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                Request Information
              </span>
              <div className="proc-sh-right">
                <span style={{
                  fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)',
                  background: 'var(--surface-subtle)', border: '1px solid var(--border-subtle)',
                  borderRadius: 5, padding: '2px 8px',
                }}>
                  {pr.code}
                </span>
              </div>
            </div>

            <div className="proc-form-section">
              <div className="form-grid">

                <FormField label={t('field', 'project')} required>
                  <SearchableDropdown
                    options={projectsData?.results?.map((project: Project) => ({
                      value: project.id,
                      label: `${project.name} (${project.code})`,
                      searchText: `${project.name} ${project.code} ${project.location || ''}`,
                    })) || []}
                    value={formData.project_id}
                    onChange={(val) => handleProjectChange(val ? Number(val) : undefined)}
                    placeholder="Select Project"
                    searchPlaceholder="Search by name or code..."
                    allowClear
                  />
                </FormField>

                <FormField label="Project Code">
                  <input
                    type="text"
                    value={formData.project_code}
                    readOnly
                    className="form-input"
                    style={{ color: 'var(--text-secondary)', cursor: 'default' }}
                  />
                </FormField>

                <FormField label={t('field', 'title')} required>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Request title"
                    className="form-input"
                  />
                </FormField>

                <FormField label={t('field', 'requestDate')} required>
                  <DateInput
                    value={formData.request_date}
                    onChange={(v) => setFormData({ ...formData, request_date: v })}
                    className="form-input"
                  />
                </FormField>

                <FormField label={t('field', 'requiredBy')} required>
                  <DateInput
                    value={formData.required_by}
                    onChange={(v) => setFormData({ ...formData, required_by: v })}
                    className="form-input"
                  />
                </FormField>

                <FormField label={t('field', 'notes')}>
                  <input
                    type="text"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Additional notes..."
                    className="form-input"
                  />
                </FormField>

              </div>
            </div>

            {/* Section 2: Required Products */}
            <div className="proc-sh" style={{ borderTop: '1px solid var(--border-subtle)' }}>
              <span className="proc-sh-label">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', marginRight: 5, verticalAlign: 'middle' }}>
                  <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/>
                </svg>
                Required Products
              </span>
              {items.length > 0 && (
                <div className="proc-sh-right">
                  <span style={{
                    fontSize: 11, fontWeight: 700, color: 'var(--brand)',
                    background: 'var(--brand-subtle)', borderRadius: 5, padding: '2px 8px',
                  }}>
                    {items.length} item{items.length !== 1 ? 's' : ''}
                  </span>
                </div>
              )}
            </div>

            <div className="proc-form-section">

              {/* Add item card */}
              <div style={{
                border: '1px solid var(--border-subtle)', borderRadius: 10,
                overflow: 'hidden', marginBottom: items.length > 0 ? 14 : 0,
                background: 'var(--card-bg)',
              }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '9px 14px',
                  background: 'var(--surface-subtle)',
                  borderBottom: '1px solid var(--border-subtle)',
                }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%',
                    background: 'var(--brand)', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 800, flexShrink: 0,
                  }}>+</div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Add Product
                  </span>
                  {selectedProduct && (
                    <span style={{
                      marginLeft: 'auto', fontSize: 10, color: 'var(--text-tertiary)',
                      background: 'var(--brand-subtle)', borderRadius: 4, padding: '2px 7px', fontWeight: 600,
                    }}>
                      Configure &amp; Add →
                    </span>
                  )}
                </div>

                <div style={{ padding: '12px 14px' }}>
                  <ProductSelector
                    selectedProductId={selectedProduct?.id || null}
                    onProductSelect={handleProductSelect}
                    selectedCategory={selectedCategory}
                    onCategoryChange={setSelectedCategory}
                  />
                </div>

                {selectedProduct && (
                  <div style={{
                    borderTop: '1px dashed var(--border-subtle)',
                    padding: '12px 14px',
                    background: 'var(--brand-subtle)',
                  }}>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'auto 160px 1fr 1fr 1fr',
                      gap: 10, alignItems: 'flex-end',
                    }}>
                      <div>
                        <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {t('col', 'quantity')} <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <QuantityInput
                          value={currentItem.quantity}
                          onChange={(value) => setCurrentItem({ ...currentItem, quantity: Math.floor(value) })}
                          min={1} step={1}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {t('col', 'unit')}
                        </label>
                        <SearchableDropdown
                          options={UNIT_OPTIONS}
                          value={currentItem.unit}
                          onChange={(val) => setCurrentItem({ ...currentItem, unit: String(val || '') })}
                          placeholder="Select Unit"
                          searchPlaceholder="Search unit..."
                          allowClear
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {t('col', 'projectSite')}
                        </label>
                        <input
                          className="form-input"
                          placeholder="Project or site…"
                          value={currentItem.project_site}
                          onChange={(e) => setCurrentItem({ ...currentItem, project_site: e.target.value })}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {t('field', 'reason')}
                        </label>
                        <input
                          className="form-input"
                          placeholder="Why is this needed?"
                          value={currentItem.reason}
                          onChange={(e) => setCurrentItem({ ...currentItem, reason: e.target.value })}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {t('col', 'notes')}
                        </label>
                        <input
                          className="form-input"
                          placeholder="Additional notes"
                          value={currentItem.notes}
                          onChange={(e) => setCurrentItem({ ...currentItem, notes: e.target.value })}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                      <Button type="button" variant="primary" onClick={handleAddItem}>
                        Add to List
                      </Button>
                      <Button type="button" variant="secondary" onClick={() => {
                        setSelectedProduct(null);
                        setCurrentItem({ quantity: 1, unit: '', project_site: '', reason: '', notes: '' });
                      }}>
                        {t('btn', 'cancel')}
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Items table */}
              {items.length > 0 && (
                <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 10, overflow: 'hidden' }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 14px', background: 'var(--surface-subtle)',
                    borderBottom: '1px solid var(--border-subtle)',
                  }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Items
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--brand)', background: 'var(--brand-subtle)', borderRadius: 5, padding: '2px 8px' }}>
                      {items.length}
                    </span>
                  </div>
                  <EditablePRItemsTable
                    items={items}
                    onUpdate={handleUpdateItem}
                    onRemove={handleRemoveItem}
                    renderProduct={(item) => (
                      <>
                        <div style={{ fontWeight: 'var(--weight-medium)', color: 'var(--text-primary)' }}>
                          {item.product?.name || 'Unknown Product'}
                        </div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: 2 }}>
                          {item.product?.code || 'N/A'}
                          {item.product?.category ? ` · ${item.product.category}` : ''}
                        </div>
                      </>
                    )}
                    unitOptions={UNIT_OPTIONS}
                  />
                </div>
              )}

              {items.length === 0 && (
                <div style={{
                  padding: '24px', textAlign: 'center', borderRadius: 10,
                  border: '1px dashed var(--border-subtle)',
                  color: 'var(--text-tertiary)', fontSize: 13,
                }}>
                  No products added yet. Use the panel above to add items.
                </div>
              )}

            </div>

          </form>

          {/* ── Sidebar ── */}
          <div className="proc-form-aside">

            {/* Summary panel */}
            <div style={{
              background: 'var(--card-bg)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 12,
              overflow: 'hidden',
              boxShadow: 'var(--shadow-sm)',
            }}>
              <div style={{ padding: '11px 16px 9px', borderBottom: '1px solid var(--border-subtle)' }}>
                <p style={{ margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
                  Request Summary
                </p>
              </div>

              <div style={{ padding: '11px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
                <p style={{ margin: '0 0 5px', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-tertiary)' }}>
                  Project
                </p>
                {selectedProject ? (
                  <>
                    <p style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.35 }}>
                      {selectedProject.name}
                    </p>
                    <p style={{ margin: 0, fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>
                      {selectedProject.code}
                    </p>
                  </>
                ) : formData.project_code ? (
                  <>
                    <p style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.35 }}>
                      {formData.title}
                    </p>
                    <p style={{ margin: 0, fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>
                      {formData.project_code}
                    </p>
                  </>
                ) : (
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                    Not selected
                  </p>
                )}
              </div>

              <div style={{ padding: '4px 16px 8px' }}>
                {([
                  { label: 'Request Date', value: fmtDate(formData.request_date) },
                  { label: 'Required By',  value: fmtDate(formData.required_by) },
                  { label: 'Products',     value: items.length > 0 ? `${items.length} item${items.length !== 1 ? 's' : ''}` : '0 items', brand: items.length > 0 },
                ] as const).map(({ label, value, brand }) => (
                  <div key={label} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '7px 0', borderBottom: '1px solid var(--border-subtle)',
                  }}>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</span>
                    <span style={{
                      fontSize: 12, fontWeight: 700,
                      color: brand ? 'var(--brand)' : 'var(--text-primary)',
                      background: brand ? 'var(--brand-subtle)' : 'transparent',
                      padding: brand ? '2px 8px' : '0',
                      borderRadius: 5,
                    }}>
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions panel */}
            <div style={{
              background: 'var(--card-bg)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 12,
              padding: '13px 14px',
              display: 'flex', flexDirection: 'column', gap: 7,
              boxShadow: 'var(--shadow-sm)',
            }}>
              {items.length === 0 && (
                <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: '0 0 3px', textAlign: 'center', fontStyle: 'italic' }}>
                  Add at least one product to submit
                </p>
              )}
              <Button
                type="button"
                variant="primary"
                disabled={saveMutation.isPending || items.length === 0}
                isLoading={saveMutation.isPending}
                onClick={handleSaveAndSubmit}
              >
                {saveMutation.isPending ? 'Submitting…' : `Save & Submit${items.length > 0 ? ` (${items.length})` : ''}`}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={saveMutation.isPending || items.length === 0}
                onClick={() => formRef.current?.requestSubmit()}
              >
                Save as Draft
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={saveMutation.isPending}
                onClick={() => router.push(`/purchase-requests/${pr.id}`)}
              >
                {t('btn', 'cancel')}
              </Button>
            </div>

          </div>
        </div>
      </PageShell>
    </MainLayout>
  );
}
