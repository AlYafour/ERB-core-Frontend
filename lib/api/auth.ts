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

  updateMe: async (data: Partial<User>): Promise<User> => {
    // Check if avatar is a File object (for upload)
    const formData = new FormData();
    let hasFile = false;
    
    Object.keys(data).forEach((key) => {
      const value = (data as any)[key];
      if (key === 'avatar' && value instanceof File) {
        formData.append('avatar', value);
        hasFile = true;
      } else if (key !== 'avatar' && value !== undefined && value !== null) {
        // Handle boolean values
        if (typeof value === 'boolean') {
          formData.append(key, value ? 'true' : 'false');
        } else {
          formData.append(key, value.toString());
        }
      }
    });
    
    // If there's a file, use FormData, otherwise use JSON
    if (hasFile) {
      const response = await apiClient.patch('/auth/me/', formData);
      return response.data;
    } else {
      const response = await apiClient.patch('/auth/me/', data);
      return response.data;
    }
  },

  refreshToken: async (refresh: string): Promise<{ access: string }> => {
    const response = await apiClient.post('/auth/token/refresh/', { refresh });
    return response.data;
  },
};

