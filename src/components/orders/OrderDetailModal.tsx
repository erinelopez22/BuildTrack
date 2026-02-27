import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { logActivity } from "@/lib/activityLogger";
import { notifyProjectMembers, formatManilaTime } from "@/lib/notificationService";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
import {
  Loader2,
  Calendar,
  Building2,
  User,
  Clock,
  XCircle,
  AlertTriangle,
  Check,
  ArrowRight,
  Package,
  Truck,
  CheckCircle2,
  PauseCircle,
  FileText,
  ListOrdered,
  ChevronDown,
  ChevronRight,
  History,
} from "lucide-react";
import type { Order, Profile, OrderStatus } from "@/types/database";
import { TrackingAssignmentSection } from "./TrackingAssignmentSection";
import { EvidenceLightbox, useLightbox } from "./EvidenceLightbox";
import { Input } from "@/components/ui/input";

interface OrderItem {
  id: string;
  sku_id: string;
  quantity_ordered: number;
  quantity_received: number | null;
  notes: string | null;
  sku?: {
    name: string;
    unit_of_measure: string;
  };
}

interface OrderDetailModalProps {
  orderId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusChange?: () => void;
}

export function OrderDetailModal({ orderId, open, onOpenChange, onStatusChange }: OrderDetailModalProps) {
  const { user, isSuperAdmin, isAdmin, canApproveOrders, canProcessLogistics, canReceiveOrders, isWarehouseAdmin } = useAuth();
  const { toast } = useToast();
  const [order, setOrder] = useState<Order | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [creator, setCreator] = useState<Profile | null>(null);
  const [approver, setApprover] = useState<Profile | null>(null);
  const [rejector, setRejector] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [isRejectedOrder, setIsRejectedOrder] = useState(false);

  // Dialogs for actions requiring reason
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showOnHoldDialog, setShowOnHoldDialog] = useState(false);
  const [showDeliveryConfirm, setShowDeliveryConfirm] = useState(false);
  const [reason, setReason] = useState("");
  const [deliverySupplier, setDeliverySupplier] = useState("Jagon");

  // Tracking validation state
  const [trackingValid, setTrackingValid] = useState(false);
  const [hasTrackingAssignments, setHasTrackingAssignments] = useState(false);
  const [allDriversArrived, setAllDriversArrived] = useState(false);

  // Collapsible section states
  const [materialsExpanded, setMaterialsExpanded] = useState(false);
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [activityExpanded, setActivityExpanded] = useState(false);

  // Activity log
  const [activityLogs, setActivityLogs] = useState<any[]>([]);

  // Lightbox state
  const lightbox = useLightbox();

  useEffect(() => {
    if (orderId && open) {
      fetchOrderDetails();
      fetchActivityLog();
    }
  }, [orderId, open]);

  const fetchActivityLog = async () => {
    if (!orderId) return;
    const { data } = await supabase
      .from("audit_logs")
      .select("*")
      .eq("table_name", "orders")
      .eq("record_id", orderId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (data) {
      const userIds = [...new Set(data.map((l) => l.user_id).filter(Boolean))];
      const { data: profiles } =
        userIds.length > 0
          ? await supabase.from("profiles").select("id, full_name, email").in("id", userIds)
          : { data: [] };
      const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

      setActivityLogs(
        data.map((log) => ({
          ...log,
          user_profile: log.user_id ? profileMap.get(log.user_id) : null,
        })),
      );
    }
  };

  const fetchOrderDetails = async () => {
    if (!orderId) return;
    setLoading(true);
    setIsRejectedOrder(false);

    // Try fetching from orders table first
    let { data: orderData } = await supabase.from("orders").select("*").eq("id", orderId).maybeSingle();

    // If not found in orders, try rejected_orders table
    let rejected = false;
    if (!orderData) {
      const { data: rejectedData } = await supabase.from("rejected_orders").select("*").eq("id", orderId).maybeSingle();
      if (rejectedData) {
        orderData = rejectedData;
        rejected = true;
        setIsRejectedOrder(true);
      }
    }

    if (orderData) {
      setOrder(orderData as Order);

      // Fetch order items - from rejected_order_items if rejected, otherwise order_items
      if (rejected) {
        const { data: items } = await supabase
          .from("rejected_order_items" as any)
          .select("id, sku_id, quantity_ordered, quantity_received, notes")
          .eq("order_id", orderId);

        if (items && (items as any[]).length > 0) {
          // Fetch SKU info separately
          const skuIds = [...new Set((items as any[]).map((i: any) => i.sku_id))];
          const { data: skus } = await supabase.from("skus").select("id, name, unit_of_measure").in("id", skuIds);
          const skuMap = new Map((skus || []).map((s: any) => [s.id, s]));

          setOrderItems(
            (items as any[]).map((item: any) => ({
              ...item,
              sku: skuMap.get(item.sku_id) as { name: string; unit_of_measure: string } | undefined,
            })),
          );
        } else {
          setOrderItems([]);
        }
      } else {
        const { data: items } = await supabase
          .from("order_items")
          .select(
            `
            id,
            sku_id,
            quantity_ordered,
            quantity_received,
            notes,
            skus (
              name,
              unit_of_measure
            )
          `,
          )
          .eq("order_id", orderId);

        if (items) {
          setOrderItems(
            items.map((item) => ({
              ...item,
              sku: item.skus as unknown as { name: string; unit_of_measure: string } | undefined,
            })),
          );
        }
      }

      // Fetch profiles in parallel
      const [creatorRes, approverRes, rejectorRes] = await Promise.all([
        orderData.created_by
          ? supabase.from("profiles").select("*").eq("id", orderData.created_by).maybeSingle()
          : Promise.resolve({ data: null }),
        orderData.approved_by
          ? supabase.from("profiles").select("*").eq("id", orderData.approved_by).maybeSingle()
          : Promise.resolve({ data: null }),
        orderData.rejected_by
          ? supabase.from("profiles").select("*").eq("id", orderData.rejected_by).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      setCreator(creatorRes.data as Profile);
      setApprover(approverRes.data as Profile);
      setRejector(rejectorRes.data as Profile);
    }

    setLoading(false);
  };

  const handleStatusChange = async (newStatus: OrderStatus, additionalData?: Record<string, unknown>) => {
    if (!order || !user || isRejectedOrder) return;
    setActionLoading(true);

    const updateData: Record<string, unknown> = {
      status: newStatus,
      ...additionalData,
    };

    if (newStatus === "approved" && order.status === "for_approval") {
      updateData.approved_by = user.id;
      updateData.approved_at = new Date().toISOString();
    }

    if (newStatus === "on_hold" && !updateData.previous_status) {
      updateData.previous_status = order.status;
    }

    if (order.status === "on_hold") {
      updateData.previous_status = null;
    }

    if (newStatus === "in_transit" && !(order as any).on_transit_at) {
      updateData.on_transit_at = new Date().toISOString();
    }
    if (newStatus === "delivered" && !(order as any).delivered_at) {
      updateData.delivered_at = new Date().toISOString();
    }

    const { error } = await supabase.from("orders").update(updateData).eq("id", order.id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setActionLoading(false);
      return;
    }

    if (newStatus === "delivered") {
      const { data: items } = await supabase
        .from("order_items")
        .select("id, quantity_ordered")
        .eq("order_id", order.id);

      if (items) {
        for (const item of items) {
          await supabase.from("order_items").update({ quantity_received: item.quantity_ordered }).eq("id", item.id);
        }
      }
    }

    await logActivity({
      action: newStatus === "approved" ? "approve" : newStatus === "rejected" ? "reject" : "status_change",
      tableName: "orders",
      recordId: order.id,
      oldValues: { status: order.status },
      newValues: { status: newStatus, order_number: order.order_number, ...additionalData },
      userId: user.id,
    });

    const statusLabel =
      newStatus === "closed" ? "Completed" : newStatus.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
    await notifyProjectMembers({
      projectId: order.project_id,
      title: `Order ${statusLabel}`,
      message: `Order ${order.order_number} has been moved to ${statusLabel}`,
      type: "order",
      referenceType: "order",
      referenceId: order.id,
      excludeUserId: user.id,
    });

    toast({ title: "Success", description: `Order moved to ${statusLabel}` });
    setActionLoading(false);
    onStatusChange?.();
    onOpenChange(false);
  };

  const handleReject = async () => {
    if (!reason.trim() || !order || !user) {
      toast({ title: "Error", description: "Rejection reason is required", variant: "destructive" });
      return;
    }

    setActionLoading(true);

    try {
      // Use atomic RPC to move order to rejected_orders table
      const { error } = await supabase.rpc("reject_order", {
        _order_id: order.id,
        _rejection_reason: reason.trim(),
      });

      if (error) throw error;

      await logActivity({
        action: "reject",
        tableName: "orders",
        recordId: order.id,
        oldValues: { status: order.status },
        newValues: {
          status: "rejected",
          order_number: order.order_number,
          rejection_reason: reason.trim(),
        },
        userId: user.id,
      });

      await notifyProjectMembers({
        projectId: order.project_id,
        title: "Order Rejected",
        message: `Order ${order.order_number} has been rejected: ${reason.trim()}`,
        type: "order",
        referenceType: "order",
        referenceId: order.id,
        excludeUserId: user.id,
      });

      toast({ title: "Order Rejected", description: `Order ${order.order_number} has been rejected` });
      setShowRejectDialog(false);
      setReason("");
      setActionLoading(false);
      onStatusChange?.();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      setActionLoading(false);
    }
  };

  const handleOnHold = async () => {
    if (!reason.trim()) {
      toast({ title: "Error", description: "On-hold reason is required", variant: "destructive" });
      return;
    }

    const updatedNotes = order?.notes
      ? `${order.notes}\n\n[ON-HOLD ${formatManilaTime(new Date())}]: ${reason.trim()}`
      : `[ON-HOLD ${formatManilaTime(new Date())}]: ${reason.trim()}`;

    await handleStatusChange("on_hold", { notes: updatedNotes, previous_status: order?.status || null });

    setShowOnHoldDialog(false);
    setReason("");
  };

  const holdableStatuses: OrderStatus[] = [
    "draft",
    "for_approval",
    "approved",
    "submitted",
    "ordered",
    "preparing",
    "in_transit",
  ];

  const getAvailableActions = () => {
    if (!order || isRejectedOrder) return [];

    const actions: {
      label: string;
      action: () => void;
      icon: React.ReactNode;
      variant: "default" | "destructive" | "outline" | "secondary";
      disabled?: boolean;
    }[] = [];
    const hasFullAccess = isSuperAdmin() || isAdmin();
    const canHold = hasFullAccess || (canProcessLogistics() && !isWarehouseAdmin());

    switch (order.status) {
      case "for_approval":
        if (hasFullAccess || canApproveOrders()) {
          actions.push(
            {
              label: "Approve",
              action: () => handleStatusChange("approved"),
              icon: <Check className="h-4 w-4 mr-2" />,
              variant: "default",
            },
            {
              label: "Reject",
              action: () => setShowRejectDialog(true),
              icon: <XCircle className="h-4 w-4 mr-2" />,
              variant: "destructive",
            },
          );
        }
        if (canHold) {
          actions.push({
            label: "On-Hold",
            action: () => setShowOnHoldDialog(true),
            icon: <PauseCircle className="h-4 w-4 mr-2" />,
            variant: "outline",
          });
        }
        break;
      case "approved":
        if (hasFullAccess || canApproveOrders()) {
          actions.push({
            label: "Submit Order",
            action: () => handleStatusChange("submitted"),
            icon: <ArrowRight className="h-4 w-4 mr-2" />,
            variant: "default",
          });
        }
        if (canHold) {
          actions.push({
            label: "On-Hold",
            action: () => setShowOnHoldDialog(true),
            icon: <PauseCircle className="h-4 w-4 mr-2" />,
            variant: "outline",
          });
        }
        break;
      case "submitted":
      case "ordered":
        if (hasFullAccess || canProcessLogistics()) {
          actions.push({
            label: "Prepare for Tracking",
            action: () => handleStatusChange("preparing"),
            icon: <Package className="h-4 w-4 mr-2" />,
            variant: "default",
          });
        }
        if (canHold) {
          actions.push({
            label: "On-Hold",
            action: () => setShowOnHoldDialog(true),
            icon: <PauseCircle className="h-4 w-4 mr-2" />,
            variant: "outline",
          });
        }
        break;
      case "preparing":
        if (hasFullAccess || canProcessLogistics()) {
          actions.push({
            label: "On Transit",
            action: () => handleStatusChange("in_transit"),
            icon: <Truck className="h-4 w-4 mr-2" />,
            variant: "default",
            disabled: !trackingValid,
          });
        }
        if (canHold) {
          actions.push({
            label: "On-Hold",
            action: () => setShowOnHoldDialog(true),
            icon: <PauseCircle className="h-4 w-4 mr-2" />,
            variant: "outline",
          });
        }
        break;
      case "in_transit":
        if (hasFullAccess || canReceiveOrders()) {
          actions.push({
            label: "Delivered",
            action: () => setShowDeliveryConfirm(true),
            icon: <CheckCircle2 className="h-4 w-4 mr-2" />,
            variant: "default",
            disabled: !allDriversArrived,
          });
        }
        if (hasFullAccess || canReceiveOrders()) {
          actions.push({
            label: "On-Hold",
            action: () => setShowOnHoldDialog(true),
            icon: <PauseCircle className="h-4 w-4 mr-2" />,
            variant: "outline",
          });
        }
        break;
      case "delivered":
        if (hasFullAccess || canApproveOrders()) {
          actions.push({
            label: "Complete Order",
            action: () => handleStatusChange("closed"),
            icon: <CheckCircle2 className="h-4 w-4 mr-2" />,
            variant: "default",
          });
        }
        break;
      case "on_hold":
        if (hasFullAccess || (canProcessLogistics() && !isWarehouseAdmin())) {
          const previousStatus = (order as any).previous_status as OrderStatus | null;
          const resumeStatus = previousStatus || "for_approval";
          const resumeLabel = resumeStatus.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
          actions.push({
            label: `Resume (→ ${resumeLabel})`,
            action: () => handleStatusChange(resumeStatus),
            icon: <Truck className="h-4 w-4 mr-2" />,
            variant: "default",
          });
        }
        break;
      default:
        break;
    }

    return actions;
  };

  const availableActions = getAvailableActions();

  const showTrackingSection = order && ["preparing", "in_transit", "delivered"].includes(order.status);

  if (!open) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-3xl w-full max-h-[100dvh] sm:max-h-[85vh] sm:w-[95vw] flex flex-col p-0 gap-0">
          {/* Sticky Header */}
          <DialogHeader className="flex-shrink-0 px-4 sm:px-6 py-4 border-b bg-background">
            <DialogTitle className="flex items-center gap-3 flex-wrap">
              <span className="font-mono text-lg">{order?.order_number || "Loading..."}</span>
              {order && <StatusBadge status={order.status} />}
              {isRejectedOrder && (
                <span className="text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded">Archived</span>
              )}
            </DialogTitle>
          </DialogHeader>

          {/* Scrollable Content */}
          {loading ? (
            <div className="flex items-center justify-center py-8 flex-1">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : order ? (
            <div className="flex-1 overflow-y-auto min-h-0">
              <div className="px-4 sm:px-6 py-4 space-y-6">
                {/* Rejected Alert */}
                {order.status === "rejected" && (
                  <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 space-y-2">
                    <div className="flex items-center gap-2 text-destructive font-medium">
                      <XCircle className="h-5 w-5" />
                      Order Rejected
                    </div>
                    {order.rejection_reason && (
                      <p className="text-sm text-destructive/80 pl-7">
                        <span className="font-medium">Reason:</span> {order.rejection_reason}
                      </p>
                    )}
                    {rejector && order.rejected_at && (
                      <p className="text-xs text-muted-foreground pl-7">
                        Rejected by {rejector.full_name || rejector.email} on {formatManilaTime(order.rejected_at)}
                      </p>
                    )}
                  </div>
                )}

                {/* Order Summary Section */}
                <section>
                  <h3 className="flex items-center gap-2 text-sm font-semibold mb-3">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    Order Summary
                  </h3>
                  <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="flex items-start gap-3">
                        <Building2 className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm text-muted-foreground">Supplier</p>
                          <p className="font-medium truncate">{order.supplier_name?.trim() || "Warehouse"}</p>
                          {order.supplier_contact && (
                            <p className="text-sm text-muted-foreground truncate">{order.supplier_contact}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <User className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm text-muted-foreground">Created By</p>
                          <p className="font-medium truncate">{creator?.full_name || creator?.email || "Unknown"}</p>
                          <p className="text-xs text-muted-foreground">
                            {order.created_at ? formatManilaTime(order.created_at) : "No date"}
                          </p>
                        </div>
                      </div>

                      {order.status !== "for_approval" &&
                        order.status !== "rejected" &&
                        approver &&
                        order.approved_at && (
                          <div className="flex items-start gap-3">
                            <Clock className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm text-muted-foreground">Approved By</p>
                              <p className="font-medium truncate">{approver.full_name || approver.email}</p>
                              <p className="text-xs text-muted-foreground">{formatManilaTime(order.approved_at)}</p>
                            </div>
                          </div>
                        )}

                      {(order as any).on_transit_at && (
                        <div className="flex items-start gap-3">
                          <Truck className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-sm text-muted-foreground">On Transit</p>
                            <p className="text-xs font-medium">{formatManilaTime((order as any).on_transit_at)}</p>
                          </div>
                        </div>
                      )}
                      {(order as any).delivered_at && (
                        <div className="flex items-start gap-3">
                          <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-sm text-muted-foreground">Delivered</p>
                            <p className="text-xs font-medium">{formatManilaTime((order as any).delivered_at)}</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {order.total_amount && (
                      <div className="flex justify-between items-center pt-2 border-t">
                        <span className="text-muted-foreground">Total Amount</span>
                        <span className="text-lg font-semibold">
                          ₱{order.total_amount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}
                  </div>
                </section>

                <Separator />

                {/* Materials Section - Collapsible */}
                <Collapsible open={materialsExpanded} onOpenChange={setMaterialsExpanded}>
                  <CollapsibleTrigger asChild>
                    <button className="flex items-center justify-between w-full text-sm font-semibold py-1 hover:text-primary transition-colors">
                      <span className="flex items-center gap-2">
                        {materialsExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        <ListOrdered className="h-4 w-4 text-muted-foreground" />
                        Materials ({orderItems.length} items)
                      </span>
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2">
                    {orderItems.length > 0 ? (
                      <div className="rounded-lg border bg-muted/30 divide-y">
                        {orderItems.map((item) => (
                          <div key={item.id} className="px-4 py-2 flex justify-between items-center gap-2">
                            <span className="text-sm truncate">{item.sku?.name || "Unknown Material"}</span>
                            <span className="text-sm text-muted-foreground whitespace-nowrap">
                              {item.quantity_ordered} {item.sku?.unit_of_measure || "pcs"}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">No materials listed</p>
                    )}
                  </CollapsibleContent>
                </Collapsible>

                {/* Notes Section - Collapsible */}
                {order.notes && (
                  <>
                    <Separator />
                    <Collapsible open={notesExpanded} onOpenChange={setNotesExpanded}>
                      <CollapsibleTrigger asChild>
                        <button className="flex items-center gap-2 w-full text-sm font-semibold py-1 hover:text-primary transition-colors">
                          {notesExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          Notes
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-2">
                        <div className="rounded-lg border bg-muted/30 p-3">
                          <p className="text-sm whitespace-pre-wrap">{order.notes}</p>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </>
                )}

                {/* Driver & Tracking Section */}
                {showTrackingSection && (
                  <>
                    <Separator />
                    <section>
                      <h3 className="flex items-center gap-2 text-sm font-semibold mb-3">
                        <Truck className="h-4 w-4 text-muted-foreground" />
                        Driver & Tracking
                        {order.status === "preparing" && !trackingValid && (
                          <span className="text-xs text-amber-600 bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded ml-2">
                            Required
                          </span>
                        )}
                      </h3>
                      <TrackingAssignmentSection
                        orderId={order.id}
                        projectId={order.project_id}
                        status={order.status}
                        onValidationChange={setTrackingValid}
                        onAssignmentsLoaded={setHasTrackingAssignments}
                        onAllDriversArrived={setAllDriversArrived}
                        readOnly={isRejectedOrder || (order.status === "in_transit" && isWarehouseAdmin() && !isSuperAdmin() && !isAdmin())}
                      />
                      {order.status === "preparing" && !trackingValid && (
                        <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 p-2 rounded mt-3">
                          Assign at least one driver with a plate number and evidence before moving to transit.
                        </p>
                      )}
                    </section>
                  </>
                )}

                {/* Activity Log - Collapsible */}
                <Separator />
                <Collapsible open={activityExpanded} onOpenChange={setActivityExpanded}>
                  <CollapsibleTrigger asChild>
                    <button className="flex items-center gap-2 w-full text-sm font-semibold py-1 hover:text-primary transition-colors">
                      {activityExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      <History className="h-4 w-4 text-muted-foreground" />
                      Activity Log ({activityLogs.length})
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2">
                    {activityLogs.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic">No activity recorded yet.</p>
                    ) : (
                      <div className="rounded-lg border bg-muted/30 divide-y max-h-[200px] overflow-y-auto">
                        {activityLogs.map((log) => {
                          const profile = log.user_profile;
                          const userName = profile?.full_name || profile?.email || "System";
                          const newVals = log.new_values as Record<string, any> | null;
                          const oldVals = log.old_values as Record<string, any> | null;
                          let summary = log.action;
                          if (log.action === "status_change" && newVals?.status) {
                            summary = `Status changed from ${oldVals?.status || "?"} to ${newVals.status}`;
                          } else if (log.action === "approve") {
                            summary = "Order approved";
                          } else if (log.action === "reject") {
                            summary = `Order rejected${newVals?.rejection_reason ? `: ${newVals.rejection_reason}` : ""}`;
                          } else if (log.action === "create") {
                            summary = "Order created";
                          } else if (log.action === "on_hold") {
                            summary = `Order placed on hold${newVals?.on_hold_reason ? `: ${newVals.on_hold_reason}` : ""}`;
                          } else if (log.action === "tracking_assigned") {
                            summary = `Driver ${newVals?.driver_name || ""} assigned`;
                          } else if (log.action === "driver_arrived") {
                            summary = `Driver ${newVals?.driver_name || ""} arrived`;
                          } else if (log.action === "driver_hold") {
                            summary = `Driver ${newVals?.driver_name || ""} placed on hold`;
                          } else if (log.action === "driver_resumed") {
                            summary = `Driver ${newVals?.driver_name || ""} resumed`;
                          } else if (log.action === "receiver_evidence_uploaded") {
                            summary = "Receiver evidence uploaded";
                          } else if (log.action === "receiver_evidence_removed") {
                            summary = `Receiver evidence removed: ${oldVals?.file_name || ""}`;
                          } else if (log.action === "preparing_evidence_removed") {
                            summary = `Preparing evidence removed: ${oldVals?.file_name || ""}`;
                          }
                          return (
                            <div key={log.id} className="px-3 py-2 text-xs">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-medium">{userName}</span>
                                <span className="text-muted-foreground whitespace-nowrap">
                                  {log.created_at ? formatManilaTime(log.created_at) : ""}
                                </span>
                              </div>
                              <p className="text-muted-foreground mt-0.5">{summary}</p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CollapsibleContent>
                </Collapsible>

                {/* Read-only notice for rejected orders */}
                {(order.status === "rejected" || isRejectedOrder) && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                    This order has been rejected and archived. It is read-only.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-center py-8 text-muted-foreground flex-1 flex items-center justify-center">
              Order not found
            </p>
          )}

          {/* Sticky Footer with Actions */}
          {availableActions.length > 0 && (
            <DialogFooter className="flex-shrink-0 px-4 sm:px-6 py-4 border-t bg-background gap-2 flex-wrap">
              <div className="w-full space-y-2">
                <div className="flex gap-2 flex-wrap">
                  {availableActions.map((action, index) => (
                    <Button
                      key={index}
                      variant={action.variant}
                      onClick={action.action}
                      disabled={actionLoading || action.disabled}
                      className="flex-1 sm:flex-none min-w-[120px]"
                      size="default"
                    >
                      {actionLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : action.icon}
                      {action.label}
                    </Button>
                  ))}
                </div>
                {order?.status === "in_transit" && !allDriversArrived && (
                  <p className="text-xs text-amber-600 text-center">
                    All tracking drivers must be marked as arrived before marking as Delivered.
                  </p>
                )}
              </div>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Reason Dialog */}
      <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
         <AlertDialogContent className="sm:max-w-md w-full p-4 sm:p-6">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="h-5 w-5" />
              Reject Order
            </AlertDialogTitle>
            <AlertDialogDescription>
              Please provide a reason for rejecting order {order?.order_number}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="reject-reason">Rejection Reason *</Label>
            <Textarea
              id="reject-reason"
              placeholder="Enter the reason for rejection..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-2"
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setReason("")}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReject}
              disabled={!reason.trim() || actionLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Reject Order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* On-Hold Reason Dialog */}
      <AlertDialog open={showOnHoldDialog} onOpenChange={setShowOnHoldDialog}>
         <AlertDialogContent className="sm:max-w-md w-full p-4 sm:p-6">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
              <PauseCircle className="h-5 w-5" />
              Place Order On-Hold
            </AlertDialogTitle>
            <AlertDialogDescription>
              Please provide a reason for placing order {order?.order_number} on hold.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="hold-reason">On-Hold Reason *</Label>
            <Textarea
              id="hold-reason"
              placeholder="Enter the reason for placing on hold..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-2"
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setReason("")}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleOnHold}
              disabled={!reason.trim() || actionLoading}
              className="bg-amber-500 text-white hover:bg-amber-600"
            >
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Place On-Hold
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delivery Confirmation Dialog with Supplier */}
      <AlertDialog
        open={showDeliveryConfirm}
        onOpenChange={(open) => {
          setShowDeliveryConfirm(open);
          if (open) setDeliverySupplier(order?.supplier_name?.trim() || "Jagon");
        }}
      >
        <AlertDialogContent className="sm:max-w-md w-full p-4 sm:p-6">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              Mark as Delivered?
            </AlertDialogTitle>
            <AlertDialogDescription>Confirm the supplier for this delivery before proceeding.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4 space-y-2">
            <Label htmlFor="delivery-supplier">Supplier *</Label>
            <Input
              id="delivery-supplier"
              placeholder="Enter supplier name"
              value={deliverySupplier}
              onChange={(e) => setDeliverySupplier(e.target.value)}
              className="mt-1"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                await handleStatusChange("delivered", { supplier_name: deliverySupplier.trim() });
                setShowDeliveryConfirm(false);
              }}
              disabled={actionLoading || !deliverySupplier.trim()}
            >
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Yes, Mark as Delivered
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Evidence Lightbox */}
      <EvidenceLightbox
        images={lightbox.images}
        startIndex={lightbox.startIndex}
        open={lightbox.open}
        onOpenChange={lightbox.setOpen}
      />
    </>
  );
}
