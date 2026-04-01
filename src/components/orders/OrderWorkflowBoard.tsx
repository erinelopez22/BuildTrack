import { useState, useEffect } from "react";
import { ordersApi } from "@/lib/apiClient";
import type { Order as ApiOrder } from "@/lib/apiClient";
import { useAuth } from "@/contexts/AuthContext";
import { useOrderStatusUpdates } from "@/hooks/useOrderStatusUpdates";
import { OrderCard } from "./OrderCard";
import { OrderDetailModal } from "./OrderDetailModal";
import { RejectOrderDialog } from "./RejectOrderDialog";
import { CreateOrderModal } from "./CreateOrderModal";
import { CompletedOrdersModal } from "./CompletedOrdersModal";
import { OnHoldReasonDialog } from "./OnHoldReasonDialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Plus, ArrowLeft, Loader2, Archive, Trash2, XCircle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { logActivity } from "@/lib/activityLogger";
import { notifyProjectMembers, formatManilaTime } from "@/lib/notificationService";
import type { Order, Project, OrderStatus } from "@/types/database";

// ── Mapping: API camelCase → local snake_case ────────────────────────────────

function toLocalOrder(o: ApiOrder): Order {
  return {
    id: o.id,
    project_id: o.projectId,
    order_number: o.orderNumber,
    order_type: o.orderType ?? "",
    status: o.status as OrderStatus,
    supplier_name: o.supplierName ?? null,
    supplier_contact: o.supplierContact ?? null,
    expected_delivery_date: o.expectedDeliveryDate ?? null,
    notes: o.notes ?? null,
    total_amount: o.totalAmount ?? null,
    approved_by: o.approvedBy ?? null,
    approved_at: o.approvedAt ?? null,
    approved_by_name: o.approvedByName ?? null,
    rejected_by: o.rejectedBy ?? null,
    rejected_at: o.rejectedAt ?? null,
    rejection_reason: o.rejectionReason ?? null,
    previous_status: null,
    created_at: o.createdAt,
    updated_at: o.updatedAt,
    created_by: o.createdBy ?? "",
  };
}

// ── Local types ───────────────────────────────────────────────────────────────

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

const EXCEPTION_LANES: { key: string; dbStatuses: OrderStatus[]; label: string; color: string }[] = [
  { key: "on_hold", dbStatuses: ["on_hold"], label: "On Hold", color: "bg-amber-500/10 border-amber-500/30" },
];

interface RejectedOrderRow {
  id: string;
  order_number: string;
  supplier_name: string | null;
  rejection_reason: string | null;
  rejected_at: string | null;
  rejected_by: string | null;
  project_id: string;
}

export function OrderWorkflowBoard({ project, onBack }: OrderWorkflowBoardProps) {
  const { user, isSuperAdmin, isAdmin, canCreateOrders, canApproveOrders, canProcessLogistics, canReceiveOrders, isWarehouseAdmin, isOfficeAdmin, isProjectEngineer } =
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
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Rejected orders
  const [rejectedOrders, setRejectedOrders] = useState<RejectedOrderRow[]>([]);

  const canDeleteRejected = isSuperAdmin() || isAdmin();

  const fetchOrders = async () => {
    const res = await ordersApi.getByProject(project.id);
    if (!res.success) {
      toast({ title: "Error", description: res.message ?? "Failed to load orders", variant: "destructive" });
    } else {
      const activeStatuses = new Set<string>([
        "draft", "for_approval", "approved", "submitted", "ordered",
        "preparing", "in_transit", "delivered", "partially_received",
        "fully_received", "on_hold",
      ]);
      const filtered = (res.data ?? [])
        .filter((o) => activeStatuses.has(o.status))
        .map(toLocalOrder);
      setOrders(filtered);
    }
    setLoading(false);
    fetchRejectedOrders();
  };

  const fetchRejectedOrders = async () => {
    const res = await ordersApi.getAll({ status: "rejected", projectId: project.id });
    if (res.success && res.data) {
      setRejectedOrders(
        res.data.map((o) => ({
          id: o.id,
          order_number: o.orderNumber,
          supplier_name: o.supplierName ?? null,
          rejection_reason: o.rejectionReason ?? null,
          rejected_at: o.rejectedAt ?? null,
          rejected_by: o.rejectedByName ?? null,
          project_id: o.projectId,
        }))
      );
    } else {
      setRejectedOrders([]);
    }
  };

  const handleDeleteRejectedOrder = async () => {
    if (!deletingOrderId || !user) return;
    setDeleteLoading(true);

    try {
      const res = await ordersApi.delete(deletingOrderId);
      if (!res.success) throw new Error(res.message ?? "Delete failed");

      await logActivity({
        action: "delete_rejected_order",
        tableName: "rejected_orders",
        recordId: deletingOrderId,
        oldValues: { status: "rejected" },
        newValues: null,
        userId: user.id,
      });

      toast({ title: "Success", description: "Rejected order permanently deleted." });
      setDeletingOrderId(null);
      fetchRejectedOrders();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setDeleteLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [project.id]);

  // Real-time order status updates via SignalR
  useOrderStatusUpdates((update) => {
    setOrders((prev) =>
      prev.map((o) =>
        o.id === update.id ? { ...o, status: update.status as OrderStatus } : o
      )
    );
  });

  const handleCreateOrder = async (data: {
    materials: { materialId: string; name: string; unit: string; quantity: number }[];
    expectedDeliveryDate: Date | null;
    notes: string;
    supplierName: string;
  }) => {
    if (!user) return;

    setIsCreating(true);

    try {
      // Pass materialName directly — backend auto-finds or creates the SKU
      const orderRes = await ordersApi.create({
        projectId: project.id,
        notes: `\n${data.notes}`,
        supplierName: data.supplierName?.trim() || "Jagon",
        expectedDeliveryDate: data.expectedDeliveryDate?.toISOString(),
        items: data.materials.map((m) => ({
          materialName: m.name,
          unit: m.unit,
          quotationItemId: m.materialId || undefined,
          quantityOrdered: m.quantity,
        })),
      });

      if (!orderRes.success || !orderRes.data) {
        toast({ title: "Error", description: orderRes.message ?? "Failed to create order", variant: "destructive" });
        setIsCreating(false);
        return;
      }

      const orderData = orderRes.data;

      await logActivity({
        action: "create",
        tableName: "orders",
        recordId: orderData.id,
        newValues: {
          order_number: orderData.orderNumber,
          status: "for_approval",
          materials_count: data.materials.length,
        },
        userId: user.id,
      });

      await notifyProjectMembers({
        projectId: project.id,
        title: "New Order Created",
        message: `Order ${orderData.orderNumber} has been created for ${project.name} with ${data.materials.length} material(s)`,
        type: "order",
        referenceType: "order",
        referenceId: orderData.id,
        excludeUserId: user.id,
      });

      toast({ title: "Success", description: "Order created successfully" });
      setIsCreateDialogOpen(false);
      fetchOrders();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }

    setIsCreating(false);
  };

  const handleStatusChange = async (order: Order, newStatus: OrderStatus) => {
    if (!user) return;

    let hasPermission = false;

    if (newStatus === "on_hold" && isWarehouseAdmin() && !isSuperAdmin() && !isAdmin()) {
      hasPermission = false;
    } else if (isSuperAdmin() || isAdmin()) {
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
      hasPermission = isSuperAdmin() || isAdmin() || (canProcessLogistics() && !isWarehouseAdmin());
    }

    if (!hasPermission) {
      toast({
        title: "Permission Denied",
        description: "You do not have permission to perform this action",
        variant: "destructive",
      });
      return;
    }

    // For approved status, always use the dedicated approve endpoint
    let res;
    if (newStatus === "approved") {
      res = await ordersApi.approve(order.id);
    } else {
      res = await ordersApi.updateStatus(order.id, newStatus);
    }

    if (!res.success) {
      toast({ title: "Error", description: res.message ?? "Failed to update status", variant: "destructive" });
      return;
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

    try {
      const res = await ordersApi.reject(orderToReject.id, reason || "");
      if (!res.success) throw new Error(res.message ?? "Reject failed");

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
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }

    setIsRejecting(false);
  };

  const handleOnHold = async (reason: string) => {
    if (!orderToHold || !user) return;
    setIsHolding(true);

    const updatedNotes = orderToHold.notes
      ? `${orderToHold.notes}\n\n[ON-HOLD ${formatManilaTime(new Date())}]: ${reason}`
      : `[ON-HOLD ${formatManilaTime(new Date())}]: ${reason}`;

    const res = await ordersApi.updateStatus(orderToHold.id, "on_hold", updatedNotes);

    if (!res.success) {
      toast({ title: "Error", description: res.message ?? "Failed to place on hold", variant: "destructive" });
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-semibold text-foreground truncate">{project.name}</h2>
            <p className="text-sm text-muted-foreground">Order Workflow</p>
          </div>
        </div>
        <div className="flex items-center gap-2 pl-14 sm:pl-0">
          <Button variant="outline" size="sm" onClick={() => setIsCompletedModalOpen(true)}>
            <Archive className="mr-2 h-4 w-4" />
            Completed
          </Button>
          {showCreateButton && (
            <Button size="sm" onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Order
            </Button>
          )}
        </div>
      </div>

      {/* Process Legend */}
      <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
        <p className="font-medium text-foreground text-sm mb-1.5">Process Legend</p>
        <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5">
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
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Exception Lanes: On Hold */}
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
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Rejected Orders Section */}
      {rejectedOrders.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground px-1 flex items-center gap-2">
            <XCircle className="h-4 w-4 text-destructive" />
            Rejected Orders ({rejectedOrders.length})
          </h3>
          <div className="border rounded-lg overflow-x-auto">
            <table className="w-full text-sm min-w-0">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">Order #</th>
                  <th className="text-left p-3 font-medium hidden sm:table-cell">Company</th>
                  <th className="text-left p-3 font-medium hidden md:table-cell">Rejection Reason</th>
                  <th className="text-left p-3 font-medium">Rejected Date</th>
                  {canDeleteRejected && <th className="text-center p-3 font-medium w-[60px]">Action</th>}
                </tr>
              </thead>
              <tbody>
                {rejectedOrders.map((ro) => (
                  <tr
                    key={ro.id}
                    className="border-t hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => setSelectedOrderId(ro.id)}
                  >
                    <td className="p-3 font-mono font-medium text-xs sm:text-sm">{ro.order_number}</td>
                    <td className="p-3 hidden sm:table-cell">{ro.supplier_name || "Jagon"}</td>
                    <td className="p-3 max-w-[250px] truncate hidden md:table-cell" title={ro.rejection_reason || ""}>
                      {ro.rejection_reason || "—"}
                    </td>
                    <td className="p-3 text-muted-foreground text-xs sm:text-sm">
                      {ro.rejected_at ? formatManilaTime(ro.rejected_at) : "—"}
                    </td>
                    {canDeleteRejected && (
                      <td className="p-3 text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:bg-destructive/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletingOrderId(ro.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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

      {/* Delete Rejected Order Confirmation */}
      <AlertDialog open={!!deletingOrderId} onOpenChange={(open) => !open && setDeletingOrderId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Rejected Order?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the rejected order and all related data (materials, tracking entries, driver assignments, evidence uploads). This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteRejectedOrder}
              disabled={deleteLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
