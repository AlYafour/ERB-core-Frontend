import {
  Product,
  PurchaseOrder,
  PurchaseOrderItem,
  PurchaseInvoice,
  PurchaseInvoiceItem,
  PurchaseRequest,
  PurchaseRequestItem,
  PurchaseQuotation,
  PurchaseQuotationItem,
} from '@/types';
import { GRNItem } from '@/lib/api/goods-receiving';

export type CleanOptional<T> = {
  [K in keyof T]: T[K] extends string
    ? T[K] extends ''
      ? undefined
      : T[K]
    : T[K] extends null
    ? undefined
    : T[K] extends (infer U)[]
    ? U[]
    : T[K];
};

export interface ProductFormData {
  name: string;
  name_ar: string;
  code: string;
  sku: string;
  barcode: string;
  description: string;
  notes: string;
  internal_notes: string;
  brand: string;
  category: string;
  tags: string;
  unit: Product['unit'];
  supplier: number | undefined;
  sell_price: number;
  buy_price: number;
  minimum_price: number;
  discount: number;
  discount_type: 'percentage' | 'fixed';
  tax1: number;
  tax2: number;
  track_stock: boolean;
  stock_balance: number;
  low_stock_threshold: number;
  profit_margin: number;
  status: 'active' | 'inactive' | 'archived';
  is_active: boolean;
}

export interface PurchaseRequestFormData {
  title: string;
  project_id: number | undefined;
  project_code?: string;
  request_date: string;
  required_by: string;
  notes: string;
  items?: PurchaseRequestItemFormData[];
}

export function toPurchaseRequestCreateData(form: PurchaseRequestFormData, items?: PurchaseRequestItemFormData[]) {
  const allItems = items ?? form.items ?? [];
  return {
    title: form.title,
    project_id: form.project_id ?? null,
    request_date: form.request_date,
    required_by: form.required_by,
    notes: form.notes,
    items: allItems.map((item) => ({
      product_id: item.product_id as number,
      quantity: item.quantity,
      unit: item.unit,
      project_site: item.project_site,
      reason: item.reason,
      notes: item.notes,
    })),
  };
}

export interface PurchaseRequestItemFormData {
  product_id: number | undefined;
  product?: Product;
  quantity: number;
  unit: string;
  project_site: string;
  reason: string;
  notes: string;
}

export interface PurchaseOrderFormData {
  purchase_request_id: number | undefined;
  purchase_quotation_id: number | undefined;
  supplier_id: number | undefined;
  cost_code_id?: number | null;
  order_date: string;
  delivery_date: string;
  payment_terms: string;
  delivery_method: 'pickup' | 'delivery' | '';
  delivery_terms: string;
  tax_rate: number;
  discount: number;
  notes: string;
  terms_and_conditions: string;
  status?: string;
  items?: PurchaseOrderItemFormData[];
}

export type PurchaseOrderUpdateFormData = Partial<PurchaseOrderFormData>;

export function toPurchaseOrderCreateData(form: PurchaseOrderFormData, items?: Array<any>) {
  const allItems = (items ?? form.items ?? []).map((item: any) => ({
    product_id: item.product_id as number,
    quantity: item.quantity,
    unit_price: item.unit_price ?? 0,
    discount: item.discount ?? 0,
    tax_rate: item.tax_rate ?? 0,
    notes: item.notes ?? '',
  }));
  return {
    purchase_request_id: form.purchase_request_id ?? null,
    purchase_quotation_id: form.purchase_quotation_id ?? null,
    supplier_id: form.supplier_id as number,
    cost_code_id: form.cost_code_id ?? null,
    order_date: form.order_date,
    delivery_date: form.delivery_date || undefined,
    payment_terms: form.payment_terms,
    delivery_method: form.delivery_method || undefined,
    delivery_terms: form.delivery_terms,
    tax_rate: form.tax_rate,
    discount: form.discount,
    notes: form.notes,
    terms_and_conditions: form.terms_and_conditions,
    status: form.status,
    items: allItems,
  };
}

export function toPurchaseOrderUpdateData(form: PurchaseOrderUpdateFormData, items?: Array<any>) {
  return toPurchaseOrderCreateData(form as PurchaseOrderFormData, items);
}

export interface PurchaseOrderItemFormData {
  product_id: number | undefined;
  product?: Product;
  quantity: number;
  unit_price: number;
  discount: number;
  tax_rate: number;
  notes: string;
}

export interface PurchaseQuotationFormData {
  quotation_request_id: number | undefined;
  purchase_request_id?: number | undefined;
  supplier_id: number | undefined;
  quotation_number: string;
  quotation_date: string;
  valid_until: string;
  payment_terms: string;
  delivery_method: 'pickup' | 'delivery' | '';
  delivery_terms: string;
  tax_rate: number;
  discount: number;
  notes: string;
  items?: PurchaseQuotationItemFormData[];
}

export function toPurchaseQuotationCreateData(form: PurchaseQuotationFormData, items?: Array<any>) {
  const allItems = (items ?? form.items ?? []).map((item: any) => ({
    product_id: item.product_id as number,
    quantity: item.quantity,
    unit_price: item.unit_price ?? 0,
    discount: item.discount ?? 0,
    tax_rate: item.tax_rate ?? 0,
    notes: item.notes ?? '',
  }));
  return {
    quotation_request_id: form.quotation_request_id ?? null,
    purchase_request_id: form.purchase_request_id ?? null,
    supplier_id: form.supplier_id as number,
    quotation_number: form.quotation_number || '',
    quotation_date: form.quotation_date,
    valid_until: form.valid_until || undefined,
    payment_terms: form.payment_terms,
    delivery_method: form.delivery_method || undefined,
    delivery_terms: form.delivery_terms,
    tax_rate: form.tax_rate,
    discount: form.discount,
    notes: form.notes,
    items: allItems,
  };
}

export interface PurchaseQuotationItemFormData {
  product_id: number | undefined;
  product?: Product;
  quantity: number;
  unit_price: number;
  discount: number;
  tax_rate: number;
  notes: string;
}

export interface PurchaseInvoiceFormData {
  purchase_order_id: number | undefined;
  grn_id: number | undefined;
  invoice_number?: string;
  invoice_date: string;
  due_date: string;
  status?: string;
  tax_rate: number;
  discount: number;
  notes: string;
  items?: PurchaseInvoiceItemFormData[];
}

export function toPurchaseInvoiceCreateData(form: PurchaseInvoiceFormData, items?: Array<any>) {
  const allItems = (items ?? form.items ?? []).map((item: any) => ({
    purchase_order_item_id: item.purchase_order_item_id as number,
    product_id: item.product_id as number,
    quantity: item.quantity,
    unit_price: item.unit_price ?? 0,
    discount: item.discount ?? 0,
    tax_rate: item.tax_rate ?? 0,
    notes: item.notes ?? '',
  }));
  return {
    purchase_order_id: form.purchase_order_id as number,
    grn_id: form.grn_id || undefined,
    invoice_number: form.invoice_number,
    invoice_date: form.invoice_date,
    due_date: form.due_date || undefined,
    status: form.status as any,
    tax_rate: form.tax_rate,
    discount: form.discount,
    notes: form.notes,
    items: allItems,
  };
}

export interface PurchaseInvoiceItemFormData {
  purchase_order_item_id: number | undefined;
  product_id: number | undefined;
  product?: Product;
  quantity: number;
  unit_price: number;
  discount: number;
  tax_rate: number;
  notes: string;
}

export interface GRNFormData {
  purchase_order_id: number | undefined;
  receipt_date: string;
  status: 'draft' | 'partial' | 'completed' | 'cancelled';
  notes: string;
  invoice_delivery_status: 'not_delivered' | 'delivered';
  items?: GRNItemFormData[];
  material_images?: File[];
  supplier_invoice_file?: File | null;
}

export function toGRNCreateData(
  form: GRNFormData,
  items?: GRNItemFormData[] | any[],
  materialImages?: File[],
  supplierInvoiceFile?: File | null,
) {
  const allItems = items ?? form.items ?? [];
  return {
    purchase_order_id: form.purchase_order_id!,
    receipt_date: form.receipt_date,
    status: form.status,
    notes: form.notes,
    invoice_delivery_status: form.invoice_delivery_status,
    items: allItems.map((item: any) => ({
      purchase_order_item_id: item.purchase_order_item_id ?? item.id,
      product_id: item.product_id,
      ordered_quantity: item.ordered_quantity,
      received_quantity: item.received_quantity,
      rejected_quantity: item.rejected_quantity,
      quality_status: item.quality_status,
      notes: item.notes ?? '',
    })),
    material_images: materialImages ?? form.material_images ?? [],
    supplier_invoice_file: supplierInvoiceFile ?? form.supplier_invoice_file ?? null,
  };
}

export interface GRNItemFormData {
  purchase_order_item_id: number | undefined;
  product_id: number | undefined;
  product?: Product;
  ordered_quantity: number;
  received_quantity: number;
  rejected_quantity: number;
  quality_status: GRNItem['quality_status'];
  notes: string;
}

export interface SupplierFormData {
  name: string;
  business_name: string;
  business_name_ar: string;
  supplier_number: string;
  contact_person: string;
  email: string;
  telephone: string;
  phone: string;
  mobile: string;
  street_address_1: string;
  street_address_2: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  address: string;
  tax_id: string;
  trn: string;
  currency: string;
  description: string;
  status: 'SUPPLIER' | 'SUBCON';
  bank_name: string;
  bank_account: string;
  notes: string;
  is_active: boolean;
}

export interface ProjectFormData {
  code: string;
  name: string;
  name_ar: string;
  location: string;
  contact_person: string;
  mobile_number: string;
  sector: string;
  plot: string;
  project_status: 'on_going' | 'completed' | 'on_hold' | 'cancelled';
  consultant: string;
  description: string;
  is_active: boolean;
}

export interface UserFormData {
  username: string;
  email: string;
  password: string;
  password2: string;
  first_name: string;
  last_name: string;
  full_name_ar: string;
  phone: string;
  role: 'site_engineer' | 'procurement_manager' | 'procurement_officer' | 'super_admin';
  is_staff: boolean;
}
