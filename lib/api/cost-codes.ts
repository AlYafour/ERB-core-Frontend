import apiClient from './client';
import { CostCode } from '@/types';

export const costCodesApi = {
  getAll: async (params?: { level?: number; search?: string; parent?: number }): Promise<CostCode[]> => {
    const response = await apiClient.get('/cost-codes/', { params });
    return response.data;
  },
};
