export interface JwtPayload {
  user_id?: number;
  role?: string;
  tenant_id?: string | null;
  is_platform_admin?: boolean;
  modules?: string[];
  exp?: number;
  iat?: number;
}

export function decodeJwt(token: string): JwtPayload {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return {};
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = base64.length % 4;
    const padded = pad ? base64 + '='.repeat(4 - pad) : base64;
    return JSON.parse(atob(padded));
  } catch {
    return {};
  }
}
