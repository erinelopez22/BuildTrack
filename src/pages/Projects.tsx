import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { projectsApi } from '@/lib/apiClient';
import type { Project as ApiProject } from '@/lib/apiClient';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState } from '@/components/common/EmptyState';
import { ProjectCard } from '@/components/projects/ProjectCard';
import { ProjectFormModal } from '@/components/projects/ProjectFormModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Plus, FolderKanban, Search } from 'lucide-react';
import type { Project, ProjectStatus } from '@/types/database';

// Map API project to the local Project type expected by existing components
function toLocalProject(p: ApiProject): Project {
  return {
    id: p.id,
    name: p.name,
    code: p.code ?? null,
    location: p.location ?? null,
    description: p.description ?? null,
    status: (p.status ?? 'active') as ProjectStatus,
    start_date: p.startDate ?? null,
    end_date: p.endDate ?? null,
    estimated_cost: p.estimatedCost ?? null,
    is_hidden: p.isHidden ?? false,
    project_manager_id: p.projectManagerId ?? null,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
    created_by: p.createdBy ?? null,
  } as unknown as Project;
}

export default function Projects() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAdmin, isSuperAdmin, canCreateProjects } = useAuth();
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showHidden, setShowHidden] = useState(false);

  const statusFilterOptions: { value: string; label: string }[] = [
    { value: 'all', label: 'All Statuses' },
    { value: 'active', label: 'Active' },
    { value: 'on_hold', label: 'On hold' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' },
    ...(isSuperAdmin() ? [{ value: 'deleted', label: 'Deleted' }] : []),
  ];

  useEffect(() => {
    if (statusFilter === 'all') {
      searchParams.delete('status');
    } else {
      searchParams.set('status', statusFilter);
    }
    setSearchParams(searchParams, { replace: true });
  }, [statusFilter]);

  const fetchProjects = async () => {
    try {
      const result = await projectsApi.getAll({
        includeHidden: isAdmin() && showHidden,
        status: statusFilter !== 'all' ? statusFilter : undefined,
      });
      setProjects((result.data ?? []).map(toLocalProject));
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to load projects', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, [showHidden]);

  const handleSubmit = async (data: {
    name: string;
    description?: string;
    location: string;
    start_date: string;
    end_date: string;
    status: ProjectStatus;
  }) => {
    setIsSubmitting(true);
    try {
      if (editingProject) {
        await projectsApi.update(editingProject.id, {
          name: data.name,
          description: data.description || undefined,
          location: data.location,
          startDate: data.start_date,
          endDate: data.end_date,
          status: data.status,
        });
        toast({ title: 'Success', description: 'Project updated successfully' });
      } else {
        await projectsApi.create({
          name: data.name,
          description: data.description || undefined,
          location: data.location,
          startDate: data.start_date,
          endDate: data.end_date,
          status: data.status,
        });
        toast({ title: 'Success', description: 'Project created successfully' });
      }

      setIsDialogOpen(false);
      setEditingProject(null);
      fetchProjects();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Something went wrong',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditProject = (project: Project) => {
    setEditingProject(project);
    setIsDialogOpen(true);
  };

  const handleDeleteProject = async (project: Project) => {
    try {
      await projectsApi.update(project.id, { status: 'deleted' });
      toast({ title: 'Success', description: 'Project moved to deleted' });
      fetchProjects();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to delete project', variant: 'destructive' });
    }
  };

  const handleRestoreProject = async (project: Project) => {
    try {
      await projectsApi.update(project.id, { status: 'active' });
      toast({ title: 'Success', description: 'Project restored successfully' });
      fetchProjects();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to restore project', variant: 'destructive' });
    }
  };

  const handleHideProject = async (project: Project) => {
    try {
      await projectsApi.update(project.id, { isHidden: true });
      toast({ title: 'Success', description: 'Project hidden' });
      fetchProjects();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleUnhideProject = async (project: Project) => {
    try {
      await projectsApi.update(project.id, { isHidden: false });
      toast({ title: 'Success', description: 'Project unhidden' });
      fetchProjects();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleCloseDialog = (open: boolean) => {
    if (!open) setEditingProject(null);
    setIsDialogOpen(open);
  };

  const filteredProjects = projects.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.code?.toLowerCase().includes(search.toLowerCase()) ||
      p.location?.toLowerCase().includes(search.toLowerCase()) ||
      p.description?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="animate-fade-in">
        <PageHeader title="Projects" description="Manage your construction projects" />
        <EmptyState
          icon={FolderKanban}
          title="No projects yet"
          description="Create your first project to start tracking inventory and orders."
          action={
            canCreateProjects()
              ? { label: 'Create Project', onClick: () => setIsDialogOpen(true) }
              : undefined
          }
        />
        <ProjectFormModal
          open={isDialogOpen}
          onOpenChange={handleCloseDialog}
          project={editingProject}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
        />
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Projects"
        description="Manage your construction projects"
        action={
          canCreateProjects() && (
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Project
            </Button>
          )
        }
      />

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent className="bg-popover z-50">
            {statusFilterOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isAdmin() && (
          <div className="flex items-center gap-2">
            <Switch id="show-hidden" checked={showHidden} onCheckedChange={setShowHidden} />
            <Label htmlFor="show-hidden" className="text-sm text-muted-foreground whitespace-nowrap">
              Show Hidden
            </Label>
          </div>
        )}
      </div>

      {filteredProjects.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-muted-foreground">No projects match your search or filter.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              canEdit={isAdmin()}
              canRestore={isSuperAdmin() && project.status === 'deleted'}
              canHide={isAdmin()}
              onEdit={handleEditProject}
              onDelete={handleDeleteProject}
              onRestore={handleRestoreProject}
              onHide={handleHideProject}
              onUnhide={handleUnhideProject}
              onClick={() => navigate(`/projects/${project.id}`)}
            />
          ))}
        </div>
      )}

      <ProjectFormModal
        open={isDialogOpen}
        onOpenChange={handleCloseDialog}
        project={editingProject}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
