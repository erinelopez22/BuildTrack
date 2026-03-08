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
  CheckSquare,
  X,
  Search,
  ChevronDown,
} from "lucide-react";
import { Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const MANILA_TZ = "Asia/Manila";

function formatManila(dateStr: string | null | undefined, fmt = "MMM dd, yyyy hh:mm a") {
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
  quotation: any | null;
  quotationItems: any[];
  borrowedAssets: any[];
  returnedAssets: any[];
  teamMembers: any[];
};

export default function Reports() {
  const { roles, user, isAdmin, hasRole } = useAuth();
  const { toast } = useToast();

  const allowed =
    isAdmin() ||
    hasRole("office_admin") ||
    hasRole("project_engineer");

  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [dateStart, setDateStart] = useState<Date | undefined>();
  const [dateEnd, setDateEnd] = useState<Date | undefined>();
  const [includeDetails, setIncludeDetails] = useState(true);
  const [includeOrders, setIncludeOrders] = useState(true);
  const [includeQuotations, setIncludeQuotations] = useState(true);
  const [includeBorrowed, setIncludeBorrowed] = useState(true);
  const [includeReturned, setIncludeReturned] = useState(true);
  const [reportData, setReportData] = useState<ReportData[] | null>(null);
  const [generating, setGenerating] = useState(false);
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);
  const [projectSearch, setProjectSearch] = useState("");
  const reportRef = useRef<HTMLDivElement>(null);

  // Fetch projects
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

  if (!allowed) {
    return <Navigate to="/dashboard" replace />;
  }

  const filteredProjects = projects.filter((p: any) =>
    p.name.toLowerCase().includes(projectSearch.toLowerCase())
  );

  const toggleProject = (id: string) => {
    setSelectedProjectIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

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
        // Project details
        const { data: project } = await supabase
          .from("projects")
          .select("*")
          .eq("id", projectId)
          .single();

        // Team members
        const { data: members } = await supabase
          .from("project_members")
          .select("*, profiles:user_id(full_name, email)")
          .eq("project_id", projectId);

        // Orders
        let ordersQuery = supabase
          .from("orders")
          .select("*, order_items(*, skus(name, sku_code, unit_of_measure)), profiles:created_by(full_name)")
          .eq("project_id", projectId)
          .order("created_at", { ascending: false });

        if (dateStart) ordersQuery = ordersQuery.gte("created_at", dateStart.toISOString());
        if (dateEnd) ordersQuery = ordersQuery.lte("created_at", dateEnd.toISOString());

        const { data: orders } = await ordersQuery;

        // Quotation
        const { data: quotation } = await supabase
          .from("project_quotations")
          .select("*")
          .eq("project_id", projectId)
          .maybeSingle();

        let quotationItems: any[] = [];
        if (quotation) {
          const { data: qItems } = await supabase
            .from("quotation_items")
            .select("*")
            .eq("quotation_id", quotation.id);
          quotationItems = qItems || [];
        }

        // Borrowed assets
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

        results.push({
          project,
          orders: orders || [],
          quotation,
          quotationItems,
          borrowedAssets,
          returnedAssets,
          teamMembers: members || [],
        });
      }

      setReportData(results);
    } catch (err: any) {
      toast({ title: "Error generating report", description: err.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportPdf = () => {
    // Use browser print-to-PDF
    window.print();
  };

  const statusLabel = (status: string | null) => {
    if (!status) return "—";
    return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const getDuration = (start: string | null, end: string | null) => {
    if (!start || !end) return "—";
    const s = new Date(start);
    const e = new Date(end);
    const days = Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
    if (days < 0) return "—";
    if (days < 30) return `${days} day${days !== 1 ? "s" : ""}`;
    const months = Math.floor(days / 30);
    const rem = days % 30;
    return `${months} month${months !== 1 ? "s" : ""}${rem > 0 ? `, ${rem} day${rem !== 1 ? "s" : ""}` : ""}`;
  };

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <PageHeader
          title="Reports"
          description="Generate and export project-based reports"
        />
      </div>

      {/* Filter / Report Builder */}
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
                <Button
                  variant="outline"
                  className="w-full justify-between text-left font-normal"
                >
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
                      <label
                        key={p.id}
                        className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                      >
                        <Checkbox
                          checked={selectedProjectIds.includes(p.id)}
                          onCheckedChange={() => toggleProject(p.id)}
                        />
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
                {selectedProjectIds.length > 5 && (
                  <span className="text-xs text-muted-foreground">+{selectedProjectIds.length - 5} more</span>
                )}
              </div>
            )}
          </div>

          {/* Date Range */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Start Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !dateStart && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateStart ? format(dateStart, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateStart} onSelect={setDateStart} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">End Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !dateEnd && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateEnd ? format(dateEnd, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateEnd} onSelect={setDateEnd} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Content checkboxes */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Report Sections</Label>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {[
                { label: "Project Details", checked: includeDetails, set: setIncludeDetails },
                { label: "Orders", checked: includeOrders, set: setIncludeOrders },
                { label: "Quotations", checked: includeQuotations, set: setIncludeQuotations },
                { label: "Borrowed Assets", checked: includeBorrowed, set: setIncludeBorrowed },
                { label: "Returned Assets", checked: includeReturned, set: setIncludeReturned },
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
            <Button variant="outline" onClick={handleExportPdf} disabled={!reportData}>
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

      {/* Report Preview */}
      <div ref={reportRef} className="report-preview space-y-8">
        {reportData === null && (
          <div className="print:hidden">
            <EmptyState
              icon={FileText}
              title="No report generated"
              description="Select projects and click 'Generate Report' to preview your report."
            />
          </div>
        )}

        {reportData && reportData.length === 0 && (
          <EmptyState
            icon={FileText}
            title="No data available"
            description="No data available for the selected filters."
          />
        )}

        {reportData && reportData.map((rd, idx) => (
          <Card key={rd.project?.id || idx} className="overflow-hidden print:shadow-none print:border">
            <CardHeader className="bg-primary/5 print:bg-transparent">
              <CardTitle className="text-xl">
                {rd.project?.name || "Unknown Project"}
                {rd.project?.code && <span className="ml-2 text-sm font-normal text-muted-foreground">({rd.project.code})</span>}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 p-6">
              {/* Project Details */}
              {includeDetails && (
                <section>
                  <h3 className="mb-3 border-b pb-1 text-base font-semibold">Project Details</h3>
                  <div className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
                    <div><span className="font-medium text-muted-foreground">Name:</span> {rd.project?.name}</div>
                    <div><span className="font-medium text-muted-foreground">Location:</span> {rd.project?.location || "—"}</div>
                    <div><span className="font-medium text-muted-foreground">Status:</span> {statusLabel(rd.project?.status)}</div>
                    <div><span className="font-medium text-muted-foreground">Start Date:</span> {formatManilaDate(rd.project?.start_date)}</div>
                    <div><span className="font-medium text-muted-foreground">End Date:</span> {formatManilaDate(rd.project?.end_date)}</div>
                    <div><span className="font-medium text-muted-foreground">Duration:</span> {getDuration(rd.project?.start_date, rd.project?.end_date)}</div>
                    <div><span className="font-medium text-muted-foreground">Estimated Cost:</span> {rd.project?.estimated_cost ? `₱${Number(rd.project.estimated_cost).toLocaleString()}` : "—"}</div>
                    <div className="sm:col-span-2 lg:col-span-3"><span className="font-medium text-muted-foreground">Description:</span> {rd.project?.description || "—"}</div>
                  </div>
                  {rd.teamMembers.length > 0 && (
                    <div className="mt-3">
                      <span className="text-sm font-medium text-muted-foreground">Team Members:</span>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {rd.teamMembers.map((m: any) => (
                          <span key={m.id} className="rounded bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                            {(m.profiles as any)?.full_name || (m.profiles as any)?.email || "—"} ({statusLabel(m.role)})
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </section>
              )}

              {/* Orders */}
              {includeOrders && (
                <section>
                  <h3 className="mb-3 border-b pb-1 text-base font-semibold">Orders ({rd.orders.length})</h3>
                  {rd.orders.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No orders found.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left text-muted-foreground">
                            <th className="pb-2 pr-4 font-medium">Order #</th>
                            <th className="pb-2 pr-4 font-medium">Status</th>
                            <th className="pb-2 pr-4 font-medium">Materials</th>
                            <th className="pb-2 pr-4 font-medium">Expected Delivery</th>
                            <th className="pb-2 pr-4 font-medium">Created By</th>
                            <th className="pb-2 pr-4 font-medium">Created At</th>
                            <th className="pb-2 font-medium">Notes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rd.orders.map((o: any) => (
                            <tr key={o.id} className="border-b last:border-0">
                              <td className="py-2 pr-4 font-mono text-xs">{o.order_number}</td>
                              <td className="py-2 pr-4">{statusLabel(o.status)}</td>
                              <td className="py-2 pr-4">
                                {o.order_items?.map((item: any, i: number) => (
                                  <div key={i} className="text-xs">
                                    {item.skus?.name || item.skus?.sku_code} × {item.quantity_ordered}
                                  </div>
                                ))}
                              </td>
                              <td className="py-2 pr-4">{formatManilaDate(o.expected_delivery_date)}</td>
                              <td className="py-2 pr-4">{(o.profiles as any)?.full_name || "—"}</td>
                              <td className="py-2 pr-4">{formatManila(o.created_at)}</td>
                              <td className="py-2 max-w-[200px] truncate">{o.notes || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              )}

              {/* Quotations */}
              {includeQuotations && (
                <section>
                  <h3 className="mb-3 border-b pb-1 text-base font-semibold">Quotations</h3>
                  {!rd.quotation ? (
                    <p className="text-sm text-muted-foreground">No quotation found.</p>
                  ) : (
                    <div>
                      <div className="mb-2 grid gap-x-8 gap-y-1 text-sm sm:grid-cols-3">
                        <div><span className="font-medium text-muted-foreground">Category:</span> {statusLabel(rd.quotation.category)}</div>
                        <div><span className="font-medium text-muted-foreground">Created:</span> {formatManila(rd.quotation.created_at)}</div>
                        <div><span className="font-medium text-muted-foreground">Notes:</span> {rd.quotation.notes || "—"}</div>
                      </div>
                      {rd.quotationItems.length > 0 && (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b text-left text-muted-foreground">
                                <th className="pb-2 pr-4 font-medium">Material</th>
                                <th className="pb-2 pr-4 font-medium">Quantity</th>
                                <th className="pb-2 font-medium">Unit</th>
                              </tr>
                            </thead>
                            <tbody>
                              {rd.quotationItems.map((qi: any) => (
                                <tr key={qi.id} className="border-b last:border-0">
                                  <td className="py-2 pr-4">{qi.material_name}</td>
                                  <td className="py-2 pr-4">{qi.quantity}</td>
                                  <td className="py-2">{qi.unit}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </section>
              )}

              {/* Borrowed Assets */}
              {includeBorrowed && (
                <section>
                  <h3 className="mb-3 border-b pb-1 text-base font-semibold">Borrowed Assets ({rd.borrowedAssets.length})</h3>
                  {rd.borrowedAssets.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No borrowed assets found.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left text-muted-foreground">
                            <th className="pb-2 pr-4 font-medium">Asset</th>
                            <th className="pb-2 pr-4 font-medium">Type</th>
                            <th className="pb-2 pr-4 font-medium">Qty</th>
                            <th className="pb-2 pr-4 font-medium">Borrowed By</th>
                            <th className="pb-2 pr-4 font-medium">Date</th>
                            <th className="pb-2 font-medium">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rd.borrowedAssets.map((b: any) => (
                            <tr key={b.id} className="border-b last:border-0">
                              <td className="py-2 pr-4">{(b.company_assets as any)?.asset_name || "—"}</td>
                              <td className="py-2 pr-4">{(b.company_assets as any)?.asset_type || "—"}</td>
                              <td className="py-2 pr-4">{b.borrowed_qty}</td>
                              <td className="py-2 pr-4">{(b.profiles as any)?.full_name || "—"}</td>
                              <td className="py-2 pr-4">{formatManila(b.borrowed_at)}</td>
                              <td className="py-2">{b.status}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              )}

              {/* Returned Assets */}
              {includeReturned && (
                <section>
                  <h3 className="mb-3 border-b pb-1 text-base font-semibold">Returned Assets ({rd.returnedAssets.length})</h3>
                  {rd.returnedAssets.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No returned assets found.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left text-muted-foreground">
                            <th className="pb-2 pr-4 font-medium">Asset</th>
                            <th className="pb-2 pr-4 font-medium">Qty Returned</th>
                            <th className="pb-2 pr-4 font-medium">Returned Date</th>
                            <th className="pb-2 font-medium">Remarks</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rd.returnedAssets.map((r: any) => (
                            <tr key={r.id} className="border-b last:border-0">
                              <td className="py-2 pr-4">{(r.company_assets as any)?.asset_name || "—"}</td>
                              <td className="py-2 pr-4">{r.returned_qty}</td>
                              <td className="py-2 pr-4">{formatManila(r.returned_at)}</td>
                              <td className="py-2">{r.return_remarks || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          .print\\:hidden { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .report-preview { break-inside: avoid; }
          .report-preview section { break-inside: avoid; }
        }
      `}</style>
    </div>
  );
}
