import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { Calendar, MoreVertical, Pencil, Trash2, RotateCcw } from 'lucide-react';
import { differenceInDays, format } from 'date-fns';
import type { Project } from '@/types/database';

interface ProjectCardProps {
  project: Project;
  onEdit?: (project: Project) => void;
  onDelete?: (project: Project) => void;
  onRestore?: (project: Project) => void;
  onClick?: () => void;
  canEdit?: boolean;
  canRestore?: boolean;
}

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

export function ProjectCard({ 
  project, 
  onEdit, 
  onDelete, 
  onRestore, 
  onClick, 
  canEdit, 
  canRestore 
}: ProjectCardProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const getDurationDays = () => {
    if (project.start_date && project.end_date) {
      return differenceInDays(new Date(project.end_date), new Date(project.start_date));
    }
    return null;
  };

  const getDateRangeDisplay = () => {
    if (project.start_date && project.end_date) {
      const start = format(new Date(project.start_date), 'MMM dd, yyyy');
      const end = format(new Date(project.end_date), 'MMM dd, yyyy');
      return `${start} – ${end}`;
    }
    return 'No dates set';
  };

  const durationDays = getDurationDays();
  const isDeleted = project.status === 'deleted';

  const handleCardClick = (e: React.MouseEvent) => {
    // Prevent click if clicking on dropdown
    if ((e.target as HTMLElement).closest('[data-radix-dropdown-menu-trigger]')) {
      return;
    }
    onClick?.();
  };

  const handleDeleteConfirm = () => {
    onDelete?.(project);
    setShowDeleteDialog(false);
  };

  return (
    <>
      <Card
        className={`group relative cursor-pointer transition-all duration-200 hover:shadow-lg hover:border-primary/30 bg-card ${
          isDeleted ? 'opacity-70 border-destructive/30' : ''
        }`}
        onClick={handleCardClick}
      >
        <CardContent className="p-5">
          {/* Header with title and menu */}
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-lg text-foreground truncate group-hover:text-primary transition-colors">
                {project.name}
              </h3>
            </div>
            
            {(canEdit || canRestore) && (
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
                  {canRestore && onRestore && (
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        onRestore(project);
                      }}
                      className="text-success focus:text-success"
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Restore Project
                    </DropdownMenuItem>
                  )}
                  {canEdit && !isDeleted && onEdit && (
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(project);
                      }}
                    >
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit Project
                    </DropdownMenuItem>
                  )}
                  {canEdit && !isDeleted && onDelete && (
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowDeleteDialog(true);
                      }}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Project
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {/* Stats */}
          <div className="space-y-3 mb-4">
            {/* Estimated Cost */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Estimated Cost</span>
              <span className="font-semibold text-foreground">
                {formatPHP(project.estimated_cost)}
              </span>
            </div>

            {/* Duration */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Duration</span>
              <span className="font-medium text-foreground">
                {durationDays !== null ? `${durationDays} days` : '—'}
              </span>
            </div>

            {/* Date Range */}
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">{getDateRangeDisplay()}</span>
            </div>
          </div>

          {/* Status Badge */}
          <div className="pt-3 border-t border-border">
            <StatusBadge status={project.status} />
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{project.name}"? The project will be moved to deleted status and can be restored by a Super Admin.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
