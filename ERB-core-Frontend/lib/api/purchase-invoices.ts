import apiClient from './client';
import { PaginatedResponse, PurchaseInvoice, PurchaseInvoiceItem } from '@/types';

export const purchaseInvoicesApi = {
  getAll: async (params?: {
    page?: number;
    page_size?: number;
    search?: string;
    purchase_order?: number;
    status?: string;
    created_by?: number;
    invoice_date_after?: string;
    invoice_date_before?: string;
  }): Promise<PaginatedResponse<PurchaseInvoice>> => {
    const response = await apiClient.get('/purchase-invoices/', { params });
    return response.data;
  },

  getById: async (id: number): Promise<PurchaseInvoice> => {
    const response = await apiClient.get(`/purchase-invoices/${id}/`);
    return response.data;
  },

  create: async (data: {
    purchase_order_id: number;
    grn_id?: number;
    invoice_date: string;
    due_date?: string;
    status?: 'draft' | 'pending' | 'approved' | 'rejected' | 'paid' | 'cancelled';
    tax_rate?: number;
    discount?: number;
    notes?: string;
    items: Omit<PurchaseInvoiceItem, 'id' | 'created_at' | 'product'>[];
  }): Promise<PurchaseInvoice> => {
    const response = await apiClient.post('/purchase-invoices/', data);
    return response.data;
  },

  update: async (id: number, data: Partial<PurchaseInvoice>): Promise<PurchaseInvoice> => {
    const response = await apiClient.patch(`/purchase-invoices/${id}/`, data);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/purchase-invoices/${id}/`);
  },

  approve: async (id: number): Promise<PurchaseInvoice> => {
    const response = await apiClient.post(`/purchase-invoices/${id}/approve/`);
    return response.data;
  },

  reject: async (id: number, rejection_reason: string): Promise<PurchaseInvoice> => {
    const response = await apiClient.post(`/purchase-invoices/${id}/reject/`, { rejection_reason });
    return response.data;
  },

  markPaid: async (
    id: number,
    data: {
      paid_amount?: number;
      payment_date?: string;
      payment_method?: string;
      payment_reference?: string;
    }
  ): Promise<PurchaseInvoice> => {
    const response = await apiClient.post(`/purchase-invoices/${id}/mark_paid/`, data);
    return response.data;
  },
};

