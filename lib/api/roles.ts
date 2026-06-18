import apiClient from './client';

export interface CatalogPermission {
  id: number;
  action: string;
  action_label: string;
}

export interface CatalogCategory {
  key: string;
  label: string;
  permissions: CatalogPermission[];
}

export interface CatalogModule {
  key: string;
  label: string;
  categories: CatalogCategory[];
}

export interface PermissionCatalog {
  modules: CatalogModule[];
}

export interface Role {
  id: number;
  name: string;
  description?: string;
  color: string;
  level: number;
  parent?: number | null;
  parent_name?: string | null;
  is_system: boolean;
  is_active: boolean;
  is_editable: boolean;
  permissions_count: number;
  granted_permission_ids: number[];
  created_at: string;
  updated_at: string;
}

export interface AdditionalRoleAssignment {
  assignment_id: number;
  role: Role;
  granted_by?: string | null;
  granted_at: string;
}

export interface UserRoles {
  id: number;
  username: string;
  email: string;
  role: string;
  primary_role?: Role | null;
  additional_roles: AdditionalRoleAssignment[];
  effective_permissions: string[];
}

export interface RoleWriteData {
  name?: string;
  description?: string;
  color?: string;
  level?: number;
  parent?: number | null;
  permission_ids?: number[];
}

export const rolesApi = {
  getCatalog: async (): Promise<PermissionCatalog> => {
    const response = await apiClient.get('/permissions/catalog/');
    return response.data;
  },

  getAll: async (params?: { search?: string }): Promise<Role[]> => {
    const response = await apiClient.get('/permissions/roles/', {
      params: { page_size: 500, ...params },
    });
    const data = response.data;
    return Array.isArray(data) ? data : (data.results ?? []);
  },

  getById: async (id: number): Promise<Role> => {
    const response = await apiClient.get(`/permissions/roles/${id}/`);
    return response.data;
  },

  create: async (data: RoleWriteData): Promise<Role> => {
    const response = await apiClient.post('/permissions/roles/', data);
    return response.data;
  },

  update: async (id: number, data: RoleWriteData): Promise<Role> => {
    const response = await apiClient.patch(`/permissions/roles/${id}/`, data);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/permissions/roles/${id}/`);
  },

  assignToUser: async (
    roleId: number,
    userId: number,
    roleType: 'primary' | 'additional',
  ): Promise<{ detail: string }> => {
    const response = await apiClient.post(`/permissions/roles/${roleId}/assign/`, {
      user_id: userId,
      role_type: roleType,
    });
    return response.data;
  },

  unassignFromUser: async (
    roleId: number,
    userId: number,
    roleType: 'primary' | 'additional',
  ): Promise<{ detail: string }> => {
    const response = await apiClient.post(`/permissions/roles/${roleId}/unassign/`, {
      user_id: userId,
      role_type: roleType,
    });
    return response.data;
  },

  getUserRoles: async (userId: number): Promise<UserRoles> => {
    const response = await apiClient.get(`/permissions/users/${userId}/roles/`);
    return response.data;
  },
};
