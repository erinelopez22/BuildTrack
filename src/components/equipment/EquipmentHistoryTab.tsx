import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatManilaTime } from "@/lib/notificationService";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Clock } from "lucide-react";
import type { Profile } from "@/types/database";

interface HistoryRow {
  id: string;
  asset_name: string;
  asset_id: string;
  action_type: string;
  requested_by_name: string;
  approved_by_name: string | null;
  rejected_by_name: string | null;
  borrow_timestamp: string | null;
  return_timestamp: string | null;
  duration: string | null;
  status: string;
  notes: string | null;
  timestamp: string;
}

interface EquipmentHistoryTabProps {
  projectId: string;
}

function computeDuration(start: string | null, end: string | null): string {
  if (!start) return "—";
  const s = new Date(start).getTime();
  const e = end ? new Date(end).getTime() : Date.now();
  const diffMs = e - s;
  if (diffMs < 0) return "—";
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days > 0) return `${days}d ${hours}h`;
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

export function EquipmentHistoryTab({ projectId }: EquipmentHistoryTabProps) {
  const [loading, setLoading] = useState(true);
  const [historyRows, setHistoryRows] = useState<HistoryRow[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");

  useEffect(() => {
    fetchHistory();
  }, [projectId]);

  const fetchHistory = async () => {
    setLoading(true);

    // Fetch equipment requests for this project
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

    // Gather IDs for lookups
    const assetIds = [...new Set(requests.map((r: any) => r.asset_id))];
    const userIds = [...new Set([
      ...requests.map((r: any) => r.requested_by),
      ...requests.filter((r: any) => r.approved_by).map((r: any) => r.approved_by),
      ...requests.filter((r: any) => r.rejected_by).map((r: any) => r.rejected_by),
    ])];
    const borrowTxIds = requests.filter((r: any) => r.borrow_transaction_id).map((r: any) => r.borrow_transaction_id);

    const [assetsRes, profilesRes, borrowsRes] = await Promise.all([
      supabase.from("company_assets").select("id, asset_name").in("id", assetIds),
      userIds.length > 0 ? supabase.from("profiles").select("id, full_name, email").in("id", userIds) : { data: [] },
      borrowTxIds.length > 0 ? supabase.from("borrow_transactions").select("*").in("id", borrowTxIds) : { data: [] },
    ]);

    const assetMap = new Map((assetsRes.data || []).map((a: any) => [a.id, a.asset_name]));
    const profileMap = new Map((profilesRes.data || []).map((p: any) => [p.id, p.full_name || p.email || "Unknown"]));
    const borrowMap = new Map((borrowsRes.data || []).map((b: any) => [b.id, b]));

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

      // Compute borrow duration for approved borrows
      let duration: string | null = null;
      let borrowTimestamp: string | null = null;
      let returnTimestamp: string | null = null;

      if (req.borrow_transaction_id) {
        const tx = borrowMap.get(req.borrow_transaction_id);
        if (tx) {
          borrowTimestamp = tx.borrowed_at;
          returnTimestamp = tx.returned_at;
          if (req.request_type === "return" && req.status === "approved") {
            duration = computeDuration(tx.borrowed_at, req.approved_at || tx.returned_at);
          } else if (req.request_type === "borrow" && req.status === "approved") {
            duration = tx.returned_at
              ? computeDuration(req.approved_at || tx.borrowed_at, tx.returned_at)
              : computeDuration(req.approved_at || tx.borrowed_at, null) + " (Ongoing)";
          }
        }
      } else if (req.request_type === "borrow" && req.status === "approved") {
        borrowTimestamp = req.approved_at;
        duration = computeDuration(req.approved_at, null) + " (Ongoing)";
      }

      const statusLabel = req.status === "for_approval" ? "For Approval" :
        req.status.charAt(0).toUpperCase() + req.status.slice(1);

      return {
        id: req.id,
        asset_name: assetMap.get(req.asset_id) || "Unknown Asset",
        asset_id: req.asset_id,
        action_type: actionType,
        requested_by_name: profileMap.get(req.requested_by) || "Unknown",
        approved_by_name: req.approved_by ? profileMap.get(req.approved_by) || null : null,
        rejected_by_name: req.rejected_by ? profileMap.get(req.rejected_by) || null : null,
        borrow_timestamp: borrowTimestamp,
        return_timestamp: returnTimestamp,
        duration,
        status: statusLabel,
        notes: req.notes || req.rejection_reason || null,
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
      const matchesStatus = statusFilter === "all" || row.status.toLowerCase() === statusFilter;
      const matchesAction = actionFilter === "all" || row.action_type === actionFilter;
      return matchesSearch && matchesStatus && matchesAction;
    });
  }, [historyRows, search, statusFilter, actionFilter]);

  const actionBadgeVariant = (action: string): "default" | "secondary" | "destructive" | "outline" => {
    if (action.includes("Approved")) return "default";
    if (action.includes("Rejected")) return "destructive";
    if (action.includes("Request")) return "secondary";
    return "outline";
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
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="for approval">For Approval</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
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

      {filteredRows.length === 0 ? (
        <p className="text-sm text-muted-foreground italic py-6 text-center">No history records found.</p>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium whitespace-nowrap">Asset</th>
                  <th className="text-left p-3 font-medium whitespace-nowrap">Action</th>
                  <th className="text-left p-3 font-medium whitespace-nowrap">Requested By</th>
                  <th className="text-left p-3 font-medium whitespace-nowrap">Approved/Rejected By</th>
                  <th className="text-left p-3 font-medium whitespace-nowrap">Date</th>
                  <th className="text-left p-3 font-medium whitespace-nowrap">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Duration
                    </span>
                  </th>
                  <th className="text-left p-3 font-medium whitespace-nowrap">Status</th>
                  <th className="text-left p-3 font-medium whitespace-nowrap">Notes</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.id} className="border-t hover:bg-muted/30 transition-colors">
                    <td className="p-3 font-medium">{row.asset_name}</td>
                    <td className="p-3">
                      <Badge variant={actionBadgeVariant(row.action_type)} className="text-xs whitespace-nowrap">
                        {row.action_type}
                      </Badge>
                    </td>
                    <td className="p-3 whitespace-nowrap">{row.requested_by_name}</td>
                    <td className="p-3 whitespace-nowrap">
                      {row.approved_by_name || row.rejected_by_name || "—"}
                    </td>
                    <td className="p-3 text-muted-foreground whitespace-nowrap">
                      {formatManilaTime(row.timestamp)}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      {row.duration || "—"}
                    </td>
                    <td className="p-3">
                      <Badge
                        variant={
                          row.status === "Approved" ? "default" :
                          row.status === "Rejected" ? "destructive" :
                          "secondary"
                        }
                        className="text-xs"
                      >
                        {row.status}
                      </Badge>
                    </td>
                    <td className="p-3 max-w-[200px] truncate text-muted-foreground" title={row.notes || ""}>
                      {row.notes || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
