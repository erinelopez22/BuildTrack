import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { Profile, UserRole, AppRole } from '@/types/database';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: AppRole[];
  loading: boolean;
  signIn: (loginId: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
  isAdmin: () => boolean;
  isSuperAdmin: () => boolean;
  isApprover: () => boolean;
  isOfficeAdmin: () => boolean;
  isWarehouseAdmin: () => boolean;
  isProjectEngineer: () => boolean;
  isReceiver: () => boolean;
  canCreateOrders: () => boolean;
  canApproveOrders: () => boolean;
  canProcessLogistics: () => boolean;
  canReceiveOrders: () => boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (profileData) {
      setProfile(profileData as unknown as Profile);
    }
  }, []);

  const fetchRoles = useCallback(async (userId: string) => {
    const { data: rolesData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);
    
    if (rolesData) {
      setRoles(rolesData.map(r => r.role as AppRole));
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) {
      await Promise.all([fetchProfile(user.id), fetchRoles(user.id)]);
    }
  }, [user, fetchProfile, fetchRoles]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          setTimeout(() => {
            fetchProfile(session.user.id);
            fetchRoles(session.user.id);
          }, 0);
        } else {
          setProfile(null);
          setRoles([]);
        }
        
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchProfile(session.user.id);
        fetchRoles(session.user.id);
      }
      
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile, fetchRoles]);

  const signIn = async (loginId: string, password: string) => {
    let email = loginId;

    // If it doesn't look like an email, try to look up the email by username
    if (!loginId.includes('@')) {
      const { data: profileData, error: lookupError } = await supabase
        .from('profiles')
        .select('email')
        .ilike('username', loginId.trim())
        .single();

      if (lookupError || !profileData) {
        return { error: new Error('Invalid username or password') };
      }
      email = profileData.email;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const hasRole = (role: AppRole) => roles.includes(role);
  const isAdmin = () => hasRole('admin') || hasRole('super_admin');
  const isSuperAdmin = () => hasRole('super_admin');
  const isApprover = () => hasRole('approver') || hasRole('admin') || hasRole('super_admin');
  const isOfficeAdmin = () => hasRole('office_admin') || hasRole('approval_admin') || hasRole('admin') || hasRole('super_admin');
  const isWarehouseAdmin = () => hasRole('warehouse_admin') || hasRole('logistics_admin') || hasRole('admin') || hasRole('super_admin');
  const isProjectEngineer = () => hasRole('project_engineer') || hasRole('project_manager') || hasRole('site_lead');
  const isReceiver = () => hasRole('receiver') || hasRole('storekeeper');

  const canCreateOrders = () => 
    hasRole('super_admin') || hasRole('admin') || 
    hasRole('project_engineer') || hasRole('project_manager') || hasRole('site_lead');

  const canApproveOrders = () => 
    hasRole('super_admin') || hasRole('admin') || 
    hasRole('office_admin') || hasRole('approval_admin') || hasRole('approver');

  const canProcessLogistics = () => 
    hasRole('super_admin') || hasRole('admin') || 
    hasRole('warehouse_admin') || hasRole('logistics_admin');

  const canReceiveOrders = () => 
    hasRole('super_admin') || hasRole('admin') || 
    hasRole('project_engineer') || hasRole('project_manager') || 
    hasRole('site_lead') || hasRole('receiver') || hasRole('storekeeper');

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
        isReceiver,
        canCreateOrders,
        canApproveOrders,
        canProcessLogistics,
        canReceiveOrders,
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
