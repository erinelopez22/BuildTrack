import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { logActivity } from '@/lib/activityLogger';
import { notifyProjectMembers, formatManilaTime } from '@/lib/notificationService';
import { OrderCard } from './OrderCard';
import { OrderDetailModal } from './OrderDetailModal';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge } from '@/components/common/StatusBadge';
import { format } from 'date-fns';
import { Loader2, Archive, MoreVertical, Trash2, AlertTriangle } from 'lucide-react';
import type { Order } from '@/types/database';

interface CompletedOrdersModalProps {
  projectId: string;
  projectName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOrderDeleted?: () => void;
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

export function CompletedOrdersModal({
  projectId,
  projectName,
  open,
  onOpenChange,
  onOrderDeleted,
}: CompletedOrdersModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);
  const [canDelete, setCanDelete] = useState(false);

  // Check if user can delete orders (Admin or Super Admin only)
  useEffect(() => {
    const checkDeletePermission = async () => {
      if (!user) {
        setCanDelete(false);
        return;
      }

      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      const hasAdminRole = userRoles?.some(
        (r) => r.role === 'admin' || r.role === 'super_admin'
      );

      setCanDelete(!!hasAdminRole);
    };

    if (open) {
      checkDeletePermission();
    }
  }, [open, user]);

  const fetchCompletedOrders = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('project_id', projectId)
      .eq('status', 'closed')
      .order('updated_at', { ascending: false });

    setOrders((data as Order[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    if (open) {
      fetchCompletedOrders();
    }
  }, [open, projectId]);

  const handleDeleteOrder = async () => {
    if (!user || !orderToDelete) return;

    // Safety check: ensure order is actually completed (closed status)
    if (orderToDelete.status !== 'closed') {
      toast({
        title: 'Error',
        description: 'Only completed orders can be deleted from this modal.',
        variant: 'destructive',
      });
      setOrderToDelete(null);
      return;
    }

    setDeleting(true);
    try {
      // Get user profile for activity log
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle();

      const userName = userProfile?.full_name || 'User';

      // Get user role
      const { data: userRole } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      const roleName = userRole?.role || 'member';

      const orderId = orderToDelete.id;
      const orderNumber = orderToDelete.order_number;

      // 1. Get delivery IDs for this order (to delete delivery_items)
      const { data: deliveries } = await supabase
        .from('deliveries')
        .select('id')
        .eq('order_id', orderId);

      const deliveryIds = deliveries?.map((d) => d.id) || [];

      // 2. Delete delivery_items if any deliveries exist
      if (deliveryIds.length > 0) {
        const { error: deleteDeliveryItemsError } = await supabase
          .from('delivery_items')
          .delete()
          .in('delivery_id', deliveryIds);

        if (deleteDeliveryItemsError) throw deleteDeliveryItemsError;
      }

      // 3. Delete deliveries
      const { error: deleteDeliveriesError } = await supabase
        .from('deliveries')
        .delete()
        .eq('order_id', orderId);

      if (deleteDeliveriesError) throw deleteDeliveriesError;

      // 4. Delete order_items
      const { error: deleteOrderItemsError } = await supabase
        .from('order_items')
        .delete()
        .eq('order_id', orderId);

      if (deleteOrderItemsError) throw deleteOrderItemsError;

      // 5. Delete the order itself
      const { error: deleteOrderError } = await supabase
        .from('orders')
        .delete()
        .eq('id', orderId);

      if (deleteOrderError) throw deleteOrderError;

      // 6. Log activity (keep audit trail)
      await logActivity({
        action: 'delete',
        tableName: 'orders',
        recordId: orderId,
        oldValues: {
          order_number: orderNumber,
          status: 'closed',
        },
        newValues: null,
        userId: user.id,
      });

      // 7. Notify project members
      await notifyProjectMembers({
        projectId,
        title: 'Order Deleted',
        message: `${userName} (${roleName}) permanently deleted completed order ${orderNumber} from ${projectName} on ${formatManilaTime(new Date())}`,
        type: 'order',
        referenceType: 'orders',
        referenceId: orderId,
        excludeUserId: user.id,
      });

      toast({
        title: 'Order Deleted',
        description: 'Order deleted permanently.',
      });

      // Remove from local state immediately
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
      setOrderToDelete(null);

      // Notify parent to refresh progress calculations
      onOrderDeleted?.();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete order',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Archive className="h-5 w-5 text-muted-foreground" />
              Completed Orders — {projectName}
            </DialogTitle>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-12">
              <Archive className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">No completed orders yet</p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                Orders moved from Delivered will appear here
              </p>
            </div>
          ) : (
            <ScrollArea className="max-h-[60vh] pr-4">
              <div className="grid gap-3">
                {orders.map((order) => (
                  <Card
                    key={order.id}
                    className="group transition-all duration-200 hover:shadow-md hover:border-primary/30 bg-card"
                  >
                    <CardContent className="p-3">
                      <div className="space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <span
                            className="font-mono text-sm font-bold text-foreground cursor-pointer hover:text-primary"
                            onClick={() => setSelectedOrderId(order.id)}
                          >
                            {order.order_number}
                          </span>
                          <div className="flex items-center gap-2">
                            <StatusBadge status={order.status} className="text-[10px] px-1.5 py-0.5" />
                            {canDelete && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <MoreVertical className="h-3 w-3" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive cursor-pointer"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setOrderToDelete(order);
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete Order
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                        </div>

                        <p
                          className="text-xs text-muted-foreground cursor-pointer"
                          onClick={() => setSelectedOrderId(order.id)}
                        >
                          {order.created_at ? formatManilaTime(order.created_at) : 'No date'}
                        </p>

                        {order.supplier_name && (
                          <p
                            className="text-xs text-muted-foreground truncate cursor-pointer"
                            onClick={() => setSelectedOrderId(order.id)}
                          >
                            {order.supplier_name}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* Order Detail Modal */}
      <OrderDetailModal
        orderId={selectedOrderId}
        open={!!selectedOrderId}
        onOpenChange={(isOpen) => {
          if (!isOpen) setSelectedOrderId(null);
        }}
        onStatusChange={fetchCompletedOrders}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!orderToDelete} onOpenChange={(isOpen) => !isOpen && setOrderToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Delete Order
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                You are about to permanently delete order{' '}
                <span className="font-semibold">{orderToDelete?.order_number}</span>.
              </p>
              <p className="font-medium text-destructive">
                This action cannot be undone.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteOrder}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'OK'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
