import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Loader2, UserPlus } from 'lucide-react';
import { logActivity } from '@/lib/activityLogger';
import { notifyProjectMembers } from '@/lib/notificationService';
import type { ProjectMember, Profile, AppRole } from '@/types/database';

interface ProjectTeamTabProps {
  projectId: string;
  projectName: string;
}

const roleLabels: Record<AppRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  office_admin: 'Office Admin',
  warehouse_admin: 'Warehouse Admin',
  project_manager: 'Project Manager',
  procurement: 'Procurement',
  storekeeper: 'Storekeeper',
  site_lead: 'Site Lead',
  viewer: 'Viewer',
  approver: 'Approver',
  approval_admin: 'Approval Admin',
  logistics_admin: 'Logistics Admin',
  project_engineer: 'Project/Site Engineer',
  receiver: 'Receiver',
  tracking_driver: 'Tracking Driver',
};

const roleOptions: { value: AppRole; label: string }[] = [
  { value: 'project_engineer', label: 'Project/Site Engineer' },
  { value: 'project_manager', label: 'Project Manager' },
  { value: 'storekeeper', label: 'Storekeeper' },
  { value: 'site_lead', label: 'Site Lead' },
  { value: 'receiver', label: 'Receiver' },
  { value: 'tracking_driver', label: 'Tracking Driver' },
  { value: 'viewer', label: 'Viewer' },
];

export function ProjectTeamTab({ projectId, projectName }: ProjectTeamTabProps) {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const [members, setMembers] = useState<(ProjectMember & { profile: Profile })[]>([]);
  const [availableUsers, setAvailableUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<(ProjectMember & { profile: Profile }) | null>(null);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState<AppRole>('viewer');
  const [isAdding, setIsAdding] = useState(false);

  const fetchMembers = async () => {
    const { data: membersData } = await supabase
      .from('project_members')
      .select('*')
      .eq('project_id', projectId);

    if (membersData && membersData.length > 0) {
      const userIds = membersData.map(m => m.user_id);
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('*')
        .in('id', userIds);

      const membersWithProfiles = membersData.map(member => ({
        ...member,
        profile: (profilesData || []).find(p => p.id === member.user_id) || {} as Profile,
      }));
      setMembers(membersWithProfiles as (ProjectMember & { profile: Profile })[]);
    } else {
      setMembers([]);
    }
    setLoading(false);
  };

  const fetchAvailableUsers = async () => {
    // Get all active profiles
    const { data: profiles } = await supabase
      .from('profiles')
      .select('*')
      .eq('is_active', true);

    // Get current member IDs
    const memberIds = members.map(m => m.user_id);
    
    // Filter out users already in the project
    const available = (profiles || []).filter(p => !memberIds.includes(p.id));
    setAvailableUsers(available as unknown as Profile[]);
  };

  useEffect(() => {
    fetchMembers();
  }, [projectId]);

  useEffect(() => {
    if (isAddDialogOpen) {
      fetchAvailableUsers();
    }
  }, [isAddDialogOpen, members]);

  const handleAddMember = async () => {
    if (!selectedUserId || !user) return;
    setIsAdding(true);

    const { error } = await supabase.from('project_members').insert({
      project_id: projectId,
      user_id: selectedUserId,
      role: selectedRole,
      created_by: user.id,
    });

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      // Log activity
      await logActivity({
        action: 'add',
        tableName: 'project_members',
        recordId: projectId,
        newValues: { user_id: selectedUserId, role: selectedRole },
        userId: user.id,
      });

      // Get the added user's name
      const addedUser = availableUsers.find(u => u.id === selectedUserId);
      
      // Notify project members
      await notifyProjectMembers({
        projectId,
        title: 'New Team Member',
        message: `${addedUser?.full_name || 'A new member'} has been added to ${projectName}`,
        type: 'team',
        referenceType: 'project',
        referenceId: projectId,
        excludeUserId: user.id,
      });

      toast({ title: 'Success', description: 'Team member added' });
      setIsAddDialogOpen(false);
      setSelectedUserId('');
      setSelectedRole('viewer');
      fetchMembers();
    }

    setIsAdding(false);
  };

  const handleRemoveMember = async () => {
    if (!memberToRemove || !user) return;
    setIsRemoving(true);

    const { error } = await supabase
      .from('project_members')
      .delete()
      .eq('id', memberToRemove.id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      // Log activity
      await logActivity({
        action: 'remove',
        tableName: 'project_members',
        recordId: projectId,
        oldValues: { user_id: memberToRemove.user_id, role: memberToRemove.role },
        userId: user.id,
      });

      // Notify project members
      await notifyProjectMembers({
        projectId,
        title: 'Team Member Removed',
        message: `${memberToRemove.profile?.full_name || 'A team member'} has been removed from ${projectName}`,
        type: 'team',
        referenceType: 'project',
        referenceId: projectId,
        excludeUserId: user.id,
      });

      toast({ title: 'Success', description: 'Team member removed' });
      setMemberToRemove(null);
      fetchMembers();
    }

    setIsRemoving(false);
  };

  const canManageTeam = isAdmin();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Team Members</CardTitle>
        {canManageTeam && (
          <Button onClick={() => setIsAddDialogOpen(true)} size="sm">
            <UserPlus className="mr-2 h-4 w-4" />
            Add Member
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {members.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between gap-3 rounded-lg border p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                    {member.profile?.full_name?.charAt(0) ||
                      member.profile?.email?.charAt(0) ||
                      'U'}
                  </div>
                  <div>
                    <p className="font-medium">
                      {member.profile?.full_name || 'Unknown User'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {roleLabels[member.role] || member.role}
                    </p>
                  </div>
                </div>
                {canManageTeam && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => setMemberToRemove(member)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="py-8 text-center text-muted-foreground">
            No team members assigned yet.
          </p>
        )}
      </CardContent>

      {/* Add Member Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Team Member</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select User</label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a user" />
                </SelectTrigger>
                <SelectContent>
                  {availableUsers.length === 0 ? (
                    <SelectItem value="_none" disabled>
                      No available users
                    </SelectItem>
                  ) : (
                    availableUsers.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.full_name || user.email}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Role</label>
              <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as AppRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddMember} disabled={!selectedUserId || isAdding}>
                {isAdding ? 'Adding...' : 'Add Member'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Remove Member Confirmation */}
      <AlertDialog open={!!memberToRemove} onOpenChange={() => setMemberToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Team Member?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove {memberToRemove?.profile?.full_name || 'this user'} from the project.
              They will no longer receive notifications or have access to project data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRemoving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveMember}
              disabled={isRemoving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isRemoving ? 'Removing...' : 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
