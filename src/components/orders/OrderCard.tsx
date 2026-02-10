import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { formatManilaTime } from '@/lib/notificationService';
import { Check, XCircle, ArrowRight, Truck, Package, PauseCircle, CheckCircle2 } from 'lucide-react';
import type { Order, OrderStatus } from '@/types/database';

interface OrderCardProps {
  order: Order;
  onClick?: () => void;
  onQuickAction?: (action: OrderStatus | 'reject' | 'on_hold') => void;
  showHoverActions?: boolean;
}

export function OrderCard({ order, onClick, onQuickAction, showHoverActions = true }: OrderCardProps) {
  const { isSuperAdmin, isAdmin, canApproveOrders, canProcessLogistics, canReceiveOrders } = useAuth();
  const [isHovered, setIsHovered] = useState(false);

  // Determine which quick actions to show based on status and permissions
  const getQuickActions = () => {
    if (!showHoverActions || !onQuickAction) return [];

    const actions: { label: string; action: OrderStatus | 'reject' | 'on_hold'; icon: React.ReactNode; variant: 'approve' | 'reject' | 'next' | 'hold' }[] = [];
    const hasFullAccess = isSuperAdmin() || isAdmin();

    switch (order.status) {
      case 'for_approval':
        if (hasFullAccess || canApproveOrders()) {
          actions.push(
            { label: 'Approve', action: 'approved', icon: <Check className="h-3 w-3" />, variant: 'approve' },
            { label: 'Reject', action: 'reject', icon: <XCircle className="h-3 w-3" />, variant: 'reject' }
          );
        }
        break;
      case 'approved':
        if (hasFullAccess || canApproveOrders()) {
          actions.push({ label: 'Submit', action: 'submitted', icon: <ArrowRight className="h-3 w-3" />, variant: 'next' });
        }
        break;
      case 'submitted':
        if (hasFullAccess || canProcessLogistics()) {
          actions.push({ label: 'Prepare', action: 'preparing', icon: <Package className="h-3 w-3" />, variant: 'next' });
        }
        break;
      case 'preparing':
        if (hasFullAccess || canProcessLogistics()) {
          actions.push({ label: 'Transit', action: 'in_transit', icon: <Truck className="h-3 w-3" />, variant: 'next' });
        }
        break;
      case 'in_transit':
        if (hasFullAccess || canReceiveOrders()) {
          actions.push(
            { label: 'Delivered', action: 'delivered', icon: <CheckCircle2 className="h-3 w-3" />, variant: 'approve' },
            { label: 'On-Hold', action: 'on_hold', icon: <PauseCircle className="h-3 w-3" />, variant: 'hold' }
          );
        }
        break;
      case 'delivered':
        if (hasFullAccess || canApproveOrders()) {
          actions.push({ label: 'Complete', action: 'closed', icon: <CheckCircle2 className="h-3 w-3" />, variant: 'approve' });
        }
        break;
      case 'on_hold':
        if (hasFullAccess) {
          actions.push({ label: 'Resume', action: 'in_transit', icon: <Truck className="h-3 w-3" />, variant: 'next' });
        }
        break;
      default:
        break;
    }

    return actions;
  };

  const quickActions = getQuickActions();

  const getButtonClass = (variant: 'approve' | 'reject' | 'next' | 'hold') => {
    switch (variant) {
      case 'approve':
        return 'bg-success/20 hover:bg-success/30 text-success border-success/30';
      case 'reject':
        return 'bg-destructive/20 hover:bg-destructive/30 text-destructive border-destructive/30';
      case 'hold':
        return 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-600 border-amber-500/30';
      case 'next':
      default:
        return 'bg-primary/20 hover:bg-primary/30 text-primary border-primary/30';
    }
  };

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Card
        className="group cursor-pointer transition-all duration-200 hover:shadow-md hover:border-primary/30 bg-card"
        onClick={onClick}
      >
        <CardContent className="p-3">
          <div className="space-y-1.5">
            {/* Order ID - Most Prominent */}
            <div className="flex items-start justify-between gap-2">
              <span className="font-mono text-sm font-bold text-foreground">
                {order.order_number}
              </span>
              <StatusBadge status={order.status} className="text-[10px] px-1.5 py-0.5" />
            </div>

            {/* Created Date (Manila time) */}
            <p className="text-xs text-muted-foreground">
              {order.created_at ? formatManilaTime(order.created_at) : 'No date'}
            </p>

            {/* Supplier */}
            <p className="text-xs text-muted-foreground truncate">
              {order.supplier_name?.trim() || 'Warehouse'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Hover Quick Actions */}
      {isHovered && quickActions.length > 0 && (
        <div className="absolute -bottom-3 left-0 right-0 flex justify-center gap-1 z-10 animate-in fade-in-0 slide-in-from-top-1 duration-150">
          {quickActions.map((qa) => (
            <Button
              key={qa.action}
              size="sm"
              variant="outline"
              className={`text-[10px] h-6 px-2 shadow-sm ${getButtonClass(qa.variant)}`}
              onClick={(e) => {
                e.stopPropagation();
                onQuickAction?.(qa.action);
              }}
            >
              {qa.icon}
              <span className="ml-1">{qa.label}</span>
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
