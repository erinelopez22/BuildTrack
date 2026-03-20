import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Loader2, Package, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/common/StatusBadge";
import { ordersApi } from "@/lib/apiClient";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import type { OrderStatus } from "@/types/database";

interface ActiveOrdersModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
}

const ACTIVE_STATUSES: OrderStatus[] = [
  "for_approval",
  "approved",
  "submitted",
  "preparing",
  "ordered",
  "in_transit",
  "delivered",
  "partially_received",
  "on_hold",
];

interface OrderRow {
  id: string;
  orderNumber: string;
  status: string;
  notes?: string;
  createdAt: string;
}

export function ActiveOrdersModal({ open, onOpenChange, projectId, projectName }: ActiveOrdersModalProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<OrderRow[]>([]);

  const fetchActiveOrders = async () => {
    setLoading(true);
    try {
      const result = await ordersApi.getByProject(projectId);
      const all = result.data ?? [];
      const active = all.filter((o) => ACTIVE_STATUSES.includes(o.status as OrderStatus));
      setOrders(
        active.map((o) => ({
          id: o.id,
          orderNumber: o.orderNumber,
          status: o.status,
          notes: o.notes,
          createdAt: o.createdAt,
        }))
      );
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load orders",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchActiveOrders();
    }
  }, [open, projectId]);

  const handleViewOrder = (orderId: string) => {
    onOpenChange(false);
    navigate(`/orders?orderId=${orderId}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[calc(100%-2rem)]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Active Orders - {projectName}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-12">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No active orders for this project.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <div
                key={order.id}
                className="flex items-center justify-between p-4 border rounded-lg bg-card hover:bg-muted/50 transition-colors"
              >
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{order.orderNumber}</span>
                    <StatusBadge status={order.status} />
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Created: {format(new Date(order.createdAt), "MMM dd, yyyy h:mm a")}
                  </div>
                  {order.notes && (
                    <p className="text-sm text-muted-foreground line-clamp-1">{order.notes}</p>
                  )}
                </div>
                <Button variant="ghost" size="sm" onClick={() => handleViewOrder(order.id)} className="shrink-0">
                  <ExternalLink className="h-4 w-4 mr-1" />
                  View
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
