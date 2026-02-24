import { useState, useEffect, useCallback } from 'react';
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
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Plus, Users, Search, UserPlus, Shield, Loader2, Eye, EyeOff, MessageSquare } from 'lucide-react';
import type { Profile, UserRole, AppRole } from '@/types/database';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { SMSNotificationsTab } from '@/components/users/SMSNotificationsTab';

interface UserWithRoles extends Profile {
  roles: UserRole[];
  creator_name?: string;
}

import { ROLE_DISPLAY_NAMES, ACTIVE_ROLES } from '@/types/database';

const roleLabels = ROLE_DISPLAY_NAMES;

const roleOptions: AppRole[] = ACTIVE_ROLES;

export default function UsersPage() {
  const { isAdmin, isSuperAdmin, user: authUser } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Assign role dialog
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [selectedRole, setSelectedRole] = useState<AppRole>('viewer');

  // Add user dialog
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [addUserForm, setAddUserForm] = useState({
    name: '',
    address: '',
    email: '',
    password: '',
    role: 'viewer' as AppRole,
  });
  const [addUserErrors, setAddUserErrors] = useState<Record<string, string>>({});
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [checkingDuplicates, setCheckingDuplicates] = useState<Record<string, boolean>>({});

  // View user modal
  const [viewUser, setViewUser] = useState<UserWithRoles | null>(null);

  const fetchUsers = async () => {
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (profilesError) {
      toast({ title: 'Error', description: profilesError.message, variant: 'destructive' });
      setLoading(false);
      return;
    }

    const { data: rolesData } = await supabase.from('user_roles').select('*');

    const profilesList = profilesData || [];
    const usersWithRoles = profilesList.map((profile) => {
      const creatorProfile = profile.created_by
        ? profilesList.find((p) => p.id === profile.created_by)
        : null;
      return {
        ...profile,
        roles: (rolesData || []).filter((role) => role.user_id === profile.id) as UserRole[],
        creator_name: creatorProfile?.full_name || undefined,
      };
    }) as unknown as UserWithRoles[];

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

    if (selectedRole === 'super_admin' && !isSuperAdmin()) {
      toast({ title: 'Permission Denied', description: 'Only Super Admin can assign Super Admin role', variant: 'destructive' });
      return;
    }

    const { error } = await supabase.from('user_roles').insert({
      user_id: selectedUser.id,
      role: selectedRole,
    });

    if (error) {
      if (error.code === '23505') {
        toast({ title: 'Error', description: 'User already has this role', variant: 'destructive' });
      } else {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      }
    } else {
      toast({ title: 'Success', description: 'Role assigned successfully' });
      setIsRoleDialogOpen(false);
      setSelectedUser(null);
      fetchUsers();
    }
  };

  const handleRemoveRole = async (userId: string, roleId: string) => {
    const userToModify = users.find(u => u.id === userId);
    const roleToRemove = userToModify?.roles.find(r => r.id === roleId);

    if (roleToRemove?.role === 'super_admin' && !isSuperAdmin()) {
      toast({ title: 'Permission Denied', description: 'Only Super Admin can remove Super Admin role', variant: 'destructive' });
      return;
    }

    if (roleToRemove?.role === 'super_admin' && userId === authUser?.id) {
      toast({ title: 'Cannot Remove', description: 'You cannot remove your own Super Admin role', variant: 'destructive' });
      return;
    }

    const { error } = await supabase.from('user_roles').delete().eq('id', roleId);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Role removed successfully' });
      fetchUsers();
    }
  };

  // --- Debounced duplicate checks ---
  const checkDuplicate = useCallback(async (field: 'email', value: string) => {
    const trimmed = value.trim().toLowerCase();
    if (!trimmed) return;

    setCheckingDuplicates(prev => ({ ...prev, [field]: true }));

    if (field === 'email') {
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .ilike('email', trimmed)
        .limit(1);
      if (data && data.length > 0) {
        setAddUserErrors(prev => ({ ...prev, email: 'Email already exists.' }));
      }
    }

    setCheckingDuplicates(prev => ({ ...prev, [field]: false }));
  }, []);

  // Debounce timer refs
  const [debounceTimers] = useState<Record<string, ReturnType<typeof setTimeout>>>({});

  const handleFieldBlur = (field: 'email') => {
    const value = addUserForm.email;
    if (value.trim()) {
      checkDuplicate(field, value);
    }
  };

  const handleFieldChangeDebounced = (field: 'email', value: string) => {
    setAddUserForm(p => ({ ...p, [field]: value }));
    setAddUserErrors(p => ({ ...p, [field]: '' }));

    if (debounceTimers[field]) clearTimeout(debounceTimers[field]);
    debounceTimers[field] = setTimeout(() => {
      if (value.trim()) checkDuplicate(field, value);
    }, 600);
  };

  const handleAddUserRoleChange = (role: AppRole) => {
    const newForm = { ...addUserForm, role };
    if (role === 'tracking_driver') {
      if (!newForm.email) newForm.email = 'driver@gmail.com';
      if (!newForm.password) newForm.password = 'password';
    }
    setAddUserForm(newForm);
  };

  const validateAddUserForm = () => {
    const errors: Record<string, string> = {};
    if (!addUserForm.name.trim()) errors.name = 'Name is required';
    if (!addUserForm.address.trim()) errors.address = 'Address is required';
    if (!addUserForm.email.trim()) errors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addUserForm.email.trim())) errors.email = 'Invalid email format';
    if (!addUserForm.password) errors.password = 'Password is required';
    else if (addUserForm.password.length < 6) errors.password = 'Password must be at least 6 characters';
    if (!addUserForm.role) errors.role = 'Role is required';
    if (addUserForm.role === 'super_admin' && !isSuperAdmin()) errors.role = 'Only Super Admin can assign this role';
    setAddUserErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const isFormValid = () => {
    const f = addUserForm;
    if (!f.name.trim() || !f.address.trim() || !f.email.trim() || !f.password) return false;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) return false;
    if (f.password.length < 6) return false;
    if (f.role === 'super_admin' && !isSuperAdmin()) return false;
    if (addUserErrors.email) return false;
    return true;
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateAddUserForm()) return;

    setIsCreatingUser(true);
    try {
      const response = await supabase.functions.invoke('admin-create-user', {
        body: {
          name: addUserForm.name.trim(),
          address: addUserForm.address.trim(),
          email: addUserForm.email.trim(),
          username: addUserForm.email.trim().toLowerCase(),
          password: addUserForm.password,
          role: addUserForm.role,
        },
      });

      if (response.error) {
        const errMsg = response.error.message || 'Failed to create user';
        toast({ title: 'Error', description: errMsg, variant: 'destructive' });
      } else if (response.data?.error) {
        const errMsg = response.data.error;
        if (errMsg.includes('Email already exists')) {
          setAddUserErrors(prev => ({ ...prev, email: errMsg }));
        } else {
          toast({ title: 'Error', description: errMsg, variant: 'destructive' });
        }
      } else {
        toast({ title: 'Success', description: 'User created successfully. They can now log in.' });
        setIsAddUserOpen(false);
        setAddUserForm({ name: '', address: '', email: '', password: '', role: 'viewer' });
        setAddUserErrors({});
        fetchUsers();
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to create user', variant: 'destructive' });
    }
    setIsCreatingUser(false);
  };

  if (!isAdmin()) {
    return (
      <div className="animate-fade-in">
        <PageHeader title="Users & Roles" />
        <EmptyState icon={Shield} title="Access Denied" description="You don't have permission to view this page." />
      </div>
    );
  }

  const filteredUsers = users.filter(
    (user) =>
      user.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      user.email?.toLowerCase().includes(search.toLowerCase()) ||
      (user as any).username?.toLowerCase().includes(search.toLowerCase())
  );

  const formatManilaTime = (dateStr: string) => {
    try {
      const zonedDate = toZonedTime(new Date(dateStr), 'Asia/Manila');
      return format(zonedDate, 'MMM dd, yyyy hh:mm a');
    } catch {
      return dateStr;
    }
  };

  const columns: Column<UserWithRoles>[] = [
    {
      key: 'user',
      header: 'Name',
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
      key: 'roles',
      header: 'Role',
      render: (user) => (
        <div className="flex flex-wrap gap-1">
          {user.roles.length > 0 ? (
            user.roles.map((role) => {
              const canRemove = role.role !== 'super_admin' || (isSuperAdmin() && user.id !== authUser?.id);
              return (
                <Badge
                  key={role.id}
                  variant="secondary"
                  className={canRemove ? 'cursor-pointer hover:bg-destructive/20' : 'cursor-not-allowed'}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (canRemove) handleRemoveRole(user.id, role.id);
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
      key: 'address',
      header: 'Address',
      render: (user) => (user as any).address || '-',
    },
    {
      key: 'created_at',
      header: 'Date Created',
      render: (user) => formatManilaTime(user.created_at),
    },
    {
      key: 'created_by',
      header: 'Created By',
      render: (user) => user.creator_name || '-',
    },
    {
      key: 'status',
      header: 'Status',
      render: (user) => (
        <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
          user.is_active ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'
        }`}>
          {user.is_active ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (user) => (
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={(e) => {
            e.stopPropagation();
            setViewUser(user);
          }} title="View Details">
            <Eye className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={(e) => {
            e.stopPropagation();
            setSelectedUser(user);
            setIsRoleDialogOpen(true);
          }} title="Assign Role">
            <UserPlus className="h-4 w-4" />
          </Button>
        </div>
      ),
      className: 'w-24',
    },
  ];

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Users & Roles"
        description="Manage user accounts and role assignments"
        action={
          <Button onClick={() => setIsAddUserOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add User
          </Button>
        }
      />

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">
            <Users className="mr-2 h-4 w-4" />
            Users & Roles
          </TabsTrigger>
          <TabsTrigger value="sms">
            <MessageSquare className="mr-2 h-4 w-4" />
            SMS Notifications
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4 mt-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search users..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>

          <DataTable columns={columns} data={filteredUsers} loading={loading} emptyMessage="No users found" />

      {/* Assign Role Dialog */}
      <Dialog open={isRoleDialogOpen} onOpenChange={setIsRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Role to {selectedUser?.full_name || selectedUser?.email}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAssignRole} className="space-y-4">
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={selectedRole} onValueChange={(value: AppRole) => setSelectedRole(value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {roleOptions.filter((role) => isSuperAdmin() || role !== 'super_admin').map((role) => (
                    <SelectItem key={role} value={role}>{roleLabels[role]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsRoleDialogOpen(false)}>Cancel</Button>
              <Button type="submit">Assign Role</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add User Dialog */}
      <Dialog open={isAddUserOpen} onOpenChange={(open) => {
        setIsAddUserOpen(open);
        if (!open) {
          setAddUserForm({ name: '', address: '', email: '', password: '', role: 'viewer' });
          setAddUserErrors({});
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add User</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateUser} className="space-y-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                value={addUserForm.name}
                onChange={(e) => { setAddUserForm(p => ({ ...p, name: e.target.value })); setAddUserErrors(p => ({ ...p, name: '' })); }}
                placeholder="Full name"
              />
              {addUserErrors.name && <p className="text-xs text-destructive">{addUserErrors.name}</p>}
            </div>

            <div className="space-y-2">
              <Label>Address *</Label>
              <Input
                value={addUserForm.address}
                onChange={(e) => { setAddUserForm(p => ({ ...p, address: e.target.value })); setAddUserErrors(p => ({ ...p, address: '' })); }}
                placeholder="Address"
              />
              {addUserErrors.address && <p className="text-xs text-destructive">{addUserErrors.address}</p>}
            </div>

            <div className="space-y-2">
              <Label>Role *</Label>
              <Select value={addUserForm.role} onValueChange={(v: AppRole) => handleAddUserRoleChange(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {roleOptions.filter(r => isSuperAdmin() || r !== 'super_admin').map(r => (
                    <SelectItem key={r} value={r}>{roleLabels[r]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {addUserErrors.role && <p className="text-xs text-destructive">{addUserErrors.role}</p>}
            </div>

            <div className="space-y-2">
              <Label>Email *</Label>
              <div className="relative">
                <Input
                  type="email"
                  value={addUserForm.email}
                  onChange={(e) => handleFieldChangeDebounced('email', e.target.value)}
                  onBlur={() => handleFieldBlur('email')}
                  placeholder="user@example.com"
                />
                {checkingDuplicates.email && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
              </div>
              {addUserErrors.email && <p className="text-xs text-destructive">{addUserErrors.email}</p>}
            </div>


            <div className="space-y-2">
              <Label>Password *</Label>
              <Input
                type="password"
                value={addUserForm.password}
                onChange={(e) => { setAddUserForm(p => ({ ...p, password: e.target.value })); setAddUserErrors(p => ({ ...p, password: '' })); }}
                placeholder="Minimum 6 characters"
              />
              {addUserErrors.password && <p className="text-xs text-destructive">{addUserErrors.password}</p>}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsAddUserOpen(false)}>Cancel</Button>
              <Button
                type="submit"
                disabled={isCreatingUser || !isFormValid()}
                title={!isFormValid() ? 'Please fix validation errors before saving.' : undefined}
              >
                {isCreatingUser ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...</> : 'Create User'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* View User Details Modal */}
      <ViewUserModal
        user={viewUser}
        open={!!viewUser}
        onOpenChange={(open) => !open && setViewUser(null)}
        formatManilaTime={formatManilaTime}
        users={users}
      />

        </TabsContent>

        <TabsContent value="sms" className="mt-4">
          <SMSNotificationsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// --- View User Details Modal Component ---
function ViewUserModal({
  user,
  open,
  onOpenChange,
  formatManilaTime,
  users,
}: {
  user: UserWithRoles | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formatManilaTime: (d: string) => string;
  users: UserWithRoles[];
}) {
  if (!user) return null;

  const creatorName = user.created_by
    ? users.find(u => u.id === user.created_by)?.full_name || 'Unknown'
    : '-';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>User Details</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <DetailRow label="Full Name" value={user.full_name || '-'} />
          <DetailRow label="Email" value={user.email || '-'} />
          <DetailRow label="Address" value={(user as any).address || '-'} />
          <Separator />
          <div>
            <p className="text-xs text-muted-foreground mb-1">Role(s)</p>
            <div className="flex flex-wrap gap-1">
              {user.roles.length > 0 ? user.roles.map(r => (
                <Badge key={r.id} variant="secondary">
                  {roleLabels[r.role]}
                </Badge>
              )) : <span className="text-muted-foreground text-sm">No roles</span>}
            </div>
          </div>
          <Separator />
          <DetailRow label="Status" value={user.is_active ? 'Active' : 'Inactive'} />
          <DetailRow label="Created At" value={user.created_at ? formatManilaTime(user.created_at) : '-'} />
          <DetailRow label="Created By" value={creatorName} />
          {user.updated_at && (
            <DetailRow label="Updated At" value={formatManilaTime(user.updated_at)} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}
