import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { authApi, tokenStore, type UserSession } from '@/lib/apiClient';
import type { AppRole } from '@/types/database';

// Re-export a slim Profile type from the API user session
export type Profile = UserSession & {
  address?: string;
  is_active?: boolean;
  notification_preferences?: string | null;
  avatar_url?: string;
  sms_opt_in?: boolean;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
};

interface AuthContextType {
  user: UserSession | null;
  /** @deprecated use user instead - kept for compatibility */
  session: { user: UserSession } | null;
  profile: Profile | null;
  roles: AppRole[];
  loading: boolean;
  signIn: (loginId: string, password: string, companyId?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
  isAdmin: () => boolean;
  isSuperAdmin: () => boolean;
  isApprover: () => boolean;
  isOfficeAdmin: () => boolean;
  isWarehouseAdmin: () => boolean;
  isProjectEngineer: () => boolean;
  isChecker: () => boolean;
  isDriver: () => boolean;
  isReceiver: () => boolean;
  canCreateOrders: () => boolean;
  canCreateProjects: () => boolean;
  canApproveOrders: () => boolean;
  canProcessLogistics: () => boolean;
  canReceiveOrders: () => boolean;
  canManageTeam: () => boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserSession | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const hydrateFromSession = useCallback((sessionUser: UserSession) => {
    setUser(sessionUser);
    setRoles((sessionUser.roles ?? []) as AppRole[]);
  }, []);

  const refreshProfile = useCallback(async () => {
    const res = await authApi.me();
    if (res.success && res.data) hydrateFromSession(res.data);
  }, [hydrateFromSession]);

  // On mount: check if we have a valid token and restore session
  useEffect(() => {
    const token = tokenStore.getAccess();
    if (!token) {
      setLoading(false);
      return;
    }
    authApi.me()
      .then(res => {
        if (res.success && res.data) hydrateFromSession(res.data);
        else tokenStore.clear();
      })
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false));
  }, [hydrateFromSession]);

  const signIn = async (loginId: string, password: string, companyId?: string): Promise<{ error: Error | null }> => {
    const res = await authApi.login(loginId, password, companyId);
    if (!res.success || !res.data) {
      return { error: new Error(res.message ?? 'Invalid credentials') };
    }
    tokenStore.set(res.data.accessToken, res.data.refreshToken);
    hydrateFromSession(res.data.user);
    return { error: null };
  };

  const signOut = async () => {
    await authApi.logout().catch(() => {});
    tokenStore.clear();
    setUser(null);
    setRoles([]);
  };

  // ── Role helpers (identical logic to original) ────────────────────────────

  const hasRole = (role: AppRole) => roles.includes(role);
  const isAdmin = () => hasRole('admin') || hasRole('super_admin');
  const isSuperAdmin = () => hasRole('super_admin');
  const isApprover = () =>
    hasRole('office_admin') || hasRole('admin') || hasRole('super_admin') ||
    hasRole('approver') || hasRole('approval_admin');
  const isOfficeAdmin = () => hasRole('office_admin');
  const isWarehouseAdmin = () => hasRole('warehouse_admin');
  const isProjectEngineer = () => hasRole('project_engineer');
  const isChecker = () => hasRole('checker');
  const isDriver = () => hasRole('driver') || hasRole('tracking_driver');
  const isReceiver = () => hasRole('checker') || hasRole('project_engineer') || hasRole('receiver');

  const canCreateOrders = () =>
    hasRole('super_admin') || hasRole('admin') || hasRole('project_engineer');
  const canCreateProjects = () =>
    hasRole('super_admin') || hasRole('admin') || hasRole('project_engineer') ||
    hasRole('project_manager');
  const canApproveOrders = () =>
    hasRole('super_admin') || hasRole('admin') || hasRole('office_admin') ||
    hasRole('approver') || hasRole('approval_admin');
  const canProcessLogistics = () =>
    hasRole('super_admin') || hasRole('admin') || hasRole('warehouse_admin') ||
    hasRole('logistics_admin');
  const canReceiveOrders = () =>
    hasRole('super_admin') || hasRole('admin') ||
    hasRole('project_engineer') || hasRole('checker') || hasRole('receiver');
  const canManageTeam = () =>
    hasRole('super_admin') || hasRole('admin') || hasRole('office_admin') ||
    hasRole('project_engineer') || hasRole('project_manager');

  // Build a profile-shaped object from user session for backward compatibility
  const profile: Profile | null = user
    ? {
        ...user,
        avatar_url: user.avatarUrl,
        sms_opt_in: user.smsOptIn,
        is_active: user.isActive,
      }
    : null;

  const session = user ? { user } : null;

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        roles,
        loading,
        signIn,
        signOut,
        hasRole,
        isAdmin,
        isSuperAdmin,
        isApprover,
        isOfficeAdmin,
        isWarehouseAdmin,
        isProjectEngineer,
        isChecker,
        isDriver,
        isReceiver,
        canCreateOrders,
        canCreateProjects,
        canApproveOrders,
        canProcessLogistics,
        canReceiveOrders,
        canManageTeam,
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
