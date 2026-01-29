import { cn } from '@/lib/utils';
import type { OrderStatus, ProjectStatus } from '@/types/database';

type Status = OrderStatus | ProjectStatus | 'ok' | 'low' | 'critical';

const statusStyles: Record<Status, string> = {
  // Order statuses - Updated color scheme
  draft: 'bg-muted text-muted-foreground',
  for_approval: 'bg-warning/10 text-warning',
  approved: 'bg-[hsl(210,90%,50%)]/10 text-[hsl(210,90%,50%)]',
  submitted: 'bg-[hsl(210,90%,50%)]/15 text-[hsl(210,80%,45%)]',
  preparing: 'bg-[hsl(220,75%,45%)]/10 text-[hsl(220,75%,45%)]',
  ordered: 'bg-[hsl(220,75%,45%)]/15 text-[hsl(220,65%,40%)]',
  in_transit: 'bg-amber-400/10 text-amber-600',
  delivered: 'bg-success/10 text-success',
  partially_received: 'bg-warning/10 text-warning',
  fully_received: 'bg-success/10 text-success',
  closed: 'bg-muted text-muted-foreground',
  cancelled: 'bg-destructive/10 text-destructive',
  rejected: 'bg-destructive/10 text-destructive',
  on_hold: 'bg-amber-500/10 text-amber-600',
  // Project statuses
  active: 'bg-success/10 text-success',
  // on_hold is already defined above for order status - shares the same style
  completed: 'bg-muted text-muted-foreground',
  deleted: 'bg-destructive/10 text-destructive',
  // Inventory statuses
  ok: 'bg-success/10 text-success',
  low: 'bg-warning/10 text-warning',
  critical: 'bg-destructive/10 text-destructive',
};

const statusLabels: Record<Status, string> = {
  draft: 'Draft',
  for_approval: 'Order Requested',
  approved: 'Order Approved',
  submitted: 'Order Submitted',
  preparing: 'Preparing for Tracking',
  ordered: 'Ordered',
  in_transit: 'On Transit',
  delivered: 'Delivered',
  partially_received: 'Partially Received',
  fully_received: 'Fully Received',
  closed: 'Closed',
  cancelled: 'Cancelled',
  rejected: 'Rejected',
  on_hold: 'On-hold',
  active: 'Active',
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
