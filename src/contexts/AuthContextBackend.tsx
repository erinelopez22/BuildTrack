import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { authAPI, apiClient } from '@/lib/api';
import type { UserResponseDTO } from '../../backend/src/dto/user.dto';
import type { AppRole } from '@/types/database';

interface AuthContextType {
  user: UserResponseDTO | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  // Legacy-friendly names used by UI
  signIn?: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp?: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signOut?: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
  isAdmin: () => boolean;
  isSuperAdmin: () => boolean;
  canCreateOrders: () => boolean;
  canApproveOrders: () => boolean;
  canManageInventory: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProviderBackend({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserResponseDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Initialize auth from stored token
  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('auth_token');
      const storedUser = localStorage.getItem('user');

      if (token && storedUser) {
        try {
          apiClient.setAuthToken(token);
          setUser(JSON.parse(storedUser));
          setIsAuthenticated(true);
        } catch (error) {
          localStorage.removeItem('auth_token');
          localStorage.removeItem('user');
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const response = await authAPI.login({ email, password });
      apiClient.setAuthToken(response.access_token);
      localStorage.setItem('user', JSON.stringify(response.user));
      setUser(response.user);
      setIsAuthenticated(true);
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  }, []);

  const logout = useCallback(() => {
    authAPI.logout();
    setUser(null);
    setIsAuthenticated(false);
  }, []);

  // Legacy-compatible wrappers
  const signIn = useCallback(async (email: string, password: string) => {
    try {
      await login(email, password);
      return { error: null };
    } catch (error: any) {
      return { error };
    }
  }, [login]);

  const signUp = useCallback(async (email: string, password: string, fullName: string) => {
    // Registration via frontend is not supported by backend API at this time.
    return { error: new Error('Registration not supported. Contact administrator.') };
  }, []);

  const signOut = useCallback(async () => {
    logout();
  }, [logout]);

  const hasRole = useCallback(
    (role: AppRole) => {
      return user?.roles?.includes(role) || false;
    },
    [user]
  );

  const isAdmin = useCallback(() => {
    return hasRole('admin') || hasRole('super_admin');
  }, [hasRole]);

  const isSuperAdmin = useCallback(() => {
    return hasRole('super_admin');
  }, [hasRole]);

  const canCreateOrders = useCallback(() => {
    return hasRole('procurement') || hasRole('admin') || hasRole('super_admin');
  }, [hasRole]);

  const canApproveOrders = useCallback(() => {
    return hasRole('approver') || hasRole('admin') || hasRole('super_admin');
  }, [hasRole]);

  const canManageInventory = useCallback(() => {
    return hasRole('storekeeper') || isAdmin();
  }, [hasRole, isAdmin]);

  const value: AuthContextType = {
    user,
    isAuthenticated,
    loading,
    login,
    logout,
    signIn,
    signUp,
    signOut,
    hasRole,
    isAdmin,
    isSuperAdmin,
    canCreateOrders,
    canApproveOrders,
    canManageInventory,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthBackend() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthBackend must be used within AuthProviderBackend');
  }
  return context;
}
