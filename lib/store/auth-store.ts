import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { User } from '@/types';
import { decodeJwt } from '@/lib/utils/jwt';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  /** UUID of the tenant this user belongs to (from JWT claim). */
  tenantId: string | null;
  /** True for ERB platform staff who manage all tenants. */
  isPlatformAdmin: boolean;
  /** Module keys enabled for this user's tenant (from JWT claim). */
  enabledModules: string[];
  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  setUser: (user: User) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  logout: () => void;
}

function setCookie(name: string, value: string, days = 1) {
  if (typeof document === 'undefined') return;
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${value};expires=${expires};path=/;SameSite=Strict`;
}

function deleteCookie(name: string) {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;SameSite=Strict`;
}

function saveTokens(access: string, refresh: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('access_token', access);
  localStorage.setItem('refresh_token', refresh);
  setCookie('access_token', access, 1);
}

function clearTokens() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  deleteCookie('access_token');
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      tenantId: null,
      isPlatformAdmin: false,
      enabledModules: [],

      setAuth: (user, accessToken, refreshToken) => {
        saveTokens(accessToken, refreshToken);
        const claims = decodeJwt(accessToken);
        set({
          user,
          accessToken,
          refreshToken,
          isAuthenticated: true,
          tenantId: claims.tenant_id ?? null,
          isPlatformAdmin: claims.is_platform_admin ?? false,
          enabledModules: claims.modules ?? [],
        });
      },

      setUser: (user) => set({ user }),

      setTokens: (accessToken, refreshToken) => {
        saveTokens(accessToken, refreshToken);
        const claims = decodeJwt(accessToken);
        set({
          accessToken,
          refreshToken,
          tenantId: claims.tenant_id ?? null,
          isPlatformAdmin: claims.is_platform_admin ?? false,
          enabledModules: claims.modules ?? [],
        });
      },

      logout: () => {
        clearTokens();
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          tenantId: null,
          isPlatformAdmin: false,
          enabledModules: [],
        });
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
        tenantId: state.tenantId,
        isPlatformAdmin: state.isPlatformAdmin,
        enabledModules: state.enabledModules,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.accessToken && state?.isAuthenticated) {
          setCookie('access_token', state.accessToken, 1);
        }
      },
    }
  )
);
