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

  login: async (username: string, password: string): Promise<AuthResponse & { requires_2fa?: boolean; temp_token?: string }> => {
    const response = await apiClient.post('/auth/login/', { username, password });
    return response.data;
  },

  me: async (): Promise<User> => {
    const response = await apiClient.get('/auth/me/');
    return response.data;
  },

  changePassword: async (oldPassword: string, newPassword: string): Promise<{ detail: string; tokens: { access: string; refresh: string } }> => {
    const response = await apiClient.post('/auth/change-password/', {
      old_password: oldPassword,
      new_password: newPassword,
    });
    return response.data;
  },

  // ── 2FA ──────────────────────────────────────────────────────────────────

  twofa: {
    setup: async (): Promise<{ secret: string; qr_code: string; uri: string }> => {
      const response = await apiClient.post('/auth/2fa/setup/');
      return response.data;
    },

    confirm: async (code: string): Promise<{ detail: string }> => {
      const response = await apiClient.post('/auth/2fa/confirm/', { code });
      return response.data;
    },

    disable: async (password: string, code: string): Promise<{ detail: string }> => {
      const response = await apiClient.post('/auth/2fa/disable/', { password, code });
      return response.data;
    },

    verify: async (tempToken: string, code: string): Promise<AuthResponse> => {
      const response = await apiClient.post('/auth/2fa/verify/', { temp_token: tempToken, code });
      return response.data;
    },
  },

  // ── WebAuthn / Passkeys ───────────────────────────────────────────────────

  webauthn: {
    registerBegin: async (deviceName: string): Promise<{ options: Record<string, unknown>; challenge_token: string }> => {
      const response = await apiClient.post('/auth/webauthn/register/begin/', { device_name: deviceName });
      return response.data;
    },

    registerComplete: async (
      credential: Record<string, unknown>,
      challengeToken: string,
      deviceName: string,
    ): Promise<{ detail: string; credentials: { device_name: string }[] }> => {
      const response = await apiClient.post('/auth/webauthn/register/complete/', {
        credential,
        challenge_token: challengeToken,
        device_name: deviceName,
      });
      return response.data;
    },

    loginBegin: async (username: string): Promise<{ options: Record<string, unknown>; challenge_token: string }> => {
      const response = await apiClient.post('/auth/webauthn/login/begin/', { username });
      return response.data;
    },

    loginComplete: async (
      credential: Record<string, unknown>,
      challengeToken: string,
    ): Promise<AuthResponse> => {
      const response = await apiClient.post('/auth/webauthn/login/complete/', {
        credential,
        challenge_token: challengeToken,
      });
      return response.data;
    },

    deleteCredential: async (credentialId: string): Promise<{ detail: string; credentials: { device_name: string }[] }> => {
      const response = await apiClient.delete('/auth/webauthn/credential/', {
        data: { credential_id: credentialId },
      });
      return response.data;
    },
  },
};
