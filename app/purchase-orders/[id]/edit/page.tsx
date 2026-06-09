'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { purchaseOrdersApi } from '@/lib/api/purchase-orders';
import { suppliersApi } from '@/lib/api/suppliers';
import { productsApi } from '@/lib/api/products';
import MainLayout from '@/components/layout/MainLayout';
import Link from 'next/link';
import { PurchaseOrder, PurchaseOrderItem, CostCode } from '@/types';
import { PurchaseOrderUpdateFormData, toPurchaseOrderUpdateData } from '@/lib/types/form-data';
import CostCodePicker from '@/components/domain/CostCodePicker';
import { toast } from '@/lib/hooks/use-toast';
import { getApiError } from '@/lib/utils/error';
import SearchableDropdown from '@/components/ui/SearchableDropdown';
import { formatPrice } from '@/lib/utils/format';
import RouteGuard from '@/components/auth/RouteGuard';
import { useAuth } from '@/lib/hooks/use-auth';
import { Button, PageHeader, PageShell } from '@/components/ui';
import { useT } from '@/lib/i18n/useT';

export default function EditPurchaseOrderPage() {
  const params = useParams();
  const id = Number(params.id);
  
  return (
    <RouteGuard
      requiredPermission={{ category: 'purchase_order', action: 'update' }}
      redirectTo={`/purchase-orders/${id}`}
    >
      <EditPurchaseOrderPageContent />
    </RouteGuard>
  );
}

function EditPurchaseOrderPageContent() {
  const t = useT();
  const router = useRouter();
  const params = useParams();
  const id = Number(params.id);
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: order, isLoading } = useQuery({
    queryKey: ['purchase-orders', id],
    queryFn: () => purchaseOrdersApi.getById(id),
  });

  const [formData, setFormData] = useState<PurchaseOrderUpdateFormData>({
    supplier_id: 0,
    order_date: new Date().toISOString().split('T')[0],
    delivery_date: '',
    delivery_method: '',
    payment_terms: '',
    delivery_terms: '',
    notes: '',
    terms_and_conditions: '',
    tax_rate: 0,
    discount: 0,
    transportation_charge: 0,
    status: 'draft',
    cost_code_id: null,
  });
  const [selectedCostCode, setSelectedCostCode] = useState<CostCode | null>(null);

  const [items, setItems] = useState<
    Omit<PurchaseOrderItem, 'product' | 'total' | 'created_at'>[]
  >([]);
  const [currentItem, setCurrentItem] = useState({
    product_id: 0,
    quantity: 0,
    unit_price: 0,
    discount: 0,
    tax_rate: 0,
    notes: '',
  });

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers-all-active'],
    queryFn: () => suppliersApi.getAllActive(),
  });

  const { data: products } = useQuery({
    queryKey: ['products-all'],
    queryFn: () => productsApi.getAll({ page: 1, page_size: 1000 }),
  });

  useEffect(() => {
    if (order) {
      const supplierId = typeof order.supplier === 'object' ? order.supplier.id : order.supplier;
      const prId = typeof order.purchase_request === 'object' ? (order.purchase_request as any)?.id : order.purchase_request;
      const pqId = typeof order.purchase_quotation === 'object' ? (order.purchase_quotation as any)?.id : order.purchase_quotation;
      setFormData({
        supplier_id: supplierId,
        purchase_request_id: prId ?? undefined,
        purchase_quotation_id: pqId ?? undefined,
        order_date: order.order_date,
        delivery_date: order.delivery_date || '',
        delivery_method: order.delivery_method || '',
        payment_terms: order.payment_terms || '',
        delivery_terms: order.delivery_terms || '',
        notes: order.notes || '',
        terms_and_conditions: (order as any).terms_and_conditions || '',
        tax_rate: order.tax_rate || 0,
        discount: order.discount || 0,
        transportation_charge: order.transportation_charge || 0,
        status: order.status,
      });
      setItems(
        order.items.map((item) => ({
          id: item.id,
          product_id: item.product?.id || item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount: item.discount ?? 0,
          tax_rate: item.tax_rate ?? 0,
          notes: item.notes || '',
        }))
      );
      if (order.cost_code) {
        setSelectedCostCode(order.cost_code as CostCode);
        setFormData(prev => ({ ...prev, cost_code_id: (order.cost_code as CostCode).id }));
      }
    }
  }, [order]);

  const mutation = useMutation({
    mutationFn: (data: PurchaseOrderUpdateFormData) =>
      purchaseOrdersApi.update(id, toPurchaseOrderUpdateData(data, items) as unknown as Partial<PurchaseOrder>),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-order', id] });
      toast('Purchase Order updated successfully!', 'success');
      router.push(`/purchase-orders/${id}`);
    },
    onError: (error: any) => {
      const message = getApiError(error, 'Failed to update purchase order');
      toast(message, 'error');
    },
  });

  const handleAddItem = () => {
    if (currentItem.product_id && currentItem.quantity > 0 && currentItem.unit_price > 0) {
      setItems([...items, { ...currentItem }]);
      setCurrentItem({
        product_id: 0,
        quantity: 0,
        unit_price: 0,
        discount: 0,
        tax_rate: 0,
        notes: '',
      });
    }
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleUpdateItem = (index: number, field: string, value: any) => {
    const updatedItems = [...items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    setItems(updatedItems);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.supplier_id) {
      toast('Please select a supplier', 'warning');
      return;
    }
    if (items.length === 0) {
      toast('Please add at least one product', 'warning');
      return;
    }
    mutation.mutate(formData);
  };

  const calculateSubtotal = () => {
    return items.reduce((sum, item) => {
      const base = item.quantity * item.unit_price;
      const disc = base * ((item.discount ?? 0) / 100);
      return sum + base - disc;
    }, 0);
  };

  const calculateItemVAT = () => {
    return items.reduce((sum, item) => {
      const base = item.quantity * item.unit_price;
      const disc = base * ((item.discount ?? 0) / 100);
      return sum + (base - disc) * ((item.tax_rate ?? 0) / 100);
    }, 0);
  };

  const calculateTaxAmount = () => {
    const subtotalWithVAT = calculateSubtotal() + calculateItemVAT();
    const taxableBase = subtotalWithVAT - (formData.discount ?? 0) + (formData.transportation_charge ?? 0);
    return taxableBase * ((formData.tax_rate ?? 0) / 100) || 0;
  };

  const calculateTotal = () => {
    const subtotalWithVAT = calculateSubtotal() + calculateItemVAT();
    const taxableBase = subtotalWithVAT - (formData.discount ?? 0) + (formData.transportation_charge ?? 0);
    const orderTax = taxableBase * ((formData.tax_rate ?? 0) / 100) || 0;
    return taxableBase + orderTax;
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="card empty-state">
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>{t('btn', 'loading')}</p>
        </div>
      </MainLayout>
    );
  }

  if (!order) {
    return (
      <MainLayout>
        <div className="card empty-state">
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>{t('empty', 'notFound')}</p>
        </div>
      </MainLayout>
    );
  }

  const isSuperAdmin = !!(user?.is_superuser || user?.is_staff);

  if ((order.status === 'approved' || order.status === 'completed') && !isSuperAdmin) {
    return (
      <MainLayout>
        <div className="card empty-state">
          <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-4)', margin: '0 0 var(--space-4) 0' }}>
            This purchase order cannot be edited because it is {order.status}.
          </p>
          <Link href={`/purchase-orders/${id}`}>
            <Button variant="primary">{t('btn', 'back')} {t('page', 'purchaseOrders')}</Button>
          </Link>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <PageShell>
        <PageHeader
          title={`${t('page', 'editPO')}: ${order.order_number}`}
          description="Update purchase order details"
          breadcrumbs={[{ label: t('page', 'purchaseOrders'), href: '/purchase-orders' }, { label: order.order_number, href: `/purchase-orders/${id}` }, { label: 'Edit' }]}
        />

        <form onSubmit={handleSubmit} className="card">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
            <div>
              <SearchableDropdown
                label={t('col', 'supplier')}
                required
                options={
                  suppliers?.map((supplier) => ({
                    value: supplier.id,
                    label: supplier.name,
                    searchText: `${supplier.name} ${supplier.business_name || ''} ${supplier.contact_person || ''}`,
                  })) || []
                }
                value={formData.supplier_id}
                onChange={(val) => setFormData({ ...formData, supplier_id: val ? Number(val) : 0 })}
                placeholder={t('misc', 'selectSupplier')}
                searchPlaceholder={t('misc', 'searchSuppliers')}
              />
            </div>

            <div>
              <label className="form-label">
                {t('col', 'orderDate')} <span style={{ color: 'var(--color-error)' }}>*</span>
              </label>
              <input
                type="date"
                required
                value={formData.order_date}
                onChange={(e) => setFormData({ ...formData, order_date: e.target.value })}
                className="form-input"
              />
            </div>

            <div>
              <label className="form-label">{t('field', 'deliveryDate')}</label>
              <input
                type="date"
                value={formData.delivery_date}
                onChange={(e) => setFormData({ ...formData, delivery_date: e.target.value })}
                className="form-input"
              />
            </div>

            <div>
              <label className="form-label">{t('col', 'deliveryMethod')}</label>
              <select
                value={formData.delivery_method}
                onChange={(e) => setFormData({ ...formData, delivery_method: e.target.value as 'pickup' | 'delivery' | '' })}
                className="form-select"
              >
                <option value="">-- Select Delivery Method --</option>
                <option value="pickup">Pick Up</option>
                <option value="delivery">Delivery</option>
              </select>
            </div>

            <div>
              <label className="form-label">{t('col', 'status')}</label>
              <select
                value={formData.status}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    status: e.target.value as typeof formData.status,
                  })
                }
                className="form-select"
              >
                <option value="draft">{t('status', 'draft')}</option>
                <option value="pending">{t('status', 'pending')}</option>
                {isSuperAdmin && <option value="approved">{t('status', 'approved')}</option>}
                {isSuperAdmin && <option value="completed">{t('status', 'completed')}</option>}
                <option value="rejected">{t('status', 'rejected')}</option>
                <option value="cancelled">{t('status', 'cancelled')}</option>
              </select>
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Cost Code</label>
              <CostCodePicker
                value={selectedCostCode}
                onChange={(code) => {
                  setSelectedCostCode(code);
                  setFormData(prev => ({ ...prev, cost_code_id: code?.id ?? null }));
                }}
              />
            </div>
          </div>

          {/* Items Section */}
          <div style={{ marginBottom: 'var(--space-6)' }}>
            <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-semibold)', marginBottom: 'var(--space-4)', marginTop: 0 }}>{t('section', 'orderItems')}</h3>

            {/* Add Item Form */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--space-3)', marginBottom: 'var(--space-4)', padding: 'var(--space-4)', backgroundColor: 'var(--surface-subtle)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ gridColumn: 'span 2' }}>
                <SearchableDropdown
                  options={
                    products?.results?.map((product) => ({
                      value: product.id,
                      label: `${product.name} (${product.code})`,
                      searchText: `${product.name} ${product.code} ${product.category || ''}`,
                    })) || []
                  }
                  value={currentItem.product_id}
                  onChange={(val) =>
                    setCurrentItem({ ...currentItem, product_id: val ? Number(val) : 0 })
                  }
                  placeholder="Select Product"
                  searchPlaceholder="Search products..."
                />
              </div>

              <div>
                <label className="form-label">{t('col', 'quantity')}</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={currentItem.quantity || ''}
                  onChange={(e) =>
                    setCurrentItem({ ...currentItem, quantity: parseFloat(e.target.value) || 0 })
                  }
                  className="form-input"
                />
              </div>

              <div>
                <label className="form-label">{t('col', 'unitPrice')}</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={currentItem.unit_price || ''}
                  onChange={(e) =>
                    setCurrentItem({ ...currentItem, unit_price: parseFloat(e.target.value) || 0 })
                  }
                  className="form-input"
                />
              </div>

              <div>
                <label className="form-label">{t('col', 'discountPct')}</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={currentItem.discount || ''}
                  onChange={(e) =>
                    setCurrentItem({ ...currentItem, discount: parseFloat(e.target.value) || 0 })
                  }
                  className="form-input"
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <Button
                  type="button"
                  variant="primary"
                  style={{ width: '100%' }}
                  onClick={handleAddItem}
                  disabled={!currentItem.product_id || currentItem.quantity <= 0 || currentItem.unit_price <= 0}
                >
                  Add
                </Button>
              </div>
            </div>

            {/* Items Table */}
            {items.length > 0 && (
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>{t('col', 'product')}</th>
                      <th>{t('col', 'quantity')}</th>
                      <th>{t('col', 'unitPrice')}</th>
                      <th>{t('col', 'discountPct')}</th>
                      <th>{t('col', 'taxPct')}</th>
                      <th>{t('col', 'total')}</th>
                      <th>{t('col', 'actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, index) => {
                      const product = products?.results?.find((p) => p.id === item.product_id)
                        ?? order?.items?.find((oi) => (oi.product?.id ?? oi.product_id) === item.product_id)?.product;
                      const itemSubtotal = item.quantity * item.unit_price;
                      const discountAmount = itemSubtotal * ((item.discount ?? 0) / 100) || 0;
                      const afterDiscount = itemSubtotal - discountAmount;
                      const taxAmount = afterDiscount * ((item.tax_rate ?? 0) / 100) || 0;
                      const itemTotal = afterDiscount + taxAmount;

                      return (
                        <tr key={index}>
                          <td>
                            <div style={{ fontWeight: 'var(--weight-medium)' }}>{product?.name || 'N/A'}</div>
                            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{product?.code || ''}</div>
                          </td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.quantity}
                              onChange={(e) =>
                                handleUpdateItem(index, 'quantity', parseFloat(e.target.value) || 0)
                              }
                              className="form-input" style={{ width: 80 }}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.unit_price}
                              onChange={(e) =>
                                handleUpdateItem(index, 'unit_price', parseFloat(e.target.value) || 0)
                              }
                              className="form-input" style={{ width: 96 }}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              value={item.discount ?? 0}
                              onChange={(e) =>
                                handleUpdateItem(index, 'discount', parseFloat(e.target.value) || 0)
                              }
                              className="form-input" style={{ width: 80 }}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              value={item.tax_rate ?? 0}
                              onChange={(e) =>
                                handleUpdateItem(index, 'tax_rate', parseFloat(e.target.value) || 0)
                              }
                              className="form-input" style={{ width: 80 }}
                            />
                          </td>
                          <td>
                            <div style={{ fontWeight: 'var(--weight-semibold)' }}>
                              {formatPrice(itemTotal)}
                            </div>
                          </td>
                          <td>
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              onClick={() => handleRemoveItem(index)}
                            >
                              {t('btn', 'delete')}
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Summary Section */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div>
                <label className="form-label">{t('field', 'paymentTerms')}</label>
                <textarea
                  value={formData.payment_terms}
                  onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
                  className="form-textarea"
                  rows={3}
                  placeholder="Enter payment terms..."
                />
              </div>

              <div>
                <label className="form-label">{t('field', 'deliveryTerms')}</label>
                <textarea
                  value={formData.delivery_terms}
                  onChange={(e) => setFormData({ ...formData, delivery_terms: e.target.value })}
                  className="form-textarea"
                  rows={3}
                  placeholder="Enter delivery terms..."
                />
              </div>

              <div>
                <label className="form-label">{t('col', 'notes')}</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="form-textarea"
                  rows={3}
                  placeholder="Enter any additional notes..."
                />
              </div>

              <div>
                <label className="form-label">{t('section', 'termsConditions')}</label>
                <textarea
                  value={formData.terms_and_conditions}
                  onChange={(e) => setFormData({ ...formData, terms_and_conditions: e.target.value })}
                  className="form-textarea"
                  rows={4}
                  placeholder="Enter terms and conditions..."
                />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div>
                <label className="form-label">{t('col', 'discountPct')}</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={formData.discount ?? 0}
                  onChange={(e) => setFormData({ ...formData, discount: parseFloat(e.target.value) || 0 })}
                  className="form-input"
                />
              </div>

              <div>
                <label className="form-label">{t('field', 'taxRate')}</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={formData.tax_rate ?? 0}
                  onChange={(e) => setFormData({ ...formData, tax_rate: parseFloat(e.target.value) || 0 })}
                  className="form-input"
                />
              </div>

              <div>
                <label className="form-label">Transportation Charge (AED)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.transportation_charge ?? 0}
                  onChange={(e) => setFormData({ ...formData, transportation_charge: parseFloat(e.target.value) || 0 })}
                  className="form-input"
                  placeholder="0.00"
                />
              </div>

              <div className="card" style={{ backgroundColor: 'var(--surface-subtle)', padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Subtotal:</span>
                  <span style={{ fontWeight: 'var(--weight-semibold)' }}>{formatPrice(calculateSubtotal())}</span>
                </div>
                {(formData.discount ?? 0) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Discount:</span>
                    <span style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--text-danger)' }}>− {formatPrice(formData.discount ?? 0)}</span>
                  </div>
                )}
                {(formData.transportation_charge ?? 0) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Transportation:</span>
                    <span style={{ fontWeight: 'var(--weight-semibold)' }}>{formatPrice(formData.transportation_charge ?? 0)}</span>
                  </div>
                )}
                {(formData.tax_rate ?? 0) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>VAT ({formData.tax_rate}%):</span>
                    <span style={{ fontWeight: 'var(--weight-semibold)' }}>{formatPrice(calculateTaxAmount())}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-2)', fontSize: 'var(--text-base)' }}>
                  <span style={{ fontWeight: 'var(--weight-bold)' }}>Total:</span>
                  <span style={{ fontWeight: 'var(--weight-bold)' }}>{formatPrice(calculateTotal())}</span>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <Button
              type="submit"
              variant="primary"
              disabled={mutation.isPending}
              isLoading={mutation.isPending}
            >
              {t('btn', 'update')} {t('page', 'purchaseOrders')}
            </Button>
            <Link href={`/purchase-orders/${id}`}>
              <Button variant="secondary">Cancel</Button>
            </Link>
          </div>
        </form>
      </PageShell>
    </MainLayout>
  );
}

