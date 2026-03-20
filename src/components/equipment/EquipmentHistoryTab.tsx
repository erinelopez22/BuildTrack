import { useState, useEffect, useMemo } from "react";
import { formatManilaTime } from "@/lib/notificationService";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Loader2, Search, Clock, User, Calendar, Package, FileText, ChevronUp, ChevronDown, ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { companyAssetsApi, type BorrowTransaction as BorrowTransactionDTO } from "@/lib/apiClient";

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
    case "partially returned":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function getActionBadgeVariant(action: string): "default" | "secondary" | "destructive" | "outline" {
  if (action === "Returned") return "default";
  if (action === "Partially Returned") return "secondary";
  if (action === "Borrowed") return "outline";
  return "outline";
}

export function EquipmentHistoryTab({ projectId }: EquipmentHistoryTabProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<BorrowTransactionDTO[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandAll, setExpandAll] = useState<string[] | undefined>(undefined);

  useEffect(() => {
    fetchHistory();
  }, [projectId]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const data = await companyAssetsApi.getAllBorrows();
      // Filter to the selected project
      setTransactions((data.data || []).filter((t) => t.projectId === projectId));
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setLoading(false);
  };

  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const matchesSearch =
        !search ||
        (t.assetName || "").toLowerCase().includes(search.toLowerCase()) ||
        (t.borrowedByName || "").toLowerCase().includes(search.toLowerCase()) ||
        (t.projectName || "").toLowerCase().includes(search.toLowerCase());
      const matchesStatus =
        statusFilter === "all" || t.status.toLowerCase() === statusFilter.toLowerCase();
      return matchesSearch && matchesStatus;
    });
  }, [transactions, search, statusFilter]);

  const handleExpandAll = () => {
    setExpandAll(filteredTransactions.map((t) => t.id));
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
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="State" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All States</SelectItem>
            <SelectItem value="borrowed">Borrowed</SelectItem>
            <SelectItem value="partially returned">Partially Returned</SelectItem>
            <SelectItem value="returned">Returned</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Expand/Collapse controls */}
      {filteredTransactions.length > 0 && (
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleExpandAll} className="text-xs gap-1">
            <ChevronDown className="h-3 w-3" /> Expand All
          </Button>
          <Button variant="ghost" size="sm" onClick={handleCollapseAll} className="text-xs gap-1">
            <ChevronUp className="h-3 w-3" /> Collapse All
          </Button>
          <span className="text-xs text-muted-foreground ml-auto">{filteredTransactions.length} record(s)</span>
        </div>
      )}

      {filteredTransactions.length === 0 ? (
        <p className="text-sm text-muted-foreground italic py-6 text-center">No history records found.</p>
      ) : (
        <Accordion
          type="multiple"
          value={expandAll}
          onValueChange={setExpandAll}
          className="space-y-2"
        >
          {filteredTransactions.map((txn) => {
            const duration = computeDuration(txn.borrowedAt || null, txn.returnedAt || null);
            const durationText = duration.text + (duration.ongoing ? " (Ongoing)" : "");

            return (
              <AccordionItem key={txn.id} value={txn.id} className="border rounded-lg bg-card px-0">
                <AccordionTrigger className="px-4 py-3 hover:no-underline [&[data-state=open]>svg]:rotate-180">
                  <div className="flex items-center gap-3 flex-wrap w-full text-left pr-2">
                    <span className="font-medium text-sm truncate max-w-[200px]">{txn.assetName || "Unknown Asset"}</span>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getStateBadgeClasses(txn.status)}`}>
                      {txn.status}
                    </span>
                    <Badge variant={getActionBadgeVariant(txn.status)} className="text-xs">
                      {txn.status}
                    </Badge>
                    <div className="flex items-center gap-2 ml-auto text-xs text-muted-foreground">
                      {txn.borrowedAt && (
                        <span className="hidden sm:inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatManilaTime(txn.borrowedAt)}
                        </span>
                      )}
                      <span className="hidden sm:inline">•</span>
                      <span className="hidden sm:inline">{txn.borrowedByName || "Unknown"}</span>
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
                      <DetailRow label="Asset Name" value={txn.assetName || "Unknown Asset"} />
                      <DetailRow label="Status" value={txn.status} />
                      <DetailRow label="Qty Borrowed" value={String(txn.borrowedQty)} />
                      {txn.returnedQty > 0 && (
                        <DetailRow label="Qty Returned" value={String(txn.returnedQty)} />
                      )}
                      <DetailRow
                        label="Duration"
                        value={durationText}
                        highlight={duration.ongoing}
                      />
                    </div>

                    {/* People */}
                    <div className="space-y-2">
                      <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                        <User className="h-3 w-3" /> People
                      </h4>
                      <DetailRow label="Borrowed By" value={txn.borrowedByName || "Unknown"} />
                      <DetailRow label="Project" value={txn.projectName || "Unknown Project"} />
                    </div>

                    {/* Borrow Timeline */}
                    <div className="space-y-2">
                      <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> Borrow Timeline
                      </h4>
                      <DetailRow
                        label="Borrowed At"
                        value={txn.borrowedAt ? formatManilaTime(txn.borrowedAt) : "Not yet available"}
                        highlight={!txn.borrowedAt}
                      />
                      {txn.expectedReturnDate && (
                        <DetailRow
                          label="Expected Return"
                          value={formatManilaTime(txn.expectedReturnDate)}
                        />
                      )}
                    </div>

                    {/* Return Timeline */}
                    <div className="space-y-2">
                      <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                        <ArrowRightLeft className="h-3 w-3" /> Return Timeline
                      </h4>
                      <DetailRow
                        label="Returned At"
                        value={txn.returnedAt ? formatManilaTime(txn.returnedAt) : "Not yet available"}
                        highlight={!txn.returnedAt}
                      />
                    </div>

                    {/* Notes & References */}
                    <div className="space-y-2">
                      <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                        <FileText className="h-3 w-3" /> Notes & Reference
                      </h4>
                      {txn.returnRemarks ? (
                        <p className="text-sm whitespace-pre-wrap break-words">{txn.returnRemarks}</p>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">No remarks</p>
                      )}
                      <DetailRow label="Transaction ID" value={txn.id.slice(0, 8) + "..."} mono />
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
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
