import { useState, useEffect, useMemo } from "react";
import { formatManilaTime } from "@/lib/notificationService";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search } from "lucide-react";
import { companyAssetsApi, type BorrowTransaction as BorrowTransactionDTO } from "@/lib/apiClient";

export function ReturnRequestsTab() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<BorrowTransactionDTO[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedTxn, setSelectedTxn] = useState<BorrowTransactionDTO | null>(null);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const data = await companyAssetsApi.getAllBorrows();
      // Return requests tab shows completed/partial returns
      setTransactions(
        (data.data || []).filter(
          (t) => t.status === "Returned" || t.status === "Partially Returned",
        ),
      );
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const q = search.toLowerCase();
      const matchesSearch =
        !search ||
        (t.assetName || "").toLowerCase().includes(q) ||
        (t.borrowedByName || "").toLowerCase().includes(q) ||
        (t.projectName || "").toLowerCase().includes(q);
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "returned" && t.status === "Returned") ||
        (statusFilter === "partial" && t.status === "Partially Returned");
      return matchesSearch && matchesStatus;
    });
  }, [transactions, search, statusFilter]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Returned":
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">Returned</Badge>;
      case "Partially Returned":
        return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">Partially Returned</Badge>;
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
            placeholder="Search by asset, returner, project..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="returned">Returned</SelectItem>
            <SelectItem value="partial">Partially Returned</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filteredTransactions.length === 0 ? (
        <p className="text-sm text-muted-foreground italic py-8 text-center">No return transactions found.</p>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium text-muted-foreground">Asset</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Project</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Borrowed By</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Borrowed At</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Qty Borrowed</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Qty Returned</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Returned At</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((txn) => (
                  <tr
                    key={txn.id}
                    className="border-b hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => setSelectedTxn(txn)}
                  >
                    <td className="p-3">
                      <p className="font-medium">{txn.assetName || "Unknown Asset"}</p>
                    </td>
                    <td className="p-3 text-muted-foreground">{txn.projectName || "Unknown Project"}</td>
                    <td className="p-3">{txn.borrowedByName || "Unknown"}</td>
                    <td className="p-3 text-muted-foreground whitespace-nowrap">
                      {txn.borrowedAt ? formatManilaTime(txn.borrowedAt) : "—"}
                    </td>
                    <td className="p-3">{txn.borrowedQty}</td>
                    <td className="p-3">{txn.returnedQty}</td>
                    <td className="p-3 text-muted-foreground whitespace-nowrap">
                      {txn.returnedAt ? formatManilaTime(txn.returnedAt) : "—"}
                    </td>
                    <td className="p-3">{getStatusBadge(txn.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {filteredTransactions.map((txn) => (
              <div
                key={txn.id}
                className="p-4 border rounded-lg space-y-2 cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => setSelectedTxn(txn)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{txn.assetName || "Unknown Asset"}</p>
                    <p className="text-xs text-muted-foreground">{txn.projectName || "Unknown Project"}</p>
                  </div>
                  {getStatusBadge(txn.status)}
                </div>
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <p>By: {txn.borrowedByName || "Unknown"} • Borrowed: {txn.borrowedQty} • Returned: {txn.returnedQty}</p>
                  <p>Borrowed At: {txn.borrowedAt ? formatManilaTime(txn.borrowedAt) : "—"}</p>
                  <p>Returned At: {txn.returnedAt ? formatManilaTime(txn.returnedAt) : "—"}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Detail Modal */}
      <Dialog open={!!selectedTxn} onOpenChange={(open) => !open && setSelectedTxn(null)}>
        <DialogContent className="max-w-md w-[calc(100%-2rem)]">
          <DialogHeader>
            <DialogTitle>Return Transaction Details</DialogTitle>
          </DialogHeader>
          {selectedTxn && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-xs text-muted-foreground">Asset</p>
                  <p className="font-medium">{selectedTxn.assetName || "Unknown Asset"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Project</p>
                  <p className="font-medium">{selectedTxn.projectName || "Unknown Project"}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-xs text-muted-foreground">Borrowed By</p>
                  <p>{selectedTxn.borrowedByName || "Unknown"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <div className="mt-1">{getStatusBadge(selectedTxn.status)}</div>
                </div>
              </div>

              <div className="border-t pt-3 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Transaction Details</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Qty Borrowed</p>
                    <p>{selectedTxn.borrowedQty}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Qty Returned</p>
                    <p>{selectedTxn.returnedQty}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Borrowed At</p>
                    <p>{selectedTxn.borrowedAt ? formatManilaTime(selectedTxn.borrowedAt) : "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Returned At</p>
                    <p className={!selectedTxn.returnedAt ? "text-amber-600" : ""}>
                      {selectedTxn.returnedAt ? formatManilaTime(selectedTxn.returnedAt) : "Not yet available"}
                    </p>
                  </div>
                </div>
              </div>

              {selectedTxn.returnRemarks && (
                <div className="border-t pt-3">
                  <p className="text-xs text-muted-foreground">Return Remarks</p>
                  <p>{selectedTxn.returnRemarks}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
