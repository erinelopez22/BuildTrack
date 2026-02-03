import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { request, setApiTokenGetter } from '@/integrations/api';
import type { Profile, AppRole } from '@/types/database';

/** Minimal user shape returned by the .NET API (camelCase in JSON). */
interface ApiUser {
  id: string;
  email: string;
  fullName?: string | null;
  roles?: string[];
}

interface AuthContextType {
  
  user: ApiUser | null;
  session: { accessToken: string } | null;
  profile: Profile | null;
  roles: AppRole[];
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
  isAdmin: () => boolean;
  isSuperAdmin: () => boolean;
  isApprover: () => boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'stockwell_access_token';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [session, setSession] = useState<{ accessToken: string } | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const setToken = useCallback((token: string | null) => {
    console.log('setToken', token);
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
      setApiTokenGetter(() => token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
      setApiTokenGetter(null);
    }
  }, []);

  const fetchMe = useCallback(async (token: string) => {
    console.log('fetchMe', token);
    const data = await request<{
      id: string;
      email: string;
      fullName: string | null;
      phone: string | null;
      avatarUrl: string | null;
      isActive: boolean;
      roles: string[];
      createdAt: string;
      updatedAt: string;
    }>('/Api/auth/me', { token });
    setProfile({
      id: data.id,
      email: data.email,
      full_name: data.fullName,
      phone: data.phone,
      avatar_url: data.avatarUrl,
      sms_opt_in: false,
      notification_preferences: { email: true, sms: false, push: true },
      is_active: data.isActive,
      created_at: data.createdAt,
      updated_at: data.updatedAt,
    });
    setRoles((data.roles || []) as AppRole[]);
    setUser({ id: data.id, email: data.email, fullName: data.fullName, roles: data.roles });
  }, []);

  const refreshProfile = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      try {
        await fetchMe(token);
      } catch {
        setToken(null);
        setUser(null);
        setSession(null);
        setProfile(null);
        setRoles([]);
      }
    }
  }, [fetchMe, setToken]);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setLoading(false);
      return;
    }
    setToken(token);
    setSession({ accessToken: token });
    request<{ id: string; email: string; fullName: string | null; roles: string[] }>('/api/auth/me', { token })
      .then((data) => {
        setUser({ id: data.id, email: data.email, fullName: data.fullName, roles: data.roles });
        setRoles((data.roles || []) as AppRole[]);
        setProfile({
          id: data.id,
          email: data.email,
          full_name: data.fullName ?? null,
          phone: null,
          avatar_url: null,
          sms_opt_in: false,
          notification_preferences: { email: true, sms: false, push: true },
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        setApiTokenGetter(null);
        setUser(null);
        setSession(null);
        setProfile(null);
        setRoles([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const signIn = async (email: string, password: string) => {
console.log('signIn', email, password);
    try {
      const data = await request<{
        accessToken: string;
        user: { id: string; email: string; fullName?: string | null; roles: string[] };
      }>('/api/Auth/login', {
        method: 'POST',
        body: { email, password },
      });
      
      setToken(data.accessToken);
      setSession({ accessToken: data.accessToken });
      setUser({
        id: data.user.id,
        email: data.user.email,
        fullName: data.user.fullName,
        roles: data.user.roles,
      });
      setRoles((data.user.roles || []) as AppRole[]);
      setProfile({
        id: data.user.id,
        email: data.user.email,
        full_name: data.user.fullName ?? null,
        phone: null,
        avatar_url: null,
        sms_opt_in: false,
        notification_preferences: { email: true, sms: false, push: true },
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err : new Error('Login failed') };
    }
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    try {
      const data = await request<{
        accessToken: string;
        user: { id: string; email: string; fullName?: string | null; roles: string[] };
      }>('/api/auth/register', {
        method: 'POST',
        body: { email, password, fullName },
      });
      setToken(data.accessToken);
      setSession({ accessToken: data.accessToken });
      setUser({
        id: data.user.id,
        email: data.user.email,
        fullName: data.user.fullName,
        roles: data.user.roles,
      });
      setRoles((data.user.roles || []) as AppRole[]);
      setProfile({
        id: data.user.id,
        email: data.user.email,
        full_name: data.user.fullName ?? null,
        phone: null,
        avatar_url: null,
        sms_opt_in: false,
        notification_preferences: { email: true, sms: false, push: true },
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err : new Error('Registration failed') };
    }
  };

  const signOut = async () => {
    setToken(null);
    setUser(null);
    setSession(null);
    setProfile(null);
    setRoles([]);
  };

  const hasRole = (role: AppRole) => roles.includes(role);
  const isAdmin = () => hasRole('admin' as AppRole) || hasRole('super_admin' as AppRole);
  const isSuperAdmin = () => hasRole('super_admin' as AppRole);
  const isApprover = () => hasRole('approver' as AppRole) || hasRole('admin' as AppRole) || hasRole('super_admin' as AppRole);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        roles,
        loading,
        signIn,
        signUp,
        signOut,
        hasRole,
        isAdmin,
        isSuperAdmin,
        isApprover,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
