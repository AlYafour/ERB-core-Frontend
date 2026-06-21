import apiClient from './client';
import { AuthResponse, User } from '@/types';

export const authApi = {
  register: async (data: {
    username: string;
    email: string;
    password: string;
    password2: string;
    first_name?: string;
    last_name?: string;
    role?: string;
    phone?: string;
  }): Promise<AuthResponse> => {
    const response = await apiClient.post('/auth/register/', data);
    return response.data;
  },

  login: async (username: string, password: string): Promise<AuthResponse> => {
    const response = await apiClient.post('/auth/login/', { username, password });
    return response.data;
  },

  me: async (): Promise<User> => {
    const response = await apiClient.get('/auth/me/');
    return response.data;
  },

};

