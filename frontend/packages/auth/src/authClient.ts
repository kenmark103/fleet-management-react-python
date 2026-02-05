import { api } from './apiClient';
import { setAccessToken, clearAccessToken } from './tokenManager';
import type { Session, User } from './types';

export const authClient = {
  // Redirect user to backend's Google OAuth flow
  loginWithGoogle() {
    const base = (import.meta as any)?.env?.VITE_API_URL || process.env.VITE_API_URL;
    window.location.href = `${base}/auth/google`;
  },

  // Optional: classic email/password login (if you support it)
  async loginWithPassword(email: string, password: string) {
    const res = await api.post('/auth/login', { email, password });
    const access = res.data?.access_token || res.data?.accessToken;
    if (access) setAccessToken(access);
    return res.data;
  },

  async register(payload: { email: string; password: string; name?: string }) {
    return api.post('/auth/register', payload);
  },

  async getCurrentUser(): Promise<Session> {
    try {
      const res = await api.get('/auth/me');
      const user = res.data?.user as User | null;
      const access = res.data?.access_token || res.data?.accessToken || null;
      if (access) setAccessToken(access);
      return { user, authenticated: !!user };
    } catch {
      return { user: null, authenticated: false };
    }
  },

  async logout() {
    try {
      await api.post('/auth/logout'); // server clears cookie
    } finally {
      clearAccessToken();
    }
  }
};