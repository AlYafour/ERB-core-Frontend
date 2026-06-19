'use client';

import { useState, useEffect } from 'react';
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
import { formatPrice } from '@/lib/utils/format';
import RouteGuard from '@/components/auth/RouteGuard';
import { useT } from '@/lib/i18n/useT';

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

  // Fetch projects
  const { data: projectsData } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.getAll({ page: 1, page_size: 1000, is_active: true }),
  });

  // Fetch products for table display (when needed)
  const { data: productsData } = useQuery({
    queryKey: ['products-for-table'],
    queryFn: () => productsApi.getAll({ page: 1, page_size: 1000 }),
    staleTime: 10 * 60 * 1000,
  });

  // Handle project selection
  const handleProjectChange = (projectId: number | null | undefined) => {
    if (projectId) {
      const selectedProject = projectsData?.results?.find((p: Project) => p.id === projectId);
      if (selectedProject) {
        setFormData({
          ...formData,
          project_id: projectId,
          project_code: selectedProject.code,
          title: selectedProject.name, // Auto-fill title from project name
        });
      }
    } else {
      setFormData({
        ...formData,
        project_id: undefined,
        project_code: '',
        title: '',
      });
    }
  };

  // Handle project code input (reverse lookup)
  const handleProjectCodeChange = (code: string) => {
    setFormData({ ...formData, project_code: code });
    
    // Find project by code
    if (code && projectsData?.results) {
      const project = projectsData.results.find((p: Project) => p.code.toLowerCase() === code.toLowerCase());
      if (project) {
        setFormData({
          ...formData,
          project_id: project.id,
          project_code: project.code,
          title: project.name, // Auto-fill title from project name
        });
      }
    } else if (!code) {
      setFormData({
        ...formData,
        project_id: undefined,
        project_code: '',
        title: '',
      });
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

  // Unit options from Product.UNIT_CHOICES
  const unitOptions: DropdownOption[] = [
    { value: 'piece', label: 'Piece' },
    { value: 'pcs', label: 'Number / Pieces' },
    { value: 'kg', label: 'Kilogram' },
    { value: 'kl', label: 'Kilo' },
    { value: 'meter', label: 'Meter' },
    { value: 'lm', label: 'Linear Meter' },
    { value: 'liter', label: 'Liter' },
    { value: 'box', label: 'Box' },
    { value: 'pack', label: 'Pack' },
    { value: 'pkt', label: 'Packet' },
    { value: 'bag', label: 'Bag' },
    { value: 'roll', label: 'Roll' },
    { value: 'ctn', label: 'Carton' },
    { value: 'ton', label: 'Ton' },
    { value: 'trip', label: 'Trip' },
    { value: 'sqm', label: 'Square Meter' },
    { value: 'cbm', label: 'Cubic Metre (cbm / m3)' },
    { value: 'pump', label: 'Pump' },
    { value: 'sheet', label: 'Sheet' },
    { value: 'brd', label: 'Board' },
    { value: 'drm', label: 'Drum' },
    { value: 'doz', label: 'Dozen' },
    { value: 'ls', label: 'Lump Sum' },
    { value: 'set', label: 'Set' },
    { value: 'ream', label: 'Ream' },
    { value: 'bundle', label: 'Bundle' },
    { value: 'nos', label: 'Nos / Number' },
    { value: 'mtr', label: 'Metre' },
    { value: 'qty', label: 'Quantity' },
    { value: 'pair', label: 'Pair' },
    { value: 'can', label: 'Can' },
    { value: 'gal', label: 'Gallon' },
    { value: 'day', label: 'Day' },
    { value: 'hour', label: 'Hour' },
    { value: 'month', label: 'Month' },
  ];

  const handleProductSelect = (product: Product | null) => {
    setSelectedProduct(product);
    if (product) {
      setCurrentItem({
        ...currentItem,
        unit: product.unit || '',
      });
    } else {
      setCurrentItem({
        quantity: 1,
        unit: '',
        project_site: '',
        reason: '',
        notes: '',
      });
    }
  };

  const handleAddItem = () => {
    if (!selectedProduct) {
      toast('Please select a product first', 'warning');
      return;
    }
    if (currentItem.quantity <= 0 || !Number.isInteger(currentItem.quantity)) {
      toast('Please enter a valid whole number quantity', 'warning');
      return;
    }

    const newItem = {
      product_id: selectedProduct.id,
      product: selectedProduct,
      quantity: Math.floor(currentItem.quantity),
      unit: currentItem.unit || selectedProduct.unit || '',
      project_site: currentItem.project_site || '',
      reason: currentItem.reason,
      notes: currentItem.notes,
    };

    setItems([...items, newItem]);
    
    // Reset form
    setSelectedProduct(null);
    setCurrentItem({
      quantity: 1,
      unit: '',
      project_site: '',
      reason: '',
      notes: '',
    });
    
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
    if (items.length === 0) {
      toast('Please add at least one product', 'warning');
      return;
    }
    
    const itemsToSubmit = items.map((item) => ({
      product_id: item.product_id,
      quantity: item.quantity,
      unit: item.unit,
      project_site: item.project_site || '',
      reason: item.reason,
      notes: item.notes,
    }));
    
    mutation.mutate(toPurchaseRequestCreateData(formData, itemsToSubmit));
  };

  const SectionHeader = ({ label, children }: { label: string; children?: React.ReactNode }) => (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '11px 20px',
      borderBottom: '1px solid var(--border-subtle)',
      background: 'var(--surface-subtle)',
    }}>
      <span style={{
        fontSize: 11, fontWeight: 700, letterSpacing: '0.07em',
        textTransform: 'uppercase', color: 'var(--text-tertiary)',
      }}>
        {label}
      </span>
      {children}
    </div>
  );

  return (
    <MainLayout>
      <PageShell>

        {/* ── Compact page top ── */}
        <div className="form-page-top">
          <Link href="/purchase-requests" className="form-page-top-back">← {t('page', 'purchaseRequests')}</Link>
          <h1 className="form-page-top-title">{t('page', 'newPR')}</h1>
        </div>

        <form onSubmit={handleSubmit} style={{
          background: 'var(--card-bg)', border: '1px solid var(--card-border)',
          borderRadius: 'var(--radius-lg)', boxShadow: 'var(--card-shadow)',
          overflow: 'hidden',
        }}>

          {/* ── Section 1: Request Info ── */}
          <SectionHeader label="Request Information" />
          <div style={{ padding: '14px 20px' }}>
            <div className="form-grid form-grid--2col">
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
                  placeholder="Enter project code"
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
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3} placeholder="Additional notes..."
                    className="form-textarea"
                  />
                </FormField>
              </div>

              {/* Info callout */}
              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: '10px 14px', borderRadius: 8,
                  background: 'rgba(59,130,246,0.04)',
                  border: '1px solid rgba(59,130,246,0.14)',
                  borderLeft: '3px solid rgba(59,130,246,0.4)',
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(59,130,246,0.7)" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}>
                    <circle cx="12" cy="12" r="10" /><path d="M12 16v-4m0-4h.01" />
                  </svg>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                    Request Code will be auto-generated based on the selected project
                    {' '}(e.g., <strong>{formData.project_code || 'PROJ'}-001</strong>, <strong>{formData.project_code || 'PROJ'}-002</strong>…)
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ── Section 2: Required Products ── */}
          <SectionHeader label={t('section', 'requestedItems')} />

          <div style={{ padding: '14px 16px' }}>
            {/* Add Item card */}
            <div style={{
              border: '1px solid var(--border-subtle)', borderRadius: 10,
              overflow: 'hidden', marginBottom: items.length > 0 ? 16 : 0,
            }}>
              <div style={{ padding: '14px 16px' }}>
                <ProductSelector
                  selectedProductId={selectedProduct?.id || null}
                  onProductSelect={handleProductSelect}
                  selectedCategory={selectedCategory}
                  onCategoryChange={setSelectedCategory}
                />
              </div>

              {selectedProduct && (
                <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '14px 16px', background: 'var(--surface-subtle)' }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <div style={{ flexShrink: 0 }}>
                      <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4, fontWeight: 600 }}>
                        {t('col', 'quantity')} <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <QuantityInput
                        value={currentItem.quantity}
                        onChange={(value) => setCurrentItem({ ...currentItem, quantity: Math.floor(value) })}
                        min={1} step={1}
                      />
                    </div>
                    <div style={{ width: 150, flexShrink: 0 }}>
                      <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4, fontWeight: 600 }}>{t('col', 'unit')}</label>
                      <SearchableDropdown
                        options={unitOptions}
                        value={currentItem.unit}
                        onChange={(val) => setCurrentItem({ ...currentItem, unit: String(val || '') })}
                        placeholder="Select Unit"
                        searchPlaceholder="Search unit..."
                        allowClear
                      />
                    </div>
                    <div style={{ flex: 1, minWidth: 160 }}>
                      <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4, fontWeight: 600 }}>{t('field', 'reason')}</label>
                      <input className="form-input" style={{ width: '100%' }} placeholder="Why is this needed?" value={currentItem.reason}
                        onChange={(e) => setCurrentItem({ ...currentItem, reason: e.target.value })} />
                    </div>
                    <div style={{ flex: 1, minWidth: 160 }}>
                      <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4, fontWeight: 600 }}>{t('col', 'notes')}</label>
                      <input className="form-input" style={{ width: '100%' }} placeholder="Additional notes" value={currentItem.notes}
                        onChange={(e) => setCurrentItem({ ...currentItem, notes: e.target.value })} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                    <Button type="button" variant="primary" onClick={handleAddItem}>{t('btn', 'addProduct')}</Button>
                    <Button type="button" variant="secondary" onClick={() => {
                      setSelectedProduct(null);
                      setCurrentItem({ quantity: 1, unit: '', project_site: '', reason: '', notes: '' });
                    }}>{t('btn', 'cancel')}</Button>
                  </div>
                </div>
              )}
            </div>

            {/* Items table */}
            {items.length > 0 && (
              <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{
                  padding: '8px 14px', background: 'var(--surface-subtle)',
                  borderBottom: '1px solid var(--border-subtle)',
                  fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)',
                }}>
                  {items.length} item{items.length !== 1 ? 's' : ''} added
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
                          {product?.code || 'N/A'}
                          {product?.category ? ` · ${product.category}` : ''}
                        </div>
                      </>
                    );
                  }}
                  unitOptions={unitOptions}
                />
              </div>
            )}
          </div>

          {/* ── Form Actions ── */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 20px',
            borderTop: '1px solid var(--border-subtle)',
            background: 'var(--surface-subtle)',
          }}>
            <Button type="submit" variant="primary" disabled={mutation.isPending} isLoading={mutation.isPending}>
              {t('btn', 'save')}
            </Button>
            <Button type="button" variant="secondary" onClick={() => router.push('/purchase-requests')}>
              {t('btn', 'cancel')}
            </Button>
            {items.length > 0 && (
              <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-tertiary)' }}>
                {items.length} product{items.length !== 1 ? 's' : ''} ready to submit
              </span>
            )}
          </div>
        </form>
      </PageShell>
    </MainLayout>
  );
}
