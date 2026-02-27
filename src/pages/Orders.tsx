import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/common/PageHeader";
import { DataTable, Column } from "@/components/common/DataTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import { EmptyState } from "@/components/common/EmptyState";
import { OrderDetailModal } from "@/components/orders/OrderDetailModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { useToast } from "@/hooks/use-toast";
import { ClipboardList, Search, ArrowUpDown, ArrowUp, ArrowDown, Trash2, Loader2, Eye } from "lucide-react";
import { logActivity } from "@/lib/activityLogger";
import { formatManilaTime } from "@/lib/notificationService";
import type { Order, Project, OrderStatus, Profile } from "@/types/database";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";

interface OrderWithProject extends Order {
  project: Project;
}

interface RejectedOrderRow {
  id: string;
  order_number: string;
  project_id: string;
  project_name: string;
  requested_by: string;
  rejected_by: string;
  rejected_at: string;
  rejection_reason: string | null;
  notes: string | null;
  created_at: string | null;
  expected_delivery_date: string | null;
}

interface RejectedOrderMaterial {
  material_name: string;
  quantity: number;
  unit: string;
}

type SortField = "created_at" | "expected_delivery_date" | "total_amount";
type SortDirection = "asc" | "desc";

const ACTIVE_STATUSES: OrderStatus[] = [
  "for_approval",
  "approved",
  "submitted",
  "preparing",
  "in_transit",
  "delivered",
  "on_hold",
];

export default function Orders() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, isSuperAdmin, isAdmin } = useAuth();
  const { toast } = useToast();
  const [orders, setOrders] = useState<OrderWithProject[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const urlStatus = searchParams.get("status");
  const [statusFilter, setStatusFilter] = useState<string>(urlStatus || "all");

  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  // Rejected orders state
  const [rejectedOrders, setRejectedOrders] = useState<RejectedOrderRow[]>([]);
  const [rejectedLoading, setRejectedLoading] = useState(false);
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Rejected order detail modal
  const [viewRejectedOrder, setViewRejectedOrder] = useState<RejectedOrderRow | null>(null);
  const [rejectedMaterials, setRejectedMaterials] = useState<RejectedOrderMaterial[]>([]);
  const [materialsLoading, setMaterialsLoading] = useState(false);

  const canDeleteRejected = isSuperAdmin() || isAdmin();

  useEffect(() => {
    if (statusFilter === "all") {
      searchParams.delete("status");
    } else {
      searchParams.set("status", statusFilter);
    }
    setSearchParams(searchParams, { replace: true });
  }, [statusFilter, searchParams, setSearchParams]);

  const fetchData = async () => {
    const { data: ordersData } = await supabase
      .from("orders")
      .select("*, project:projects(*)")
      .in("status", [
        "for_approval",
        "approved",
        "submitted",
        "preparing",
        "in_transit",
        "delivered",
        "on_hold",
        "closed",
      ])
      .order("created_at", { ascending: false });

    const activeProjectOrders = (ordersData || []).filter(
      (order: any) => order.project?.status === "active" && !order.project?.is_hidden
    );

    setOrders(activeProjectOrders as OrderWithProject[]);

    const { data: projectsData } = await supabase.from("projects").select("*").eq("status", "active").eq("is_hidden", false);
    setProjects((projectsData || []) as Project[]);

    setLoading(false);
    fetchRejectedOrders();
  };

  const fetchRejectedOrders = async () => {
    setRejectedLoading(true);
    try {
      const { data: rejected } = await supabase
        .from("rejected_orders")
        .select("id, order_number, project_id, created_by, created_at, rejected_by, rejected_at, rejection_reason, notes, expected_delivery_date")
        .order("rejected_at", { ascending: false });

      if (!rejected || rejected.length === 0) {
        setRejectedOrders([]);
        setRejectedLoading(false);
        return;
      }

      const projectIds = [...new Set(rejected.map((r: any) => r.project_id))];
      const { data: projectsData } = await supabase.from("projects").select("id, name").in("id", projectIds);
      const projectMap = new Map((projectsData || []).map((p: any) => [p.id, p.name]));

      const userIds = [
        ...new Set([
          ...rejected.map((r: any) => r.created_by),
          ...rejected.filter((r: any) => r.rejected_by).map((r: any) => r.rejected_by),
        ]),
      ];
      const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", userIds);
      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p.full_name || "Unknown"]));

      setRejectedOrders(
        rejected.map((r: any) => ({
          id: r.id,
          order_number: r.order_number,
          project_id: r.project_id,
          project_name: projectMap.get(r.project_id) || "Unknown",
          requested_by: profileMap.get(r.created_by) || "Unknown",
          rejected_by: r.rejected_by ? profileMap.get(r.rejected_by) || "Unknown" : "Unknown",
          rejected_at: r.rejected_at || r.created_at,
          rejection_reason: r.rejection_reason,
          notes: r.notes,
          created_at: r.created_at,
          expected_delivery_date: r.expected_delivery_date,
        }))
      );
    } catch (err: any) {
      console.error("Error fetching rejected orders:", err);
    } finally {
      setRejectedLoading(false);
    }
  };

  const openRejectedOrderDetail = async (ro: RejectedOrderRow) => {
    setViewRejectedOrder(ro);
    setMaterialsLoading(true);
    try {
      const { data: items } = await supabase
        .from("rejected_order_items")
        .select("quantity_ordered, sku_id")
        .eq("order_id", ro.id);

      if (items && items.length > 0) {
        const skuIds = items.map((i: any) => i.sku_id);
        const { data: skus } = await supabase.from("skus").select("id, name, unit_of_measure").in("id", skuIds);
        const skuMap = new Map((skus || []).map((s: any) => [s.id, s]));

        setRejectedMaterials(
          items.map((i: any) => {
            const sku = skuMap.get(i.sku_id);
            return {
              material_name: sku?.name || "Unknown",
              quantity: i.quantity_ordered,
              unit: sku?.unit_of_measure || "EA",
            };
          })
        );
      } else {
        setRejectedMaterials([]);
      }
    } catch {
      setRejectedMaterials([]);
    } finally {
      setMaterialsLoading(false);
    }
  };

  const handleDeleteRejectedOrder = async () => {
    if (!deletingOrderId || !user) return;
    setDeleteLoading(true);

    try {
      const { error } = await supabase.rpc("delete_rejected_order", {
        _order_id: deletingOrderId,
      });

      if (error) throw error;

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
    fetchData();
  }, []);

  const formatManilaTimeLocal = (dateStr: string) => {
    try {
      const zonedDate = toZonedTime(new Date(dateStr), "Asia/Manila");
      return format(zonedDate, "MMM dd, yyyy hh:mm a");
    } catch {
      return dateStr;
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4 text-muted-foreground" />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="h-4 w-4 text-primary" />
    ) : (
      <ArrowDown className="h-4 w-4 text-primary" />
    );
  };

  const filteredAndSortedOrders = useMemo(() => {
    let result = orders.filter((order) => {
      const matchesSearch =
        order.order_number?.toLowerCase().includes(search.toLowerCase()) ||
        order.supplier_name?.toLowerCase().includes(search.toLowerCase()) ||
        order.project?.name?.toLowerCase().includes(search.toLowerCase());

      let matchesStatus = false;
      if (statusFilter === "all") {
        matchesStatus = true;
      } else if (statusFilter === "active") {
        matchesStatus = ACTIVE_STATUSES.includes(order.status);
      } else {
        matchesStatus = order.status === statusFilter;
      }

      return matchesSearch && matchesStatus;
    });

    result.sort((a, b) => {
      let aVal: number | string | null = null;
      let bVal: number | string | null = null;

      switch (sortField) {
        case "created_at":
          aVal = a.created_at;
          bVal = b.created_at;
          break;
        case "expected_delivery_date":
          aVal = a.expected_delivery_date || "";
          bVal = b.expected_delivery_date || "";
          break;
        case "total_amount":
          aVal = a.total_amount ?? 0;
          bVal = b.total_amount ?? 0;
          break;
      }

      if (aVal === null || aVal === "") return sortDirection === "asc" ? 1 : -1;
      if (bVal === null || bVal === "") return sortDirection === "asc" ? -1 : 1;

      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [orders, search, statusFilter, sortField, sortDirection]);

  const columns: Column<OrderWithProject>[] = [
    {
      key: "order_number",
      header: "Order #",
      render: (order) => <span className="font-medium">{order.order_number}</span>,
    },
    {
      key: "project",
      header: "Project",
      render: (order) => <span className="text-muted-foreground">{order.project?.name}</span>,
    },
    {
      key: "supplier",
      header: "Supplier",
      render: (order) => order.supplier_name || "-",
    },
    {
      key: "status",
      header: "Status",
      render: (order) => <StatusBadge status={order.status} />,
    },
    {
      key: "created",
      header: (
        <button
          className="flex items-center gap-1 hover:text-primary transition-colors"
          onClick={() => handleSort("created_at")}
        >
          Created
          {getSortIcon("created_at")}
        </button>
      ) as unknown as string,
      render: (order) => format(new Date(order.created_at), "MMM d, yyyy"),
    },
  ];

  const statusOptions: { value: string; label: string }[] = [
    { value: "all", label: "All Statuses" },
    { value: "active", label: "Active Orders" },
    { value: "for_approval", label: "Order Request" },
    { value: "approved", label: "Approved" },
    { value: "submitted", label: "Ordered" },
    { value: "in_transit", label: "On Transit" },
    { value: "delivered", label: "Delivered" },
  ];

  if (!loading && orders.length === 0 && rejectedOrders.length === 0) {
    return (
      <div className="animate-fade-in">
        <PageHeader title="View Orders" description="Manage purchase orders and track deliveries" />
        <EmptyState
          icon={ClipboardList}
          title="No orders yet"
          description="Create your first purchase order to start tracking procurement."
        />
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader title="Orders" description="Manage purchase orders and track deliveries" />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search orders..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={filteredAndSortedOrders}
        loading={loading}
        emptyMessage="No orders found"
        onRowClick={(order) => setSelectedOrderId(order.id)}
      />

      {/* Rejected Orders Table - minimal columns */}
      {rejectedOrders.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-destructive" />
            Rejected Orders ({rejectedOrders.length})
          </h3>
          <div className="border rounded-lg overflow-hidden overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">Order #</th>
                  <th className="text-left p-3 font-medium">Project</th>
                  <th className="text-left p-3 font-medium">Rejected Date</th>
                  <th className="text-center p-3 font-medium w-[70px]">Action</th>
                </tr>
              </thead>
              <tbody>
                {rejectedOrders.map((ro) => (
                  <tr key={ro.id} className="border-t hover:bg-muted/30 transition-colors">
                    <td className="p-3 font-mono font-medium">{ro.order_number}</td>
                    <td className="p-3">{ro.project_name}</td>
                    <td className="p-3 text-muted-foreground">{formatManilaTimeLocal(ro.rejected_at)}</td>
                    <td className="p-3 text-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => openRejectedOrderDetail(ro)}
                        title="View Details"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <OrderDetailModal
        orderId={selectedOrderId}
        open={!!selectedOrderId}
        onOpenChange={(open) => !open && setSelectedOrderId(null)}
        onStatusChange={fetchData}
      />

      {/* Rejected Order Detail Modal */}
      <Dialog open={!!viewRejectedOrder} onOpenChange={(open) => !open && setViewRejectedOrder(null)}>
        <DialogContent className="sm:max-w-lg w-full max-h-[100dvh] sm:max-h-[85vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Rejected Order Details</DialogTitle>
          </DialogHeader>
          {viewRejectedOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <DetailRow label="Order Number" value={viewRejectedOrder.order_number} />
                <DetailRow label="Project" value={viewRejectedOrder.project_name} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge variant="destructive" className="mt-1">Rejected</Badge>
                </div>
                <DetailRow label="Requested By" value={viewRejectedOrder.requested_by} />
              </div>
              <Separator />
              <DetailRow label="Rejected By" value={viewRejectedOrder.rejected_by} />
              <DetailRow label="Rejected Date" value={formatManilaTimeLocal(viewRejectedOrder.rejected_at)} />
              {viewRejectedOrder.rejection_reason && (
                <div>
                  <p className="text-xs text-muted-foreground">Rejection Reason</p>
                  <p className="text-sm font-medium whitespace-pre-wrap">{viewRejectedOrder.rejection_reason}</p>
                </div>
              )}
              <Separator />
              <DetailRow label="Created Date" value={viewRejectedOrder.created_at ? formatManilaTimeLocal(viewRejectedOrder.created_at) : '-'} />
              <DetailRow label="Expected Delivery Date" value={viewRejectedOrder.expected_delivery_date || '-'} />
              {viewRejectedOrder.notes && (
                <div>
                  <p className="text-xs text-muted-foreground">Notes</p>
                  <p className="text-sm font-medium whitespace-pre-wrap">{viewRejectedOrder.notes}</p>
                </div>
              )}
              <Separator />
              <div>
                <p className="text-xs text-muted-foreground mb-2">Materials</p>
                {materialsLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading materials...
                  </div>
                ) : rejectedMaterials.length > 0 ? (
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left p-2 font-medium">Material</th>
                          <th className="text-right p-2 font-medium">Quantity</th>
                          <th className="text-left p-2 font-medium">Unit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rejectedMaterials.map((m, i) => (
                          <tr key={i} className="border-t">
                            <td className="p-2">{m.material_name}</td>
                            <td className="p-2 text-right">{m.quantity}</td>
                            <td className="p-2">{m.unit}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No materials found</p>
                )}
              </div>

              {/* Delete action for admins */}
              {canDeleteRejected && (
                <>
                  <Separator />
                  <div className="flex justify-end">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        setDeletingOrderId(viewRejectedOrder.id);
                        setViewRejectedOrder(null);
                      }}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Permanently
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation for Rejected Orders */}
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

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}
