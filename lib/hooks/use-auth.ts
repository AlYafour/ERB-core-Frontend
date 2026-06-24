import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi } from '@/lib/api/auth';
import { useAuthStore } from '@/lib/store/auth-store';
import { useRouter } from 'next/navigation';
import { toast } from '@/lib/hooks/use-toast';
import { getApiError } from '@/lib/utils/error';

// Typed accessor for Zustand persist API — undefined on the server (no localStorage)
const authPersist = (useAuthStore as unknown as {
  persist?: {
    hasHydrated: () => boolean;
    onFinishHydration: (cb: () => void) => () => void;
  };
}).persist;

export function useAuth() {
  const { setAuth, logout: logoutStore, user, isAuthenticated } = useAuthStore();
  const router = useRouter();
  const queryClient = useQueryClient();

  // Track when Zustand has finished reading from localStorage.
  // Without this, RouteGuard sees user=null on the first render after a hard
  // refresh (before hydration) and redirects to /login → /dashboard.
  // On SSR authPersist is undefined (no localStorage) — default to false, client picks it up
  const [hasHydrated, setHasHydrated] = useState(() => authPersist?.hasHydrated() ?? false);

  useEffect(() => {
    if (hasHydrated || !authPersist) return;
    if (authPersist.hasHydrated()) { setHasHydrated(true); return; }
    return authPersist.onFinishHydration(() => setHasHydrated(true));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: currentUser, isLoading: isQueryLoading } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: authApi.me,
    enabled: hasHydrated && isAuthenticated,
    retry: false,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  // isLoading stays true until: (1) localStorage is read, (2) /me query settles
  const isLoading = !hasHydrated || isQueryLoading;

  const loginMutation = useMutation({
    mutationFn: ({ username, password }: { username: string; password: string }) =>
      authApi.login(username, password),
    onSuccess: (data) => {
      setAuth(data.user, data.tokens.access, data.tokens.refresh);
      queryClient.setQueryData(['auth', 'me'], data.user);
      router.push('/dashboard');
    },
  });

  const registerMutation = useMutation({
    mutationFn: (data: {
      username: string;
      email: string;
      password: string;
      password2: string;
      first_name?: string;
      last_name?: string;
      role?: string;
      phone?: string;
    }) => authApi.register(data),
    onSuccess: () => {
      toast('Registration successful! Your account is pending approval. You will be notified once approved.', 'success');
      router.push('/login');
    },
    onError: (error: unknown) => {
      toast(getApiError(error, 'Registration failed. Please check your information and try again.'), 'error');
    },
  });

  const logout = () => {
    logoutStore();
    queryClient.clear();
    router.push('/company-login');
  };

  return {
    user: currentUser || user,
    isLoading,
    isAuthenticated: hasHydrated && isAuthenticated,
    login: loginMutation.mutate,
    register: registerMutation.mutate,
    logout,
    isLoggingIn: loginMutation.isPending,
    isRegistering: registerMutation.isPending,
  };
}

