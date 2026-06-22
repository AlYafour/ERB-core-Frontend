export interface TenantInfo {
  id: string;
  name: string;
  name_ar?: string;
  slug: string;
  company_code: string;
  status: 'trial' | 'active' | 'inactive' | 'suspended';
  plan?: PlanInfo | null;
  industry?: string;
  country?: string;
  email?: string;
  logo?: string | null;
  max_users: number;
  max_projects?: number;
  trial_ends_at?: string | null;
  subscription_ends_at?: string | null;
  settings?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  modules?: TenantModuleInfo[];
  active_user_count?: number;
  branding?: TenantBrandingData;
}

export interface TenantModuleInfo {
  id: number;
  module_key: string;
  is_enabled: boolean;
  usage_limit?: number | null;
  label?: string;
  label_ar?: string;
}

export interface PlanInfo {
  id: number;
  name: string;
  slug: string;
  tier: 'free' | 'starter' | 'professional' | 'enterprise' | 'custom';
  price_aed: string;
  max_users: number;
  trial_days: number;
  is_active: boolean;
  is_public: boolean;
  sort_order: number;
  plan_modules: { id: number; module_key: string }[];
  tenant_count?: number;
}

export interface AuditLogEntry {
  id: string;
  tenant?: string | null;
  tenant_name?: string | null;
  actor?: number | null;
  actor_username?: string | null;
  action: string;
  resource: string;
  resource_id: string;
  diff?: Record<string, unknown> | null;
  ip_address?: string | null;
  user_agent?: string;
  extra?: Record<string, unknown>;
  created_at: string;
}

export interface PlatformStats {
  total_tenants: number;
  active_tenants: number;
  trial_tenants: number;
  suspended_tenants: number;
  total_plans: number;
  total_users: number;
  platform_admins: number;
  audit_logs_today: number;
}

export interface TenantBrandingData {
  logo_url: string;
  login_bg_url: string;
  primary_color: string;
  company_legal_name: string;
  company_address: string;
  company_phone: string;
  company_email: string;
  company_trn: string;
  default_terms?: string;
  updated_at?: string;
}

export interface ValidateCompanyCodeResponse {
  valid: boolean;
  tenant_id?: string;
  tenant_name?: string;
  plan?: string | null;
  status?: string;
  branding?: Pick<TenantBrandingData, 'logo_url' | 'login_bg_url' | 'primary_color'>;
}
