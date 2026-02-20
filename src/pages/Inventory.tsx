import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { OrderWorkflowBoard } from "@/components/orders/OrderWorkflowBoard";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Package, Search } from "lucide-react";
import type { Project } from "@/types/database";

export default function Inventory() {
  const { isSuperAdmin } = useAuth();
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  const fetchProjects = async () => {
    let query = supabase.from("projects").select("*").order("name", { ascending: true });
    query = query.neq("status", "deleted");
    query = query.eq("is_hidden", false);

    const { data, error } = await query;

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setProjects(data as Project[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  // Filter by search
  const filteredProjects = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.code?.toLowerCase().includes(search.toLowerCase()) ||
      p.location?.toLowerCase().includes(search.toLowerCase()),
  );

  // If a project is selected, show the order workflow board
  if (selectedProject) {
    return (
      <div className="animate-fade-in">
        <OrderWorkflowBoard project={selectedProject} onBack={() => setSelectedProject(null)} />
      </div>
    );
  }

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
        <PageHeader title="Inventory" description="Select a project to view and manage orders" />
        <EmptyState
          icon={Package}
          title="No projects available"
          description="Create a project first to start managing inventory and orders."
        />
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader title="Order & Tracking" description="Select a project to view and manage orders" />

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search projects..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Project Cards Grid */}
      {filteredProjects.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-muted-foreground">No projects match your search.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredProjects.map((project) => (
            <ProjectCard key={project.id} project={project} onClick={() => setSelectedProject(project)} />
          ))}
        </div>
      )}
    </div>
  );
}
