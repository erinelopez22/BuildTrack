import { useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { projectsApi, ordersApi, quotationsApi, companyAssetsApi } from '@/lib/apiClient';
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { EmptyState } from "@/components/common/EmptyState";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import {
  FileText,
  Printer,
  FileDown,
  FileSpreadsheet,
  CalendarIcon,
  Loader2,
  X,
  Search,
  ChevronDown,
  ChevronRight,
  Building2,
  ClipboardList,
  PackageCheck,
  TrendingUp,
  Boxes,
  RotateCcw,
  History,
  Users,
  MapPin,
  Clock,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
} from "lucide-react";
import { Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { formatActivityDescription } from "@/lib/activityLogger";

const MANILA_TZ = "Asia/Manila";

function formatManila(dateStr: string | null | undefined, fmt = "MMM dd, yyyy – h:mm a") {
  if (!dateStr) return "—";
  try {
    return formatInTimeZone(new Date(dateStr), MANILA_TZ, fmt);
  } catch {
    return "—";
  }
}

function formatManilaDate(dateStr: string | null | undefined) {
  return formatManila(dateStr, "MMM dd, yyyy");
}

type BorrowRecord = {
  id: string;
  assetName: string;
  assetType: string;
  assetCode: string;
  borrowedQty: number;
  returnedQty: number;
  status: string;
  borrowedBy: string;
  borrowRequestedAt: string | null;
  borrowRequestedBy: string | null;
  borrowApprovedAt: string | null;
  borrowApprovedBy: string | null;
  borrowedAt: string | null;
  returnRequestedAt: string | null;
  returnRequestedBy: string | null;
  returnApprovedAt: string | null;
  returnApprovedBy: string | null;
  returnedAt: string | null;
  returnRemarks: string | null;
  expectedReturnDate: string | null;
  duration: string;
  ongoing: boolean;
};

type ReportData = {
  project: any;
  orders: any[];
  rejectedOrders: any[];
  quotation: any | null;
  quotationItems: any[];
  assetHistory: BorrowRecord[];
  teamMembers: any[];
  activityLogs: any[];
  materialProgress: {
    materialName: string;
    unit: string;
    quotedQty: number;
    orderedQty: number;
    deliveredQty: number;
    remainingQty: number;
    percentage: number;
  }[];
  overallProgress: { totalQuoted: number; totalOrdered: number; totalDelivered: number; percentage: number };
};

const ORDER_STATUS_GROUPS: Record<string, string[]> = {
  "Order Request": ["for_approval", "draft", "submitted"],
  "Approved": ["approved"],
  "Ordered": ["ordered"],
  "Preparing": ["preparing"],
  "In Transit": ["in_transit"],
  "On Hold": ["on_hold"],
  "Delivered": ["delivered"],
  "Completed": ["fully_received", "closed", "partially_received"],
  "Cancelled": ["cancelled"],
};

function statusLabel(status: string | null) {
  if (!status) return "—";
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function statusBadgeVariant(status: string | null): "default" | "secondary" | "destructive" | "outline" {
  if (!status) return "outline";
  if (["delivered", "fully_received", "closed"].includes(status)) return "default";
  if (["rejected", "cancelled"].includes(status)) return "destructive";
  if (["in_transit", "preparing", "approved", "ordered"].includes(status)) return "secondary";
  return "outline";
}

function getDuration(start: string | null, end: string | null) {
  if (!start || !end) return "—";
  const s = new Date(start);
  const e = new Date(end);
  const days = Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 0) return "—";
  if (days < 30) return `${days} day${days !== 1 ? "s" : ""}`;
  const months = Math.floor(days / 30);
  const rem = days % 30;
  return `${months} month${months !== 1 ? "s" : ""}${rem > 0 ? `, ${rem} day${rem !== 1 ? "s" : ""}` : ""}`;
}

function computeBorrowDuration(start: string | null, end: string | null): { text: string; ongoing: boolean } {
  if (!start) return { text: "—", ongoing: false };
  const s = new Date(start);
  const e = end ? new Date(end) : new Date();
  const days = Math.max(0, Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)));
  const ongoing = !end;
  if (days === 0) return { text: ongoing ? "< 1 day (Ongoing)" : "< 1 day", ongoing };
  const txt = days < 30
    ? `${days} day${days !== 1 ? "s" : ""}`
    : `${Math.floor(days / 30)} month${Math.floor(days / 30) !== 1 ? "s" : ""}${days % 30 > 0 ? `, ${days % 30}d` : ""}`;
  return { text: ongoing ? `${txt} (Ongoing)` : txt, ongoing };
}

/* ─── Collapsible Report Section ─── */
function ReportSection({
  title,
  icon: Icon,
  count,
  children,
  defaultOpen = true,
}: {
  title: string;
  icon: React.ElementType;
  count?: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="report-section">
      <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-lg border bg-muted/50 px-4 py-3 text-left font-semibold transition-colors hover:bg-muted print:bg-transparent print:border-b print:border-t-0 print:border-x-0 print:rounded-none print:px-0">
        <span className="print:hidden">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </span>
        <Icon className="h-4 w-4 text-primary" />
        <span className="text-sm uppercase tracking-wide">{title}</span>
        {count !== undefined && (
          <Badge variant="secondary" className="ml-auto text-xs print:bg-transparent print:border">
            {count}
          </Badge>
        )}
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-4 print:!block">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

/* ─── Stat Mini Card ─── */
function StatMini({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-lg border bg-card p-3 text-center print:border print:p-2">
      <div className="text-lg font-bold text-foreground">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
      {sub && <div className="text-[10px] text-muted-foreground/70">{sub}</div>}
    </div>
  );
}

/* ─── Workflow Step ─── */
function WorkflowStep({ label, by, at, done }: { label: string; by?: string | null; at?: string | null; done: boolean }) {
  return (
    <div className={cn("flex items-start gap-2 text-xs", done ? "text-foreground" : "text-muted-foreground/60")}>
      <div className={cn("mt-0.5 h-3.5 w-3.5 shrink-0 rounded-full border-2 flex items-center justify-center",
        done ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/30"
      )}>
        {done && <CheckCircle2 className="h-2.5 w-2.5" />}
      </div>
      <div className="min-w-0">
        <div className="font-medium">{label}</div>
        {done && (
          <div className="text-muted-foreground">
            {by || "—"} • {formatManila(at)}
          </div>
        )}
        {!done && <div className="text-muted-foreground/50 italic">Not yet</div>}
      </div>
    </div>
  );
}

export default function Reports() {
  const { user, isAdmin, hasRole, profile } = useAuth();
  const { toast } = useToast();

  const allowed = isAdmin() || hasRole("office_admin") || hasRole("project_engineer");

  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [dateStart, setDateStart] = useState<Date | undefined>();
  const [dateEnd, setDateEnd] = useState<Date | undefined>();
  const [includeDetails, setIncludeDetails] = useState(true);
  const [includeOrders, setIncludeOrders] = useState(true);
  const [includeQuotations, setIncludeQuotations] = useState(true);
  const [includeAssets, setIncludeAssets] = useState(true);
  const [includeProgress, setIncludeProgress] = useState(true);
  const [includeActivity, setIncludeActivity] = useState(true);
  const [reportData, setReportData] = useState<ReportData[] | null>(null);
  const [generating, setGenerating] = useState(false);
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);
  const [projectSearch, setProjectSearch] = useState("");
  const reportRef = useRef<HTMLDivElement>(null);

  const { data: projects = [] } = useQuery({
    queryKey: ["reports-projects"],
    queryFn: async () => {
      const result = await projectsApi.getAll();
      return (result.data || []).filter((p: any) => !p.isHidden);
    },
  });

  if (!allowed) return <Navigate to="/dashboard" replace />;

  const filteredProjects = projects.filter((p: any) =>
    p.name.toLowerCase().includes(projectSearch.toLowerCase())
  );

  const toggleProject = (id: string) =>
    setSelectedProjectIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const selectAll = () => setSelectedProjectIds(projects.map((p: any) => p.id));
  const clearAll = () => setSelectedProjectIds([]);

  const generateReport = async () => {
    if (selectedProjectIds.length === 0) {
      toast({ title: "No project selected", description: "Please select at least one project.", variant: "destructive" });
      return;
    }
    setGenerating(true);
    try {
      const results: ReportData[] = [];

      for (const projectId of selectedProjectIds) {
        const projectResult = await projectsApi.getById(projectId);
        const project = projectResult.data ?? null;

        const membersResult = await projectsApi.getMembers(projectId);
        const members = (membersResult.data || []).map((m: any) => ({
          ...m,
          user_id: m.userId,
          project_id: m.projectId,
          profiles: { full_name: m.userFullName, email: m.userEmail },
        }));

        // ALL active orders (exclude rejected/cancelled — fetched separately below)
        const allOrdersResult = await ordersApi.getByProject(projectId);
        let rawApiOrders: any[] = (allOrdersResult.data || []).filter(
          (o: any) => !['rejected', 'cancelled'].includes(o.status)
        );
        // Client-side date filtering
        if (dateStart) rawApiOrders = rawApiOrders.filter((o: any) => new Date(o.createdAt) >= dateStart!);
        if (dateEnd) rawApiOrders = rawApiOrders.filter((o: any) => new Date(o.createdAt) <= dateEnd!);

        const mapOrderItems = (items: any[]) =>
          items.map((i: any) => ({
            ...i,
            sku_id: i.skuId,
            quotation_item_id: i.quotationItemId ?? null,
            quantity_ordered: i.quantityOrdered,
            quantity_received: i.quantityReceived,
            sku_name: i.skuName,
            skus: { name: i.skuName, sku_code: i.skuCode, unit_of_measure: i.unit },
          }));

        const orders = rawApiOrders.map((o: any) => ({
          ...o,
          order_number: o.orderNumber,
          project_id: o.projectId,
          supplier_name: o.supplierName,
          expected_delivery_date: o.expectedDeliveryDate,
          created_at: o.createdAt,
          rejection_reason: o.rejectionReason,
          creator_name: o.createdByName || null,
          approver_name: o.approvedByName || null,
          rejector_name: o.rejectedByName || null,
          order_items: mapOrderItems(o.items || []),
        }));

        // Rejected orders — from same endpoint filtered by status
        const rejectedResult = await ordersApi.getAll({ status: 'rejected', projectId });
        let rawRejApi: any[] = rejectedResult.data || [];
        if (dateStart) rawRejApi = rawRejApi.filter((o: any) => new Date(o.createdAt) >= dateStart!);
        if (dateEnd) rawRejApi = rawRejApi.filter((o: any) => new Date(o.createdAt) <= dateEnd!);

        const rejectedOrders = rawRejApi.map((o: any) => ({
          ...o,
          order_number: o.orderNumber,
          project_id: o.projectId,
          supplier_name: o.supplierName,
          expected_delivery_date: o.expectedDeliveryDate,
          created_at: o.createdAt,
          rejection_reason: o.rejectionReason,
          creator_name: o.createdByName || null,
          approver_name: o.approvedByName || null,
          rejector_name: o.rejectedByName || null,
          order_items: mapOrderItems(o.items || []),
        }));

        // Quotation
        const quotationsResult = await quotationsApi.getAll(projectId);
        const apiQuotations: any[] = quotationsResult.data || [];
        const quotation = apiQuotations[0] ?? null;
        const quotationItems = (quotation?.items || []).map((qi: any) => ({
          id: qi.id,
          material_name: qi.materialName,
          unit: qi.unit,
          quantity: qi.quantity,
          received_quantity: qi.receivedQuantity,
        }));

        // Borrow transactions
        const borrowsResult = await companyAssetsApi.getAllBorrows(projectId);
        let borrowTxns: any[] = borrowsResult.data || [];
        if (dateStart) borrowTxns = borrowTxns.filter((b: any) => b.borrowedAt && new Date(b.borrowedAt) >= dateStart!);
        if (dateEnd) borrowTxns = borrowTxns.filter((b: any) => b.borrowedAt && new Date(b.borrowedAt) <= dateEnd!);

        const assetHistory: BorrowRecord[] = (borrowTxns || []).map((b: any) => ({
          id: b.id,
          assetName: b.assetName || '—',
          assetType: '—',
          assetCode: '—',
          borrowedQty: b.borrowedQty,
          returnedQty: b.returnedQty,
          status: b.status,
          borrowedBy: b.borrowedByName || '—',
          borrowedAt: b.borrowedAt,
          returnedAt: b.returnedAt,
          returnRemarks: b.returnRemarks,
          expectedReturnDate: b.expectedReturnDate,
          borrowRequestedAt: null,
          borrowRequestedBy: null,
          borrowApprovedAt: null,
          borrowApprovedBy: null,
          returnRequestedAt: null,
          returnRequestedBy: null,
          returnApprovedAt: null,
          returnApprovedBy: null,
          duration: computeBorrowDuration(b.borrowedAt, b.returnedAt).text,
          ongoing: computeBorrowDuration(b.borrowedAt, b.returnedAt).ongoing,
        }));

        // Activity logs
        let activityLogs: any[] = [];
        try {
          const activityResult = await projectsApi.getActivity(projectId, 100);
          activityLogs = (activityResult.data || []).map((log: any) => ({
            ...log,
            id: log.id,
            action: log.action,
            tableName: log.tableName,
            created_at: log.createdAt,
            user: { full_name: log.userName || "System" },
          }));
        } catch {
          activityLogs = [];
        }

        // Material progress – match by quotation_item_id (FK) or sku_name (fallback for manual orders)
        let materialProgress: ReportData["materialProgress"] = [];
        let overallProgress = { totalQuoted: 0, totalOrdered: 0, totalDelivered: 0, percentage: 0 };

        if (quotationItems.length > 0) {
          const deliveredStatuses = ["delivered", "closed", "fully_received", "partially_received"];
          // All order items from delivered orders (for progress)
          const deliveredItems = (orders || [])
            .filter((o: any) => deliveredStatuses.includes(o.status))
            .flatMap((o: any) => o.order_items || []);
          // All order items (for ordered qty)
          const allOrderItems = (orders || []).flatMap((o: any) => o.order_items || []);

          materialProgress = quotationItems.map((qi: any) => {
            // Match by FK first, then by SKU name (case-insensitive) for manually created orders
            const matchItem = (item: any) =>
              item.quotation_item_id === qi.id ||
              (!item.quotation_item_id &&
                (item.sku_name || '').toLowerCase() === (qi.material_name || '').toLowerCase());

            const ordered = allOrderItems
              .filter(matchItem)
              .reduce((s: number, i: any) => s + (i.quantity_ordered || 0), 0);

            // Use quantity_ordered (not quantity_received which is always 0 in DB)
            const delivered = Math.min(
              deliveredItems.filter(matchItem).reduce((s: number, i: any) => s + (i.quantity_ordered || 0), 0),
              qi.quantity
            );

            return {
              materialName: qi.material_name,
              unit: qi.unit,
              quotedQty: qi.quantity,
              orderedQty: ordered,
              deliveredQty: delivered,
              remainingQty: Math.max(0, qi.quantity - delivered),
              percentage: qi.quantity > 0 ? Math.round((delivered / qi.quantity) * 1000) / 10 : 0,
            };
          });

          const tq = materialProgress.reduce((s, m) => s + m.quotedQty, 0);
          const to = materialProgress.reduce((s, m) => s + m.orderedQty, 0);
          const td = materialProgress.reduce((s, m) => s + m.deliveredQty, 0);
          overallProgress = { totalQuoted: tq, totalOrdered: to, totalDelivered: td, percentage: tq > 0 ? Math.round((td / tq) * 1000) / 10 : 0 };
        }

        results.push({
          project,
          orders: orders || [],
          rejectedOrders: rejectedOrders || [],
          quotation,
          quotationItems,
          assetHistory,
          teamMembers: members || [],
          activityLogs,
          materialProgress,
          overallProgress,
        });
      }

      setReportData(results);
    } catch (err: any) {
      toast({ title: "Error generating report", description: err.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const handlePrint = () => window.print();

  // Group orders by status category
  const groupOrdersByStatus = (orders: any[], rejected: any[]) => {
    const groups: { label: string; orders: any[] }[] = [];
    for (const [label, statuses] of Object.entries(ORDER_STATUS_GROUPS)) {
      const matched = orders.filter((o: any) => statuses.includes(o.status));
      if (matched.length > 0) groups.push({ label, orders: matched });
    }
    if (rejected.length > 0) {
      groups.push({ label: "Rejected", orders: rejected.map((r: any) => ({ ...r, order_items: r.order_items || r.rejected_order_items, status: "rejected" })) });
    }
    return groups;
  };

  return (
    <div className="space-y-6">
      {/* ─── Page Header (hidden on print) ─── */}
      <div className="print:hidden">
        <PageHeader title="Reports" description="Generate and export project-based reports" />
      </div>

      {/* ─── Report Builder (hidden on print) ─── */}
      <Card className="print:hidden">
        <CardHeader>
          <CardTitle className="text-lg">Report Builder</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Project Selector */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Select Projects</Label>
            <Popover open={projectDropdownOpen} onOpenChange={setProjectDropdownOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between text-left font-normal">
                  <span className="truncate">
                    {selectedProjectIds.length === 0
                      ? "Select projects..."
                      : `${selectedProjectIds.length} project${selectedProjectIds.length > 1 ? "s" : ""} selected`}
                  </span>
                  <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] p-0" align="start">
                <div className="border-b p-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 pl-8 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      placeholder="Search projects..."
                      value={projectSearch}
                      onChange={(e) => setProjectSearch(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between border-b px-3 py-2">
                  <button className="text-xs text-primary hover:underline" onClick={selectAll}>Select All</button>
                  <button className="text-xs text-muted-foreground hover:underline" onClick={clearAll}>Clear All</button>
                </div>
                <div className="max-h-[250px] overflow-y-auto p-1">
                  {filteredProjects.length === 0 ? (
                    <div className="py-4 text-center text-sm text-muted-foreground">No projects found</div>
                  ) : (
                    filteredProjects.map((p: any) => (
                      <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
                        <Checkbox checked={selectedProjectIds.includes(p.id)} onCheckedChange={() => toggleProject(p.id)} />
                        <span className="truncate">{p.name}</span>
                        {p.code && <span className="ml-auto shrink-0 text-xs text-muted-foreground">{p.code}</span>}
                      </label>
                    ))
                  )}
                </div>
              </PopoverContent>
            </Popover>
            {selectedProjectIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {selectedProjectIds.slice(0, 5).map((id) => {
                  const proj = projects.find((p: any) => p.id === id);
                  return (
                    <span key={id} className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                      {proj?.name || id.slice(0, 8)}
                      <X className="h-3 w-3 cursor-pointer hover:text-destructive" onClick={() => toggleProject(id)} />
                    </span>
                  );
                })}
                {selectedProjectIds.length > 5 && <span className="text-xs text-muted-foreground">+{selectedProjectIds.length - 5} more</span>}
              </div>
            )}
          </div>

          {/* Date Range */}
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { label: "Start Date", value: dateStart, set: setDateStart },
              { label: "End Date", value: dateEnd, set: setDateEnd },
            ].map((d) => (
              <div key={d.label} className="space-y-2">
                <Label className="text-sm font-medium">{d.label}</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !d.value && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {d.value ? format(d.value, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={d.value} onSelect={d.set} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
            ))}
          </div>

          {/* Content checkboxes */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Report Sections</Label>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {[
                { label: "Project Details", checked: includeDetails, set: setIncludeDetails },
                { label: "Progress & Materials", checked: includeProgress, set: setIncludeProgress },
                { label: "Orders", checked: includeOrders, set: setIncludeOrders },
                { label: "Quotations", checked: includeQuotations, set: setIncludeQuotations },
                { label: "Equipment & Assets", checked: includeAssets, set: setIncludeAssets },
                { label: "Activity History", checked: includeActivity, set: setIncludeActivity },
              ].map((item) => (
                <label key={item.label} className="flex cursor-pointer items-center gap-2 text-sm">
                  <Checkbox checked={item.checked} onCheckedChange={(v) => item.set(!!v)} />
                  {item.label}
                </label>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3 border-t pt-4">
            <Button onClick={generateReport} disabled={generating}>
              {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
              Generate Report
            </Button>
            <Button variant="outline" onClick={handlePrint} disabled={!reportData}>
              <Printer className="mr-2 h-4 w-4" />
              Print Report
            </Button>
            <Button variant="outline" onClick={handlePrint} disabled={!reportData}>
              <FileDown className="mr-2 h-4 w-4" />
              Export PDF
            </Button>
            <Button variant="outline" disabled>
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Export Excel / CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ─── Report Output ─── */}
      <div ref={reportRef} className="report-preview space-y-8">
        {reportData === null && (
          <div className="print:hidden">
            <EmptyState icon={FileText} title="No report generated" description="Select projects and click 'Generate Report' to preview your report." />
          </div>
        )}

        {reportData && reportData.length === 0 && (
          <EmptyState icon={FileText} title="No data available" description="No data available for the selected filters." />
        )}

        {reportData && reportData.length > 0 && (
          <>
            {/* ── Report Header ── */}
            <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-6 text-center print:border print:bg-transparent print:p-4">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Project Management Report</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Generated on {formatInTimeZone(new Date(), MANILA_TZ, "MMMM dd, yyyy – h:mm a")} (PHT)
              </p>
              <p className="text-sm text-muted-foreground">
                Generated by: <span className="font-medium text-foreground">{profile?.full_name || "—"}</span>
              </p>
              <div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
                <span>{reportData.length} project{reportData.length > 1 ? "s" : ""}</span>
                {dateStart && <span>• From {format(dateStart, "PPP")}</span>}
                {dateEnd && <span>• To {format(dateEnd, "PPP")}</span>}
              </div>
            </div>

            {/* ── Per-Project Sections ── */}
            {reportData.map((rd, idx) => {
              const allOrders = [...rd.orders, ...rd.rejectedOrders.map((r: any) => ({ ...r, status: "rejected" }))];
              const orderGroups = groupOrdersByStatus(rd.orders, rd.rejectedOrders);
              const activeBorrows = rd.assetHistory.filter((a) => a.status !== "Returned");
              const returnedBorrows = rd.assetHistory.filter((a) => a.status === "Returned");

              return (
                <div key={rd.project?.id || idx} className="space-y-4 rounded-lg border bg-card p-6 shadow-sm print:shadow-none print:break-before-page print:p-4">
                  {/* Project Title Banner */}
                  <div className="flex items-start justify-between border-b pb-4">
                    <div>
                      <h2 className="text-xl font-bold text-foreground">
                        {rd.project?.name || "Unknown Project"}
                      </h2>
                      {rd.project?.code && <span className="text-sm text-muted-foreground">Code: {rd.project.code}</span>}
                      {rd.project?.location && (
                        <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5" /> {rd.project.location}
                        </div>
                      )}
                    </div>
                    <Badge variant={rd.project?.status === "active" ? "default" : "secondary"} className="text-xs">
                      {statusLabel(rd.project?.status)}
                    </Badge>
                  </div>

                  {/* ── PROJECT DETAILS ── */}
                  {includeDetails && (
                    <ReportSection title="Project Overview" icon={Building2} defaultOpen>
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="space-y-3">
                          <DetailItem icon={<CalendarIcon className="h-3.5 w-3.5" />} label="Start Date" value={formatManilaDate(rd.project?.startDate)} />
                          <DetailItem icon={<CalendarIcon className="h-3.5 w-3.5" />} label="End Date" value={formatManilaDate(rd.project?.endDate)} />
                        </div>
                        <div className="space-y-3">
                          <DetailItem icon={<Clock className="h-3.5 w-3.5" />} label="Duration" value={getDuration(rd.project?.startDate, rd.project?.endDate)} />
                          <DetailItem icon={<DollarSign className="h-3.5 w-3.5" />} label="Estimated Cost" value={rd.project?.estimatedCost ? `₱${Number(rd.project.estimatedCost).toLocaleString()}` : "—"} />
                        </div>
                        <div className="sm:col-span-2">
                          <div className="text-xs font-medium text-muted-foreground mb-1">Description</div>
                          <p className="text-sm text-foreground">{rd.project?.description || "No description provided."}</p>
                        </div>
                      </div>

                      {rd.teamMembers.length > 0 && (
                        <div className="mt-4 border-t pt-3">
                          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-2">
                            <Users className="h-3.5 w-3.5" /> Assigned Team Members ({rd.teamMembers.length})
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {rd.teamMembers.map((m: any) => (
                              <span key={m.id} className="inline-flex items-center gap-1 rounded-md border bg-background px-2.5 py-1 text-xs">
                                <span className="font-medium">{(m.profiles as any)?.full_name || "—"}</span>
                                <span className="text-muted-foreground">• {statusLabel(m.role)}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </ReportSection>
                  )}

                  {/* ── PROJECT PROGRESS ── */}
                  {includeProgress && (
                    <ReportSection title="Project Progress Report" icon={TrendingUp} defaultOpen>
                      <div className="grid gap-2 grid-cols-2 sm:grid-cols-4">
                        <div className="rounded border bg-card px-3 py-2 print:p-1.5">
                          <div className="text-[10px] text-muted-foreground">Start Date</div>
                          <div className="text-xs font-semibold text-foreground">{formatManilaDate(rd.project?.startDate)}</div>
                        </div>
                        <div className="rounded border bg-card px-3 py-2 print:p-1.5">
                          <div className="text-[10px] text-muted-foreground">Expected Completion</div>
                          <div className="text-xs font-semibold text-foreground">{formatManilaDate(rd.project?.endDate)}</div>
                        </div>
                        <div className="rounded border bg-card px-3 py-2 print:p-1.5">
                          <div className="text-[10px] text-muted-foreground">Status</div>
                          <div className="text-xs font-semibold text-foreground">{statusLabel(rd.project?.status)}</div>
                        </div>
                        <div className="rounded border bg-card px-3 py-2 print:p-1.5">
                          <div className="text-[10px] text-muted-foreground">Duration</div>
                          <div className="text-xs font-semibold text-foreground">{getDuration(rd.project?.startDate, rd.project?.endDate)}</div>
                        </div>
                      </div>

                      {rd.materialProgress.length > 0 ? (
                        <div className="mt-3">
                          <div className="mb-1 flex items-center justify-between">
                            <span className="text-xs font-medium">Overall Delivery Progress</span>
                            <span className="text-sm font-bold text-primary">{rd.overallProgress.percentage}%</span>
                          </div>
                          <Progress value={rd.overallProgress.percentage} className="h-2" />
                          <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
                            <span>Quoted: <span className="font-semibold text-foreground">{rd.overallProgress.totalQuoted}</span></span>
                            <span>Delivered: <span className="font-semibold text-foreground">{rd.overallProgress.totalDelivered}</span></span>
                            <span>Remaining: <span className="font-semibold text-foreground">{Math.max(0, rd.overallProgress.totalQuoted - rd.overallProgress.totalDelivered)}</span></span>
                          </div>
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-muted-foreground">No quotation found for progress tracking.</p>
                      )}
                    </ReportSection>
                  )}

                  {/* ── MATERIAL PROGRESS ── */}
                  {includeProgress && rd.materialProgress.length > 0 && (
                    <ReportSection title="Material Progress Report" icon={Boxes} count={rd.materialProgress.length}>
                      <div className="grid gap-2 grid-cols-2 sm:grid-cols-4 mb-3">
                        <div className="rounded border bg-card px-3 py-2 text-center print:p-1.5">
                          <div className="text-sm font-bold text-foreground">{rd.materialProgress.length}</div>
                          <div className="text-[10px] text-muted-foreground">Materials</div>
                        </div>
                        <div className="rounded border bg-card px-3 py-2 text-center print:p-1.5">
                          <div className="text-sm font-bold text-foreground">{rd.overallProgress.totalQuoted}</div>
                          <div className="text-[10px] text-muted-foreground">Quoted</div>
                        </div>
                        <div className="rounded border bg-card px-3 py-2 text-center print:p-1.5">
                          <div className="text-sm font-bold text-foreground">{rd.overallProgress.totalOrdered}</div>
                          <div className="text-[10px] text-muted-foreground">Ordered</div>
                        </div>
                        <div className="rounded border bg-card px-3 py-2 text-center print:p-1.5">
                          <div className="text-sm font-bold text-foreground">{rd.overallProgress.totalDelivered}</div>
                          <div className="text-[10px] text-muted-foreground">Delivered</div>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        {rd.materialProgress.map((m, i) => (
                          <Collapsible key={i}>
                            <CollapsibleTrigger className="w-full">
                              <div className="flex items-center justify-between rounded border bg-card px-3 py-2 hover:bg-muted/40 transition-colors text-left">
                                <div className="flex-1 min-w-0">
                                  <span className="text-xs font-semibold text-foreground">{m.materialName}</span>
                                  <div className="flex items-center gap-3 mt-0.5 text-[10px] text-muted-foreground">
                                    <span>Unit: {m.unit}</span>
                                    <span>Quoted/Received: {m.quotedQty}/{m.deliveredQty}</span>
                                    <span>Remaining: {m.remainingQty}</span>
                                    <span className={cn("font-semibold",
                                      m.percentage >= 100 ? "text-primary" : m.percentage > 0 ? "text-foreground" : "text-muted-foreground"
                                    )}>{m.percentage}%</span>
                                  </div>
                                </div>
                                <Badge variant="outline" className={cn("text-[9px] ml-2 shrink-0",
                                  m.percentage >= 100 ? "border-primary text-primary" : m.percentage > 0 ? "border-destructive/50 text-destructive" : ""
                                )}>
                                  {m.percentage >= 100 ? "Done" : m.percentage > 0 ? "Partial" : "Pending"}
                                </Badge>
                              </div>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <div className="mx-1 rounded-b border border-t-0 bg-muted/20 px-3 py-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
                                <div><span className="text-muted-foreground">Quoted:</span> <span className="font-semibold">{m.quotedQty}</span></div>
                                <div><span className="text-muted-foreground">Ordered:</span> <span className="font-semibold">{m.orderedQty}</span></div>
                                <div><span className="text-muted-foreground">Delivered:</span> <span className="font-semibold">{m.deliveredQty}</span></div>
                                <div><span className="text-muted-foreground">Remaining:</span> <span className="font-semibold">{m.remainingQty}</span></div>
                                <div className="col-span-2 sm:col-span-4 flex items-center gap-2 mt-1">
                                  <Progress value={m.percentage} className="h-1.5 flex-1" />
                                  <span className="font-semibold text-foreground">{m.percentage}%</span>
                                </div>
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        ))}
                      </div>
                    </ReportSection>
                  )}

                  {/* ── ORDERS REPORT ── */}
                  {includeOrders && (
                    <ReportSection title="Orders Report" icon={ClipboardList} count={allOrders.length}>
                      {allOrders.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No orders found for this project.</p>
                      ) : (
                        <div className="space-y-5">
                          {orderGroups.map((group) => (
                            <div key={group.label}>
                              <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                                <span className="h-2 w-2 rounded-full bg-primary" />
                                {group.label}
                                <Badge variant="outline" className="text-[10px]">{group.orders.length}</Badge>
                              </h4>
                              <div className="space-y-3">
                                {group.orders.map((o: any) => {
                                  const items = o.order_items || o.rejected_order_items || [];
                                  return (
                                    <div key={o.id} className="rounded-md border p-3 text-sm">
                                      <div className="flex items-start justify-between gap-2 mb-2">
                                        <div>
                                          <span className="font-mono text-xs font-bold">{o.order_number}</span>
                                          <Badge variant={statusBadgeVariant(o.status)} className="ml-2 text-[10px]">{statusLabel(o.status)}</Badge>
                                        </div>
                                        <span className="text-xs text-muted-foreground whitespace-nowrap">{formatManila(o.created_at)}</span>
                                      </div>
                                      
                                      <div className="grid gap-x-6 gap-y-1 text-xs sm:grid-cols-3 mb-2">
                                        <div><span className="text-muted-foreground">Supplier:</span> {o.supplier_name || "—"}</div>
                                        <div><span className="text-muted-foreground">Created by:</span> {o.creator_name || "—"}</div>
                                        <div><span className="text-muted-foreground">Expected Delivery:</span> {formatManilaDate(o.expected_delivery_date)}</div>
                                        {o.approver_name && (
                                          <div><span className="text-muted-foreground">Approved by:</span> {o.approver_name} {o.approved_at && <span className="text-muted-foreground">({formatManila(o.approved_at)})</span>}</div>
                                        )}
                                        {o.rejector_name && (
                                          <div><span className="text-muted-foreground">Rejected by:</span> {o.rejector_name} {o.rejected_at && <span className="text-muted-foreground">({formatManila(o.rejected_at)})</span>}</div>
                                        )}
                                        {o.rejection_reason && (
                                          <div className="sm:col-span-3"><span className="text-muted-foreground">Rejection Reason:</span> <span className="text-destructive">{o.rejection_reason}</span></div>
                                        )}
                                        {o.delivered_at && (
                                          <div><span className="text-muted-foreground">Delivered at:</span> {formatManila(o.delivered_at)}</div>
                                        )}
                                        {o.on_transit_at && (
                                          <div><span className="text-muted-foreground">In Transit at:</span> {formatManila(o.on_transit_at)}</div>
                                        )}
                                      </div>

                                      {/* Materials table */}
                                      {items.length > 0 && (
                                        <div className="overflow-x-auto rounded border mt-1">
                                          <table className="w-full text-xs">
                                            <thead>
                                              <tr className="bg-muted/30 text-muted-foreground">
                                                <th className="px-2 py-1 text-left font-medium">Material</th>
                                                <th className="px-2 py-1 text-right font-medium">Ordered</th>
                                                <th className="px-2 py-1 text-right font-medium">Received</th>
                                                <th className="px-2 py-1 text-left font-medium">Unit</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {items.map((item: any, i: number) => {
                                                const isDelivered = ['delivered', 'closed', 'fully_received', 'partially_received'].includes(o.status);
                                                const receivedQty = isDelivered ? (item.quantity_ordered || 0) : (item.quantity_received || 0);
                                                return (
                                                <tr key={i} className="border-t">
                                                  <td className="px-2 py-1">{item.skus?.name || item.skus?.sku_code || "—"}</td>
                                                  <td className="px-2 py-1 text-right">{item.quantity_ordered}</td>
                                                  <td className="px-2 py-1 text-right">{receivedQty}</td>
                                                  <td className="px-2 py-1 text-muted-foreground">{item.skus?.unit_of_measure || "—"}</td>
                                                </tr>
                                                );
                                              })}
                                            </tbody>
                                          </table>
                                        </div>
                                      )}

                                      {o.notes && (
                                        <div className="mt-1 text-xs text-muted-foreground"><span className="font-medium">Notes:</span> {o.notes}</div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </ReportSection>
                  )}

                  {/* ── QUOTATIONS REPORT ── */}
                  {includeQuotations && (
                    <ReportSection title="Quotations Report" icon={FileText}>
                      {!rd.quotation ? (
                        <p className="text-sm text-muted-foreground">No quotation found for this project.</p>
                      ) : (
                        <div>
                          <div className="mb-3 grid gap-x-8 gap-y-1 text-sm sm:grid-cols-3">
                            <DetailItem label="Category" value={statusLabel(rd.quotation.category)} />
                            <DetailItem label="Created" value={formatManila(rd.quotation.created_at)} />
                            <DetailItem label="Notes" value={rd.quotation.notes || "—"} />
                          </div>
                          {rd.quotationItems.length > 0 && (
                            <div className="overflow-x-auto rounded-md border">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
                                    <th className="px-3 py-2 font-medium">Material</th>
                                    <th className="px-3 py-2 font-medium text-right">Quantity</th>
                                    <th className="px-3 py-2 font-medium">Unit</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {rd.quotationItems.map((qi: any) => (
                                    <tr key={qi.id} className="border-b last:border-0">
                                      <td className="px-3 py-2">{qi.material_name}</td>
                                      <td className="px-3 py-2 text-right">{qi.quantity}</td>
                                      <td className="px-3 py-2 text-muted-foreground">{qi.unit}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      )}
                    </ReportSection>
                  )}

                  {/* ── EQUIPMENT & ASSET HISTORY ── */}
                  {includeAssets && (
                    <ReportSection title="Equipment & Asset History" icon={PackageCheck} count={rd.assetHistory.length}>
                      {rd.assetHistory.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No equipment borrow/return history found for this project.</p>
                      ) : (
                        <div className="space-y-4">
                          {/* Summary stats */}
                          <div className="grid gap-3 sm:grid-cols-4 mb-2">
                            <StatMini label="Total Records" value={rd.assetHistory.length} />
                            <StatMini label="Currently Borrowed" value={activeBorrows.length} />
                            <StatMini label="Returned" value={returnedBorrows.length} />
                            <StatMini label="Total Qty Borrowed" value={rd.assetHistory.reduce((s, a) => s + a.borrowedQty, 0)} />
                          </div>

                          {/* Each record with full lifecycle */}
                          {rd.assetHistory.map((rec) => (
                            <div key={rec.id} className="rounded-md border p-3 text-sm">
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <div>
                                  <span className="font-medium">{rec.assetName}</span>
                                  <span className="ml-2 text-xs text-muted-foreground">{rec.assetCode}</span>
                                  <Badge variant={rec.status === "Returned" ? "default" : "secondary"} className="ml-2 text-[10px]">{rec.status}</Badge>
                                </div>
                                <span className={cn("text-xs font-medium", rec.ongoing ? "text-amber-600" : "text-muted-foreground")}>{rec.duration}</span>
                              </div>

                              <div className="grid gap-x-6 gap-y-1 text-xs sm:grid-cols-3 mb-3">
                                <div><span className="text-muted-foreground">Type:</span> {rec.assetType}</div>
                                <div><span className="text-muted-foreground">Qty Borrowed:</span> {rec.borrowedQty}</div>
                                <div><span className="text-muted-foreground">Qty Returned:</span> {rec.returnedQty}</div>
                                <div><span className="text-muted-foreground">Borrowed By:</span> {rec.borrowedBy}</div>
                                {rec.expectedReturnDate && (
                                  <div><span className="text-muted-foreground">Expected Return:</span> {formatManilaDate(rec.expectedReturnDate)}</div>
                                )}
                                {rec.returnRemarks && (
                                  <div className="sm:col-span-3"><span className="text-muted-foreground">Remarks:</span> {rec.returnRemarks}</div>
                                )}
                              </div>

                              {/* Lifecycle workflow */}
                              <div className="grid gap-4 sm:grid-cols-2 border-t pt-2">
                                <div>
                                  <div className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Borrow Workflow</div>
                                  <div className="space-y-2">
                                    <WorkflowStep label="Borrow Requested" by={rec.borrowRequestedBy} at={rec.borrowRequestedAt} done={!!rec.borrowRequestedAt} />
                                    <WorkflowStep label="Borrow Approved" by={rec.borrowApprovedBy} at={rec.borrowApprovedAt} done={!!rec.borrowApprovedAt} />
                                  </div>
                                </div>
                                <div>
                                  <div className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Return Workflow</div>
                                  <div className="space-y-2">
                                    <WorkflowStep label="Return Requested" by={rec.returnRequestedBy} at={rec.returnRequestedAt} done={!!rec.returnRequestedAt} />
                                    <WorkflowStep label="Return Approved" by={rec.returnApprovedBy} at={rec.returnApprovedAt} done={!!rec.returnApprovedAt} />
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </ReportSection>
                  )}

                  {/* ── ACTIVITY HISTORY ── */}
                  {includeActivity && (
                    <ReportSection title="Activity History" icon={History} count={rd.activityLogs.length}>
                      {rd.activityLogs.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No activity logs found.</p>
                      ) : (
                        <div className="space-y-1">
                          {rd.activityLogs.map((log: any) => (
                            <div key={log.id} className="flex items-start gap-3 rounded-md border-b py-2 last:border-0 text-sm">
                              <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-primary/40" />
                              <div className="min-w-0 flex-1">
                                <p className="text-foreground">{formatActivityDescription(log)}</p>
                                <div className="flex flex-wrap gap-x-4 text-xs text-muted-foreground">
                                  <span>By: {log.user?.full_name || "System"}</span>
                                  <span>{formatManila(log.created_at)}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </ReportSection>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* Print & report-preview styles */}
      <style>{`
        @page { margin: 10mm; size: auto; }
        @media print {
          .print\\:hidden { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; font-size: 11px; overflow: visible !important; margin: 0; }
          html { overflow: visible !important; }
          * { overflow: visible !important; }
          .report-preview { break-inside: avoid; overflow: visible !important; }
          .report-section { break-inside: avoid; }
          [data-state="closed"] > [data-radix-collapsible-content] { display: block !important; height: auto !important; }
          .print\\:break-before-page { break-before: page; }
          .print\\:break-before-page:first-child { break-before: auto; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; }
          main, [data-radix-scroll-area-viewport], [data-sidebar-content] { overflow: visible !important; height: auto !important; max-height: none !important; }
          /* Hide all system UI */
          nav, aside, header, [data-lovable-badge], .lovable-badge, [id*="lovable"], a[href*="lovable.dev"] { display: none !important; }
          footer { display: none !important; }
        }
        /* Hide Lovable badge inside report preview area */
        .report-preview [data-lovable-badge],
        .report-preview .lovable-badge,
        .report-preview a[href*="lovable.dev"],
        .report-preview iframe { display: none !important; }
      `}</style>
    </div>
  );
}

/* ─── Small Helper Components ─── */
function DetailItem({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="text-sm">
      <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="font-medium text-foreground">{value}</div>
    </div>
  );
}
