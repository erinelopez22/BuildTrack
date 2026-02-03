import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { request } from '@/integrations/api';
import { useAuth } from '@/contexts/AuthContext';
import { mapApiProject, type ApiProject } from '@/lib/apiMappers';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState } from '@/components/common/EmptyState';
import { ProjectCard } from '@/components/projects/ProjectCard';
import { ProjectFormModal } from '@/components/projects/ProjectFormModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

export default function Projects() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAdmin, isSuperAdmin, user } = useAuth();
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Super Admin can see deleted projects, others cannot
  const statusFilterOptions: { value: string; label: string }[] = [
    { value: 'all', label: 'All Statuses' },
    { value: 'active', label: 'Active' },
    { value: 'on_hold', label: 'On hold' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' },
    ...(isSuperAdmin() ? [{ value: 'deleted', label: 'Deleted' }] : []),
  ];

  // Update URL when filter changes
  useEffect(() => {
    if (statusFilter === 'all') {
      searchParams.delete('status');
    } else {
      searchParams.set('status', statusFilter);
    }
    setSearchParams(searchParams, { replace: true });
  }, [statusFilter, searchParams, setSearchParams]);

  const fetchProjects = async () => {
    try {
      const statusParam = statusFilter !== 'all' ? `?status=${encodeURIComponent(statusFilter)}` : '';
      const data = await request<ApiProject[]>(`/api/projects${statusParam}`);
      setProjects((data ?? []).map(mapApiProject));
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'Failed to load projects', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, [statusFilter]);

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
        await request(`/api/projects/${editingProject.id}`, {
          method: 'PUT',
          body: {
            name: data.name,
            description: data.description || null,
            location: data.location,
            startDate: data.start_date,
            endDate: data.end_date,
            status: data.status,
          },
        });
        toast({ title: 'Success', description: 'Project updated successfully' });
      } else {
        await request('/api/projects', {
          method: 'POST',
          body: {
            name: data.name,
            description: data.description || null,
            location: data.location,
            startDate: data.start_date,
            endDate: data.end_date,
            status: data.status,
          },
        });
        toast({ title: 'Success', description: 'Project created successfully' });
      }

      setIsDialogOpen(false);
      setEditingProject(null);
      fetchProjects();
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Something went wrong',
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
      await request(`/api/projects/${project.id}`, {
        method: 'PUT',
        body: { status: 'deleted', name: project.name, description: project.description ?? null, location: project.location ?? '', startDate: project.start_date ?? undefined, endDate: project.end_date ?? undefined },
      });
      toast({ title: 'Success', description: 'Project moved to deleted' });
      fetchProjects();
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete project',
        variant: 'destructive',
      });
    }
  };

  const handleRestoreProject = async (project: Project) => {
    try {
      await request(`/api/projects/${project.id}`, {
        method: 'PUT',
        body: { status: 'active', name: project.name, description: project.description ?? null, location: project.location ?? '', startDate: project.start_date ?? undefined, endDate: project.end_date ?? undefined },
      });
      toast({ title: 'Success', description: 'Project restored successfully' });
      fetchProjects();
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to restore project',
        variant: 'destructive',
      });
    }
  };

  const handleCloseDialog = (open: boolean) => {
    if (!open) {
      setEditingProject(null);
    }
    setIsDialogOpen(open);
  };

  // Filter by search and status
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
            isAdmin()
              ? {
                  label: 'Create Project',
                  onClick: () => setIsDialogOpen(true),
                }
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
          isAdmin() && (
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Project
            </Button>
          )
        }
      />

      {/* Search and Filter Controls */}
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
              onEdit={handleEditProject}
              onDelete={handleDeleteProject}
              onRestore={handleRestoreProject}
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
