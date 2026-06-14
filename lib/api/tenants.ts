import apiClient from './client';
import type {
  TenantInfo, TenantModuleInfo, PlanInfo,
  AuditLogEntry, PlatformStats, ValidateCompanyCodeResponse, TenantBrandingData,
} from '@/types/saas';
import type { PaginatedResponse } from '@/types';

export interface CreateTenantPayload {
  name: string;
  name_ar?: string;
  company_code?: string;
  status?: 'trial' | 'active' | 'inactive';
  plan: number;
  industry?: string;
  country?: string;
  email?: string;
  max_users?: number;
  max_projects?: number;
  enabled_modules?: string[];
  // Admin account (optional — if provided, password is required)
  admin_first_name?: string;
  admin_last_name?: string;
  admin_email?: string;
  admin_password?: string;
  // Branding (all optional)
  branding_logo_url?: string;
  branding_login_bg_url?: string;
  branding_primary_color?: string;
  branding_company_legal_name?: string;
}

export interface CreateTenantResponse extends TenantInfo {
  admin_credentials?: {
    username: string;
    email: string;
    password: string;
  };
}

export const tenantApi = {
  // ── Company-admin endpoints ───────────────────────────────────────
  me: async (): Promise<TenantInfo> => {
    const r = await apiClient.get('/tenants/me/');
    return r.data;
  },

  myModules: async (): Promise<TenantModuleInfo[]> => {
    const r = await apiClient.get('/tenants/me/modules/');
    return r.data;
  },

  myBranding: async (): Promise<TenantBrandingData> => {
    const r = await apiClient.get('/tenants/me/branding/');
    return r.data;
  },

  updateMyBranding: async (data: Partial<TenantBrandingData>): Promise<TenantBrandingData> => {
    const r = await apiClient.patch('/tenants/me/branding/', data);
    return r.data;
  },

  myBrandingUpload: async (file: File, type: 'logo' | 'login_bg'): Promise<{ url: string; type: string }> => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('type', type);
    const r = await apiClient.post('/tenants/me/upload-branding-asset/', fd);
    return r.data;
  },

  // ── Super-admin: Tenants ─────────────────────────────────────────
  listTenants: async (params?: { page?: number; search?: string; page_size?: number }): Promise<PaginatedResponse<TenantInfo>> => {
    const r = await apiClient.get('/super/tenants/', { params });
    return r.data;
  },

  /** Fetch all tenants in one request (for selectors / module management). */
  listAllTenants: async (): Promise<TenantInfo[]> => {
    const r = await apiClient.get('/super/tenants/', { params: { page_size: 1000 } });
    return r.data?.results ?? r.data;
  },

  getTenant: async (id: string): Promise<TenantInfo> => {
    const r = await apiClient.get(`/super/tenants/${id}/`);
    return r.data;
  },

  createTenant: async (data: CreateTenantPayload): Promise<CreateTenantResponse> => {
    const r = await apiClient.post('/super/tenants/', data);
    return r.data;
  },

  /** Suggest a unique company code for a given name. */
  suggestCode: async (name: string): Promise<{ company_code: string }> => {
    const r = await apiClient.get('/super/tenants/suggest-code/', { params: { name } });
    return r.data;
  },

  /** Upload a branding file (logo or login_bg) before the tenant is created. */
  uploadBranding: async (file: File, type: 'logo' | 'login_bg'): Promise<{ url: string }> => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('type', type);
    const r = await apiClient.post('/super/branding-upload/', fd);
    return r.data;
  },

  getBranding: async (id: string): Promise<TenantBrandingData> => {
    const r = await apiClient.get(`/super/tenants/${id}/branding/`);
    return r.data;
  },

  updateBranding: async (id: string, data: Partial<TenantBrandingData>): Promise<TenantBrandingData> => {
    const r = await apiClient.patch(`/super/tenants/${id}/branding/`, data);
    return r.data;
  },

  setStatus: async (id: string, status: string): Promise<TenantInfo> => {
    const r = await apiClient.post(`/super/tenants/${id}/set-status/`, { status });
    return r.data;
  },

  regenerateCode: async (id: string): Promise<{ company_code: string }> => {
    const r = await apiClient.post(`/super/tenants/${id}/regenerate-code/`);
    return r.data;
  },

  updateModules: async (
    id: string,
    updates: Record<string, boolean>,
  ): Promise<TenantInfo> => {
    const r = await apiClient.post(`/super/tenants/${id}/update-modules/`, { updates });
    return r.data;
  },

  changePlan: async (id: string, planId: number): Promise<TenantInfo> => {
    const r = await apiClient.post(`/super/tenants/${id}/change-plan/`, { plan_id: planId });
    return r.data;
  },

  // ── Super-admin: Plans ───────────────────────────────────────────
  listPlans: async (): Promise<PaginatedResponse<PlanInfo>> => {
    const r = await apiClient.get('/super/plans/');
    return r.data;
  },

  // ── Super-admin: Audit logs ──────────────────────────────────────
  listAuditLogs: async (params?: {
    page?: number;
    tenant?: string;
    action?: string;
  }): Promise<PaginatedResponse<AuditLogEntry>> => {
    const r = await apiClient.get('/super/audit-logs/', { params });
    return r.data;
  },

  // ── Super-admin: Stats ───────────────────────────────────────────
  getStats: async (): Promise<PlatformStats> => {
    const r = await apiClient.get('/super/stats/');
    return r.data;
  },

  // ── Auth: company-code validation (AllowAny) ─────────────────────
  validateCompanyCode: async (company_code: string): Promise<ValidateCompanyCodeResponse> => {
    const r = await apiClient.post('/auth/validate-company-code/', { company_code });
    return r.data;
  },
};
