import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { formatManilaTime } from "@/lib/notificationService";
import { logActivity } from "@/lib/activityLogger";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search, Check, X, Clock } from "lucide-react";
import { companyAssetsApi, type BorrowTransaction as BorrowTransactionDTO } from "@/lib/apiClient";

export function BorrowRequestsTab() {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<BorrowTransactionDTO[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedTxn, setSelectedTxn] = useState<BorrowTransactionDTO | null>(null);
  const [returnQty, setReturnQty] = useState(0);
  const [returnRemarks, setReturnRemarks] = useState("");
  const [returning, setReturning] = useState(false);

  const canManage = isAdmin();

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const data = await companyAssetsApi.getAllBorrows();
      // Show active borrows + pending approval requests
      setTransactions((data.data || []).filter((t) =>
        t.status === "Borrowed" || t.status === "Partially Returned" || t.approvalStatus === "pending"
      ));
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
        (statusFilter === "borrowed" && t.status === "Borrowed") ||
        (statusFilter === "partial" && t.status === "Partially Returned");
      return matchesSearch && matchesStatus;
    });
  }, [transactions, search, statusFilter]);

  const handleProcessReturn = async () => {
    if (!selectedTxn || returnQty <= 0 || !user) return;
    setReturning(true);
    try {
      await companyAssetsApi.returnAsset(selectedTxn.id, {
        returnedQty: returnQty,
        remarks: returnRemarks.trim() || undefined,
      });

      await logActivity({
        action: "asset_returned",
        tableName: "borrow_transactions",
        recordId: selectedTxn.projectId || selectedTxn.id,
        oldValues: null,
        newValues: { assetId: selectedTxn.assetId, qty: returnQty },
        userId: user.id,
      });

      toast({ title: "Returned", description: `Returned ${returnQty} item(s).` });
      setSelectedTxn(null);
      setReturnQty(0);
      setReturnRemarks("");
      fetchTransactions();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setReturning(false);
  };

  const handleApprove = async (txnId: string) => {
    try {
      await companyAssetsApi.approveBorrow(txnId);
      toast({ title: "Approved", description: "Request has been approved." });
      fetchTransactions();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleReject = async (txnId: string) => {
    try {
      await companyAssetsApi.rejectBorrow(txnId);
      toast({ title: "Rejected", description: "Request has been rejected." });
      fetchTransactions();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const getStatusBadge = (txn: BorrowTransactionDTO) => {
    if (txn.approvalStatus === "pending") {
      return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"><Clock className="h-3 w-3 mr-1" />Pending {txn.requestType === "return" ? "Return" : "Borrow"}</Badge>;
    }
    switch (txn.status) {
      case "Borrowed":
        return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">Borrowed</Badge>;
      case "Partially Returned":
        return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">Partially Returned</Badge>;
      default:
        return <Badge variant="secondary">{txn.status}</Badge>;
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
            placeholder="Search by asset, borrower, project..."
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
            <SelectItem value="borrowed">Borrowed</SelectItem>
            <SelectItem value="partial">Partially Returned</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filteredTransactions.length === 0 ? (
        <p className="text-sm text-muted-foreground italic py-8 text-center">No active borrow transactions found.</p>
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
                  <th className="text-left p-3 font-medium text-muted-foreground">Qty</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Remaining</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                  {canManage && <th className="text-left p-3 font-medium text-muted-foreground">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((txn) => (
                  <tr
                    key={txn.id}
                    className="border-b hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => {
                      setSelectedTxn(txn);
                      setReturnQty(txn.borrowedQty - txn.returnedQty);
                      setReturnRemarks("");
                    }}
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
                    <td className="p-3">{txn.borrowedQty - txn.returnedQty}</td>
                    <td className="p-3">{getStatusBadge(txn)}</td>
                    {canManage && (
                      <td className="p-3" onClick={(e) => e.stopPropagation()}>
                        {txn.approvalStatus === "pending" ? (
                          <div className="flex gap-1">
                            <Button size="sm" className="h-7 text-xs gap-1" onClick={() => handleApprove(txn.id)}>
                              <Check className="h-3 w-3" /> Approve
                            </Button>
                            <Button size="sm" variant="destructive" className="h-7 text-xs gap-1" onClick={() => handleReject(txn.id)}>
                              <X className="h-3 w-3" /> Reject
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1 text-success border-success/30"
                            onClick={() => {
                              setSelectedTxn(txn);
                              setReturnQty(txn.borrowedQty - txn.returnedQty);
                              setReturnRemarks("");
                            }}
                          >
                            <Check className="h-3 w-3" /> Return
                          </Button>
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
            {filteredTransactions.map((txn) => (
              <div
                key={txn.id}
                className="p-4 border rounded-lg space-y-2 cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => {
                  setSelectedTxn(txn);
                  setReturnQty(txn.borrowedQty - txn.returnedQty);
                  setReturnRemarks("");
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{txn.assetName || "Unknown Asset"}</p>
                    <p className="text-xs text-muted-foreground">{txn.projectName || "Unknown Project"}</p>
                  </div>
                  {getStatusBadge(txn)}
                </div>
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <p>By: {txn.borrowedByName || "Unknown"} • Qty: {txn.borrowedQty} • Remaining: {txn.borrowedQty - txn.returnedQty}</p>
                  <p>Borrowed: {txn.borrowedAt ? formatManilaTime(txn.borrowedAt) : "—"}</p>
                </div>
                {canManage && (
                  <div className="flex gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                    {txn.approvalStatus === "pending" ? (
                      <>
                        <Button size="sm" className="h-7 text-xs gap-1" onClick={() => handleApprove(txn.id)}>
                          <Check className="h-3 w-3" /> Approve
                        </Button>
                        <Button size="sm" variant="destructive" className="h-7 text-xs gap-1" onClick={() => handleReject(txn.id)}>
                          <X className="h-3 w-3" /> Reject
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1 text-success border-success/30"
                        onClick={() => {
                          setSelectedTxn(txn);
                          setReturnQty(txn.borrowedQty - txn.returnedQty);
                          setReturnRemarks("");
                        }}
                      >
                        <Check className="h-3 w-3" /> Process Return
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Return Modal */}
      <Dialog open={!!selectedTxn} onOpenChange={(open) => !open && setSelectedTxn(null)}>
        <DialogContent className="max-w-md w-[calc(100%-2rem)]">
          <DialogHeader>
            <DialogTitle>Process Return</DialogTitle>
          </DialogHeader>
          {selectedTxn && (
            <div className="space-y-4 text-sm">
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
              <div className="border-t pt-3 space-y-1">
                <p className="text-xs text-muted-foreground">Borrowed: {selectedTxn.borrowedQty}</p>
                <p className="text-xs text-muted-foreground">Already returned: {selectedTxn.returnedQty}</p>
                <p className="font-medium">Remaining: {selectedTxn.borrowedQty - selectedTxn.returnedQty}</p>
              </div>
              {canManage && (
                <div className="space-y-3 border-t pt-3">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Return Quantity</p>
                    <input
                      type="number"
                      min={1}
                      max={selectedTxn.borrowedQty - selectedTxn.returnedQty}
                      value={returnQty}
                      onChange={(e) => setReturnQty(parseInt(e.target.value) || 0)}
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Remarks (optional)</p>
                    <Textarea
                      value={returnRemarks}
                      onChange={(e) => setReturnRemarks(e.target.value)}
                      placeholder="Optional remarks"
                      rows={2}
                    />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" onClick={() => setSelectedTxn(null)}>
                      Cancel
                    </Button>
                    <Button onClick={handleProcessReturn} disabled={returning || returnQty <= 0}>
                      {returning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Confirm Return
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
