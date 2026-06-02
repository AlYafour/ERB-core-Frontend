import apiClient from './client';
import { PaginatedResponse, Product, PurchaseOrder } from '@/types';

export interface GRNItem {
  id?: number;
  purchase_order_item_id: number;
  product_id: number;
  product?: Product;
  ordered_quantity: number;
  received_quantity: number;
  rejected_quantity: number;
  quality_status: 'good' | 'damaged' | 'defective' | 'missing';
  notes?: string;
  created_at?: string;
}

export interface GoodsReceivedNote {
  id: number;
  purchase_order?: number | PurchaseOrder;
  purchase_order_id: number;
  grn_number: string;
  receipt_date: string;
  status: 'draft' | 'partial' | 'completed' | 'cancelled';
  notes?: string;
  items: GRNItem[];
  received_by: number;
  received_by_name?: string;
  total_items?: number;
  total_received_quantity?: number;
  invoices?: Array<{ id: number; invoice_number: string; [key: string]: any }>;
  material_images?: Array<{ id: number; image: string; image_url: string; created_at: string }>;
  supplier_invoice_file?: string | null;
  supplier_invoice_file_url?: string | null;
  invoice_delivery_status?: 'not_delivered' | 'delivered';
  created_at: string;
  updated_at: string;
}

export const goodsReceivingApi = {
  getAll: async (params?: {
    page?: number;
    page_size?: number;
    search?: string;
    purchase_order?: number;
    status?: string;
    receipt_date_after?: string;
    receipt_date_before?: string;
  }): Promise<PaginatedResponse<GoodsReceivedNote>> => {
    const response = await apiClient.get('/goods-receiving/', { params });
    return response.data;
  },

  getById: async (id: number): Promise<GoodsReceivedNote> => {
    const response = await apiClient.get(`/goods-receiving/${id}/`);
    return response.data;
  },

  create: async (data: {
    purchase_order_id: number;
    receipt_date: string;
    status?: 'draft' | 'partial' | 'completed' | 'cancelled';
    notes?: string;
    items: Omit<GRNItem, 'id' | 'created_at' | 'product'>[];
    material_images?: File[];
    supplier_invoice_file?: File | null;
    invoice_delivery_status?: 'not_delivered' | 'delivered';
  }): Promise<GoodsReceivedNote> => {
    const formData = new FormData();

    formData.append('purchase_order_id', data.purchase_order_id.toString());
    formData.append('receipt_date', data.receipt_date);
    if (data.status) formData.append('status', data.status);
    if (data.notes) formData.append('notes', data.notes);
    if (data.invoice_delivery_status) {
      formData.append('invoice_delivery_status', data.invoice_delivery_status);
    }

    if (data.material_images && data.material_images.length > 0) {
      data.material_images.forEach((img) => {
        formData.append('material_images', img);
      });
    }

    if (data.supplier_invoice_file) {
      formData.append('supplier_invoice_file', data.supplier_invoice_file);
    }

    if (data.items && Array.isArray(data.items) && data.items.length > 0) {
      formData.append('items', JSON.stringify(data.items));
    } else {
      throw new Error('Items are required and must be a non-empty array');
    }

    const response = await apiClient.post('/goods-receiving/', formData);
    return response.data;
  },

  update: async (id: number, data: Partial<{
    receipt_date: string;
    status: 'draft' | 'partial' | 'completed' | 'cancelled';
    notes: string;
    invoice_delivery_status: 'not_delivered' | 'delivered';
  }>): Promise<GoodsReceivedNote> => {
    const response = await apiClient.patch(`/goods-receiving/${id}/`, data);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/goods-receiving/${id}/`);
  },

  addImages: async (id: number, images: File[]): Promise<GoodsReceivedNote> => {
    const formData = new FormData();
    images.forEach((img) => formData.append('material_images', img));
    const response = await apiClient.post(`/goods-receiving/${id}/add_images/`, formData);
    return response.data;
  },

  deleteImage: async (grnId: number, imageId: number): Promise<void> => {
    await apiClient.delete(`/goods-receiving/${grnId}/delete_image/${imageId}/`);
  },

  uploadSupplierInvoice: async (id: number, file: File): Promise<GoodsReceivedNote> => {
    const formData = new FormData();
    formData.append('supplier_invoice_file', file);
    const response = await apiClient.post(`/goods-receiving/${id}/upload_supplier_invoice/`, formData);
    return response.data;
  },

  markInvoiceDelivered: async (id: number): Promise<GoodsReceivedNote> => {
    const response = await apiClient.post(`/goods-receiving/${id}/mark_invoice_delivered/`);
    return response.data;
  },
};
