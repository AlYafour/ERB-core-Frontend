import apiClient from './client';
import { CostCode } from '@/types';

export const costCodesApi = {
  getAll: async (params?: { level?: number; search?: string; parent?: number; is_direct?: boolean; is_active?: boolean }): Promise<CostCode[]> => {
    const response = await apiClient.get('/cost-codes/', { params });
    return response.data;
  },
  create: async (payload: Partial<CostCode>): Promise<CostCode> => {
    const response = await apiClient.post('/cost-codes/', payload);
    return response.data;
  },
  /** Add a code from a picker or the tree manager — excel/qb codes are
   *  generated server-side. With parent → a child one level deeper; without
   *  parent + level:'1' → a brand-new top-level Work Section; without
   *  parent and no level → a new Main Category (level 2, legacy default). */
  quickAdd: async (payload: { name: string; is_direct?: boolean; parent?: number | null; level?: '1' }): Promise<CostCode> => {
    const response = await apiClient.post('/cost-codes/quick-add/', payload);
    return response.data;
  },
  update: async (id: number, payload: Partial<CostCode>): Promise<CostCode> => {
    const response = await apiClient.patch(`/cost-codes/${id}/`, payload);
    return response.data;
  },
  remove: async (id: number): Promise<void> => {
    await apiClient.delete(`/cost-codes/${id}/`);
  },
};
