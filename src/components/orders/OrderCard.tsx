import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/AuthContext';
import { formatManilaTime } from '@/lib/notificationService';
import { Check, XCircle, ArrowRight, Truck, MoreVertical, Package, PauseCircle, PlayCircle } from 'lucide-react';
import type { Order, OrderStatus } from '@/types/database';

interface OrderCardProps {
  order: Order;
  onClick?: () => void;
  onQuickAction?: (action: OrderStatus | 'reject' | 'on_hold') => void;
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

// Statuses that can be put on hold
const HOLDABLE_STATUSES: OrderStatus[] = ['draft', 'for_approval', 'approved', 'submitted', 'ordered', 'preparing', 'in_transit'];

export function OrderCard({ order, onClick, onQuickAction }: OrderCardProps) {
  const { isSuperAdmin, isAdmin, canApproveOrders, canProcessLogistics, canReceiveOrders, isWarehouseAdmin } = useAuth();

  const getMenuActions = () => {
    if (!onQuickAction) return [];

    const actions: { label: string; action: OrderStatus | 'reject' | 'on_hold'; icon: React.ReactNode; variant?: 'destructive' }[] = [];
    const hasFullAccess = isSuperAdmin() || isAdmin();
    const canHold = hasFullAccess || (canProcessLogistics() && !isWarehouseAdmin());

    switch (order.status) {
      case 'for_approval':
      case 'draft':
        if (hasFullAccess || canApproveOrders()) {
          actions.push(
            { label: 'Approve', action: 'approved', icon: <Check className="h-4 w-4" /> },
            { label: 'Reject', action: 'reject', icon: <XCircle className="h-4 w-4" />, variant: 'destructive' }
          );
        }
        if (canHold) {
          actions.push({ label: 'On Hold', action: 'on_hold', icon: <PauseCircle className="h-4 w-4" /> });
        }
        break;
      case 'approved':
        if (hasFullAccess || canApproveOrders()) {
          actions.push({ label: 'Submit Order', action: 'submitted', icon: <ArrowRight className="h-4 w-4" /> });
        }
        if (canHold) {
          actions.push({ label: 'On Hold', action: 'on_hold', icon: <PauseCircle className="h-4 w-4" /> });
        }
        break;
      case 'submitted':
      case 'ordered':
        if (hasFullAccess || canProcessLogistics()) {
          actions.push({ label: 'Prepare for Tracking', action: 'preparing', icon: <Package className="h-4 w-4" /> });
        }
        if (canHold) {
          actions.push({ label: 'On Hold', action: 'on_hold', icon: <PauseCircle className="h-4 w-4" /> });
        }
        break;
      case 'preparing':
        if (hasFullAccess || canProcessLogistics()) {
          actions.push({ label: 'On Transit', action: 'in_transit', icon: <Truck className="h-4 w-4" /> });
        }
        if (canHold) {
          actions.push({ label: 'On Hold', action: 'on_hold', icon: <PauseCircle className="h-4 w-4" /> });
        }
        break;
      case 'in_transit':
        // Delivered handled via detail modal (requires evidence + remarks)
        if (canHold) {
          actions.push({ label: 'On Hold', action: 'on_hold', icon: <PauseCircle className="h-4 w-4" /> });
        }
        break;
      case 'on_hold':
        if (hasFullAccess) {
          const previousStatus = (order as any).previous_status as OrderStatus | null;
          const resumeStatus = previousStatus || 'for_approval';
          actions.push({ label: 'Resume', action: resumeStatus as OrderStatus, icon: <PlayCircle className="h-4 w-4" /> });
        } else if (canProcessLogistics() && !isWarehouseAdmin()) {
          const previousStatus = (order as any).previous_status as OrderStatus | null;
          const resumeStatus = previousStatus || 'for_approval';
          actions.push({ label: 'Resume', action: resumeStatus as OrderStatus, icon: <PlayCircle className="h-4 w-4" /> });
        }
        break;
      default:
        break;
    }

    return actions;
  };

  const menuActions = getMenuActions();
  const overdue = isOverdue(order);

  return (
    <div className="relative">
      <Card
        className="group cursor-pointer transition-all duration-200 hover:shadow-md hover:border-primary/30 bg-card"
        onClick={onClick}
      >
        <CardContent className="p-3">
          <div className="space-y-1.5">
            {/* Order ID + Status + Menu */}
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
                {menuActions.length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreVertical className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                      {menuActions.map((ma) => (
                        <DropdownMenuItem
                          key={ma.action}
                          onClick={() => onQuickAction?.(ma.action)}
                          className={ma.variant === 'destructive' ? 'text-destructive focus:text-destructive' : ''}
                        >
                          {ma.icon}
                          <span className="ml-2">{ma.label}</span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
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
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
