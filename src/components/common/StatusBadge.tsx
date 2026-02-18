import { cn } from '@/lib/utils';
import { ORDER_STATUS_UI_MAP } from '@/types/database';
import type { OrderStatus, ProjectStatus } from '@/types/database';

type Status = OrderStatus | ProjectStatus | 'ok' | 'low' | 'critical';

// Styles mapped to simplified UI labels
const simplifiedStatusStyles: Record<string, string> = {
  'Order Request': 'bg-warning/10 text-warning',
  'Approved': 'bg-[hsl(210,90%,50%)]/10 text-[hsl(210,90%,50%)]',
  'Ordered': 'bg-[hsl(220,75%,45%)]/10 text-[hsl(220,75%,45%)]',
  'On Transit': 'bg-amber-400/10 text-amber-600',
  'Delivered': 'bg-success/10 text-success',
  'Rejected': 'bg-destructive/10 text-destructive',
  'Cancelled': 'bg-destructive/10 text-destructive',
  'On-Hold': 'bg-amber-500/10 text-amber-600',
};

const projectStatusStyles: Record<string, string> = {
  active: 'bg-success/10 text-success',
  on_hold: 'bg-amber-500/10 text-amber-600',
  completed: 'bg-muted text-muted-foreground',
  cancelled: 'bg-destructive/10 text-destructive',
  deleted: 'bg-destructive/10 text-destructive',
};

const inventoryStatusStyles: Record<string, string> = {
  ok: 'bg-success/10 text-success',
  low: 'bg-warning/10 text-warning',
  critical: 'bg-destructive/10 text-destructive',
};

const projectStatusLabels: Record<string, string> = {
  active: 'Active',
  on_hold: 'On-hold',
  completed: 'Completed',
  cancelled: 'Cancelled',
  deleted: 'Deleted',
};

const inventoryStatusLabels: Record<string, string> = {
  ok: 'OK',
  low: 'Low Stock',
  critical: 'Critical',
};

interface StatusBadgeProps {
  status: Status;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  // Determine label and style
  let label: string;
  let style: string;

  if (status in ORDER_STATUS_UI_MAP) {
    label = ORDER_STATUS_UI_MAP[status as OrderStatus];
    style = simplifiedStatusStyles[label] || 'bg-muted text-muted-foreground';
  } else if (status in projectStatusLabels) {
    label = projectStatusLabels[status];
    style = projectStatusStyles[status] || 'bg-muted text-muted-foreground';
  } else if (status in inventoryStatusLabels) {
    label = inventoryStatusLabels[status];
    style = inventoryStatusStyles[status] || 'bg-muted text-muted-foreground';
  } else {
    label = String(status);
    style = 'bg-muted text-muted-foreground';
  }

  return (
    <span className={cn('status-badge', style, className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}
