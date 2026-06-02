import apiClient from './client';
import { PaginatedResponse } from '@/types';

export interface Permission {
  id: number;
  name: string;
  category: string;
  action: string;
  display_name: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PermissionSet {
  id: number;
  name: string;
  description?: string;
  permissions: Permission[];
  permissions_count: number;
  is_active: boolean;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserPermission {
  id: number;
  user: number;
  user_username: string;
  permission: Permission;
  permission_id: number;
  granted: boolean;
  granted_by?: number;
  granted_by_username?: string;
  granted_at: string;
  notes?: string;
}

export interface UserPermissionSummary {
  id: number;
  username: string;
  email: string;
  role: string;
  permission_set?: PermissionSet;
  permission_set_id?: number;
  permissions: Array<{ category: string; action: string }>;
}

export const permissionsApi = {
  // Permissions
  getAllPermissions: async (params?: {
    page?: number;
    search?: string;
    category?: string;
    action?: string;
  }): Promise<PaginatedResponse<Permission>> => {
    const response = await apiClient.get('/permissions/', { params });
    return response.data;
  },

  getPermissionById: async (id: number): Promise<Permission> => {
    const response = await apiClient.get(`/permissions/${id}/`);
    return response.data;
  },

  getPermissionsByCategory: async (): Promise<Record<string, Permission[]>> => {
    const response = await apiClient.get('/permissions/by_category/');
    return response.data;
  },

  // Permission Sets
  getAllPermissionSets: async (params?: {
    page?: number;
    page_size?: number;
    search?: string;
  }): Promise<PaginatedResponse<PermissionSet>> => {
    const response = await apiClient.get('/permission-sets/', { params });
    return response.data;
  },

  getPermissionSetById: async (id: number): Promise<PermissionSet> => {
    const response = await apiClient.get(`/permission-sets/${id}/`);
    return response.data;
  },

  createPermissionSet: async (data: Partial<PermissionSet>): Promise<PermissionSet> => {
    const response = await apiClient.post('/permission-sets/', data);
    return response.data;
  },

  updatePermissionSet: async (id: number, data: Partial<PermissionSet>): Promise<PermissionSet> => {
    const response = await apiClient.patch(`/permission-sets/${id}/`, data);
    return response.data;
  },

  deletePermissionSet: async (id: number): Promise<void> => {
    await apiClient.delete(`/permission-sets/${id}/`);
  },

  assignPermissionsToSet: async (id: number, permissionIds: number[]): Promise<PermissionSet> => {
    const response = await apiClient.post(`/permission-sets/${id}/assign_permissions/`, {
      permission_ids: permissionIds,
    });
    return response.data;
  },

  // User Permissions
  getAllUserPermissions: async (params?: {
    page?: number;
    search?: string;
    user?: number;
  }): Promise<PaginatedResponse<UserPermission>> => {
    const response = await apiClient.get('/user-permissions/', { params });
    return response.data;
  },

  createUserPermission: async (data: Partial<UserPermission>): Promise<UserPermission> => {
    const response = await apiClient.post('/user-permissions/', data);
    return response.data;
  },

  deleteUserPermission: async (id: number): Promise<void> => {
    await apiClient.delete(`/user-permissions/${id}/`);
  },

  // User Permission Summary
  getUserPermissionSummary: async (userId: number): Promise<UserPermissionSummary> => {
    const response = await apiClient.get(`/user-permission-summary/${userId}/`);
    return response.data;
  },

  getUserPermissions: async (userId: number): Promise<{ permissions: Array<{ category: string; action: string }> }> => {
    const response = await apiClient.get(`/user-permission-summary/${userId}/permissions/`);
    return response.data;
  },

  assignPermissionSetToUser: async (userId: number, permissionSetId: number | null): Promise<UserPermissionSummary> => {
    const response = await apiClient.post(`/user-permission-summary/${userId}/assign_permission_set/`, {
      permission_set_id: permissionSetId,
    });
    return response.data;
  },

  getMyPermissions: async (): Promise<{
    user_id: number;
    username: string;
    permission_set?: PermissionSet;
    permissions: Array<{ category: string; action: string }>;
  }> => {
    const response = await apiClient.get('/user-permission-summary/me/');
    return response.data;
  },

  checkPermissions: async (checks: Array<{ category: string; action: string }>): Promise<{
    results: Array<{ category: string; action: string; has_permission: boolean }>;
  }> => {
    const response = await apiClient.post('/user-permission-summary/check/', { checks });
    return response.data;
  },
};

