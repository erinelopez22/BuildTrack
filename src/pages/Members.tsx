import { useState, useEffect } from 'react';
import { usersApi, projectsApi } from '@/lib/apiClient';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState } from '@/components/common/EmptyState';
import { DataTable, Column } from '@/components/common/DataTable';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Users, Search, ShieldX } from 'lucide-react';
import type { AppRole } from '@/types/database';

interface MemberWithDetails {
  id: string;
  email: string;
  full_name: string | null;
  is_active: boolean;
  roles: AppRole[];
  projects: { id: string; name: string }[];
}

export default function Members() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [members, setMembers] = useState<MemberWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function fetchMembers() {
      if (!isAdmin()) {
        setLoading(false);
        return;
      }

      try {
        // Fetch all users
        const usersResult = await usersApi.getAll();
        const users = (usersResult.data ?? []).filter((u) => u.isActive);

        // Fetch all projects and their members in parallel
        const projectsResult = await projectsApi.getAll();
        const projects = projectsResult.data ?? [];

        const membersByProject = await Promise.all(
          projects.map(async (project) => {
            try {
              const result = await projectsApi.getMembers(project.id);
              return { project, members: result.data ?? [] };
            } catch {
              return { project, members: [] };
            }
          })
        );

        // Build userId → projects reverse map
        const userProjectsMap: Record<string, { id: string; name: string }[]> = {};
        membersByProject.forEach(({ project, members }) => {
          members.forEach((m) => {
            if (!userProjectsMap[m.userId]) userProjectsMap[m.userId] = [];
            userProjectsMap[m.userId].push({ id: project.id, name: project.name });
          });
        });

        const membersWithDetails: MemberWithDetails[] = users.map((u) => ({
          id: u.id,
          email: u.email,
          full_name: u.fullName ?? null,
          is_active: u.isActive,
          roles: (u.roles ?? []) as AppRole[],
          projects: userProjectsMap[u.id] ?? [],
        }));

        membersWithDetails.sort((a, b) =>
          (a.full_name ?? '').localeCompare(b.full_name ?? '')
        );

        setMembers(membersWithDetails);
      } catch (error: any) {
        toast({
          title: 'Error',
          description: error.message,
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    }

    fetchMembers();
  }, [isAdmin, toast]);

  // RBAC check - only admins can view this page
  if (!isAdmin()) {
    return (
      <div className="animate-fade-in">
        <PageHeader title="Members" description="View active team members across all projects" />
        <EmptyState
          icon={ShieldX}
          title="Access Denied"
          description="You don't have permission to view this page. Only administrators can view the members list."
        />
      </div>
    );
  }

  const filteredMembers = members.filter((member) => {
    const searchLower = search.toLowerCase();
    return (
      member.full_name?.toLowerCase().includes(searchLower) ||
      member.email.toLowerCase().includes(searchLower) ||
      member.roles.some((r) => r.toLowerCase().includes(searchLower)) ||
      member.projects.some((p) => p.name.toLowerCase().includes(searchLower))
    );
  });

  const formatRole = (role: AppRole): string => {
    return role.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const columns: Column<MemberWithDetails>[] = [
    {
      key: 'name',
      header: 'Member Name',
      render: (member) => (
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">
            {member.full_name?.charAt(0)?.toUpperCase() || member.email.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-medium">{member.full_name || 'Unnamed User'}</p>
            <p className="text-xs text-muted-foreground">{member.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'roles',
      header: 'Role',
      render: (member) => (
        <div className="flex flex-wrap gap-1">
          {member.roles.length > 0 ? (
            member.roles.map((role) => (
              <Badge key={role} variant="secondary" className="text-xs">
                {formatRole(role)}
              </Badge>
            ))
          ) : (
            <span className="text-muted-foreground text-sm">No role assigned</span>
          )}
        </div>
      ),
    },
    {
      key: 'projects',
      header: 'Assigned Project(s)',
      render: (member) => (
        <div className="flex flex-wrap gap-1 max-w-[300px]">
          {member.projects.length > 0 ? (
            member.projects.slice(0, 3).map((project) => (
              <Badge key={project.id} variant="outline" className="text-xs">
                {project.name}
              </Badge>
            ))
          ) : (
            <span className="text-muted-foreground text-sm">No projects</span>
          )}
          {member.projects.length > 3 && (
            <Badge variant="outline" className="text-xs">
              +{member.projects.length - 3} more
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (member) => (
        <Badge variant={member.is_active ? 'default' : 'secondary'} className="text-xs">
          {member.is_active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <div className="animate-fade-in">
        <PageHeader title="Active Members" description="View active team members across all projects" />
        <EmptyState
          icon={Users}
          title="No active members"
          description="There are no active team members to display."
        />
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Active Members"
        description="View active team members across all projects"
      />

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search members..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filteredMembers}
        loading={loading}
        emptyMessage="No members found"
      />
    </div>
  );
}
