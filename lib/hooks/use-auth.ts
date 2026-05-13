import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi } from '@/lib/api/auth';
import { useAuthStore } from '@/lib/store/auth-store';
import { useRouter } from 'next/navigation';

export function useAuth() {
  const { setAuth, logout: logoutStore, user, isAuthenticated } = useAuthStore();
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
    onSuccess: (data) => {
      // Don't auto-login - user needs approval first
      // Show success message and redirect to login
      const { toast } = require('@/lib/hooks/use-toast');
      toast('Registration successful! Your account is pending approval. You will be notified once approved.', 'success');
      router.push('/login');
    },
    onError: (error: any) => {
      const { toast } = require('@/lib/hooks/use-toast');
      // Handle password validation errors
      if (error?.response?.data?.password) {
        const passwordErrors = error.response.data.password;
        if (Array.isArray(passwordErrors)) {
          // Show first error
          toast(passwordErrors[0], 'error');
        } else {
          toast(String(passwordErrors), 'error');
        }
      } else if (error?.response?.data?.error) {
        toast(error.response.data.error, 'error');
      } else if (error?.response?.data?.message) {
        toast(error.response.data.message, 'error');
      } else {
        // Try to extract error from non-field errors
        const nonFieldErrors = error?.response?.data?.non_field_errors;
        if (nonFieldErrors && Array.isArray(nonFieldErrors)) {
          toast(nonFieldErrors[0], 'error');
        } else {
          toast(error?.message || 'Registration failed. Please check your information and try again.', 'error');
        }
      }
    },
  });

  const logout = () => {
    logoutStore();
    queryClient.clear();
    router.push('/login');
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

