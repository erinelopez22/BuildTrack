import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatManilaTime } from "@/lib/notificationService";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Loader2, Search, Clock, User, Calendar, Package, FileText, ChevronUp, ChevronDown, ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ROLE_DISPLAY_NAMES, type AppRole } from "@/types/database";

interface HistoryRow {
  id: string;
  asset_name: string;
  asset_unit: string | null;
  asset_id: string;
  action_type: string;
  request_type: string;
  state: string;
  requested_by_name: string;
  borrowed_by_name: string | null;
  returned_by_name: string | null;
  approved_by_name: string | null;
  approved_by_role: string | null;
  rejected_by_name: string | null;
  rejected_by_role: string | null;
  requested_at: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  returned_at: string | null;
  borrow_timestamp: string | null;
  return_timestamp: string | null;
  // Lifecycle timestamps from borrow_transactions
  borrow_requested_at: string | null;
  borrow_requested_by_name: string | null;
  borrow_approved_at: string | null;
  borrow_approved_by_name: string | null;
  borrow_approved_by_role: string | null;
  return_requested_at: string | null;
  return_requested_by_name: string | null;
  return_approved_at: string | null;
  return_approved_by_name: string | null;
  return_approved_by_role: string | null;
  duration: string | null;
  borrowed_qty: number | null;
  returned_qty: number | null;
  notes: string | null;
  rejection_reason: string | null;
  request_id: string;
  timestamp: string;
}

interface EquipmentHistoryTabProps {
  projectId: string;
}

function computeDuration(start: string | null, end: string | null): { text: string; ongoing: boolean } {
  if (!start) return { text: "—", ongoing: false };
  const s = new Date(start).getTime();
  const e = end ? new Date(end).getTime() : Date.now();
  const diffMs = e - s;
  if (diffMs < 0) return { text: "—", ongoing: false };
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  const text = days > 0 ? `${days}d ${hours}h` : hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  return { text, ongoing: !end };
}

function getStateBadgeClasses(state: string): string {
  switch (state.toLowerCase()) {
    case "borrowed":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
    case "returned":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
    case "for approval":
    case "pending":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300";
    case "rejected":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function getActionBadgeVariant(action: string): "default" | "secondary" | "destructive" | "outline" {
  if (action.includes("Approved")) return "default";
  if (action.includes("Rejected")) return "destructive";
  if (action.includes("Request")) return "secondary";
  return "outline";
}

export function EquipmentHistoryTab({ projectId }: EquipmentHistoryTabProps) {
  const [loading, setLoading] = useState(true);
  const [historyRows, setHistoryRows] = useState<HistoryRow[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [expandAll, setExpandAll] = useState<string[] | undefined>(undefined);

  useEffect(() => {
    fetchHistory();
  }, [projectId]);

  const fetchHistory = async () => {
    setLoading(true);

    const { data: requests } = await supabase
      .from("equipment_requests")
      .select("*")
      .eq("project_id", projectId)
      .order("requested_at", { ascending: false });

    if (!requests || requests.length === 0) {
      setHistoryRows([]);
      setLoading(false);
      return;
    }

    const assetIds = [...new Set(requests.map((r: any) => r.asset_id))];
    const userIds = [...new Set([
      ...requests.map((r: any) => r.requested_by),
      ...requests.filter((r: any) => r.approved_by).map((r: any) => r.approved_by),
      ...requests.filter((r: any) => r.rejected_by).map((r: any) => r.rejected_by),
    ])];
    const borrowTxIds = requests.filter((r: any) => r.borrow_transaction_id).map((r: any) => r.borrow_transaction_id);

    const [assetsRes, profilesRes, borrowsRes, rolesRes] = await Promise.all([
      supabase.from("company_assets").select("id, asset_name, unit").in("id", assetIds),
      userIds.length > 0 ? supabase.from("profiles").select("id, full_name, email").in("id", userIds) : { data: [] },
      borrowTxIds.length > 0 ? supabase.from("borrow_transactions").select("*, borrow_requested_at, borrow_requested_by, borrow_approved_at, borrow_approved_by, return_requested_at, return_requested_by, return_approved_at, return_approved_by").in("id", borrowTxIds) : { data: [] },
      userIds.length > 0 ? supabase.from("user_roles").select("user_id, role").in("user_id", userIds) : { data: [] },
    ]);

    const assetMap = new Map((assetsRes.data || []).map((a: any) => [a.id, a]));
    const profileMap = new Map((profilesRes.data || []).map((p: any) => [p.id, p.full_name || p.email || "Unknown"]));
    const borrowMap = new Map((borrowsRes.data || []).map((b: any) => [b.id, b]));

    // Build role map: user_id → highest role display name
    const roleMap = new Map<string, string>();
    for (const r of (rolesRes.data || []) as { user_id: string; role: string }[]) {
      const displayName = ROLE_DISPLAY_NAMES[r.role as AppRole] || r.role;
      if (!roleMap.has(r.user_id)) {
        roleMap.set(r.user_id, displayName);
      }
    }

    // Collect additional user IDs from borrow_transactions lifecycle fields
    const txUserIds = new Set<string>();
    for (const b of (borrowsRes.data || [])) {
      if (b.borrow_approved_by && !profileMap.has(b.borrow_approved_by)) txUserIds.add(b.borrow_approved_by);
      if (b.borrow_requested_by && !profileMap.has(b.borrow_requested_by)) txUserIds.add(b.borrow_requested_by);
      if (b.return_requested_by && !profileMap.has(b.return_requested_by)) txUserIds.add(b.return_requested_by);
      if (b.return_approved_by && !profileMap.has(b.return_approved_by)) txUserIds.add(b.return_approved_by);
    }
    if (txUserIds.size > 0) {
      const { data: extraProfiles } = await supabase.from("profiles").select("id, full_name, email").in("id", [...txUserIds]);
      for (const p of (extraProfiles || [])) {
        profileMap.set(p.id, p.full_name || p.email || "Unknown");
      }
      const { data: extraRoles } = await supabase.from("user_roles").select("user_id, role").in("user_id", [...txUserIds]);
      for (const r of (extraRoles || []) as { user_id: string; role: string }[]) {
        const displayName = ROLE_DISPLAY_NAMES[r.role as AppRole] || r.role;
        if (!roleMap.has(r.user_id)) {
          roleMap.set(r.user_id, displayName);
        }
      }
    }

    // Build a lookup: borrow_transaction_id → the original borrow request (approved)
    const borrowRequestByTxId = new Map<string, any>();
    for (const req of requests) {
      if (req.request_type === "borrow" && req.borrow_transaction_id) {
        borrowRequestByTxId.set(req.borrow_transaction_id, req);
      }
    }

    const rows: HistoryRow[] = requests.map((req: any) => {
      let actionType = "Borrow Request";
      if (req.request_type === "borrow") {
        if (req.status === "approved") actionType = "Borrow Approved";
        else if (req.status === "rejected") actionType = "Borrow Rejected";
        else actionType = "Borrow Request";
      } else if (req.request_type === "return") {
        if (req.status === "approved") actionType = "Return Approved";
        else if (req.status === "rejected") actionType = "Return Rejected";
        else actionType = "Return Request";
      }

      // Determine state
      let state = "Pending";
      if (req.status === "for_approval") state = "For Approval";
      else if (req.status === "rejected") state = "Rejected";
      else if (req.status === "approved") {
        if (req.request_type === "return") state = "Returned";
        else state = "Borrowed";
      }

      const asset = assetMap.get(req.asset_id);
      const tx = req.borrow_transaction_id ? borrowMap.get(req.borrow_transaction_id) : null;

      let duration: string | null = null;
      let borrowTimestamp: string | null = null;
      let returnTimestamp: string | null = null;
      let borrowedQty: number | null = null;
      let returnedQty: number | null = null;
      let borrowedByName: string | null = null;
      let returnedByName: string | null = null;

      // Lifecycle timestamps from borrow_transactions DB columns
      let txBorrowRequestedAt: string | null = null;
      let txBorrowRequestedByName: string | null = null;
      let txBorrowApprovedAt: string | null = null;
      let txBorrowApprovedByName: string | null = null;
      let txBorrowApprovedByRole: string | null = null;
      let txReturnRequestedAt: string | null = null;
      let txReturnRequestedByName: string | null = null;
      let txReturnApprovedAt: string | null = null;
      let txReturnApprovedByName: string | null = null;
      let txReturnApprovedByRole: string | null = null;

      if (tx) {
        borrowTimestamp = tx.borrowed_at;
        returnTimestamp = tx.returned_at;
        borrowedQty = tx.borrowed_qty;
        returnedQty = tx.returned_qty > 0 ? tx.returned_qty : null;
        borrowedByName = profileMap.get(tx.borrowed_by) || null;

        // Read lifecycle fields directly from borrow_transactions
        txBorrowRequestedAt = tx.borrow_requested_at || null;
        txBorrowRequestedByName = tx.borrow_requested_by ? (profileMap.get(tx.borrow_requested_by) || null) : null;
        txBorrowApprovedAt = tx.borrow_approved_at || null;
        txBorrowApprovedByName = tx.borrow_approved_by ? (profileMap.get(tx.borrow_approved_by) || null) : null;
        txBorrowApprovedByRole = tx.borrow_approved_by ? (roleMap.get(tx.borrow_approved_by) || null) : null;
        txReturnRequestedAt = tx.return_requested_at || null;
        txReturnRequestedByName = tx.return_requested_by ? (profileMap.get(tx.return_requested_by) || null) : null;
        txReturnApprovedAt = tx.return_approved_at || null;
        txReturnApprovedByName = tx.return_approved_by ? (profileMap.get(tx.return_approved_by) || null) : null;
        txReturnApprovedByRole = tx.return_approved_by ? (roleMap.get(tx.return_approved_by) || null) : null;

        if (req.request_type === "return" && req.status === "approved") {
          const d = computeDuration(tx.borrowed_at, tx.return_approved_at || req.approved_at || tx.returned_at);
          duration = d.text + (d.ongoing ? " (Ongoing)" : "");
          returnedByName = profileMap.get(req.requested_by) || null;
        } else if (req.request_type === "borrow" && req.status === "approved") {
          const d = computeDuration(tx.borrow_approved_at || req.approved_at || tx.borrowed_at, tx.returned_at);
          duration = d.text + (d.ongoing ? " (Ongoing)" : "");
        }

        // Fallback: if DB lifecycle columns are empty, try equipment_requests cross-reference
        if (!txBorrowRequestedAt && req.request_type === "return" && req.borrow_transaction_id) {
          const origBorrowReq = borrowRequestByTxId.get(req.borrow_transaction_id);
          if (origBorrowReq) {
            txBorrowRequestedAt = origBorrowReq.requested_at;
            txBorrowApprovedAt = txBorrowApprovedAt || origBorrowReq.approved_at;
            if (!txBorrowApprovedByName && origBorrowReq.approved_by) {
              txBorrowApprovedByName = profileMap.get(origBorrowReq.approved_by) || null;
              txBorrowApprovedByRole = roleMap.get(origBorrowReq.approved_by) || null;
            }
          }
        }
      } else if (req.request_type === "borrow" && req.status === "approved") {
        borrowTimestamp = req.approved_at;
        borrowedQty = req.quantity;
        const d = computeDuration(req.approved_at, null);
        duration = d.text + " (Ongoing)";
      }

      // For borrow requests without a tx yet, use request's own timestamps
      if (req.request_type === "borrow") {
        if (!txBorrowRequestedAt) txBorrowRequestedAt = req.requested_at;
        if (!txBorrowRequestedByName) txBorrowRequestedByName = profileMap.get(req.requested_by) || null;
        if (!txBorrowApprovedAt && req.status === "approved") txBorrowApprovedAt = req.approved_at;
        if (!txBorrowApprovedByName && req.approved_by) {
          txBorrowApprovedByName = profileMap.get(req.approved_by) || null;
          txBorrowApprovedByRole = roleMap.get(req.approved_by) || null;
        }
      }

      // For return requests without tx lifecycle, use request's own timestamps
      if (req.request_type === "return") {
        if (!txReturnRequestedAt) txReturnRequestedAt = req.requested_at;
        if (!txReturnRequestedByName) txReturnRequestedByName = profileMap.get(req.requested_by) || null;
        if (!txReturnApprovedAt && req.status === "approved") txReturnApprovedAt = req.approved_at;
        if (!txReturnApprovedByName && req.status === "approved" && req.approved_by) {
          txReturnApprovedByName = profileMap.get(req.approved_by) || null;
          txReturnApprovedByRole = roleMap.get(req.approved_by) || null;
        }
      }

      if (!borrowedQty && req.request_type === "borrow") borrowedQty = req.quantity;
      if (!returnedQty && req.request_type === "return") returnedQty = req.quantity;

      return {
        id: req.id,
        asset_name: asset?.asset_name || "Unknown Asset",
        asset_unit: asset?.unit || null,
        asset_id: req.asset_id,
        action_type: actionType,
        request_type: req.request_type,
        state,
        requested_by_name: profileMap.get(req.requested_by) || "Unknown",
        borrowed_by_name: borrowedByName || (req.request_type === "borrow" ? profileMap.get(req.requested_by) || null : null),
        returned_by_name: returnedByName,
        approved_by_name: req.approved_by ? profileMap.get(req.approved_by) || null : null,
        approved_by_role: req.approved_by ? roleMap.get(req.approved_by) || null : null,
        rejected_by_name: req.rejected_by ? profileMap.get(req.rejected_by) || null : null,
        rejected_by_role: req.rejected_by ? roleMap.get(req.rejected_by) || null : null,
        requested_at: req.requested_at,
        approved_at: req.approved_at,
        rejected_at: req.rejected_at,
        returned_at: returnTimestamp,
        borrow_timestamp: borrowTimestamp,
        return_timestamp: returnTimestamp,
        // Lifecycle from DB
        borrow_requested_at: txBorrowRequestedAt,
        borrow_requested_by_name: txBorrowRequestedByName,
        borrow_approved_at: txBorrowApprovedAt,
        borrow_approved_by_name: txBorrowApprovedByName,
        borrow_approved_by_role: txBorrowApprovedByRole,
        return_requested_at: txReturnRequestedAt,
        return_requested_by_name: txReturnRequestedByName,
        return_approved_at: txReturnApprovedAt,
        return_approved_by_name: txReturnApprovedByName,
        return_approved_by_role: txReturnApprovedByRole,
        duration,
        borrowed_qty: borrowedQty,
        returned_qty: returnedQty,
        notes: req.notes || null,
        rejection_reason: req.rejection_reason || null,
        request_id: req.id,
        timestamp: req.approved_at || req.rejected_at || req.requested_at,
      };
    });

    setHistoryRows(rows);
    setLoading(false);
  };

  const filteredRows = useMemo(() => {
    return historyRows.filter((row) => {
      const matchesSearch = !search ||
        row.asset_name.toLowerCase().includes(search.toLowerCase()) ||
        row.requested_by_name.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "all" || row.state.toLowerCase() === statusFilter;
      const matchesAction = actionFilter === "all" || row.action_type === actionFilter;
      return matchesSearch && matchesStatus && matchesAction;
    });
  }, [historyRows, search, statusFilter, actionFilter]);

  const handleExpandAll = () => {
    setExpandAll(filteredRows.map((r) => r.id));
  };

  const handleCollapseAll = () => {
    setExpandAll([]);
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
            placeholder="Search by asset or user..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="State" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All States</SelectItem>
            <SelectItem value="for approval">For Approval</SelectItem>
            <SelectItem value="borrowed">Borrowed</SelectItem>
            <SelectItem value="returned">Returned</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Action Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            <SelectItem value="Borrow Request">Borrow Request</SelectItem>
            <SelectItem value="Borrow Approved">Borrow Approved</SelectItem>
            <SelectItem value="Borrow Rejected">Borrow Rejected</SelectItem>
            <SelectItem value="Return Request">Return Request</SelectItem>
            <SelectItem value="Return Approved">Return Approved</SelectItem>
            <SelectItem value="Return Rejected">Return Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Expand/Collapse controls */}
      {filteredRows.length > 0 && (
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleExpandAll} className="text-xs gap-1">
            <ChevronDown className="h-3 w-3" /> Expand All
          </Button>
          <Button variant="ghost" size="sm" onClick={handleCollapseAll} className="text-xs gap-1">
            <ChevronUp className="h-3 w-3" /> Collapse All
          </Button>
          <span className="text-xs text-muted-foreground ml-auto">{filteredRows.length} record(s)</span>
        </div>
      )}

      {filteredRows.length === 0 ? (
        <p className="text-sm text-muted-foreground italic py-6 text-center">No history records found.</p>
      ) : (
        <Accordion
          type="multiple"
          value={expandAll}
          onValueChange={setExpandAll}
          className="space-y-2"
        >
          {filteredRows.map((row) => (
            <AccordionItem key={row.id} value={row.id} className="border rounded-lg bg-card px-0">
              <AccordionTrigger className="px-4 py-3 hover:no-underline [&[data-state=open]>svg]:rotate-180">
                <div className="flex items-center gap-3 flex-wrap w-full text-left pr-2">
                  <span className="font-medium text-sm truncate max-w-[200px]">{row.asset_name}</span>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getStateBadgeClasses(row.state)}`}>
                    {row.state}
                  </span>
                  <Badge variant={getActionBadgeVariant(row.action_type)} className="text-xs">
                    {row.action_type}
                  </Badge>
                  <div className="flex items-center gap-2 ml-auto text-xs text-muted-foreground">
                    {row.requested_at && (
                      <span className="hidden sm:inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatManilaTime(row.requested_at)}
                      </span>
                    )}
                    <span className="hidden sm:inline">•</span>
                    <span className="hidden sm:inline">{row.requested_by_name}</span>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 pt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  {/* Core Identity */}
                  <div className="space-y-2">
                    <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                      <Package className="h-3 w-3" /> Details
                    </h4>
                    <DetailRow label="Asset Name" value={row.asset_name} />
                    {row.asset_unit && <DetailRow label="Unit" value={row.asset_unit} />}
                    <DetailRow label="Action" value={row.action_type} />
                    <DetailRow label="State" value={row.state} />
                    {row.borrowed_qty != null && <DetailRow label="Qty Borrowed" value={String(row.borrowed_qty)} />}
                    {row.returned_qty != null && <DetailRow label="Qty Returned" value={String(row.returned_qty)} />}
                    {row.duration && (
                      <DetailRow
                        label="Duration"
                        value={row.duration}
                        highlight={row.duration.includes("Ongoing")}
                      />
                    )}
                  </div>

                  {/* People */}
                  <div className="space-y-2">
                    <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                      <User className="h-3 w-3" /> People
                    </h4>
                    <DetailRow label="Requested By" value={row.requested_by_name} />
                    {row.borrowed_by_name && <DetailRow label="Borrowed By" value={row.borrowed_by_name} />}
                    {row.returned_by_name && <DetailRow label="Returned By" value={row.returned_by_name} />}
                    {row.approved_by_name && (
                      <DetailRow
                        label={row.request_type === "return" ? "Return Approved By" : "Borrow Approved By"}
                        value={`${row.approved_by_name}${row.approved_by_role ? ` (${row.approved_by_role})` : ""}`}
                      />
                    )}
                    {row.rejected_by_name && (
                      <DetailRow
                        label="Rejected By"
                        value={`${row.rejected_by_name}${row.rejected_by_role ? ` (${row.rejected_by_role})` : ""}`}
                      />
                    )}
                  </div>

                  {/* SECTION 1: Borrow Request Workflow – Always Visible */}
                  <div className="space-y-2">
                    <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> Borrow Request Workflow
                    </h4>
                    <DetailRow
                      label="Borrow Requested At"
                      value={row.borrow_requested_at ? formatManilaTime(row.borrow_requested_at) : "Not yet available"}
                      highlight={!row.borrow_requested_at}
                    />
                    <DetailRow
                      label="Requested By"
                      value={row.borrow_requested_by_name || "Not yet available"}
                      highlight={!row.borrow_requested_by_name}
                    />
                    <DetailRow
                      label="Borrow Approved At"
                      value={row.borrow_approved_at ? formatManilaTime(row.borrow_approved_at) : "Not yet available"}
                      highlight={!row.borrow_approved_at}
                    />
                    <DetailRow
                      label="Approved By"
                      value={
                        row.borrow_approved_by_name
                          ? `${row.borrow_approved_by_name}${row.borrow_approved_by_role ? ` (${row.borrow_approved_by_role})` : ""}`
                          : "Not yet available"
                      }
                      highlight={!row.borrow_approved_by_name}
                    />
                  </div>

                  {/* SECTION 2: Return Workflow – Always Visible */}
                  <div className="space-y-2">
                    <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                      <ArrowRightLeft className="h-3 w-3" /> Return Workflow
                    </h4>
                    <DetailRow
                      label="Return Requested At"
                      value={row.return_requested_at ? formatManilaTime(row.return_requested_at) : "Not yet available"}
                      highlight={!row.return_requested_at}
                    />
                    <DetailRow
                      label="Requested By"
                      value={row.return_requested_by_name || "Not yet available"}
                      highlight={!row.return_requested_by_name}
                    />
                    <DetailRow
                      label="Return Approved At"
                      value={row.return_approved_at ? formatManilaTime(row.return_approved_at) : "Not yet available"}
                      highlight={!row.return_approved_at}
                    />
                    <DetailRow
                      label="Approved By"
                      value={
                        row.return_approved_by_name
                          ? `${row.return_approved_by_name}${row.return_approved_by_role ? ` (${row.return_approved_by_role})` : ""}`
                          : "Not yet available"
                      }
                      highlight={!row.return_approved_by_name}
                    />
                  </div>

                  {/* Notes & References */}
                  <div className="space-y-2">
                    <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                      <FileText className="h-3 w-3" /> Notes & Reference
                    </h4>
                    {row.notes ? (
                      <p className="text-sm whitespace-pre-wrap break-words">{row.notes}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">No notes</p>
                    )}
                    {row.rejection_reason && (
                      <div className="mt-1">
                        <span className="text-xs font-medium text-destructive">Rejection Reason:</span>
                        <p className="text-sm text-destructive/80 whitespace-pre-wrap">{row.rejection_reason}</p>
                      </div>
                    )}
                    <DetailRow label="Request ID" value={row.request_id.slice(0, 8) + "..."} mono />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
}

function DetailRow({ label, value, highlight, mono }: { label: string; value: string; highlight?: boolean; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="text-xs text-muted-foreground whitespace-nowrap">{label}</span>
      <span className={`text-xs text-right break-words max-w-[200px] ${highlight ? "text-amber-600 font-medium" : ""} ${mono ? "font-mono" : ""}`}>
        {value}
      </span>
    </div>
  );
}
