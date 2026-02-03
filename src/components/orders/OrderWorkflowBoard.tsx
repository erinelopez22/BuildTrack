import { useState, useEffect } from 'react';
import { request } from '@/integrations/api';
import { useAuth } from '@/contexts/AuthContext';
import { mapApiOrderWithProject, type ApiOrderWithProject } from '@/lib/apiMappers';
import { OrderCard } from './OrderCard';
import { OrderDetailModal } from './OrderDetailModal';
import { RejectOrderDialog } from './RejectOrderDialog';
import { CreateOrderModal } from './CreateOrderModal';
import { CompletedOrdersModal } from './CompletedOrdersModal';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Plus, ArrowLeft, Loader2, XCircle, Check, Archive, EyeOff } from 'lucide-react';
import { logActivity } from '@/lib/activityLogger';
import { notifyProjectMembers } from '@/lib/notificationService';
import type { Order, Project, OrderStatus } from '@/types/database';

interface OrderWorkflowBoardProps {
  project: Project;
  onBack: () => void;
}

// Main workflow lanes (active orders flow)
const MAIN_WORKFLOW_LANES: { key: OrderStatus; label: string; color: string }[] = [
  { key: 'for_approval', label: 'Order Requested', color: 'bg-warning/10 border-warning/30' },
  { key: 'approved', label: 'Order Approved', color: 'bg-[hsl(210,90%,50%)]/10 border-[hsl(210,90%,50%)]/30' },
  { key: 'submitted', label: 'Order Submitted', color: 'bg-[hsl(210,90%,50%)]/15 border-[hsl(210,80%,45%)]/30' },
  { key: 'preparing', label: 'Preparing for Tracking', color: 'bg-[hsl(220,75%,45%)]/10 border-[hsl(220,75%,45%)]/30' },
  { key: 'in_transit', label: 'On Transit', color: 'bg-amber-400/10 border-amber-400/30' },
  { key: 'delivered', label: 'Delivered', color: 'bg-success/10 border-success/30' },
];

// Separated lanes for held/rejected orders
const SPECIAL_STATUS_LANES: { key: OrderStatus; label: string; color: string; icon: 'hold' | 'reject' }[] = [
  { key: 'on_hold', label: 'On-hold', color: 'bg-amber-500/10 border-amber-500/30', icon: 'hold' },
  { key: 'rejected', label: 'Rejected', color: 'bg-destructive/10 border-destructive/30', icon: 'reject' },
];

export function OrderWorkflowBoard({ project, onBack }: OrderWorkflowBoardProps) {
  const { user, isApprover, isSuperAdmin, isAdmin } = useAuth();
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [orderToReject, setOrderToReject] = useState<Order | null>(null);
  const [isRejecting, setIsRejecting] = useState(false);
  const [isCompletedModalOpen, setIsCompletedModalOpen] = useState(false);

  const fetchOrders = async () => {
    try {
      const data = await request<ApiOrderWithProject[]>('/api/orders?status=all');
      const projectOrders = (data ?? [])
        .filter((o) => o.projectId === project.id && o.status !== 'closed')
        .map(mapApiOrderWithProject);
      setOrders(projectOrders);
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'Failed to load orders', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [project.id]);

  const handleCreateOrder = async (data: {
    materials: { materialId: string; name: string; unit: string; quantity: number }[];
    expectedDeliveryDate: Date | null;
    notes: string;
  }) => {
    if (!user) return;

    setIsCreating(true);

    // Format materials as notes content (including the materials list in the notes)
    const materialsDescription = data.materials
      .map((m) => `• ${m.name} (${m.unit}) - Qty: ${m.quantity}`)
      .join('\n');
    
    const fullNotes = `Materials:\n${materialsDescription}\n\n${data.notes}`;

    try {
      const orderData = await request<{ id: string; orderNumber: string; status: string; [key: string]: unknown }>('/api/orders', {
        method: 'POST',
        body: {
          projectId: project.id,
          expectedDeliveryDate: data.expectedDeliveryDate?.toISOString().split('T')[0] || null,
          notes: fullNotes,
        },
      });
      toast({ title: 'Success', description: 'Order created successfully' });
      setIsCreateDialogOpen(false);
      fetchOrders();
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to create order', variant: 'destructive' });
    } finally {
      setIsCreating(false);
    }
  };

  const handleStatusChange = async (order: Order, newStatus: OrderStatus) => {
    if (!user) return;

    // Check permissions
    const canTransition = isSuperAdmin() || isApprover();
    if (!canTransition) {
      toast({ 
        title: 'Permission Denied', 
        description: 'Only Approvers, Admins, and Super Admins can change order status', 
        variant: 'destructive' 
      });
      return;
    }

    // Validate transition rules (non-Super Admin)
    if (!isSuperAdmin()) {
      const validTransitions: Record<OrderStatus, OrderStatus[]> = {
        for_approval: ['approved', 'rejected', 'on_hold'],
        approved: ['submitted', 'rejected', 'on_hold'],
        submitted: ['preparing', 'on_hold'],
        preparing: ['in_transit', 'on_hold'],
        in_transit: ['delivered', 'on_hold'],
        delivered: ['closed'],
        rejected: [],
        on_hold: [], // Admin only can move back
        draft: ['for_approval'],
        ordered: ['delivered'],
        partially_received: ['fully_received'],
        fully_received: ['closed'],
        closed: [],
        cancelled: [],
      };

      if (!validTransitions[order.status]?.includes(newStatus)) {
        toast({
          title: 'Invalid Transition',
          description: `Cannot move from ${order.status} to ${newStatus}`,
          variant: 'destructive',
        });
        return;
      }
    }

    const updateData: Record<string, unknown> = { status: newStatus };
    
    // Set approval info if approving
    if (newStatus === 'approved' && order.status === 'for_approval') {
      updateData.approved_by = user.id;
      updateData.approved_at = new Date().toISOString();
    }

    try {
      await request(`/api/orders/${order.id}`, {
        method: 'PUT',
        body: {
          status: newStatus,
          ...(newStatus === 'approved' && order.status === 'for_approval' ? { approvedBy: user.id } : {}),
        },
      });
      const statusLabel = newStatus.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
      toast({ title: 'Success', description: `Order moved to ${statusLabel}` });
      fetchOrders();
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to update order', variant: 'destructive' });
    }
  };

  const handleReject = async (reason: string) => {
    if (!orderToReject || !user) return;
    setIsRejecting(true);
    try {
      await request(`/api/orders/${orderToReject.id}`, {
        method: 'PUT',
        body: { status: 'rejected', rejectedBy: user.id, rejectionReason: reason || null },
      });
      toast({ title: 'Order Rejected', description: `Order ${orderToReject.order_number} has been rejected` });
      setOrderToReject(null);
      fetchOrders();
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to reject order', variant: 'destructive' });
    } finally {
      setIsRejecting(false);
    }
  };

  // Get orders for a specific lane
  const getOrdersForLane = (status: OrderStatus) => {
    return orders.filter(o => o.status === status);
  };

  // Get the next status in the workflow
  const getNextStatus = (currentStatus: OrderStatus): OrderStatus | null => {
    const statusOrder: OrderStatus[] = ['for_approval', 'approved', 'submitted', 'preparing', 'in_transit', 'delivered'];
    const currentIndex = statusOrder.indexOf(currentStatus);
    if (currentIndex >= 0 && currentIndex < statusOrder.length - 1) {
      return statusOrder[currentIndex + 1];
    }
    return null;
  };

  const canMoveOrder = isApprover() || isSuperAdmin();
  const canRejectOrder = isApprover() || isAdmin() || isSuperAdmin();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  const handleHideOrder = async (order: Order) => {
    if (!user) return;
    try {
      await request(`/api/orders/${order.id}`, { method: 'PUT', body: { status: 'closed' } });
      // Log activity
      await logActivity({
        action: 'hide',
        tableName: 'orders',
        recordId: order.id,
        oldValues: { status: order.status },
        newValues: { status: 'closed', order_number: order.order_number },
        userId: user.id,
      });

      // Notify project members
      await notifyProjectMembers({
        projectId: project.id,
        title: 'Order Completed',
        message: `Order ${order.order_number} has been marked as completed`,
        type: 'order',
        referenceType: 'order',
        referenceId: order.id,
        excludeUserId: user.id,
      });

      toast({ title: 'Success', description: 'Order moved to Completed' });
      fetchOrders();
    }catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-xl font-semibold text-foreground">{project.name}</h2>
            <p className="text-sm text-muted-foreground">Order Workflow</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setIsCompletedModalOpen(true)}>
            <Archive className="mr-2 h-4 w-4" />
            Completed
          </Button>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Order
          </Button>
        </div>
      </div>

      {/* Main Workflow Board - Active Status Lanes */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground px-1">Active Workflow</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          {MAIN_WORKFLOW_LANES.map((lane) => {
            const laneOrders = getOrdersForLane(lane.key);
            return (
              <div
                key={lane.key}
                className={`rounded-xl border-2 ${lane.color} p-3 min-h-[200px] flex flex-col`}
              >
                <div className="flex items-center justify-between mb-3 flex-shrink-0">
                  <h3 className="font-semibold text-foreground text-xs sm:text-sm truncate">{lane.label}</h3>
                  <span className="text-xs text-muted-foreground bg-background/80 px-2 py-0.5 rounded-full flex-shrink-0 ml-1">
                    {laneOrders.length}
                  </span>
                </div>

                <div className="space-y-2 flex-1 overflow-y-auto">
                  {laneOrders.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-6">
                      No orders
                    </p>
                  ) : (
                    laneOrders.map((order) => (
                      <div key={order.id} className="group relative">
                        <OrderCard
                          order={order}
                          onClick={() => setSelectedOrderId(order.id)}
                        />
                        {/* Action buttons - show on hover if user has permissions */}
                        {order.status === 'for_approval' && (
                          <div className="absolute -bottom-2 left-0 right-0 flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                            {canMoveOrder && (
                              <Button
                                size="sm"
                                variant="secondary"
                                className="text-xs h-6 px-2 bg-success/20 hover:bg-success/30 text-success"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStatusChange(order, 'approved');
                                }}
                              >
                                <Check className="h-3 w-3 mr-1" />
                                Approve
                              </Button>
                            )}
                            {canRejectOrder && (
                              <Button
                                size="sm"
                                variant="secondary"
                                className="text-xs h-6 px-2 bg-destructive/20 hover:bg-destructive/30 text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOrderToReject(order);
                                }}
                              >
                                <XCircle className="h-3 w-3 mr-1" />
                                Reject
                              </Button>
                            )}
                          </div>
                        )}
                        {/* Move button for statuses that can progress */}
                        {!['for_approval', 'rejected', 'delivered', 'on_hold'].includes(order.status) && canMoveOrder && getNextStatus(order.status) && (
                          <Button
                            size="sm"
                            variant="secondary"
                            className="absolute -bottom-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-xs h-6 px-2 z-10"
                            onClick={(e) => {
                              e.stopPropagation();
                              const nextStatus = getNextStatus(order.status);
                              if (nextStatus) handleStatusChange(order, nextStatus);
                            }}
                          >
                            Move to Next →
                          </Button>
                        )}
                        {/* Hide button for delivered orders */}
                        {order.status === 'delivered' && canMoveOrder && (
                          <Button
                            size="sm"
                            variant="secondary"
                            className="absolute -bottom-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-xs h-6 px-2 bg-muted/80 hover:bg-muted z-10"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleHideOrder(order);
                            }}
                          >
                            <EyeOff className="h-3 w-3 mr-1" />
                            Hide
                          </Button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Separated Section for On-hold and Rejected */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        {SPECIAL_STATUS_LANES.map((lane) => {
          const laneOrders = getOrdersForLane(lane.key);
          return (
            <div
              key={lane.key}
              className={`rounded-xl border-2 ${lane.color} p-4`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  {lane.icon === 'hold' ? (
                    <div className="p-1.5 rounded-lg bg-amber-500/20">
                      <Loader2 className="h-4 w-4 text-amber-600" />
                    </div>
                  ) : (
                    <div className="p-1.5 rounded-lg bg-destructive/20">
                      <XCircle className="h-4 w-4 text-destructive" />
                    </div>
                  )}
                  <h3 className="font-semibold text-foreground">{lane.label}</h3>
                </div>
                <span className="text-sm text-muted-foreground bg-background/80 px-2.5 py-1 rounded-full">
                  {laneOrders.length} {laneOrders.length === 1 ? 'order' : 'orders'}
                </span>
              </div>

              {laneOrders.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No {lane.label.toLowerCase()} orders
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {laneOrders.map((order) => (
                    <div key={order.id} className="group relative">
                      <OrderCard
                        order={order}
                        onClick={() => setSelectedOrderId(order.id)}
                      />
                      {/* Super Admin can move on-hold orders back */}
                      {order.status === 'on_hold' && isSuperAdmin() && (
                        <Button
                          size="sm"
                          variant="secondary"
                          className="absolute -bottom-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-xs h-6 px-2 bg-primary/20 hover:bg-primary/30 z-10"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStatusChange(order, 'for_approval');
                          }}
                        >
                          Restore to Queue
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Create Order Modal */}
      <CreateOrderModal
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        projectId={project.id}
        projectName={project.name}
        onSubmit={handleCreateOrder}
        isSubmitting={isCreating}
      />

      {/* Order Detail Modal */}
      <OrderDetailModal
        orderId={selectedOrderId}
        open={!!selectedOrderId}
        onOpenChange={(open) => !open && setSelectedOrderId(null)}
        onStatusChange={fetchOrders}
      />

      {/* Reject Order Dialog */}
      <RejectOrderDialog
        open={!!orderToReject}
        onOpenChange={(open) => !open && setOrderToReject(null)}
        orderNumber={orderToReject?.order_number || ''}
        onConfirm={handleReject}
        isSubmitting={isRejecting}
      />

      {/* Completed Orders Modal */}
      <CompletedOrdersModal
        projectId={project.id}
        projectName={project.name}
        open={isCompletedModalOpen}
        onOpenChange={setIsCompletedModalOpen}
        onOrderDeleted={fetchOrders}
      />
    </div>
  );
}
