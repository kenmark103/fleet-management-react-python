import React from 'react';
import { authClient } from './authClient';
import type { Session, User } from './types';

type AuthContextValue = {
  user: User | null;
  authenticated: boolean;
  loading: boolean;
  loginWithGoogle: () => void;
  loginWithPassword: (email: string, password: string) => Promise<void>;
  register: (payload: { email: string; password: string; name?: string }) => Promise<void>;
  refreshSession: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [authenticated, setAuthenticated] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

  const refreshSession = React.useCallback(async () => {
    setLoading(true);
    try {
      const session: Session = await authClient.getCurrentUser();
      setUser(session.user);
      setAuthenticated(session.authenticated);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const loginWithGoogle = React.useCallback(() => {
    authClient.loginWithGoogle();
  }, []);

  const loginWithPassword = React.useCallback(async (email: string, password: string) => {
    await authClient.loginWithPassword(email, password);
    await refreshSession();
  }, [refreshSession]);

  const register = React.useCallback(async (payload: { email: string; password: string; name?: string }) => {
    await authClient.register(payload);
  }, []);

  const logout = React.useCallback(async () => {
    await authClient.logout();
    await refreshSession();
  }, [refreshSession]);

  const value: AuthContextValue = {
    user, authenticated, loading,
    loginWithGoogle, loginWithPassword, register, refreshSession, logout
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider />');
  return ctx;
}

// Export for router context use (guards)
export { authClient };
export type { AuthContextValue };