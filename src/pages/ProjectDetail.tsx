import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { request } from '@/integrations/api';
import { useAuth } from '@/contexts/AuthContext';
import { mapApiProject, type ApiProject } from '@/lib/apiMappers';
import { StatusBadge } from '@/components/common/StatusBadge';
import { ProjectFormModal } from '@/components/projects/ProjectFormModal';
import { ProjectTeamTab } from '@/components/projects/ProjectTeamTab';
import { ProjectActivityTab } from '@/components/projects/ProjectActivityTab';
import { QuotationModal } from '@/components/projects/QuotationModal';
import { ProjectProgressModal } from '@/components/projects/ProjectProgressModal';
import { ActiveOrdersModal } from '@/components/projects/ActiveOrdersModal';
import { DeliveredMaterialsModal } from '@/components/projects/DeliveredMaterialsModal';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useProjectProgress } from '@/hooks/useProjectProgress';
import {
  ArrowLeft,
  Users,
  Activity,
  MapPin,
  Calendar,
  Pencil,
  ChevronsUpDown,
  FileText,
  ClipboardList,
  Package,
  TruckIcon,
} from 'lucide-react';
import type { Project, ProjectStatus, AppRole } from '@/types/database';
import { format } from 'date-fns';

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAdmin, user } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isQuotationOpen, setIsQuotationOpen] = useState(false);
  const [isActiveOrdersOpen, setIsActiveOrdersOpen] = useState(false);
  const [isDeliveredMaterialsOpen, setIsDeliveredMaterialsOpen] = useState(false);
  const [isProgressModalOpen, setIsProgressModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userProjectRole, setUserProjectRole] = useState<AppRole | null>(null);
  const [hasQuotation, setHasQuotation] = useState(false);
  const [progressKey, setProgressKey] = useState(0);

  const progress = useProjectProgress(id || '', progressKey);

  const fetchAllProjects = async () => {
    try {
      const data = await request<ApiProject[]>('/api/projects');
      setAllProjects(data.map(mapApiProject));
    } catch {
      setAllProjects([]);
    }
  };

  const fetchProjectData = async () => {
    if (!id) return;

    try {
      const projectData = await request<{
        id: string; name: string; code?: string | null; location?: string | null; description?: string | null;
        status: string; startDate?: string | null; endDate?: string | null; projectManagerId?: string | null;
        estimatedCost?: number | null; createdAt: string; updatedAt: string; createdBy?: string | null;
      }>(`/api/projects/${id}`);
      setProject(mapApiProject(projectData));

      try {
       
      const res=  await request<any>(`/api/projects/${id}/quotation`);
      console.log(res);
       if(res.id=="00000000-0000-0000-0000-000000000000")
       {
        setHasQuotation(false);
       }
       else
       {
        setHasQuotation(true);
       }
       
      } catch {
        console.log("HAS NOOOO  QQQQQQQQQ");
        setHasQuotation(false);
      }

      if (user) {
        const members = await request<Array<{ userId: string; role: string }>>(`/api/projects/${id}/members`);
        const member = members.find((m: { userId: string }) => m.userId === user.id);
        if (member) setUserProjectRole(member.role as AppRole);
      }
    } catch {
      toast({ title: 'Error', description: 'Project not found', variant: 'destructive' });
      navigate('/projects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllProjects();
    fetchProjectData();
  }, [id, navigate, toast, user]);

  // Check if user can edit quotation (admin or project_manager role)
  const canEditQuotation = isAdmin() || userProjectRole === 'project_manager';

  // Refresh progress when quotation changes
  const handleQuotationChange = () => {
    setProgressKey((prev) => prev + 1);
    fetchProjectData();
  };

  const handleEditSubmit = async (data: {
    name: string;
    description?: string;
    location: string;
    start_date: string;
    end_date: string;
    status: ProjectStatus;
  }) => {
    if (!project) return;
    setIsSubmitting(true);

    try {
      await request(`/api/projects/${project.id}`, {
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
      setIsEditDialogOpen(false);
      fetchProjectData();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Something went wrong';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleProjectSwitch = (projectId: string) => {
    navigate(`/projects/${projectId}`);
  };

  const getDateRangeDisplay = () => {
    if (!project) return '—';
    if (project.start_date && project.end_date) {
      const start = format(new Date(project.start_date), 'MMM dd, yyyy');
      const end = format(new Date(project.end_date), 'MMM dd, yyyy');
      return `${start} – ${end}`;
    }
    return 'No dates set';
  };

  const formatDate = (date: string | null | undefined) => {
    if (!date) return '—';
    return format(new Date(date), 'MMM dd, yyyy');
  };

  if (loading || !project) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header with Project Switcher */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/projects')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>

        {/* Project Switcher Dropdown */}
        <div className="flex-1 min-w-0">
          <Select value={project.id} onValueChange={handleProjectSwitch}>
            <SelectTrigger className="w-full max-w-xs bg-background">
              <div className="flex items-center gap-2">
                <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder="Select project" />
              </div>
            </SelectTrigger>
            <SelectContent className="bg-popover z-50 max-h-64">
              {allProjects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate">{p.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <StatusBadge status={project.status} className="text-sm px-4 py-1.5 font-semibold" />
          {isAdmin() && (
            <Button variant="outline" onClick={() => setIsEditDialogOpen(true)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
          )}
        </div>
      </div>

      {/* Project Title and Description */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-foreground">{project.name}</h1>
        {project.description && (
          <p className="text-muted-foreground whitespace-pre-wrap">{project.description}</p>
        )}
      </div>

      {/* Project Info Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Location */}
        <Card>
          <CardContent className="flex items-start gap-3 p-4">
            <div className="rounded-lg bg-primary/10 p-2 flex-shrink-0">
              <MapPin className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">Location</p>
              <p className="font-medium break-words">{project.location || 'Not set'}</p>
            </div>
          </CardContent>
        </Card>

        {/* Duration (Date Range) */}
        <Card>
          <CardContent className="flex items-start gap-3 p-4">
            <div className="rounded-lg bg-accent/10 p-2 flex-shrink-0">
              <Calendar className="h-5 w-5 text-accent-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">Duration</p>
              <p className="font-medium">{getDateRangeDisplay()}</p>
            </div>
          </CardContent>
        </Card>

        {/* Status */}
        <Card>
          <CardContent className="flex items-start gap-3 p-4">
            <div className="rounded-lg bg-muted p-2 flex-shrink-0">
              <FileText className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">Status</p>
              <div className="mt-1">
                <StatusBadge status={project.status} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress Section - Clickable to open Project Progress Modal */}
      <Card 
        className="cursor-pointer transition-colors hover:bg-muted/50" 
        onClick={() => setIsProgressModalOpen(true)}
      >
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-success/10 p-2">
                <ClipboardList className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="font-medium">Project Progress</p>
                <p className="text-sm text-muted-foreground">Based on quotation materials received</p>
              </div>
            </div>
            <span className="text-2xl font-bold text-primary">{progress.percentage.toFixed(0)}%</span>
          </div>
          <Progress value={progress.percentage} className="h-3" />
          {!progress.hasQuotation && (
            <p className="text-sm text-muted-foreground">
              No quotation set. Create a quotation to track progress.
            </p>
          )}
          <p className="text-xs text-muted-foreground">Click to view detailed progress</p>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        <Button variant="outline" onClick={() => setIsQuotationOpen(true)}>
          <ClipboardList className="mr-2 h-4 w-4" />
          {hasQuotation ? 'View Quotation' : 'Add Quotation'}
        </Button>
        <Button variant="outline" onClick={() => setIsActiveOrdersOpen(true)}>
          <Package className="mr-2 h-4 w-4" />
          View Active Orders
        </Button>
        <Button variant="outline" onClick={() => setIsDeliveredMaterialsOpen(true)}>
          <TruckIcon className="mr-2 h-4 w-4" />
          Delivered Materials
        </Button>
      </div>

      {/* Tabs - Team and Activity */}
      <Tabs defaultValue="team" className="space-y-4">
        <TabsList>
          <TabsTrigger value="team" className="gap-2">
            <Users className="h-4 w-4" />
            Team
          </TabsTrigger>
          <TabsTrigger value="activity" className="gap-2">
            <Activity className="h-4 w-4" />
            Activity
          </TabsTrigger>
        </TabsList>

        <TabsContent value="team">
          <ProjectTeamTab projectId={project.id} projectName={project.name} />
        </TabsContent>

        <TabsContent value="activity">
          <ProjectActivityTab projectId={project.id} />
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <ProjectFormModal
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        project={project}
        onSubmit={handleEditSubmit}
        isSubmitting={isSubmitting}
      />

      <QuotationModal
        open={isQuotationOpen}
        onOpenChange={setIsQuotationOpen}
        projectId={project.id}
        projectName={project.name}
        canEdit={canEditQuotation}
        hasExistingQuotation={hasQuotation}
        onQuotationChange={handleQuotationChange}
      />

      <ActiveOrdersModal
        open={isActiveOrdersOpen}
        onOpenChange={setIsActiveOrdersOpen}
        projectId={project.id}
        projectName={project.name}
      />

      <DeliveredMaterialsModal
        open={isDeliveredMaterialsOpen}
        onOpenChange={setIsDeliveredMaterialsOpen}
        projectId={project.id}
        projectName={project.name}
      />

      <ProjectProgressModal
        open={isProgressModalOpen}
        onOpenChange={setIsProgressModalOpen}
        projectId={project.id}
        projectName={project.name}
        refreshKey={progressKey}
      />
    </div>
  );
}
