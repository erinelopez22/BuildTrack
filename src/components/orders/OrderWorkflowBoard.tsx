import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { OrderCard } from "./OrderCard";
import { OrderDetailModal } from "./OrderDetailModal";
import { RejectOrderDialog } from "./RejectOrderDialog";
import { CreateOrderModal } from "./CreateOrderModal";
import { CompletedOrdersModal } from "./CompletedOrdersModal";
import { OnHoldReasonDialog } from "./OnHoldReasonDialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Plus, ArrowLeft, Loader2, Archive } from "lucide-react";
import { logActivity } from "@/lib/activityLogger";
import { notifyProjectMembers, formatManilaTime } from "@/lib/notificationService";
import type { Order, Project, OrderStatus } from "@/types/database";

interface OrderWorkflowBoardProps {
  project: Project;
  onBack: () => void;
}

// 7-lane workflow: Order Request → Approved → Ordered → Preparing → On Transit → Delivered
const MAIN_WORKFLOW_LANES: { key: string; dbStatuses: OrderStatus[]; label: string; color: string }[] = [
  { key: "order_request", dbStatuses: ["draft", "for_approval"], label: "Order Request", color: "bg-warning/10 border-warning/30" },
  { key: "approved", dbStatuses: ["approved"], label: "Approved", color: "bg-[hsl(210,90%,50%)]/10 border-[hsl(210,90%,50%)]/30" },
  { key: "ordered", dbStatuses: ["submitted", "ordered"], label: "Ordered", color: "bg-[hsl(220,75%,45%)]/10 border-[hsl(220,75%,45%)]/30" },
  { key: "preparing", dbStatuses: ["preparing"], label: "Preparing", color: "bg-violet-500/10 border-violet-500/30" },
  { key: "on_transit", dbStatuses: ["in_transit"], label: "On Transit", color: "bg-amber-400/10 border-amber-400/30" },
  { key: "delivered", dbStatuses: ["delivered", "partially_received", "fully_received", "closed"], label: "Delivered", color: "bg-success/10 border-success/30" },
];

// Exception lanes shown below main flow
const EXCEPTION_LANES: { key: string; dbStatuses: OrderStatus[]; label: string; color: string }[] = [
  { key: "rejected", dbStatuses: ["rejected"], label: "Rejected", color: "bg-destructive/10 border-destructive/30" },
  { key: "on_hold", dbStatuses: ["on_hold"], label: "On Hold", color: "bg-amber-500/10 border-amber-500/30" },
];

export function OrderWorkflowBoard({ project, onBack }: OrderWorkflowBoardProps) {
  const { user, isSuperAdmin, isAdmin, canCreateOrders, canApproveOrders, canProcessLogistics, canReceiveOrders } =
    useAuth();
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [orderToReject, setOrderToReject] = useState<Order | null>(null);
  const [orderToHold, setOrderToHold] = useState<Order | null>(null);
  const [isRejecting, setIsRejecting] = useState(false);
  const [isHolding, setIsHolding] = useState(false);
  const [isCompletedModalOpen, setIsCompletedModalOpen] = useState(false);

  const fetchOrders = async () => {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("project_id", project.id)
      .neq("status", "closed")
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setOrders(data as Order[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();

    const channel = supabase
      .channel("orders-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `project_id=eq.${project.id}`,
        },
        () => {
          fetchOrders();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [project.id]);

  const handleCreateOrder = async (data: {
    materials: { materialId: string; name: string; unit: string; quantity: number }[];
    expectedDeliveryDate: Date | null;
    notes: string;
    supplierName: string;
  }) => {
    if (!user) return;

    setIsCreating(true);

    const { data: orderData, error } = await supabase
      .from("orders")
      .insert({
        project_id: project.id,
        notes: `\n${data.notes}`,
        supplier_name: data.supplierName?.trim() || 'Jagon',
        created_by: user.id,
        order_number: "",
        status: "for_approval" as OrderStatus,
      })
      .select()
      .single();

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setIsCreating(false);
      return;
    }

    if (orderData) {
      const orderItems = [];

      for (const material of data.materials) {
        let skuId: string | null = null;

        const { data: existingSku } = await supabase.from("skus").select("id").eq("name", material.name).maybeSingle();

        if (existingSku) {
          skuId = existingSku.id;
        } else {
          const { data: newSku, error: skuError } = await supabase
            .from("skus")
            .insert({
              name: material.name,
              sku_code: "",
              unit_of_measure: material.unit,
              created_by: user.id,
            })
            .select("id")
            .single();

          if (skuError) {
            console.error("Error creating SKU:", skuError);
            continue;
          }
          skuId = newSku.id;
        }

        if (skuId) {
          orderItems.push({
            order_id: orderData.id,
            sku_id: skuId,
            quotation_item_id: material.materialId,
            quantity_ordered: material.quantity,
            quantity_received: 0,
          });
        }
      }

      if (orderItems.length > 0) {
        const { error: itemsError } = await supabase.from("order_items").insert(orderItems);

        if (itemsError) {
          console.error("Error creating order items:", itemsError);
          toast({
            title: "Warning",
            description: "Order created but some items could not be linked",
            variant: "destructive",
          });
        }
      }

      await logActivity({
        action: "create",
        tableName: "orders",
        recordId: orderData.id,
        newValues: {
          order_number: orderData.order_number,
          status: "for_approval",
          materials_count: data.materials.length,
        },
        userId: user.id,
      });

      await notifyProjectMembers({
        projectId: project.id,
        title: "New Order Created",
        message: `Order ${orderData.order_number} has been created for ${project.name} with ${data.materials.length} material(s)`,
        type: "order",
        referenceType: "order",
        referenceId: orderData.id,
        excludeUserId: user.id,
      });

      toast({ title: "Success", description: "Order created successfully" });
      setIsCreateDialogOpen(false);
      fetchOrders();
    }

    setIsCreating(false);
  };

  const handleStatusChange = async (order: Order, newStatus: OrderStatus) => {
    if (!user) return;

    let hasPermission = false;

    if (isSuperAdmin() || isAdmin()) {
      hasPermission = true;
    } else if (order.status === "for_approval" && (newStatus === "approved" || newStatus === "rejected")) {
      hasPermission = canApproveOrders();
    } else if (order.status === "approved" && (newStatus === "submitted" || newStatus === "ordered")) {
      hasPermission = canApproveOrders();
    } else if (
      (order.status === "submitted" || order.status === "ordered" || order.status === "approved") &&
      newStatus === "preparing"
    ) {
      hasPermission = canProcessLogistics();
    } else if (order.status === "preparing" && newStatus === "in_transit") {
      hasPermission = canProcessLogistics();
    } else if (order.status === "in_transit" && (newStatus === "delivered" || newStatus === "on_hold")) {
      hasPermission = canReceiveOrders();
    } else if (order.status === "delivered" && newStatus === "closed") {
      hasPermission = canApproveOrders() || isAdmin() || isSuperAdmin();
    } else if (order.status === "on_hold") {
      // Resume: restore previous status
      hasPermission = isSuperAdmin() || isAdmin() || canProcessLogistics();
    }

    if (!hasPermission) {
      toast({
        title: "Permission Denied",
        description: "You do not have permission to perform this action",
        variant: "destructive",
      });
      return;
    }

    const updateData: Record<string, unknown> = { status: newStatus };

    if (newStatus === "approved" && order.status === "for_approval") {
      updateData.approved_by = user.id;
      updateData.approved_at = new Date().toISOString();
    }

    // When putting on hold, store previous status
    if (newStatus === "on_hold") {
      updateData.previous_status = order.status;
    }

    // When resuming from on_hold, clear previous_status
    if (order.status === "on_hold") {
      updateData.previous_status = null;
    }

    const { error } = await supabase.from("orders").update(updateData).eq("id", order.id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    if (newStatus === "delivered") {
      const { data: orderItems } = await supabase
        .from("order_items")
        .select("id, quantity_ordered")
        .eq("order_id", order.id);

      if (orderItems) {
        for (const item of orderItems) {
          await supabase.from("order_items").update({ quantity_received: item.quantity_ordered }).eq("id", item.id);
        }
      }
    }

    await logActivity({
      action: newStatus === "approved" ? "approve" : "status_change",
      tableName: "orders",
      recordId: order.id,
      oldValues: { status: order.status },
      newValues: { status: newStatus, order_number: order.order_number },
      userId: user.id,
    });

    const statusLabel =
      newStatus === "closed" ? "Completed" : newStatus.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
    await notifyProjectMembers({
      projectId: project.id,
      title: `Order ${statusLabel}`,
      message: `Order ${order.order_number} has been moved to ${statusLabel}`,
      type: "order",
      referenceType: "order",
      referenceId: order.id,
      excludeUserId: user.id,
    });

    toast({ title: "Success", description: `Order moved to ${statusLabel}` });
    fetchOrders();
  };

  const handleReject = async (reason: string) => {
    if (!orderToReject || !user) return;
    setIsRejecting(true);

    const { error } = await supabase
      .from("orders")
      .update({
        status: "rejected" as OrderStatus,
        rejected_by: user.id,
        rejected_at: new Date().toISOString(),
        rejection_reason: reason || null,
      })
      .eq("id", orderToReject.id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      await logActivity({
        action: "reject",
        tableName: "orders",
        recordId: orderToReject.id,
        oldValues: { status: orderToReject.status },
        newValues: {
          status: "rejected",
          order_number: orderToReject.order_number,
          rejection_reason: reason || null,
        },
        userId: user.id,
      });

      await notifyProjectMembers({
        projectId: project.id,
        title: "Order Rejected",
        message: `Order ${orderToReject.order_number} has been rejected${reason ? `: ${reason}` : ""}`,
        type: "order",
        referenceType: "order",
        referenceId: orderToReject.id,
        excludeUserId: user.id,
      });

      toast({ title: "Order Rejected", description: `Order ${orderToReject.order_number} has been rejected` });
      setOrderToReject(null);
      fetchOrders();
    }

    setIsRejecting(false);
  };

  const handleOnHold = async (reason: string) => {
    if (!orderToHold || !user) return;
    setIsHolding(true);

    const updatedNotes = orderToHold.notes
      ? `${orderToHold.notes}\n\n[ON-HOLD ${formatManilaTime(new Date())}]: ${reason}`
      : `[ON-HOLD ${formatManilaTime(new Date())}]: ${reason}`;

    const { error } = await supabase
      .from("orders")
      .update({
        status: "on_hold" as OrderStatus,
        notes: updatedNotes,
        previous_status: orderToHold.status,
      })
      .eq("id", orderToHold.id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      await logActivity({
        action: "on_hold",
        tableName: "orders",
        recordId: orderToHold.id,
        oldValues: { status: orderToHold.status },
        newValues: {
          status: "on_hold",
          order_number: orderToHold.order_number,
          on_hold_reason: reason,
          previous_status: orderToHold.status,
        },
        userId: user.id,
      });

      await notifyProjectMembers({
        projectId: project.id,
        title: "Order On-Hold",
        message: `Order ${orderToHold.order_number} has been placed on hold: ${reason}`,
        type: "order",
        referenceType: "order",
        referenceId: orderToHold.id,
        excludeUserId: user.id,
      });

      toast({ title: "Order On-Hold", description: `Order ${orderToHold.order_number} has been placed on hold` });
      setOrderToHold(null);
      fetchOrders();
    }

    setIsHolding(false);
  };

  const handleQuickAction = (order: Order, action: OrderStatus | "reject" | "on_hold") => {
    if (action === "reject") {
      setOrderToReject(order);
    } else if (action === "on_hold") {
      setOrderToHold(order);
    } else {
      handleStatusChange(order, action);
    }
  };

  const getOrdersForLane = (dbStatuses: OrderStatus[]) => {
    return orders.filter((o) => dbStatuses.includes(o.status));
  };

  const showCreateButton = canCreateOrders();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

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
          {showCreateButton && (
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Order
            </Button>
          )}
        </div>
      </div>

      {/* Process Legend */}
      <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
        <p className="font-medium text-foreground text-sm mb-1.5">Process Legend</p>
        <div className="flex flex-wrap items-center gap-1">
          <span className="font-medium">Order Request</span><span>→</span>
          <span className="font-medium">Approved</span><span>→</span>
          <span className="font-medium">Ordered</span><span>→</span>
          <span className="font-medium">Preparing</span><span>→</span>
          <span className="font-medium">On Transit</span><span>→</span>
          <span className="font-medium">Delivered</span>
        </div>
      </div>

      {/* Main Workflow Board */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground px-1">Active Workflow</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          {MAIN_WORKFLOW_LANES.map((lane) => {
            const laneOrders = getOrdersForLane(lane.dbStatuses);
            return (
              <div key={lane.key} className={`rounded-xl border-2 ${lane.color} p-3 min-h-[200px] flex flex-col`}>
                <div className="flex items-center justify-between mb-3 flex-shrink-0">
                  <h3 className="font-semibold text-foreground text-xs sm:text-sm truncate">{lane.label}</h3>
                  <span className="text-xs text-muted-foreground bg-background/80 px-2 py-0.5 rounded-full flex-shrink-0 ml-1">
                    {laneOrders.length}
                  </span>
                </div>

                <div className="space-y-4 flex-1 overflow-y-auto">
                  {laneOrders.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-6">No orders</p>
                  ) : (
                    laneOrders.map((order) => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        onClick={() => setSelectedOrderId(order.id)}
                        onQuickAction={(action) => handleQuickAction(order, action)}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Exception Lanes: Rejected & On Hold */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground px-1">Exceptions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {EXCEPTION_LANES.map((lane) => {
            const laneOrders = getOrdersForLane(lane.dbStatuses);
            return (
              <div key={lane.key} className={`rounded-xl border-2 ${lane.color} p-3 min-h-[120px] flex flex-col`}>
                <div className="flex items-center justify-between mb-3 flex-shrink-0">
                  <h3 className="font-semibold text-foreground text-xs sm:text-sm truncate">{lane.label}</h3>
                  <span className="text-xs text-muted-foreground bg-background/80 px-2 py-0.5 rounded-full flex-shrink-0 ml-1">
                    {laneOrders.length}
                  </span>
                </div>

                <div className="space-y-4 flex-1 overflow-y-auto">
                  {laneOrders.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">No orders</p>
                  ) : (
                    laneOrders.map((order) => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        onClick={() => setSelectedOrderId(order.id)}
                        onQuickAction={(action) => handleQuickAction(order, action)}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
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
        orderNumber={orderToReject?.order_number || ""}
        onConfirm={handleReject}
        isSubmitting={isRejecting}
      />

      {/* On-Hold Reason Dialog */}
      <OnHoldReasonDialog
        open={!!orderToHold}
        onOpenChange={(open) => !open && setOrderToHold(null)}
        orderNumber={orderToHold?.order_number || ""}
        onConfirm={handleOnHold}
        isSubmitting={isHolding}
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
