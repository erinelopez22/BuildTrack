import { useState, useEffect } from 'react';
import { ordersApi } from '@/lib/apiClient';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { formatManilaTime } from '@/lib/notificationService';
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
import { Loader2, Archive, MoreVertical, Trash2, AlertTriangle } from 'lucide-react';
import type { Order as ApiOrder } from '@/lib/apiClient';

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
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [orderToDelete, setOrderToDelete] = useState<ApiOrder | null>(null);

  const canDelete = isAdmin();

  const fetchCompletedOrders = async () => {
    setLoading(true);
    try {
      const result = await ordersApi.getByProject(projectId, 'closed');
      setOrders(result.data ?? []);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchCompletedOrders();
    }
  }, [open, projectId]);

  const handleDeleteOrder = async () => {
    if (!orderToDelete) return;

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
      await ordersApi.delete(orderToDelete.id);

      toast({
        title: 'Order Deleted',
        description: 'Order deleted permanently.',
      });

      setOrders((prev) => prev.filter((o) => o.id !== orderToDelete.id));
      setOrderToDelete(null);
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
        <DialogContent className="max-w-2xl w-[calc(100%-2rem)] max-h-[85vh] flex flex-col gap-4">
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
            <ScrollArea className="flex-1 max-h-[calc(100dvh-120px)] sm:max-h-[60vh] pr-4">
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
                            {order.orderNumber}
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
                          {order.createdAt ? formatManilaTime(order.createdAt) : 'No date'}
                        </p>

                        {order.supplierName && (
                          <p
                            className="text-xs text-muted-foreground truncate cursor-pointer"
                            onClick={() => setSelectedOrderId(order.id)}
                          >
                            {order.supplierName}
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
                <span className="font-semibold">{orderToDelete?.orderNumber}</span>.
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
