import apiClient from './client';
import { Product, PaginatedResponse } from '@/types';

export const productsApi = {
  getAll: async (params?: {
    page?: number;
    page_size?: number;
    search?: string;
    // Text filters
    name?: string;
    code?: string;
    sku?: string;
    barcode?: string;
    description?: string;
    brand?: string;
    category?: string;
    // Choice filters
    unit?: string;
    status?: string;
    is_active?: boolean;
    discount_type?: string;
    // Range filters
    unit_price_min?: number;
    unit_price_max?: number;
    buy_price_min?: number;
    buy_price_max?: number;
    stock_balance_min?: number;
    stock_balance_max?: number;
    // Foreign key
    supplier?: number;
    // Boolean
    track_stock?: boolean;
    // Date filters
    created_at_after?: string;
    created_at_before?: string;
  }): Promise<PaginatedResponse<Product>> => {
    const response = await apiClient.get('/products/', { params });
    return response.data;
  },

  getById: async (id: number): Promise<Product> => {
    const response = await apiClient.get(`/products/${id}/`);
    return response.data;
  },

  create: async (data: Partial<Product>): Promise<Product> => {
    const response = await apiClient.post('/products/', data);
    return response.data;
  },

  update: async (id: number, data: Partial<Product>): Promise<Product> => {
    const response = await apiClient.patch(`/products/${id}/`, data);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/products/${id}/`);
  },

  getCategories: async (): Promise<string[]> => {
    const response = await apiClient.get('/products/categories/');
    return response.data;
  },

  importExcel: async (file: File): Promise<{ created: number; updated: number; skipped: number; errors: string[]; total_in_db: number }> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiClient.post('/products/import_excel/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
};
