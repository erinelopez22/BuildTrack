import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader } from '@/components/common/PageHeader';
import { DataTable, Column } from '@/components/common/DataTable';
import { EmptyState } from '@/components/common/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Plus, Users, Search, UserPlus, Shield } from 'lucide-react';
import type { Profile, UserRole, AppRole } from '@/types/database';

interface UserWithRoles extends Profile {
  roles: UserRole[];
}

const roleLabels: Record<AppRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  office_admin: 'Office Admin',
  warehouse_admin: 'Warehouse Admin',
  project_engineer: 'Project/Site Engineer',
  receiver: 'Receiver',
  tracking_driver: 'Tracking Driver',
  project_manager: 'Project Manager',
  procurement: 'Procurement',
  storekeeper: 'Storekeeper',
  site_lead: 'Site Lead',
  viewer: 'Viewer',
  approver: 'Approver',
  approval_admin: 'Approval Admin (Legacy)',
  logistics_admin: 'Logistics Admin (Legacy)',
};

const roleOptions: AppRole[] = [
  'super_admin',
  'admin',
  'office_admin',
  'warehouse_admin',
  'project_engineer',
  'receiver',
  'tracking_driver',
  'project_manager',
  'storekeeper',
  'site_lead',
  'viewer',
];

export default function UsersPage() {
  const { isAdmin, isSuperAdmin, user: authUser } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [selectedRole, setSelectedRole] = useState<AppRole>('viewer');

  const fetchUsers = async () => {
    // Fetch profiles
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (profilesError) {
      toast({ title: 'Error', description: profilesError.message, variant: 'destructive' });
      setLoading(false);
      return;
    }

    // Fetch roles
    const { data: rolesData } = await supabase
      .from('user_roles')
      .select('*');

    // Combine profiles with their roles
    const usersWithRoles = (profilesData || []).map((profile) => ({
      ...profile,
      roles: (rolesData || []).filter((role) => role.user_id === profile.id) as UserRole[],
    })) as UserWithRoles[];

    setUsers(usersWithRoles);
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin()) {
      fetchUsers();
    } else {
      setLoading(false);
    }
  }, [isAdmin]);

  const handleAssignRole = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedUser) return;

    // Only Super Admin can assign super_admin role
    if (selectedRole === 'super_admin' && !isSuperAdmin()) {
      toast({
        title: 'Permission Denied',
        description: 'Only Super Admin can assign Super Admin role',
        variant: 'destructive',
      });
      return;
    }

    const { error } = await supabase.from('user_roles').insert({
      user_id: selectedUser.id,
      role: selectedRole,
    });

    if (error) {
      if (error.code === '23505') {
        toast({
          title: 'Error',
          description: 'User already has this role',
          variant: 'destructive',
        });
      } else {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      }
    } else {
      toast({ title: 'Success', description: 'Role assigned successfully' });
      setIsDialogOpen(false);
      setSelectedUser(null);
      fetchUsers();
    }
  };

  const handleRemoveRole = async (userId: string, roleId: string) => {
    // Find the role being removed
    const userToModify = users.find(u => u.id === userId);
    const roleToRemove = userToModify?.roles.find(r => r.id === roleId);
    
    // Only Super Admin can remove super_admin role
    if (roleToRemove?.role === 'super_admin' && !isSuperAdmin()) {
      toast({
        title: 'Permission Denied',
        description: 'Only Super Admin can remove Super Admin role',
        variant: 'destructive',
      });
      return;
    }

    // Prevent removing your own super_admin role
    if (roleToRemove?.role === 'super_admin' && userId === authUser?.id) {
      toast({
        title: 'Cannot Remove',
        description: 'You cannot remove your own Super Admin role',
        variant: 'destructive',
      });
      return;
    }

    const { error } = await supabase
      .from('user_roles')
      .delete()
      .eq('id', roleId);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Role removed successfully' });
      fetchUsers();
    }
  };

  if (!isAdmin()) {
    return (
      <div className="animate-fade-in">
        <PageHeader title="Users & Roles" />
        <EmptyState
          icon={Shield}
          title="Access Denied"
          description="You don't have permission to view this page. Only administrators can manage users and roles."
        />
      </div>
    );
  }

  const filteredUsers = users.filter(
    (user) =>
      user.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      user.email?.toLowerCase().includes(search.toLowerCase())
  );

  const columns: Column<UserWithRoles>[] = [
    {
      key: 'user',
      header: 'User',
      render: (user) => (
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            {user.full_name?.charAt(0) || user.email?.charAt(0) || 'U'}
          </div>
          <div>
            <p className="font-medium">{user.full_name || 'Unknown'}</p>
            <p className="text-xs text-muted-foreground">{user.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'phone',
      header: 'Phone',
      render: (user) => user.phone || '-',
    },
    {
      key: 'roles',
      header: 'Roles',
      render: (user) => (
        <div className="flex flex-wrap gap-1">
          {user.roles.length > 0 ? (
            user.roles.map((role) => {
              // Only super_admin can remove super_admin roles, and users can't remove their own super_admin
              const canRemove = role.role !== 'super_admin' || (isSuperAdmin() && user.id !== authUser?.id);
              return (
                <Badge
                  key={role.id}
                  variant="secondary"
                  className={canRemove ? 'cursor-pointer hover:bg-destructive/20' : 'cursor-not-allowed'}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (canRemove) {
                      handleRemoveRole(user.id, role.id);
                    }
                  }}
                >
                  {roleLabels[role.role]}
                  {canRemove && <span className="ml-1 text-muted-foreground">×</span>}
                </Badge>
              );
            })
          ) : (
            <span className="text-muted-foreground">No roles</span>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (user) => (
        <span
          className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
            user.is_active
              ? 'bg-success/10 text-success'
              : 'bg-muted text-muted-foreground'
          }`}
        >
          {user.is_active ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (user) => (
        <Button
          size="sm"
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedUser(user);
            setIsDialogOpen(true);
          }}
        >
          <UserPlus className="h-4 w-4" />
        </Button>
      ),
      className: 'w-12',
    },
  ];

  if (!loading && users.length === 0) {
    return (
      <div className="animate-fade-in">
        <PageHeader
          title="Users & Roles"
          description="Manage user accounts and role assignments"
        />
        <EmptyState
          icon={Users}
          title="No users yet"
          description="Users will appear here once they sign up."
        />
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Users & Roles"
        description="Manage user accounts and role assignments"
      />

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search users..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <DataTable
        columns={columns}
        data={filteredUsers}
        loading={loading}
        emptyMessage="No users found"
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Role to {selectedUser?.full_name || selectedUser?.email}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAssignRole} className="space-y-4">
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={selectedRole}
                onValueChange={(value: AppRole) => setSelectedRole(value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions
                    .filter((role) => isSuperAdmin() || role !== 'super_admin')
                    .map((role) => (
                    <SelectItem key={role} value={role}>
                      {roleLabels[role]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Assign Role</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}