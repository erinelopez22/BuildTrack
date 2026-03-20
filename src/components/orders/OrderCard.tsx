import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge } from '@/components/common/StatusBadge';
import { formatManilaTime } from '@/lib/notificationService';
import type { Order } from '@/types/database';

interface OrderCardProps {
  order: Order;
  onClick?: () => void;
  onQuickAction?: never; // kept for interface compatibility but no longer used
}

// Check if an order request is overdue (>5 days in Order Request status)
function isOverdue(order: Order): boolean {
  if (order.status !== 'for_approval' && order.status !== 'draft') return false;
  if (!order.created_at) return false;

  const now = new Date();
  const created = new Date(order.created_at);
  const diffMs = now.getTime() - created.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays > 5;
}

export function OrderCard({ order, onClick }: OrderCardProps) {
  const overdue = isOverdue(order);

  return (
    <div className="relative">
      <Card
        className="group cursor-pointer transition-all duration-200 hover:shadow-md hover:border-primary/30 bg-card"
        onClick={onClick}
      >
        <CardContent className="p-3">
          <div className="space-y-1.5">
            {/* Order ID + Status */}
            <div className="flex items-start justify-between gap-2">
              <span className="font-mono text-sm font-bold text-foreground">
                {order.order_number}
              </span>
              <div className="flex items-center gap-1">
                {overdue && (
                  <span className="inline-flex items-center rounded-full bg-destructive/15 px-1.5 py-0.5 text-[9px] font-bold text-destructive">
                    Overdue 5+ days
                  </span>
                )}
                <StatusBadge status={order.status} className="text-[10px] px-1.5 py-0.5" />
              </div>
            </div>

            {/* Created Date (Manila time) */}
            <p className="text-xs text-muted-foreground">
              {order.created_at ? formatManilaTime(order.created_at) : 'No date'}
            </p>

            {/* Company Name */}
            <p className="text-xs text-muted-foreground truncate">
              {order.supplier_name?.trim() || 'Jagon'}
            </p>

            {/* Approved By — shown for all post-approval statuses */}
            {['approved', 'submitted', 'ordered', 'preparing', 'in_transit', 'delivered'].includes(order.status) && (
              <p className="text-xs text-muted-foreground truncate">
                <span className="text-muted-foreground/70">Approved by </span>
                <span className="font-medium text-foreground">
                  {order.approved_by_name || '—'}
                </span>
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
