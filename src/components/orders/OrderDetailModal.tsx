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
} from "lucide-react";
import type { Order, Profile, OrderStatus } from "@/types/database";
import { TrackingAssignmentSection } from "./TrackingAssignmentSection";
import { EvidenceLightbox, useLightbox } from "./EvidenceLightbox";

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
  const { user, isSuperAdmin, isAdmin, canApproveOrders, canProcessLogistics, canReceiveOrders } = useAuth();
  const { toast } = useToast();
  const [order, setOrder] = useState<Order | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [creator, setCreator] = useState<Profile | null>(null);
  const [approver, setApprover] = useState<Profile | null>(null);
  const [rejector, setRejector] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Dialogs for actions requiring reason
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showOnHoldDialog, setShowOnHoldDialog] = useState(false);
  const [reason, setReason] = useState("");

  // Tracking validation state
  const [trackingValid, setTrackingValid] = useState(false);
  const [hasTrackingAssignments, setHasTrackingAssignments] = useState(false);

  // Lightbox state
  const lightbox = useLightbox();

  useEffect(() => {
    if (orderId && open) {
      fetchOrderDetails();
    }
  }, [orderId, open]);

  const fetchOrderDetails = async () => {
    if (!orderId) return;
    setLoading(true);

    // Fetch order
    const { data: orderData, error } = await supabase.from("orders").select("*").eq("id", orderId).maybeSingle();

    if (orderData) {
      setOrder(orderData as Order);

      // Fetch order items with SKU info
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
    if (!order || !user) return;
    setActionLoading(true);

    const updateData: Record<string, unknown> = {
      status: newStatus,
      ...additionalData,
    };

    // Set approval info if approving
    if (newStatus === "approved" && order.status === "for_approval") {
      updateData.approved_by = user.id;
      updateData.approved_at = new Date().toISOString();
    }

    const { error } = await supabase.from("orders").update(updateData).eq("id", order.id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setActionLoading(false);
      return;
    }

    // When order is marked as "delivered", update order_items.quantity_received
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

    // Log activity
    await logActivity({
      action: newStatus === "approved" ? "approve" : newStatus === "rejected" ? "reject" : "status_change",
      tableName: "orders",
      recordId: order.id,
      oldValues: { status: order.status },
      newValues: { status: newStatus, order_number: order.order_number, ...additionalData },
      userId: user.id,
    });

    // Notify project members
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
    if (!reason.trim()) {
      toast({ title: "Error", description: "Rejection reason is required", variant: "destructive" });
      return;
    }

    await handleStatusChange("rejected", {
      rejected_by: user?.id,
      rejected_at: new Date().toISOString(),
      rejection_reason: reason.trim(),
    });

    setShowRejectDialog(false);
    setReason("");
  };

  const handleOnHold = async () => {
    if (!reason.trim()) {
      toast({ title: "Error", description: "On-hold reason is required", variant: "destructive" });
      return;
    }

    // Store on-hold reason in notes (append)
    const updatedNotes = order?.notes
      ? `${order.notes}\n\n[ON-HOLD ${formatManilaTime(new Date())}]: ${reason.trim()}`
      : `[ON-HOLD ${formatManilaTime(new Date())}]: ${reason.trim()}`;

    await handleStatusChange("on_hold", { notes: updatedNotes });

    setShowOnHoldDialog(false);
    setReason("");
  };

  // Determine available actions based on status and permissions
  const getAvailableActions = () => {
    if (!order) return [];

    const actions: {
      label: string;
      action: () => void;
      icon: React.ReactNode;
      variant: "default" | "destructive" | "outline" | "secondary";
      disabled?: boolean;
    }[] = [];
    const hasFullAccess = isSuperAdmin() || isAdmin();

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
        break;
      case "submitted":
        if (hasFullAccess || canProcessLogistics()) {
          actions.push({
            label: "Prepare for Tracking",
            action: () => handleStatusChange("preparing"),
            icon: <Package className="h-4 w-4 mr-2" />,
            variant: "default",
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
            disabled: !trackingValid, // Require tracking assignments before transit
          });
        }
        break;
      case "in_transit":
        if (hasFullAccess || canReceiveOrders()) {
          actions.push(
            {
              label: "Delivered",
              action: () => handleStatusChange("delivered"),
              icon: <CheckCircle2 className="h-4 w-4 mr-2" />,
              variant: "default",
            },
            {
              label: "On-Hold",
              action: () => setShowOnHoldDialog(true),
              icon: <PauseCircle className="h-4 w-4 mr-2" />,
              variant: "outline",
            },
          );
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
        if (hasFullAccess) {
          actions.push({
            label: "Resume Transit",
            action: () => handleStatusChange("in_transit"),
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

  // Check if tracking section should be shown
  const showTrackingSection = order && (order.status === "preparing" || order.status === "in_transit");

  if (!open) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl w-[95vw] max-h-[90vh] md:max-h-[85vh] flex flex-col p-0 gap-0">
          {/* Sticky Header */}
          <DialogHeader className="flex-shrink-0 px-4 sm:px-6 py-4 border-b bg-background">
            <DialogTitle className="flex items-center gap-3 flex-wrap">
              <span className="font-mono text-lg">{order?.order_number || "Loading..."}</span>
              {order && <StatusBadge status={order.status} />}
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
                {/* Rejected Alert - Always visible at top */}
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
                          <p className="font-medium truncate">{order.supplier_name || "Not specified"}</p>
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

                      <div className="flex items-start gap-3">
                        <Calendar className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm text-muted-foreground">Expected Delivery</p>
                          <p className="font-medium">
                            {order.expected_delivery_date
                              ? formatManilaTime(order.expected_delivery_date).split(" –")[0]
                              : "Not set"}
                          </p>
                        </div>
                      </div>

                      {order.status !== "for_approval" && order.status !== "rejected" && approver && order.approved_at && (
                        <div className="flex items-start gap-3">
                          <Clock className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm text-muted-foreground">Approved By</p>
                            <p className="font-medium truncate">{approver.full_name || approver.email}</p>
                            <p className="text-xs text-muted-foreground">{formatManilaTime(order.approved_at)}</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Total Amount */}
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

                {/* Materials Section */}
                <section>
                  <h3 className="flex items-center gap-2 text-sm font-semibold mb-3">
                    <ListOrdered className="h-4 w-4 text-muted-foreground" />
                    Materials ({orderItems.length})
                  </h3>
                  {orderItems.length > 0 ? (
                    <div className="rounded-lg border bg-muted/30 divide-y">
                      {orderItems.map((item) => (
                        <div key={item.id} className="px-4 py-3 flex justify-between items-center gap-2">
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
                </section>

                {/* Notes Section */}
                {order.notes && (
                  <>
                    <Separator />
                    <section>
                      <h3 className="flex items-center gap-2 text-sm font-semibold mb-3">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        Notes
                      </h3>
                      <div className="rounded-lg border bg-muted/30 p-4">
                        <p className="text-sm whitespace-pre-wrap">{order.notes}</p>
                      </div>
                    </section>
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
                        readOnly={order.status === "in_transit"}
                      />
                      {order.status === "preparing" && !trackingValid && (
                        <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 p-2 rounded mt-3">
                          Assign at least one driver with a plate number before moving to transit.
                        </p>
                      )}
                    </section>
                  </>
                )}

                {/* Read-only notice for rejected orders */}
                {order.status === "rejected" && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                    This order is read-only. Only Super Admin can modify rejected orders.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-center py-8 text-muted-foreground flex-1 flex items-center justify-center">Order not found</p>
          )}

          {/* Sticky Footer with Actions */}
          {availableActions.length > 0 && (
            <DialogFooter className="flex-shrink-0 px-4 sm:px-6 py-4 border-t bg-background gap-2 flex-wrap">
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
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Reason Dialog */}
      <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <AlertDialogContent className="max-w-md">
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
        <AlertDialogContent className="max-w-md">
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
