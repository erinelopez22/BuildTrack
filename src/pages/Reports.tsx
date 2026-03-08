import { useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
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
  BarChart3,
} from "lucide-react";
import { Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { formatActivityDescription } from "@/lib/activityLogger";
import type { Json } from "@/integrations/supabase/types";

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

type ReportData = {
  project: any;
  orders: any[];
  rejectedOrders: any[];
  quotation: any | null;
  quotationItems: any[];
  borrowedAssets: any[];
  returnedAssets: any[];
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
  const [includeBorrowed, setIncludeBorrowed] = useState(true);
  const [includeReturned, setIncludeReturned] = useState(true);
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
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, location, status, code")
        .eq("is_hidden", false)
        .order("name");
      if (error) throw error;
      return data || [];
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
        const { data: project } = await supabase.from("projects").select("*").eq("id", projectId).single();

        const { data: members } = await supabase
          .from("project_members")
          .select("*, profiles:user_id(full_name, email)")
          .eq("project_id", projectId);

        // Active orders
        let ordersQuery = supabase
          .from("orders")
          .select("*, order_items(*, skus(name, sku_code, unit_of_measure)), profiles:created_by(full_name), approver:approved_by(full_name), rejector:rejected_by(full_name)")
          .eq("project_id", projectId)
          .order("created_at", { ascending: false });
        if (dateStart) ordersQuery = ordersQuery.gte("created_at", dateStart.toISOString());
        if (dateEnd) ordersQuery = ordersQuery.lte("created_at", dateEnd.toISOString());
        const { data: orders } = await ordersQuery;

        // Rejected orders
        let rejQuery = supabase
          .from("rejected_orders")
          .select("*, rejected_order_items(*, skus(name, sku_code, unit_of_measure)), profiles:created_by(full_name), rejector:rejected_by(full_name)")
          .eq("project_id", projectId)
          .order("created_at", { ascending: false });
        if (dateStart) rejQuery = rejQuery.gte("created_at", dateStart.toISOString());
        if (dateEnd) rejQuery = rejQuery.lte("created_at", dateEnd.toISOString());
        const { data: rejectedOrders } = await rejQuery;

        // Quotation
        const { data: quotation } = await supabase.from("project_quotations").select("*").eq("project_id", projectId).maybeSingle();
        let quotationItems: any[] = [];
        if (quotation) {
          const { data: qItems } = await supabase.from("quotation_items").select("*").eq("quotation_id", quotation.id);
          quotationItems = qItems || [];
        }

        // Borrow transactions
        let borrowQuery = supabase
          .from("borrow_transactions")
          .select("*, company_assets:asset_id(asset_name, asset_type, asset_code), profiles:borrowed_by(full_name)")
          .eq("project_id", projectId)
          .order("borrowed_at", { ascending: false });
        if (dateStart) borrowQuery = borrowQuery.gte("borrowed_at", dateStart.toISOString());
        if (dateEnd) borrowQuery = borrowQuery.lte("borrowed_at", dateEnd.toISOString());
        const { data: borrows } = await borrowQuery;

        const borrowedAssets = (borrows || []).filter((b: any) => b.status !== "Returned");
        const returnedAssets = (borrows || []).filter((b: any) => b.status === "Returned");

        // Activity logs
        const allOrders = [...(orders || []), ...(rejectedOrders || [])];
        const orderIds = allOrders.map((o: any) => o.id);
        const logRecordIds = [projectId, ...orderIds];

        let activityLogs: any[] = [];
        if (logRecordIds.length > 0) {
          const { data: logs } = await supabase
            .from("audit_logs")
            .select("*")
            .in("record_id", logRecordIds)
            .order("created_at", { ascending: false })
            .limit(100);

          if (logs && logs.length > 0) {
            const userIds = [...new Set(logs.map((l: any) => l.user_id).filter(Boolean))];
            const { data: profiles } = await supabase.from("profiles").select("id, full_name, email").in("id", userIds);
            const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
            activityLogs = logs.map((l: any) => ({
              ...l,
              user: profileMap.get(l.user_id),
            }));
          }
        }

        // Material progress calculation
        let materialProgress: ReportData["materialProgress"] = [];
        let overallProgress = { totalQuoted: 0, totalOrdered: 0, totalDelivered: 0, percentage: 0 };

        if (quotationItems.length > 0) {
          const deliveredOrders = (orders || []).filter((o: any) => ["delivered", "closed", "fully_received", "partially_received"].includes(o.status));
          const allOrderItems = (orders || []).flatMap((o: any) => (o.order_items || []).map((i: any) => ({ ...i, orderStatus: o.status })));

          const matMap = new Map<string, { materialName: string; unit: string; quotedQty: number; orderedQty: number; deliveredQty: number }>();
          for (const qi of quotationItems) {
            matMap.set(qi.id, { materialName: qi.material_name, unit: qi.unit, quotedQty: qi.quantity, orderedQty: 0, deliveredQty: 0 });
          }

          for (const item of allOrderItems) {
            if (item.quotation_item_id && matMap.has(item.quotation_item_id)) {
              const m = matMap.get(item.quotation_item_id)!;
              m.orderedQty += item.quantity_ordered || 0;
              if (["delivered", "closed", "fully_received", "partially_received"].includes(item.orderStatus)) {
                m.deliveredQty += item.quantity_received || 0;
              }
            }
          }

          materialProgress = Array.from(matMap.values()).map((m) => {
            const delivered = Math.min(m.deliveredQty, m.quotedQty);
            return {
              ...m,
              deliveredQty: delivered,
              remainingQty: Math.max(0, m.quotedQty - delivered),
              percentage: m.quotedQty > 0 ? Math.round((delivered / m.quotedQty) * 100) : 0,
            };
          });

          const tq = materialProgress.reduce((s, m) => s + m.quotedQty, 0);
          const to = materialProgress.reduce((s, m) => s + m.orderedQty, 0);
          const td = materialProgress.reduce((s, m) => s + m.deliveredQty, 0);
          overallProgress = { totalQuoted: tq, totalOrdered: to, totalDelivered: td, percentage: tq > 0 ? Math.round((td / tq) * 100) : 0 };
        }

        results.push({
          project,
          orders: orders || [],
          rejectedOrders: rejectedOrders || [],
          quotation,
          quotationItems,
          borrowedAssets,
          returnedAssets,
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
      groups.push({ label: "Rejected", orders: rejected.map((r: any) => ({ ...r, order_items: r.rejected_order_items, status: "rejected" })) });
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
                { label: "Progress Report", checked: includeProgress, set: setIncludeProgress },
                { label: "Orders", checked: includeOrders, set: setIncludeOrders },
                { label: "Quotations", checked: includeQuotations, set: setIncludeQuotations },
                { label: "Borrowed Assets", checked: includeBorrowed, set: setIncludeBorrowed },
                { label: "Returned Assets", checked: includeReturned, set: setIncludeReturned },
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
                Generated by: <span className="font-medium text-foreground">{profile?.full_name || user?.email || "—"}</span>
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
                          <DetailItem icon={<CalendarIcon className="h-3.5 w-3.5" />} label="Start Date" value={formatManilaDate(rd.project?.start_date)} />
                          <DetailItem icon={<CalendarIcon className="h-3.5 w-3.5" />} label="End Date" value={formatManilaDate(rd.project?.end_date)} />
                        </div>
                        <div className="space-y-3">
                          <DetailItem icon={<Clock className="h-3.5 w-3.5" />} label="Duration" value={getDuration(rd.project?.start_date, rd.project?.end_date)} />
                          <DetailItem icon={<DollarSign className="h-3.5 w-3.5" />} label="Estimated Cost" value={rd.project?.estimated_cost ? `₱${Number(rd.project.estimated_cost).toLocaleString()}` : "—"} />
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
                                <span className="font-medium">{(m.profiles as any)?.full_name || (m.profiles as any)?.email || "—"}</span>
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
                      <div className="grid gap-4 sm:grid-cols-4">
                        <StatMini label="Start Date" value={formatManilaDate(rd.project?.start_date)} />
                        <StatMini label="Expected Completion" value={formatManilaDate(rd.project?.end_date)} />
                        <StatMini label="Status" value={statusLabel(rd.project?.status)} />
                        <StatMini label="Duration" value={getDuration(rd.project?.start_date, rd.project?.end_date)} />
                      </div>

                      {rd.materialProgress.length > 0 && (
                        <div className="mt-4">
                          <div className="mb-2 flex items-center justify-between">
                            <span className="text-sm font-medium">Overall Material Delivery Progress</span>
                            <span className="text-lg font-bold text-primary">{rd.overallProgress.percentage}%</span>
                          </div>
                          <Progress value={rd.overallProgress.percentage} className="h-3" />
                          <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs text-muted-foreground">
                            <div>Quoted: <span className="font-semibold text-foreground">{rd.overallProgress.totalQuoted}</span></div>
                            <div>Delivered: <span className="font-semibold text-foreground">{rd.overallProgress.totalDelivered}</span></div>
                            <div>Remaining: <span className="font-semibold text-foreground">{Math.max(0, rd.overallProgress.totalQuoted - rd.overallProgress.totalDelivered)}</span></div>
                          </div>
                        </div>
                      )}
                      {rd.materialProgress.length === 0 && (
                        <p className="mt-2 text-sm text-muted-foreground">No quotation found for progress tracking.</p>
                      )}
                    </ReportSection>
                  )}

                  {/* ── MATERIAL PROGRESS ── */}
                  {includeProgress && rd.materialProgress.length > 0 && (
                    <ReportSection title="Material Progress Report" icon={Boxes} count={rd.materialProgress.length}>
                      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4 mb-4">
                        <StatMini label="Total Materials" value={rd.materialProgress.length} />
                        <StatMini label="Total Quoted" value={rd.overallProgress.totalQuoted} />
                        <StatMini label="Total Ordered" value={rd.overallProgress.totalOrdered} />
                        <StatMini label="Total Delivered" value={rd.overallProgress.totalDelivered} />
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
                              <th className="px-3 py-2 font-medium">Material</th>
                              <th className="px-3 py-2 font-medium">Unit</th>
                              <th className="px-3 py-2 font-medium text-right">Quoted</th>
                              <th className="px-3 py-2 font-medium text-right">Ordered</th>
                              <th className="px-3 py-2 font-medium text-right">Delivered</th>
                              <th className="px-3 py-2 font-medium text-right">Remaining</th>
                              <th className="px-3 py-2 font-medium text-right">Progress</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rd.materialProgress.map((m, i) => (
                              <tr key={i} className="border-b last:border-0">
                                <td className="px-3 py-2 font-medium">{m.materialName}</td>
                                <td className="px-3 py-2 text-muted-foreground">{m.unit}</td>
                                <td className="px-3 py-2 text-right">{m.quotedQty}</td>
                                <td className="px-3 py-2 text-right">{m.orderedQty}</td>
                                <td className="px-3 py-2 text-right">{m.deliveredQty}</td>
                                <td className="px-3 py-2 text-right">{m.remainingQty}</td>
                                <td className="px-3 py-2 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <div className="hidden w-16 sm:block print:block">
                                      <Progress value={m.percentage} className="h-1.5" />
                                    </div>
                                    <span className={cn("text-xs font-semibold", m.percentage === 100 ? "text-primary" : m.percentage > 0 ? "text-foreground" : "text-muted-foreground")}>
                                      {m.percentage}%
                                    </span>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </ReportSection>
                  )}

                  {/* ── ORDERS REPORT ── */}
                  {includeOrders && (
                    <ReportSection title="Orders Report" icon={ClipboardList} count={allOrders.length}>
                      {allOrders.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No orders found for this project.</p>
                      ) : (
                        <div className="space-y-4">
                          {orderGroups.map((group) => (
                            <div key={group.label}>
                              <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                                <span className="h-2 w-2 rounded-full bg-primary" />
                                {group.label}
                                <Badge variant="outline" className="text-[10px]">{group.orders.length}</Badge>
                              </h4>
                              <div className="overflow-x-auto rounded-md border">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
                                      <th className="px-3 py-2 font-medium">Order #</th>
                                      <th className="px-3 py-2 font-medium">Status</th>
                                      <th className="px-3 py-2 font-medium">Supplier</th>
                                      <th className="px-3 py-2 font-medium">Materials</th>
                                      <th className="px-3 py-2 font-medium">Expected Delivery</th>
                                      <th className="px-3 py-2 font-medium">Created By</th>
                                      <th className="px-3 py-2 font-medium">Created At</th>
                                      <th className="px-3 py-2 font-medium">Notes</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {group.orders.map((o: any) => {
                                      const items = o.order_items || o.rejected_order_items || [];
                                      return (
                                        <tr key={o.id} className="border-b last:border-0 align-top">
                                          <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{o.order_number}</td>
                                          <td className="px-3 py-2">
                                            <Badge variant={statusBadgeVariant(o.status)} className="text-[10px] whitespace-nowrap">{statusLabel(o.status)}</Badge>
                                          </td>
                                          <td className="px-3 py-2 text-xs">{o.supplier_name || "—"}</td>
                                          <td className="px-3 py-2">
                                            {items.map((item: any, i: number) => (
                                              <div key={i} className="text-xs whitespace-nowrap">
                                                {item.skus?.name || item.skus?.sku_code || "—"} × {item.quantity_ordered}
                                                {item.skus?.unit_of_measure && <span className="text-muted-foreground"> {item.skus.unit_of_measure}</span>}
                                              </div>
                                            ))}
                                          </td>
                                          <td className="px-3 py-2 text-xs whitespace-nowrap">{formatManilaDate(o.expected_delivery_date)}</td>
                                          <td className="px-3 py-2 text-xs whitespace-nowrap">{(o.profiles as any)?.full_name || "—"}</td>
                                          <td className="px-3 py-2 text-xs whitespace-nowrap">{formatManila(o.created_at)}</td>
                                          <td className="px-3 py-2 text-xs max-w-[150px] truncate">{o.notes || o.rejection_reason || "—"}</td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
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

                  {/* ── BORROWED ASSETS ── */}
                  {includeBorrowed && (
                    <ReportSection title="Borrowed Assets" icon={PackageCheck} count={rd.borrowedAssets.length}>
                      {rd.borrowedAssets.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No borrowed assets found.</p>
                      ) : (
                        <div className="overflow-x-auto rounded-md border">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
                                <th className="px-3 py-2 font-medium">Asset Name</th>
                                <th className="px-3 py-2 font-medium">Category</th>
                                <th className="px-3 py-2 font-medium text-right">Qty Borrowed</th>
                                <th className="px-3 py-2 font-medium">Borrowed By</th>
                                <th className="px-3 py-2 font-medium">Borrow Date</th>
                                <th className="px-3 py-2 font-medium">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {rd.borrowedAssets.map((b: any) => (
                                <tr key={b.id} className="border-b last:border-0">
                                  <td className="px-3 py-2 font-medium">{(b.company_assets as any)?.asset_name || "—"}</td>
                                  <td className="px-3 py-2 text-muted-foreground">{(b.company_assets as any)?.asset_type || "—"}</td>
                                  <td className="px-3 py-2 text-right">{b.borrowed_qty}</td>
                                  <td className="px-3 py-2">{(b.profiles as any)?.full_name || "—"}</td>
                                  <td className="px-3 py-2 text-xs whitespace-nowrap">{formatManila(b.borrowed_at)}</td>
                                  <td className="px-3 py-2">
                                    <Badge variant="outline" className="text-[10px]">{b.status}</Badge>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </ReportSection>
                  )}

                  {/* ── RETURNED ASSETS ── */}
                  {includeReturned && (
                    <ReportSection title="Returned Assets" icon={RotateCcw} count={rd.returnedAssets.length}>
                      {rd.returnedAssets.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No returned assets found.</p>
                      ) : (
                        <div className="overflow-x-auto rounded-md border">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
                                <th className="px-3 py-2 font-medium">Asset Name</th>
                                <th className="px-3 py-2 font-medium text-right">Qty Returned</th>
                                <th className="px-3 py-2 font-medium">Returned By</th>
                                <th className="px-3 py-2 font-medium">Return Date</th>
                                <th className="px-3 py-2 font-medium">Remarks</th>
                              </tr>
                            </thead>
                            <tbody>
                              {rd.returnedAssets.map((r: any) => (
                                <tr key={r.id} className="border-b last:border-0">
                                  <td className="px-3 py-2 font-medium">{(r.company_assets as any)?.asset_name || "—"}</td>
                                  <td className="px-3 py-2 text-right">{r.returned_qty}</td>
                                  <td className="px-3 py-2">{(r.profiles as any)?.full_name || "—"}</td>
                                  <td className="px-3 py-2 text-xs whitespace-nowrap">{formatManila(r.returned_at)}</td>
                                  <td className="px-3 py-2 text-xs">{r.return_remarks || "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
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
                                  <span>By: {log.user?.full_name || log.user?.email || "System"}</span>
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

      {/* Print styles */}
      <style>{`
        @media print {
          .print\\:hidden { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; font-size: 11px; }
          .report-preview { break-inside: avoid; }
          .report-section { break-inside: avoid; }
          [data-state="closed"] > [data-radix-collapsible-content] { display: block !important; height: auto !important; }
          .print\\:break-before-page { break-before: page; }
          .print\\:break-before-page:first-child { break-before: auto; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; }
        }
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
