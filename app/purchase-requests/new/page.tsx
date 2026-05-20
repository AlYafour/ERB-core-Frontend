'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { purchaseRequestsApi } from '@/lib/api/purchase-requests';
import { productsApi } from '@/lib/api/products';
import { projectsApi } from '@/lib/api/projects';
import MainLayout from '@/components/layout/MainLayout';
import Link from 'next/link';
import { Button, PageShell, PageHeader } from '@/components/ui';
import { PurchaseRequestItem, Product, Project } from '@/types';
import { PurchaseRequestFormData, toPurchaseRequestCreateData } from '@/lib/types/form-data';
import { toast } from '@/lib/hooks/use-toast';
import { getApiError } from '@/lib/utils/error';
import ProductSelector from '@/components/features/ProductSelector';
import QuantityInput from '@/components/ui/QuantityInput';
import SearchableDropdown, { DropdownOption } from '@/components/ui/SearchableDropdown';
import FormField from '@/components/ui/FormField';
import AIProcurementChat, { AIFormUpdate } from '@/components/features/AIProcurementChat';
import VoiceRealtimeChat from '@/components/features/VoiceRealtimeChat';
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

  const handleAIAddItems = (aiItems: Array<{
    product_id: number; product?: Product; quantity: number;
    unit: string; reason: string; notes: string; project_site: string;
  }>) => {
    setItems((prev) => {
      const next = [...prev];
      for (const ai of aiItems) {
        const existing = next.findIndex((x) => x.product_id === ai.product_id);
        if (existing >= 0) {
          next[existing] = { ...next[existing], quantity: next[existing].quantity + ai.quantity };
        } else {
          next.push(ai);
        }
      }
      return next;
    });
    toast(`AI added ${aiItems.length} item(s) to the list`, 'success');
  };

  const handleAIFormUpdate = (fields: AIFormUpdate) => {
    setFormData((prev) => {
      const updated = { ...prev };
      if (fields.title)       updated.title       = fields.title;
      if (fields.required_by) updated.required_by = fields.required_by;
      if (fields.notes)       updated.notes       = fields.notes;
      if (fields.project_id && projectsData?.results) {
        const project = projectsData.results.find((p: Project) => p.id === fields.project_id);
        if (project) {
          updated.project_id   = project.id;
          updated.project_code = project.code;
          updated.title        = updated.title || project.name;
        }
      }
      return updated;
    });
  };

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

  return (
    <MainLayout>
      <PageShell>
        <PageHeader
          title={t('page', 'newPR')}
          description="Create a new purchase request with required products"
          backHref="/purchase-requests"
          breadcrumbs={[
            { label: t('page', 'purchaseRequests'), href: '/purchase-requests' },
            { label: t('page', 'newPR') },
          ]}
        />
        <form onSubmit={handleSubmit} className="card">
          <div className="form-grid" style={{ marginBottom: 'var(--space-6)' }}>
            {/* Project Selection */}
            <FormField
              label={t('field', 'project')}
              required
            >
              <SearchableDropdown
                options={
                  projectsData?.results?.map((project: Project) => ({
                    value: project.id,
                    label: `${project.name} (${project.code})`,
                    searchText: `${project.name} ${project.code} ${project.location || ''}`,
                  })) || []
                }
                value={formData.project_id}
                onChange={(val) => handleProjectChange(val ? Number(val) : undefined)}
                placeholder="Select Project"
                searchPlaceholder="Search by name or code..."
                allowClear
              />
            </FormField>

            {/* Project Code */}
            <FormField
              label="Project Code"
            >
              <input
                type="text"
                placeholder="Enter project code"
                value={formData.project_code}
                onChange={(e) => handleProjectCodeChange(e.target.value)}
                className="form-input"
              />
            </FormField>

            {/* Title */}
            <FormField
              label={t('field', 'title')}
              required
            >
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Auto-filled from project name"
                className="form-input"
              />
            </FormField>

            {/* Request Date */}
            <FormField
              label={t('field', 'requestDate')}
              required
            >
              <input
                type="date"
                required
                value={formData.request_date}
                onChange={(e) => setFormData({ ...formData, request_date: e.target.value })}
                className="form-input"
              />
            </FormField>

            {/* Required By */}
            <FormField
              label={t('field', 'requiredBy')}
              required
            >
              <input
                type="date"
                required
                value={formData.required_by}
                onChange={(e) => setFormData({ ...formData, required_by: e.target.value })}
                className="form-input"
              />
            </FormField>

            {/* General Notes - Full Width */}
            <div style={{ gridColumn: '1 / -1' }}>
              <FormField
                label={t('field', 'notes')}
              >
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  placeholder="Additional notes..."
                  className="form-textarea"
                />
              </FormField>
            </div>

            {/* Info Note - Full Width */}
            <div style={{ gridColumn: '1 / -1' }}>
              <div 
                className="card"
                style={{ 
                  padding: 'var(--space-3)',
                  backgroundColor: 'var(--surface-inset)',
                  borderColor: 'var(--border-subtle)',
                }}
              >
                <p style={{ 
                  fontSize: 'var(--text-xs)',
                  color: 'var(--text-secondary)',
                  margin: 0,
                }}>
                  <strong>Note:</strong> Request Code will be auto-generated based on the selected project (e.g., {formData.project_code || 'PROJ'}-001, {formData.project_code || 'PROJ'}-002...)
                </p>
              </div>
            </div>
          </div>

          {/* Items Section - Unified */}
          <div style={{ marginBottom: 'var(--space-6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <h3 style={{
                fontSize: 'var(--text-lg)',
                fontWeight: 'var(--weight-semibold)',
                color: 'var(--text-primary)',
                margin: 0,
              }}>
                {t('section', 'requestedItems')}
              </h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <AIProcurementChat onAddItems={handleAIAddItems} onFormUpdate={handleAIFormUpdate} />
                <VoiceRealtimeChat onAddItems={handleAIAddItems} onFormUpdate={handleAIFormUpdate} />
              </div>
            </div>
            
            {/* Add Item Form - Unified Card */}
            <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
              {/* Product Selection */}
              <div style={{ marginBottom: 'var(--space-4)' }}>
                <ProductSelector
                  selectedProductId={selectedProduct?.id || null}
                  onProductSelect={handleProductSelect}
                  selectedCategory={selectedCategory}
                  onCategoryChange={setSelectedCategory}
                />
              </div>

              {/* Product Details Form */}
              {selectedProduct && (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  paddingTop: 10,
                  borderTop: `1px solid var(--border-subtle)`,
                }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                    {/* Qty â€" compact fixed width */}
                    <div style={{ flexShrink: 0 }}>
                      <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 3 }}>{t('col', 'quantity')} <span style={{ color: '#ef4444' }}>*</span></label>
                      <QuantityInput
                        value={currentItem.quantity}
                        onChange={(value) => setCurrentItem({ ...currentItem, quantity: Math.floor(value) })}
                        min={1}
                        step={1}
                      />
                    </div>
                    {/* Unit */}
                    <div style={{ width: 140, flexShrink: 0 }}>
                      <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 3 }}>{t('col', 'unit')}</label>
                      <SearchableDropdown
                        options={unitOptions}
                        value={currentItem.unit}
                        onChange={(val) => setCurrentItem({ ...currentItem, unit: String(val || '') })}
                        placeholder="Select Unit"
                        searchPlaceholder="Search unit..."
                        allowClear
                      />
                    </div>
                    {/* Reason */}
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 3 }}>{t('field', 'reason')}</label>
                      <input
                        className="form-input"
                        style={{ width: '100%' }}
                        placeholder="Why is this needed?"
                        value={currentItem.reason}
                        onChange={(e) => setCurrentItem({ ...currentItem, reason: e.target.value })}
                      />
                    </div>
                    {/* Notes */}
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 3 }}>{t('col', 'notes')}</label>
                      <input
                        className="form-input"
                        style={{ width: '100%' }}
                        placeholder="Additional notes"
                        value={currentItem.notes}
                        onChange={(e) => setCurrentItem({ ...currentItem, notes: e.target.value })}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 'var(--space-3)', paddingTop: 'var(--space-2)' }}>
                    <Button type="button" variant="primary" onClick={handleAddItem}>
                      {t('btn', 'addProduct')}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        setSelectedProduct(null);
                        setCurrentItem({ quantity: 1, unit: '', project_site: '', reason: '', notes: '' });
                      }}
                    >
                      {t('btn', 'cancel')}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Items Table - Unified */}
            {items.length > 0 && (
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>{t('col', 'product')}</th>
                        <th>{t('col', 'quantity')}</th>
                        <th>{t('col', 'unit')}</th>
                        <th>{t('field', 'reason')}</th>
                        <th>{t('col', 'notes')}</th>
                        <th>{t('col', 'actions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, index) => {
                        const product = item.product || productsData?.results?.find((p) => p.id === item.product_id);
                        return (
                          <tr key={index}>
                            <td>
                              <div style={{ 
                                fontWeight: 'var(--weight-medium)',
                                color: 'var(--text-primary)',
                              }}>
                                {product?.name || 'Unknown Product'}
                              </div>
                              <div style={{ 
                                fontSize: 'var(--text-xs)',
                                color: 'var(--text-secondary)',
                                marginTop: 'var(--space-1)',
                              }}>
                                {product?.code || 'N/A'}
                              </div>
                              {product?.category && (
                                <div style={{ 
                                  fontSize: 'var(--text-xs)',
                                  color: 'var(--text-tertiary)',
                                  marginTop: 'var(--space-1)',
                                }}>
                                  {product.category}
                                </div>
                              )}
                            </td>
                            <td>
                              <input
                                type="number"
                                min="1"
                                step="1"
                                value={item.quantity}
                                onChange={(e) => handleUpdateItem(index, 'quantity', Math.floor(Number(e.target.value)) || 1)}
                                className="form-input"
                                style={{ width: '100px' }}
                              />
                            </td>
                            <td>
                              <SearchableDropdown
                                options={unitOptions}
                                value={item.unit || ''}
                                onChange={(val) => handleUpdateItem(index, 'unit', val || '')}
                                placeholder="Select Unit"
                                searchPlaceholder="Search unit..."
                                allowClear
                              />
                            </td>
                            <td>
                              <textarea
                                value={item.reason || ''}
                                onChange={(e) => handleUpdateItem(index, 'reason', e.target.value)}
                                placeholder="Purpose"
                                rows={2}
                                className="form-textarea"
                                style={{ width: '160px' }}
                              />
                            </td>
                            <td>
                              <textarea
                                value={item.notes || ''}
                                onChange={(e) => handleUpdateItem(index, 'notes', e.target.value)}
                                placeholder="Notes"
                                rows={2}
                                className="form-textarea"
                                style={{ width: '160px' }}
                              />
                            </td>
                            <td>
                              <Button type="button" variant="delete" size="sm" onClick={() => handleRemoveItem(index)}>
                                {t('btn', 'delete')}
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <Button type="submit" variant="primary" disabled={mutation.isPending} isLoading={mutation.isPending}>
              {t('btn', 'save')}
            </Button>
            <Button variant="secondary" onClick={() => router.push('/purchase-requests')}>
              {t('btn', 'cancel')}
            </Button>
          </div>
        </form>
      </PageShell>
    </MainLayout>
  );
}
