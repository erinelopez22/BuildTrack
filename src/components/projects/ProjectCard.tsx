import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
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
import { Calendar, MapPin, MoreVertical, Pencil, Trash2, RotateCcw, EyeOff, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import type { Project } from '@/types/database';

interface ProjectCardProps {
  project: Project;
  onEdit?: (project: Project) => void;
  onDelete?: (project: Project) => void;
  onRestore?: (project: Project) => void;
  onHide?: (project: Project) => void;
  onUnhide?: (project: Project) => void;
  onClick?: () => void;
  canEdit?: boolean;
  canRestore?: boolean;
  canHide?: boolean;
}

interface ProjectProgress {
  percentage: number;
  hasQuotation: boolean;
}

export function ProjectCard({ 
  project, 
  onEdit, 
  onDelete, 
  onRestore, 
  onHide,
  onUnhide,
  onClick, 
  canEdit, 
  canRestore,
  canHide,
}: ProjectCardProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [progress, setProgress] = useState<ProjectProgress>({ percentage: 0, hasQuotation: false });

  useEffect(() => {
    const fetchProgress = async () => {
      try {
        const { data: quotation } = await supabase
          .from('project_quotations')
          .select('id')
          .eq('project_id', project.id)
          .maybeSingle();

        if (!quotation) {
          setProgress({ percentage: 0, hasQuotation: false });
          return;
        }

        const { data: quotationItems } = await supabase
          .from('quotation_items')
          .select('id, material_name, quantity')
          .eq('quotation_id', quotation.id);

        if (!quotationItems || quotationItems.length === 0) {
          setProgress({ percentage: 0, hasQuotation: true });
          return;
        }

        const totalQuoted = quotationItems.reduce((sum, item) => sum + item.quantity, 0);

        const { data: orders } = await supabase
          .from('orders')
          .select('id')
          .eq('project_id', project.id)
          .in('status', ['delivered', 'closed']);

        if (!orders || orders.length === 0) {
          setProgress({ percentage: 0, hasQuotation: true });
          return;
        }

        const { data: orderItems } = await supabase
          .from('order_items')
          .select('quotation_item_id, quantity_received')
          .in('order_id', orders.map(o => o.id))
          .not('quotation_item_id', 'is', null);

        const receivedByQuotationItemId: Record<string, number> = {};
        orderItems?.forEach((item: any) => {
          if (item.quotation_item_id) {
            const qty = item.quantity_received ?? 0;
            receivedByQuotationItemId[item.quotation_item_id] = 
              (receivedByQuotationItemId[item.quotation_item_id] || 0) + qty;
          }
        });

        let totalReceived = 0;
        quotationItems.forEach((qItem) => {
          const received = receivedByQuotationItemId[qItem.id] || 0;
          totalReceived += Math.min(received, qItem.quantity);
        });

        const percentage = totalQuoted > 0 ? Math.min(100, (totalReceived / totalQuoted) * 100) : 0;
        setProgress({ percentage, hasQuotation: true });
      } catch (error) {
        console.error('Error fetching project progress:', error);
      }
    };

    fetchProgress();
  }, [project.id]);

  const getDateRangeDisplay = () => {
    if (project.start_date && project.end_date) {
      const start = format(new Date(project.start_date), 'MMM dd, yyyy');
      const end = format(new Date(project.end_date), 'MMM dd, yyyy');
      return `${start} – ${end}`;
    }
    return 'No dates set';
  };

  const isDeleted = project.status === 'deleted';
  const isHidden = project.is_hidden === true;

  const handleCardClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-radix-dropdown-menu-trigger]')) {
      return;
    }
    onClick?.();
  };

  const handleDeleteConfirm = () => {
    onDelete?.(project);
    setShowDeleteDialog(false);
  };

  const showMenu = canEdit || canRestore || canHide;

  return (
    <>
      <Card
        className={`group relative cursor-pointer transition-all duration-200 hover:shadow-lg hover:border-primary/30 bg-card ${
          isDeleted ? 'opacity-70 border-destructive/30' : ''
        } ${isHidden ? 'opacity-80 border-dashed border-muted-foreground/40' : ''}`}
        onClick={handleCardClick}
      >
        <CardContent className="p-5">
          {/* Header with title and menu */}
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-lg text-foreground truncate group-hover:text-primary transition-colors">
                  {project.name}
                </h3>
                {isHidden && (
                  <Badge variant="outline" className="text-xs shrink-0">
                    Hidden
                  </Badge>
                )}
              </div>
            </div>
            
            {showMenu && (
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
                  {canHide && !isDeleted && !isHidden && onHide && (
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        onHide(project);
                      }}
                    >
                      <EyeOff className="h-4 w-4 mr-2" />
                      Hide Project
                    </DropdownMenuItem>
                  )}
                  {canHide && !isDeleted && isHidden && onUnhide && (
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        onUnhide(project);
                      }}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Unhide Project
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

          {/* Location */}
          {project.location && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
              <MapPin className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{project.location}</span>
            </div>
          )}

          {/* Date Range */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
            <Calendar className="h-4 w-4 flex-shrink-0" />
            <span>{getDateRangeDisplay()}</span>
          </div>

          {/* Status Badge */}
          <div className="mb-4">
            <StatusBadge status={project.status} className="text-sm px-3 py-1" />
          </div>

          {/* Progress Bar */}
          <div className="pt-3 border-t border-border">
            {progress.hasQuotation ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-semibold text-primary">{progress.percentage.toFixed(0)}%</span>
                </div>
                <Progress value={progress.percentage} className="h-2" />
              </div>
            ) : (
              <div className="text-sm text-muted-foreground text-center py-1">
                No quotation set
              </div>
            )}
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
