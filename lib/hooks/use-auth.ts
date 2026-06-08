import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi } from '@/lib/api/auth';
import { useAuthStore } from '@/lib/store/auth-store';
import { useRouter } from 'next/navigation';
import { toast } from '@/lib/hooks/use-toast';
import { getApiError } from '@/lib/utils/error';

export function useAuth() {
  const { setAuth, logout: logoutStore, user, isAuthenticated, isPlatformAdmin } = useAuthStore();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: currentUser, isLoading } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: authApi.me,
    enabled: isAuthenticated,
    retry: false,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

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
      router.push('/');
    },
    onError: (error: unknown) => {
      toast(getApiError(error, 'Registration failed. Please check your information and try again.'), 'error');
    },
  });

  const logout = () => {
    const wasAdmin = isPlatformAdmin;
    const lastCode = typeof window !== 'undefined'
      ? localStorage.getItem('last_company_code')
      : null;

    // For tenant users: mark the saved code as validated so company-login
    // skips step 1 entirely on next visit (user already belongs to that company)
    if (!wasAdmin && lastCode && typeof window !== 'undefined') {
      localStorage.setItem('last_company_validated', 'true');
    }

    logoutStore();       // clears tokens + auth state (NOT last_company_* keys)
    queryClient.clear(); // clears all cached queries

    if (wasAdmin) {
      router.push('/platform-login');
    } else if (lastCode) {
      router.push('/company-login');
    } else {
      router.push('/');
    }
  };

  return {
    user: currentUser || user,
    isLoading,
    isAuthenticated,
    login: loginMutation.mutate,
    register: registerMutation.mutate,
    logout,
    isLoggingIn: loginMutation.isPending,
    isRegistering: registerMutation.isPending,
  };
}

