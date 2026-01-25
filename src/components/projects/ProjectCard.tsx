import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DollarSign, Calendar, MoreVertical, Pencil } from 'lucide-react';
import { differenceInDays, format } from 'date-fns';
import type { Project, ProjectStatus } from '@/types/database';

interface ProjectCardProps {
  project: Project;
  onEdit?: (project: Project) => void;
  onClick?: () => void;
  canEdit?: boolean;
}

const statusDisplayMap: Record<ProjectStatus, string> = {
  active: 'In-progress',
  on_hold: 'On hold',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export function ProjectCard({ project, onEdit, onClick, canEdit }: ProjectCardProps) {
  const getDurationDisplay = () => {
    if (project.start_date && project.end_date) {
      const days = differenceInDays(new Date(project.end_date), new Date(project.start_date));
      return `${days} days`;
    }
    if (project.start_date) {
      return `Started ${format(new Date(project.start_date), 'MMM d, yyyy')}`;
    }
    return 'Not scheduled';
  };

  const formatCurrency = (amount: number | null | undefined) => {
    if (amount == null) return '$0';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const handleCardClick = (e: React.MouseEvent) => {
    // Prevent click if clicking on dropdown
    if ((e.target as HTMLElement).closest('[data-radix-dropdown-menu-trigger]')) {
      return;
    }
    onClick?.();
  };

  return (
    <Card
      className="group relative cursor-pointer transition-all duration-200 hover:shadow-lg hover:border-primary/30 bg-card"
      onClick={handleCardClick}
    >
      <CardContent className="p-5">
        {/* Header with title and menu */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg text-foreground truncate group-hover:text-primary transition-colors">
              {project.name}
            </h3>
            {project.code && (
              <p className="text-xs text-muted-foreground font-mono mt-0.5">{project.code}</p>
            )}
          </div>
          
          {canEdit && onEdit && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                  data-radix-dropdown-menu-trigger
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-popover z-50">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(project);
                  }}
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit Project
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Description if exists */}
        {project.description && (
          <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
            {project.description}
          </p>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="flex items-center gap-2 text-sm">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-success/10">
              <DollarSign className="h-4 w-4 text-success" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Est. Cost</p>
              <p className="font-medium text-foreground">
                {formatCurrency(project.estimated_cost)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Calendar className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Duration</p>
              <p className="font-medium text-foreground">{getDurationDisplay()}</p>
            </div>
          </div>
        </div>

        {/* Status Badge */}
        <div className="pt-3 border-t border-border">
          <StatusBadge status={project.status} />
        </div>
      </CardContent>
    </Card>
  );
}
