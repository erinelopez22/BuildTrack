import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { StatusBadge } from '@/components/common/StatusBadge';
import { ProjectFormModal } from '@/components/projects/ProjectFormModal';
import { ProjectTeamTab } from '@/components/projects/ProjectTeamTab';
import { ProjectActivityTab } from '@/components/projects/ProjectActivityTab';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeft,
  Users,
  Activity,
  MapPin,
  Calendar,
  Pencil,
  Clock,
  ChevronsUpDown,
  FileText,
  DollarSign,
} from 'lucide-react';
import type { Project, ProjectStatus } from '@/types/database';
import { format, differenceInDays } from 'date-fns';

// Format currency in Philippine Peso
const formatPHP = (amount: number | null | undefined) => {
  if (amount == null) return '₱0.00';
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAdmin } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchAllProjects = async () => {
    const { data } = await supabase
      .from('projects')
      .select('id, name, status')
      .order('name', { ascending: true });
    setAllProjects((data || []) as Project[]);
  };

  const fetchProjectData = async () => {
    if (!id) return;

    // Fetch project
    const { data: projectData, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (projectError || !projectData) {
      toast({ title: 'Error', description: 'Project not found', variant: 'destructive' });
      navigate('/projects');
      return;
    }

    setProject(projectData as Project);
    setLoading(false);
  };

  useEffect(() => {
    fetchAllProjects();
    fetchProjectData();
  }, [id, navigate, toast]);

  const handleEditSubmit = async (data: {
    name: string;
    description?: string;
    location: string;
    estimated_cost: number;
    start_date: string;
    end_date: string;
    status: ProjectStatus;
  }) => {
    if (!project) return;
    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('projects')
        .update({
          name: data.name,
          description: data.description || null,
          location: data.location,
          estimated_cost: data.estimated_cost,
          start_date: data.start_date,
          end_date: data.end_date,
          status: data.status,
        })
        .eq('id', project.id);

      if (error) throw error;
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

  const getDurationDisplay = () => {
    if (!project) return '—';
    if (project.start_date && project.end_date) {
      const days = differenceInDays(new Date(project.end_date), new Date(project.start_date));
      return `${days} days`;
    }
    return '—';
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
          <StatusBadge status={project.status} />
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

      {/* Project Info Cards - Full width layout for readability */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Location - Full text visible */}
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

        {/* Estimated Cost */}
        <Card>
          <CardContent className="flex items-start gap-3 p-4">
            <div className="rounded-lg bg-success/10 p-2 flex-shrink-0">
              <DollarSign className="h-5 w-5 text-success" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">Estimated Cost</p>
              <p className="font-medium">{formatPHP(project.estimated_cost)}</p>
            </div>
          </CardContent>
        </Card>

        {/* Duration */}
        <Card>
          <CardContent className="flex items-start gap-3 p-4">
            <div className="rounded-lg bg-accent/10 p-2 flex-shrink-0">
              <Clock className="h-5 w-5 text-accent-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">Duration</p>
              <p className="font-medium">{getDurationDisplay()}</p>
            </div>
          </CardContent>
        </Card>

        {/* Start Date */}
        <Card>
          <CardContent className="flex items-start gap-3 p-4">
            <div className="rounded-lg bg-primary/10 p-2 flex-shrink-0">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">Start Date</p>
              <p className="font-medium">{formatDate(project.start_date)}</p>
            </div>
          </CardContent>
        </Card>

        {/* End Date */}
        <Card>
          <CardContent className="flex items-start gap-3 p-4">
            <div className="rounded-lg bg-warning/10 p-2 flex-shrink-0">
              <Calendar className="h-5 w-5 text-warning" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">End Date</p>
              <p className="font-medium">{formatDate(project.end_date)}</p>
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

      <ProjectFormModal
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        project={project}
        onSubmit={handleEditSubmit}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
