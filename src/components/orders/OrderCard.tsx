import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge } from '@/components/common/StatusBadge';
import { format } from 'date-fns';
import type { Order } from '@/types/database';

interface OrderCardProps {
  order: Order;
  onClick?: () => void;
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

export function OrderCard({ order, onClick }: OrderCardProps) {
  return (
    <Card
      className="group cursor-pointer transition-all duration-200 hover:shadow-md hover:border-primary/30 bg-card"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <span className="font-mono text-sm font-semibold text-foreground">
              {order.order_number}
            </span>
            <StatusBadge status={order.status} className="text-xs" />
          </div>
          
          {order.supplier_name && (
            <p className="text-sm text-muted-foreground truncate">
              {order.supplier_name}
            </p>
          )}
          
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {order.expected_delivery_date
                ? format(new Date(order.expected_delivery_date), 'MMM d, yyyy')
                : 'No delivery date'}
            </span>
            <span className="font-medium text-foreground">
              {formatPHP(order.total_amount)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}