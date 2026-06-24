import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi } from '@/lib/api/auth';
import { useAuthStore } from '@/lib/store/auth-store';
import { useRouter } from 'next/navigation';
import { toast } from '@/lib/hooks/use-toast';
import { getApiError } from '@/lib/utils/error';

export function useAuth() {
  const { setAuth, logout: logoutStore, user, isAuthenticated, _hasHydrated } = useAuthStore();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: currentUser, isLoading: isQueryLoading } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: authApi.me,
    enabled: _hasHydrated && isAuthenticated,
    retry: false,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  // Treat pre-hydration as loading — prevents RouteGuard from redirecting
  // during the brief window between JS init and localStorage restore.
  const isLoading = !_hasHydrated || isQueryLoading;

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
    isAuthenticated: _hasHydrated && isAuthenticated,
    login: loginMutation.mutate,
    register: registerMutation.mutate,
    logout,
    isLoggingIn: loginMutation.isPending,
    isRegistering: registerMutation.isPending,
  };
}

