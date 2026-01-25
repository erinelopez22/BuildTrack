import { cn } from '@/lib/utils';
import type { OrderStatus, ProjectStatus } from '@/types/database';

type Status = OrderStatus | ProjectStatus | 'ok' | 'low' | 'critical';

const statusStyles: Record<Status, string> = {
  // Order statuses
  draft: 'bg-muted text-muted-foreground',
  for_approval: 'bg-warning/10 text-warning',
  approved: 'bg-success/10 text-success',
  ordered: 'bg-primary/10 text-primary',
  in_transit: 'bg-accent/10 text-accent-foreground',
  delivered: 'bg-success/10 text-success',
  partially_received: 'bg-warning/10 text-warning',
  fully_received: 'bg-success/10 text-success',
  closed: 'bg-muted text-muted-foreground',
  cancelled: 'bg-destructive/10 text-destructive',
  rejected: 'bg-destructive/10 text-destructive',
  // Project statuses
  active: 'bg-success/10 text-success',
  on_hold: 'bg-warning/10 text-warning',
  completed: 'bg-muted text-muted-foreground',
  deleted: 'bg-destructive/10 text-destructive',
  // Inventory statuses
  ok: 'bg-success/10 text-success',
  low: 'bg-warning/10 text-warning',
  critical: 'bg-destructive/10 text-destructive',
};

const statusLabels: Record<Status, string> = {
  draft: 'Draft',
  for_approval: 'For Approval',
  approved: 'Approved',
  ordered: 'Ordered',
  in_transit: 'In Transit',
  delivered: 'Delivered',
  partially_received: 'Partially Received',
  fully_received: 'Fully Received',
  closed: 'Closed',
  cancelled: 'Cancelled',
  rejected: 'Rejected',
  active: 'Active',
  on_hold: 'On Hold',
  completed: 'Completed',
  deleted: 'Deleted',
  ok: 'OK',
  low: 'Low Stock',
  critical: 'Critical',
};

interface StatusBadgeProps {
  status: Status;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span className={cn('status-badge', statusStyles[status], className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {statusLabels[status]}
    </span>
  );
}