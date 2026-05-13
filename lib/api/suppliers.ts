import apiClient from './client';
import { Supplier, PaginatedResponse } from '@/types';

export const suppliersApi = {
  getAll: async (params?: {
    page?: number;
    page_size?: number;
    search?: string;
    // Text filters
    name?: string;
    business_name?: string;
    supplier_number?: string;
    first_name?: string;
    last_name?: string;
    contact_person?: string;
    email?: string;
    phone?: string;
    telephone?: string;
    mobile?: string;
    city?: string;
    state?: string;
    country?: string;
    trn?: string;
    tax_id?: string;
    // Choice filters
    currency?: string;
    is_active?: boolean;
    // Date filters
    created_at_after?: string;
    created_at_before?: string;
  }): Promise<PaginatedResponse<Supplier>> => {
    const response = await apiClient.get('/suppliers/', { params });
    return response.data;
  },

  getAllActive: async (): Promise<Supplier[]> => {
    // Fetch all active suppliers by looping through pages
    const allSuppliers: Supplier[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const response = await suppliersApi.getAll({ 
        page, 
        page_size: 100,
        is_active: true 
      });
      
      if (response.results && response.results.length > 0) {
        allSuppliers.push(...response.results);
        hasMore = response.next !== null;
        page++;
      } else {
        hasMore = false;
      }
    }

    return allSuppliers;
  },

  getById: async (id: number): Promise<Supplier> => {
    const response = await apiClient.get(`/suppliers/${id}/`);
    return response.data;
  },

  create: async (data: Partial<Supplier>): Promise<Supplier> => {
    const response = await apiClient.post('/suppliers/', data);
    return response.data;
  },

  update: async (id: number, data: Partial<Supplier>): Promise<Supplier> => {
    const response = await apiClient.patch(`/suppliers/${id}/`, data);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/suppliers/${id}/`);
  },

  importExcel: async (file: File): Promise<{ created: number; updated: number; skipped: number; errors: string[]; total_in_db: number }> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiClient.post('/suppliers/import_excel/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
};

