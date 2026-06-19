'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { purchaseRequestsApi } from '@/lib/api/purchase-requests';
import { productsApi } from '@/lib/api/products';
import { projectsApi } from '@/lib/api/projects';
import MainLayout from '@/components/layout/MainLayout';
import Link from 'next/link';
import { Button, PageShell } from '@/components/ui';
import { PurchaseRequestItem, Product, Project } from '@/types';
import { PurchaseRequestFormData, toPurchaseRequestCreateData } from '@/lib/types/form-data';
import { toast } from '@/lib/hooks/use-toast';
import { getApiError } from '@/lib/utils/error';
import ProductSelector from '@/components/features/ProductSelector';
import QuantityInput from '@/components/ui/QuantityInput';
import SearchableDropdown, { DropdownOption } from '@/components/ui/SearchableDropdown';
import { EditablePRItemsTable } from '@/components/procurement/EditablePRItemsTable';
import FormField from '@/components/ui/FormField';
import RouteGuard from '@/components/auth/RouteGuard';
import { useT } from '@/lib/i18n/useT';
import { fmtDate } from '@/lib/utils/format';

export default function NewPurchaseRequestPage() {
  return (
    <RouteGuard
      requiredPermission={{ category: 'purchase_request', action: 'create' }}
      redirectTo="/purchase-requests"
    >
      <NewPurchaseRequestPageContent />
    </RouteGuard>
  );
}

function NewPurchaseRequestPageContent() {
  const t = useT();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  const [formData, setFormData] = useState<PurchaseRequestFormData>({
    project_id: undefined,
    project_code: '',
    title: '',
    request_date: new Date().toISOString().split('T')[0],
    required_by: '',
    notes: '',
  });

  const [items, setItems] = useState<Array<{
    product_id: number;
    product?: Product;
    quantity: number;
    unit: string;
    project_site: string;
    reason: string;
    notes: string;
  }>>([]);

  const [selectedCategory, setSelectedCategory] = useState<string>('');
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

  const { data: productsData } = useQuery({
    queryKey: ['products-for-table'],
    queryFn: () => productsApi.getAll({ page: 1, page_size: 1000 }),
    staleTime: 10 * 60 * 1000,
  });

  const handleProjectChange = (projectId: number | null | undefined) => {
    if (projectId) {
      const selectedProject = projectsData?.results?.find((p: Project) => p.id === projectId);
      if (selectedProject) {
        setFormData({ ...formData, project_id: projectId, project_code: selectedProject.code, title: selectedProject.name });
      }
    } else {
      setFormData({ ...formData, project_id: undefined, project_code: '', title: '' });
    }
  };

  const handleProjectCodeChange = (code: string) => {
    setFormData({ ...formData, project_code: code });
    if (code && projectsData?.results) {
      const project = projectsData.results.find((p: Project) => p.code.toLowerCase() === code.toLowerCase());
      if (project) {
        setFormData({ ...formData, project_id: project.id, project_code: project.code, title: project.name });
      }
    } else if (!code) {
      setFormData({ ...formData, project_id: undefined, project_code: '', title: '' });
    }
  };

  const mutation = useMutation({
    mutationFn: purchaseRequestsApi.create,
    onSuccess: () => {
      toast('Purchase request created successfully!', 'success');
      router.push('/purchase-requests');
    },
    onError: (error: any) => {
      toast(getApiError(error, 'Failed to create purchase request'), 'error');
    },
  });

  const unitOptions: DropdownOption[] = [
    { value: 'piece', label: 'Piece' }, { value: 'pcs', label: 'Number / Pieces' },
    { value: 'kg', label: 'Kilogram' }, { value: 'kl', label: 'Kilo' },
    { value: 'meter', label: 'Meter' }, { value: 'lm', label: 'Linear Meter' },
    { value: 'liter', label: 'Liter' }, { value: 'box', label: 'Box' },
    { value: 'pack', label: 'Pack' }, { value: 'pkt', label: 'Packet' },
    { value: 'bag', label: 'Bag' }, { value: 'roll', label: 'Roll' },
    { value: 'ctn', label: 'Carton' }, { value: 'ton', label: 'Ton' },
    { value: 'trip', label: 'Trip' }, { value: 'sqm', label: 'Square Meter' },
    { value: 'cbm', label: 'Cubic Metre (cbm / m3)' }, { value: 'pump', label: 'Pump' },
    { value: 'sheet', label: 'Sheet' }, { value: 'brd', label: 'Board' },
    { value: 'drm', label: 'Drum' }, { value: 'doz', label: 'Dozen' },
    { value: 'ls', label: 'Lump Sum' }, { value: 'set', label: 'Set' },
    { value: 'ream', label: 'Ream' }, { value: 'bundle', label: 'Bundle' },
    { value: 'nos', label: 'Nos / Number' }, { value: 'mtr', label: 'Metre' },
    { value: 'qty', label: 'Quantity' }, { value: 'pair', label: 'Pair' },
    { value: 'can', label: 'Can' }, { value: 'gal', label: 'Gallon' },
    { value: 'day', label: 'Day' }, { value: 'hour', label: 'Hour' },
    { value: 'month', label: 'Month' },
  ];

  const handleProductSelect = (product: Product | null) => {
    setSelectedProduct(product);
    if (product) {
      setCurrentItem({ ...currentItem, unit: product.unit || '' });
    } else {
      setCurrentItem({ quantity: 1, unit: '', project_site: '', reason: '', notes: '' });
    }
  };

  const handleAddItem = () => {
    if (!selectedProduct) { toast('Please select a product first', 'warning'); return; }
    if (currentItem.quantity < 1) {
      toast('Quantity must be at least 1', 'warning'); return;
    }
    setItems([...items, {
      product_id: selectedProduct.id,
      product: selectedProduct,
      quantity: Math.floor(currentItem.quantity),
      unit: currentItem.unit || selectedProduct.unit || '',
      project_site: currentItem.project_site || '',
      reason: currentItem.reason,
      notes: currentItem.notes,
    }]);
    setSelectedProduct(null);
    setCurrentItem({ quantity: 1, unit: '', project_site: '', reason: '', notes: '' });
    toast('Product added successfully!', 'success');
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
    toast('Product removed', 'info');
  };

  const handleUpdateItem = (index: number, field: string, value: any) => {
    const updatedItems = [...items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    setItems(updatedItems);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) { toast('Please add at least one product', 'warning'); return; }
    const itemsToSubmit = items.map((item) => ({
      product_id: item.product_id, quantity: item.quantity,
      unit: item.unit, project_site: item.project_site || '',
      reason: item.reason, notes: item.notes,
    }));
    mutation.mutate(toPurchaseRequestCreateData(formData, itemsToSubmit));
  };

  /* ─── derived for sidebar ─── */
  const selectedProject = projectsData?.results?.find((p: Project) => p.id === formData.project_id);

  return (
    <MainLayout>
      <PageShell compact>

        {/* ── Sticky form bar ── */}
        <div className="proc-form-bar">
          <Link href="/purchase-requests" className="proc-form-bar-back">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M5 12l7-7M5 12l7 7"/>
            </svg>
            {t('page', 'purchaseRequests')}
          </Link>
          <span className="proc-form-bar-sep" />
          <span className="proc-form-bar-badge">PR</span>
          <h1 className="proc-form-bar-title">{t('page', 'newPR')}</h1>
          <div className="proc-form-bar-actions">
            <Button type="button" variant="primary"
              disabled={mutation.isPending} isLoading={mutation.isPending}
              onClick={() => formRef.current?.requestSubmit()}>
              {t('btn', 'save')}
            </Button>
            <Button type="button" variant="secondary" onClick={() => router.push('/purchase-requests')}>
              {t('btn', 'cancel')}
            </Button>
          </div>
        </div>

        {/* ── Split layout ── */}
        <div className="proc-form-split">

          {/* ── Main form ── */}
          <form ref={formRef} onSubmit={handleSubmit} className="proc-form-main">

            {/* Section 1: Request Info */}
            <div className="proc-sh">
              <span className="proc-sh-label">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display:'inline', marginRight: 5, verticalAlign: 'middle' }}>
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                Request Information
              </span>
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
                    type="text" placeholder="Enter project code"
                    value={formData.project_code}
                    onChange={(e) => handleProjectCodeChange(e.target.value)}
                    className="form-input"
                  />
                </FormField>

                <FormField label={t('field', 'title')} required>
                  <input
                    type="text" required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Auto-filled from project name"
                    className="form-input"
                  />
                </FormField>

                <FormField label={t('field', 'requestDate')} required>
                  <input
                    type="date" required
                    value={formData.request_date}
                    onChange={(e) => setFormData({ ...formData, request_date: e.target.value })}
                    className="form-input"
                  />
                </FormField>

                <FormField label={t('field', 'requiredBy')} required>
                  <input
                    type="date" required
                    value={formData.required_by}
                    onChange={(e) => setFormData({ ...formData, required_by: e.target.value })}
                    className="form-input"
                  />
                </FormField>

                <div style={{ gridColumn: '1 / -1' }}>
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

                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    padding: '9px 13px', borderRadius: 8,
                    background: 'rgba(59,130,246,0.04)',
                    border: '1px solid rgba(59,130,246,0.13)',
                    borderLeft: '3px solid rgba(59,130,246,0.38)',
                  }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(59,130,246,0.65)" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}>
                      <circle cx="12" cy="12" r="10" /><path d="M12 16v-4m0-4h.01" />
                    </svg>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.55 }}>
                      Request Code will be auto-generated based on the selected project{' '}
                      (e.g.,{' '}
                      <strong style={{ color: 'var(--text-primary)' }}>{formData.project_code || 'PROJ'}-001</strong>,{' '}
                      <strong style={{ color: 'var(--text-primary)' }}>{formData.project_code || 'PROJ'}-002</strong>…)
                    </p>
                  </div>
                </div>

              </div>
            </div>

            {/* Section 2: Required Products */}
            <div className="proc-sh" style={{ borderTop: '1px solid var(--border-subtle)' }}>
              <span className="proc-sh-label">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display:'inline', marginRight: 5, verticalAlign: 'middle' }}>
                  <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/>
                </svg>
                Required Products
              </span>
              {items.length > 0 && (
                <div className="proc-sh-right">
                  <span style={{
                    fontSize: 11, fontWeight: 700, color: 'var(--brand)',
                    background: 'var(--brand-subtle)', borderRadius: 5,
                    padding: '2px 8px',
                  }}>
                    {items.length} item{items.length !== 1 ? 's' : ''}
                  </span>
                </div>
              )}
            </div>

            <div className="proc-form-section">

              {/* ── Add item card ── */}
              <div style={{
                border: '1px solid var(--border-subtle)', borderRadius: 10,
                overflow: 'hidden', marginBottom: items.length > 0 ? 14 : 0,
                background: 'var(--card-bg)',
              }}>
                {/* Card header */}
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
                      background: 'var(--brand-subtle)', borderRadius: 4,
                      padding: '2px 7px', fontWeight: 600,
                    }}>
                      Configure & Add →
                    </span>
                  )}
                </div>

                {/* Product selector */}
                <div style={{ padding: '12px 14px' }}>
                  <ProductSelector
                    selectedProductId={selectedProduct?.id || null}
                    onProductSelect={handleProductSelect}
                    selectedCategory={selectedCategory}
                    onCategoryChange={setSelectedCategory}
                  />
                </div>

                {/* Item configuration (visible after product selected) */}
                {selectedProduct && (
                  <div style={{
                    borderTop: '1px dashed var(--border-subtle)',
                    padding: '12px 14px',
                    background: 'var(--brand-subtle)',
                  }}>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'auto 160px 1fr 1fr',
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
                          options={unitOptions}
                          value={currentItem.unit}
                          onChange={(val) => setCurrentItem({ ...currentItem, unit: String(val || '') })}
                          placeholder="Select Unit"
                          searchPlaceholder="Search unit..."
                          allowClear
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {t('field', 'reason')}
                        </label>
                        <input className="form-input" placeholder="Why is this needed?"
                          value={currentItem.reason}
                          onChange={(e) => setCurrentItem({ ...currentItem, reason: e.target.value })} />
                      </div>

                      <div>
                        <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {t('col', 'notes')}
                        </label>
                        <input className="form-input" placeholder="Additional notes"
                          value={currentItem.notes}
                          onChange={(e) => setCurrentItem({ ...currentItem, notes: e.target.value })} />
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                      <Button type="button" variant="primary" onClick={handleAddItem}>{t('btn', 'addProduct')}</Button>
                      <Button type="button" variant="secondary" onClick={() => {
                        setSelectedProduct(null);
                        setCurrentItem({ quantity: 1, unit: '', project_site: '', reason: '', notes: '' });
                      }}>{t('btn', 'cancel')}</Button>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Items table ── */}
              {items.length > 0 && (
                <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 10, overflow: 'hidden' }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 14px', background: 'var(--surface-subtle)',
                    borderBottom: '1px solid var(--border-subtle)',
                  }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Items Added
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--brand)', background: 'var(--brand-subtle)', borderRadius: 5, padding: '2px 8px' }}>
                      {items.length}
                    </span>
                  </div>
                  <EditablePRItemsTable
                    items={items}
                    onUpdate={handleUpdateItem}
                    onRemove={handleRemoveItem}
                    renderProduct={(item) => {
                      const product = item.product || productsData?.results?.find((p) => p.id === item.product_id);
                      return (
                        <>
                          <div style={{ fontWeight: 'var(--weight-medium)', color: 'var(--text-primary)' }}>
                            {product?.name || 'Unknown Product'}
                          </div>
                          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: 2 }}>
                            {product?.code || 'N/A'}{product?.category ? ` · ${product.category}` : ''}
                          </div>
                        </>
                      );
                    }}
                    unitOptions={unitOptions}
                  />
                </div>
              )}

            </div>
          </form>

          {/* ── Sticky sidebar ── */}
          <div className="proc-form-aside">

            {/* ── Summary panel ── */}
            <div style={{
              background: 'var(--card-bg)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 12,
              overflow: 'hidden',
              boxShadow: 'var(--shadow-sm)',
            }}>
              {/* Title row */}
              <div style={{ padding: '11px 16px 9px', borderBottom: '1px solid var(--border-subtle)' }}>
                <p style={{ margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
                  Request Summary
                </p>
              </div>

              {/* Project block */}
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
                ) : (
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                    Not selected yet
                  </p>
                )}
              </div>

              {/* Info rows */}
              <div style={{ padding: '4px 16px 8px' }}>
                {[
                  { label: 'Request Date', value: fmtDate(formData.request_date) },
                  { label: 'Required By',  value: fmtDate(formData.required_by) },
                  { label: 'Products',     value: items.length > 0 ? `${items.length} item${items.length !== 1 ? 's' : ''}` : '0 items', brand: items.length > 0 },
                ].map(({ label, value, brand }) => (
                  <div key={label} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '7px 0', borderBottom: '1px solid var(--border-subtle)',
                  }}>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</span>
                    <span style={{
                      fontSize: 12, fontWeight: 700,
                      color: brand ? 'var(--brand)' : value === '—' ? 'var(--text-tertiary)' : 'var(--text-primary)',
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

            {/* ── Actions panel ── */}
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
              <Button type="button" variant="primary"
                disabled={mutation.isPending || items.length === 0}
                isLoading={mutation.isPending}
                onClick={() => formRef.current?.requestSubmit()}>
                {mutation.isPending ? 'Submitting…' : `Submit Request${items.length > 0 ? ` (${items.length})` : ''}`}
              </Button>
              <Button type="button" variant="secondary" onClick={() => router.push('/purchase-requests')}>
                Cancel
              </Button>
            </div>

          </div>
        </div>
      </PageShell>
    </MainLayout>
  );
}
