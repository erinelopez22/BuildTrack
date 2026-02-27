import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatManilaTime, notifyProjectMembers } from "@/lib/notificationService";
import { logActivity } from "@/lib/activityLogger";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
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
import { Loader2, Search, Check, X } from "lucide-react";

interface ReturnRequest {
  id: string;
  asset_id: string;
  asset_name: string;
  asset_unit: string | null;
  project_id: string;
  project_name: string;
  requested_by: string;
  requested_by_name: string;
  requested_at: string;
  quantity: number;
  status: string;
  approved_by: string | null;
  approved_by_name: string | null;
  approved_at: string | null;
  rejected_by: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  notes: string | null;
  borrow_transaction_id: string | null;
}

export function ReturnRequestsTab() {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<ReturnRequest[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedRequest, setSelectedRequest] = useState<ReturnRequest | null>(null);
  const [rejectRequest, setRejectRequest] = useState<ReturnRequest | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const canManage = isAdmin();

  const fetchRequests = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("equipment_requests")
      .select("*")
      .eq("request_type", "return")
      .order("requested_at", { ascending: false });

    if (!data || data.length === 0) {
      setRequests([]);
      setLoading(false);
      return;
    }

    const assetIds = [...new Set(data.map((r: any) => r.asset_id))];
    const userIds = [...new Set([
      ...data.map((r: any) => r.requested_by),
      ...data.filter((r: any) => r.approved_by).map((r: any) => r.approved_by),
    ])];
    const projectIds = [...new Set(data.map((r: any) => r.project_id))];

    const [assetsRes, profilesRes, projectsRes] = await Promise.all([
      supabase.from("company_assets").select("id, asset_name, unit").in("id", assetIds),
      userIds.length > 0 ? supabase.from("profiles").select("id, full_name, email").in("id", userIds) : { data: [] },
      projectIds.length > 0 ? supabase.from("projects").select("id, name").in("id", projectIds) : { data: [] },
    ]);

    const assetMap = new Map((assetsRes.data || []).map((a: any) => [a.id, a]));
    const profileMap = new Map((profilesRes.data || []).map((p: any) => [p.id, p.full_name || p.email || "Unknown"]));
    const projectMap = new Map((projectsRes.data || []).map((p: any) => [p.id, p.name]));

    setRequests(
      data.map((r: any) => {
        const asset = assetMap.get(r.asset_id);
        return {
          id: r.id,
          asset_id: r.asset_id,
          asset_name: asset?.asset_name || "Unknown Asset",
          asset_unit: asset?.unit || null,
          project_id: r.project_id,
          project_name: projectMap.get(r.project_id) || "Unknown Project",
          requested_by: r.requested_by,
          requested_by_name: profileMap.get(r.requested_by) || "Unknown",
          requested_at: r.requested_at,
          quantity: r.quantity,
          status: r.status,
          approved_by: r.approved_by,
          approved_by_name: r.approved_by ? profileMap.get(r.approved_by) || null : null,
          approved_at: r.approved_at,
          rejected_by: r.rejected_by,
          rejected_at: r.rejected_at,
          rejection_reason: r.rejection_reason,
          notes: r.notes,
          borrow_transaction_id: r.borrow_transaction_id,
        };
      })
    );
    setLoading(false);
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      const q = search.toLowerCase();
      const matchesSearch = !search ||
        r.asset_name.toLowerCase().includes(q) ||
        r.requested_by_name.toLowerCase().includes(q) ||
        r.project_name.toLowerCase().includes(q);
      const matchesStatus = statusFilter === "all" ||
        (statusFilter === "pending" && r.status === "for_approval") ||
        (statusFilter === "approved" && r.status === "approved") ||
        (statusFilter === "rejected" && r.status === "rejected");
      return matchesSearch && matchesStatus;
    });
  }, [requests, search, statusFilter]);

  const handleApprove = async (req: ReturnRequest) => {
    if (!user || !req.borrow_transaction_id) return;
    try {
      const { error: updateError } = await supabase
        .from("equipment_requests")
        .update({
          status: "approved",
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        })
        .eq("id", req.id);
      if (updateError) throw updateError;

      // Fetch the borrow transaction
      const { data: tx } = await supabase
        .from("borrow_transactions")
        .select("*")
        .eq("id", req.borrow_transaction_id)
        .single();

      if (tx) {
        const newReturnedQty = tx.returned_qty + req.quantity;
        const newStatus = newReturnedQty >= tx.borrowed_qty ? "Returned" : "Partially Returned";

        const { error } = await supabase
          .from("borrow_transactions")
          .update({
            returned_qty: newReturnedQty,
            returned_at: new Date().toISOString(),
            return_remarks: req.notes || null,
            status: newStatus,
            return_approved_at: new Date().toISOString(),
            return_approved_by: user.id,
          })
          .eq("id", req.borrow_transaction_id);
        if (error) throw error;

        await logActivity({
          action: "asset_returned",
          tableName: "borrow_transactions",
          recordId: req.project_id,
          oldValues: null,
          newValues: { asset_id: req.asset_id, qty: req.quantity, status: newStatus, approved_by: user.id },
          userId: user.id,
        });

        // SMS notification for return approval
        await notifyProjectMembers({
          projectId: req.project_id,
          title: "Return Request Approved",
          message: `Return request for ${req.asset_name} (x${req.quantity}) approved for ${req.project_name}`,
          type: "team",
          referenceType: "equipment_request",
          referenceId: req.id,
          excludeUserId: user.id,
        });
      }

      toast({ title: "Approved", description: "Return request approved and executed." });
      fetchRequests();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleReject = async () => {
    if (!user || !rejectRequest) return;
    try {
      const { error } = await supabase
        .from("equipment_requests")
        .update({
          status: "rejected",
          rejected_by: user.id,
          rejected_at: new Date().toISOString(),
          rejection_reason: rejectReason.trim() || null,
        })
        .eq("id", rejectRequest.id);
      if (error) throw error;

      // SMS notification for return rejection
      await notifyProjectMembers({
        projectId: rejectRequest.project_id,
        title: "Return Request Rejected",
        message: `Return request for ${rejectRequest.asset_name} rejected${rejectReason ? `: ${rejectReason}` : ""}`,
        type: "team",
        referenceType: "equipment_request",
        referenceId: rejectRequest.id,
        excludeUserId: user.id,
      });

      toast({ title: "Rejected", description: "Return request rejected." });
      setRejectRequest(null);
      setRejectReason("");
      fetchRequests();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "for_approval":
        return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">Pending</Badge>;
      case "approved":
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">Approved</Badge>;
      case "rejected":
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">Rejected</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by asset, requester, project..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filteredRequests.length === 0 ? (
        <p className="text-sm text-muted-foreground italic py-8 text-center">No return requests found.</p>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium text-muted-foreground">Asset</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Project</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Returned By</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Return Requested At</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Qty</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Approved By</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Approved At</th>
                  {canManage && <th className="text-left p-3 font-medium text-muted-foreground">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map((req) => (
                  <tr
                    key={req.id}
                    className="border-b hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => setSelectedRequest(req)}
                  >
                    <td className="p-3">
                      <div>
                        <p className="font-medium">{req.asset_name}</p>
                        {req.asset_unit && <p className="text-xs text-muted-foreground">{req.asset_unit}</p>}
                      </div>
                    </td>
                    <td className="p-3 text-muted-foreground">{req.project_name}</td>
                    <td className="p-3">{req.requested_by_name}</td>
                    <td className="p-3 text-muted-foreground whitespace-nowrap">{formatManilaTime(req.requested_at)}</td>
                    <td className="p-3">{req.quantity}</td>
                    <td className="p-3">{getStatusBadge(req.status)}</td>
                    <td className="p-3 text-muted-foreground">{req.approved_by_name || "Not yet available"}</td>
                    <td className="p-3 text-muted-foreground whitespace-nowrap">
                      {req.approved_at ? formatManilaTime(req.approved_at) : "Not yet available"}
                    </td>
                    {canManage && (
                      <td className="p-3" onClick={(e) => e.stopPropagation()}>
                        {req.status === "for_approval" && (
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs gap-1 text-success border-success/30"
                              onClick={() => handleApprove(req)}
                            >
                              <Check className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs gap-1 text-destructive border-destructive/30"
                              onClick={() => setRejectRequest(req)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {filteredRequests.map((req) => (
              <div
                key={req.id}
                className="p-4 border rounded-lg space-y-2 cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => setSelectedRequest(req)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{req.asset_name}</p>
                    <p className="text-xs text-muted-foreground">{req.project_name}</p>
                  </div>
                  {getStatusBadge(req.status)}
                </div>
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <p>By: {req.requested_by_name} • Qty: {req.quantity}</p>
                  <p>Requested: {formatManilaTime(req.requested_at)}</p>
                  <p>Approved By: {req.approved_by_name || "Not yet available"}</p>
                  <p>Approved At: {req.approved_at ? formatManilaTime(req.approved_at) : "Not yet available"}</p>
                </div>
                {req.status === "for_approval" && canManage && (
                  <div className="flex gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1 text-success border-success/30"
                      onClick={() => handleApprove(req)}
                    >
                      <Check className="h-3 w-3" /> Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1 text-destructive border-destructive/30"
                      onClick={() => setRejectRequest(req)}
                    >
                      <X className="h-3 w-3" /> Reject
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Detail Modal */}
      <Dialog open={!!selectedRequest} onOpenChange={(open) => !open && setSelectedRequest(null)}>
        <DialogContent className="max-w-md w-[calc(100%-2rem)]">
          <DialogHeader>
            <DialogTitle>Return Request Details</DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-xs text-muted-foreground">Asset</p>
                  <p className="font-medium">{selectedRequest.asset_name}</p>
                  {selectedRequest.asset_unit && <p className="text-xs text-muted-foreground">{selectedRequest.asset_unit}</p>}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Project</p>
                  <p className="font-medium">{selectedRequest.project_name}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-xs text-muted-foreground">Returned By</p>
                  <p>{selectedRequest.requested_by_name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Quantity</p>
                  <p>{selectedRequest.quantity}</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <div className="mt-1">{getStatusBadge(selectedRequest.status)}</div>
              </div>

              <div className="border-t pt-3 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Return Workflow</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Return Requested At</p>
                    <p>{formatManilaTime(selectedRequest.requested_at)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Return Approved At</p>
                    <p className={!selectedRequest.approved_at ? "text-amber-600" : ""}>
                      {selectedRequest.approved_at ? formatManilaTime(selectedRequest.approved_at) : "Not yet available"}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Approved By</p>
                  <p className={!selectedRequest.approved_by_name ? "text-amber-600" : ""}>
                    {selectedRequest.approved_by_name || "Not yet available"}
                  </p>
                </div>
              </div>

              {selectedRequest.rejection_reason && (
                <div className="border-t pt-3">
                  <p className="text-xs text-muted-foreground">Rejection Reason</p>
                  <p className="text-destructive">{selectedRequest.rejection_reason}</p>
                </div>
              )}

              {selectedRequest.notes && (
                <div className="border-t pt-3">
                  <p className="text-xs text-muted-foreground">Notes</p>
                  <p>{selectedRequest.notes}</p>
                </div>
              )}

              {selectedRequest.status === "for_approval" && canManage && (
                <div className="flex gap-2 border-t pt-3">
                  <Button
                    size="sm"
                    className="gap-1"
                    onClick={() => {
                      handleApprove(selectedRequest);
                      setSelectedRequest(null);
                    }}
                  >
                    <Check className="h-3.5 w-3.5" /> Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="gap-1"
                    onClick={() => {
                      setRejectRequest(selectedRequest);
                      setSelectedRequest(null);
                    }}
                  >
                    <X className="h-3.5 w-3.5" /> Reject
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <AlertDialog open={!!rejectRequest} onOpenChange={(open) => !open && setRejectRequest(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Return Request</AlertDialogTitle>
            <AlertDialogDescription>
              Provide a reason for rejecting this return request.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Textarea
              placeholder="Rejection reason (optional)"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={2}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRejectReason("")}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReject}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Reject
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
