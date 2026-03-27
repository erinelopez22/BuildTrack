import { useState, useEffect } from "react";
import { quotationsApi, projectsApi } from "@/lib/apiClient";
import type { QuotationChangeRequest as ApiChangeRequest } from "@/lib/apiClient";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { logActivity } from "@/lib/activityLogger";
import { notifyProjectMembers, formatManilaTime } from "@/lib/notificationService";
import { PageHeader } from "@/components/common/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
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
import {
  ClipboardList,
  Search,
  Eye,
  CheckCircle2,
  XCircle,
  Clock,
  Package,
  Loader2,
  FileText,
} from "lucide-react";
import { format } from "date-fns";

interface QuotationRow {
  id: string;
  project_id: string;
  project_name: string;
  created_by: string;
  creator_name: string;
  created_at: string;
  updated_at: string;
  category: string;
  notes: string | null;
  items_count: number;
}

interface QuotationItemRow {
  id: string;
  material_name: string;
  unit: string;
  quantity: number;
}

interface ChangeRequestRow {
  id: string;
  project_id: string;
  project_name: string;
  quotation_id: string | null;
  change_type: string;
  status: string;
  payload: any;
  requested_by: string;
  requester_name: string;
  requester_role: string;
  created_at: string;
  reviewed_by: string | null;
  reviewer_name: string | null;
  reviewed_at: string | null;
  review_remarks: string | null;
}

export default function QuotationRequests() {
  const { user, isAdmin, isOfficeAdmin } = useAuth();
  const canApproveQuotations = isAdmin() || isOfficeAdmin();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("existing");

  // Existing quotations state
  const [quotations, setQuotations] = useState<QuotationRow[]>([]);
  const [quotationsLoading, setQuotationsLoading] = useState(true);
  const [quotationSearch, setQuotationSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState("all");
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);

  // Change requests state
  const [changeRequests, setChangeRequests] = useState<ChangeRequestRow[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(true);

  // View modal
  const [viewQuotation, setViewQuotation] = useState<QuotationRow | null>(null);
  const [viewItems, setViewItems] = useState<QuotationItemRow[]>([]);
  const [viewAdditionalItems, setViewAdditionalItems] = useState<{ items: QuotationItemRow[]; quotation: any }[]>([]);
  const [viewLoading, setViewLoading] = useState(false);

  // Approve/reject
  const [reviewingRequest, setReviewingRequest] = useState<ChangeRequestRow | null>(null);
  const [reviewAction, setReviewAction] = useState<"approved" | "rejected" | null>(null);
  const [reviewRemarks, setReviewRemarks] = useState("");
  const [reviewing, setReviewing] = useState(false);

  // Detail preview for change request
  const [previewRequest, setPreviewRequest] = useState<ChangeRequestRow | null>(null);

  useEffect(() => {
    fetchProjects();
    fetchQuotations();
    fetchChangeRequests();
  }, []);

  const fetchProjects = async () => {
    const result = await projectsApi.getAll();
    const data = result.data || [];
    setProjects(data.map((p) => ({ id: p.id, name: p.name })));
  };

  const fetchQuotations = async () => {
    setQuotationsLoading(true);
    try {
      const result = await quotationsApi.getAll();
      const data = result.data || [];

      setQuotations(
        data.map((q) => ({
          id: q.id,
          project_id: q.projectId,
          project_name: q.projectName || "Unknown",
          created_by: q.createdBy || "",
          creator_name: q.createdByName || "Unknown",
          created_at: q.createdAt,
          updated_at: q.updatedAt,
          category: q.category || "initial",
          notes: q.notes || null,
          items_count: (q.items || []).length,
        }))
      );
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setQuotationsLoading(false);
    }
  };

  const fetchChangeRequests = async () => {
    setRequestsLoading(true);
    try {
      const result = await quotationsApi.getChangeRequests();
      const requests = result.data || [];

      setChangeRequests(
        requests.map((r) => {
          let parsedPayload: any = {};
          try {
            if (r.payload) parsedPayload = JSON.parse(r.payload);
          } catch {
            parsedPayload = {};
          }
          return {
            id: r.id,
            project_id: r.projectId,
            project_name: r.projectName || "Unknown",
            quotation_id: r.quotationId || null,
            change_type: r.changeType || "",
            status: r.status,
            payload: parsedPayload,
            requested_by: r.requestedBy || "",
            requester_name: r.requestedByName || "Unknown",
            requester_role: "member",
            created_at: r.createdAt,
            reviewed_by: r.reviewedBy || null,
            reviewer_name: r.reviewedByName || null,
            reviewed_at: r.reviewedAt || null,
            review_remarks: r.reviewRemarks || null,
          };
        })
      );
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setRequestsLoading(false);
    }
  };

  const handleViewQuotation = async (q: QuotationRow) => {
    setViewQuotation(q);
    setViewLoading(true);
    try {
      // Fetch full quotation by id to get items
      const result = await quotationsApi.getById(q.id);
      const quotationData = result.data;
      const initialItems: QuotationItemRow[] = (quotationData?.items || []).map((item) => ({
        id: item.id,
        material_name: item.materialName,
        unit: item.unit || "pcs",
        quantity: item.quantity,
      }));
      setViewItems(initialItems);

      // Fetch additional quotations for same project
      const allResult = await quotationsApi.getAll(q.project_id);
      const allQuotations = allResult.data || [];
      const additionalQuots = allQuotations.filter(
        (aq) => aq.category === "additional" && aq.id !== q.id
      );

      const additional: { items: QuotationItemRow[]; quotation: any }[] = additionalQuots.map((aq) => ({
        items: (aq.items || []).map((item) => ({
          id: item.id,
          material_name: item.materialName,
          unit: item.unit || "pcs",
          quantity: item.quantity,
        })),
        quotation: {
          id: aq.id,
          created_at: aq.createdAt,
          notes: aq.notes,
        },
      }));
      setViewAdditionalItems(additional);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setViewLoading(false);
    }
  };

  const handleReview = async () => {
    if (!reviewingRequest || !reviewAction || !user) return;

    // Guard: block if already processed
    if (reviewingRequest.status !== "pending") {
      toast({ title: "Error", description: "This request has already been processed.", variant: "destructive" });
      return;
    }

    setReviewing(true);

    try {
      // The REST API backend handles applying changes when reviewing
      const result = await quotationsApi.reviewChangeRequest(reviewingRequest.id, {
        status: reviewAction,
        reviewRemarks: reviewRemarks || undefined,
      });

      if (!result.success) throw new Error(result.message || "Failed to review change request");

      await logActivity({
        action: `change_request_${reviewAction}`,
        tableName: "project_quotations",
        recordId: reviewingRequest.quotation_id || reviewingRequest.project_id,
        oldValues: { status: "pending" },
        newValues: { status: reviewAction, reviewed_by: user.id },
        userId: user.id,
      });

      await notifyProjectMembers({
        projectId: reviewingRequest.project_id,
        title: `Quotation Change ${reviewAction === "approved" ? "Approved" : "Rejected"}`,
        message: `The quotation ${reviewingRequest.change_type} request for ${reviewingRequest.project_name} was ${reviewAction}.`,
        type: "project",
        referenceType: "quotation_change_request",
        referenceId: reviewingRequest.id,
        excludeUserId: user.id,
      });

      toast({ title: "Success", description: `Change request ${reviewAction}.` });
      setReviewingRequest(null);
      setReviewAction(null);
      setReviewRemarks("");
      fetchChangeRequests();
      fetchQuotations();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setReviewing(false);
    }
  };

  const pendingRequests = changeRequests.filter((r) => r.status === "pending");
  const allRequests = changeRequests;

  const filteredQuotations = quotations.filter((q) => {
    if (projectFilter !== "all" && q.project_id !== projectFilter) return false;
    if (quotationSearch) {
      const search = quotationSearch.toLowerCase();
      return (
        q.project_name.toLowerCase().includes(search) ||
        q.id.toLowerCase().includes(search) ||
        q.creator_name.toLowerCase().includes(search)
      );
    }
    return true;
  });

  const getChangeSummary = (payload: any, changeType: string) => {
    if (changeType === "delete") return "Delete entire quotation";
    const items = payload?.items || [];
    const added = items.length;
    if (changeType === "create") return `Create with ${added} material(s)`;
    return `Update: ${added} material(s) proposed`;
  };

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Quotation Request"
        description="View all project quotations and manage approval requests"
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="existing">Existing Quotations</TabsTrigger>
          <TabsTrigger value="approval" className="relative">
            For Approval
            {pendingRequests.length > 0 && (
              <span className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                {pendingRequests.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ===== EXISTING QUOTATIONS TAB ===== */}
        <TabsContent value="existing" className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by project or creator..."
                value={quotationSearch}
                onChange={(e) => setQuotationSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {quotationsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredQuotations.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mb-3 opacity-50" />
                <p>No quotations found</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredQuotations.map((q) => (
                <Card key={q.id} className="hover:bg-muted/30 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-foreground">{q.project_name}</span>
                          <Badge variant="outline" className="capitalize text-xs">
                            {q.category}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {formatManilaTime(q.created_at)}
                          </span>
                          <span>By: {q.creator_name}</span>
                          <span>{q.items_count} material(s)</span>
                        </div>
                        {q.updated_at !== q.created_at && (
                          <p className="text-xs text-muted-foreground">
                            Updated: {formatManilaTime(q.updated_at)}
                          </p>
                        )}
                      </div>
                      <Button variant="outline" size="sm" onClick={() => handleViewQuotation(q)}>
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ===== FOR APPROVAL TAB ===== */}
        <TabsContent value="approval" className="space-y-4">
          {requestsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : allRequests.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <CheckCircle2 className="h-12 w-12 mb-3 opacity-50" />
                <p>{canApproveQuotations ? "No pending requests" : "You have no submitted requests"}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {allRequests.map((req) => (
                <Card
                  key={req.id}
                  className={`transition-colors ${req.status === "pending" ? "border-amber-300 dark:border-amber-700" : ""}`}
                >
                  <CardContent className="p-4 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-foreground">{req.project_name}</span>
                          <Badge
                            variant={req.status === "pending" ? "default" : req.status === "approved" ? "secondary" : "destructive"}
                            className="capitalize text-xs"
                          >
                            {req.status}
                          </Badge>
                          <Badge variant="outline" className="capitalize text-xs">
                            {req.change_type}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                          <span>
                            By: {req.requester_name} ({req.requester_role.replace(/_/g, " ")})
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {formatManilaTime(req.created_at)}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {getChangeSummary(req.payload, req.change_type)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => setPreviewRequest(req)}>
                          <Eye className="h-4 w-4 mr-1" />
                          Details
                        </Button>
                        {canApproveQuotations && req.status === "pending" && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => {
                                setReviewingRequest(req);
                                setReviewAction("approved");
                              }}
                            >
                              <CheckCircle2 className="h-4 w-4 mr-1" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                setReviewingRequest(req);
                                setReviewAction("rejected");
                              }}
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              Reject
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                    {req.status !== "pending" && req.reviewer_name && (
                      <div className="text-xs text-muted-foreground border-t pt-2">
                        Reviewed by {req.reviewer_name} on {formatManilaTime(req.reviewed_at || "")}
                        {req.review_remarks && <span> — "{req.review_remarks}"</span>}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ===== VIEW QUOTATION MODAL ===== */}
      <Dialog open={!!viewQuotation} onOpenChange={(open) => !open && setViewQuotation(null)}>
        <DialogContent className="max-w-3xl w-[calc(100%-2rem)]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Quotation — {viewQuotation?.project_name}
            </DialogTitle>
          </DialogHeader>

          {viewLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Metadata */}
              <div className="flex flex-wrap gap-3 text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
                <span>Created: {viewQuotation && formatManilaTime(viewQuotation.created_at)}</span>
                <span>•</span>
                <span>By: {viewQuotation?.creator_name}</span>
                <span>•</span>
                <Badge variant="outline" className="capitalize">
                  {viewQuotation?.category}
                </Badge>
              </div>

              {/* Section 1: Initial Quoted Materials */}
              <div className="space-y-3">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Initial Quoted Materials
                </Label>
                {viewItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No materials</p>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left p-3 font-medium">Material</th>
                          <th className="text-left p-3 font-medium">Unit</th>
                          <th className="text-right p-3 font-medium">Qty</th>
                        </tr>
                      </thead>
                      <tbody>
                        {viewItems.map((item) => (
                          <tr key={item.id} className="border-t">
                            <td className="p-3 uppercase">{item.material_name}</td>
                            <td className="p-3">{item.unit}</td>
                            <td className="p-3 text-right font-medium">{item.quantity}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Section 2: Updates / Added Materials */}
              {viewAdditionalItems.length > 0 && (
                <div className="space-y-3 p-4 border rounded-lg bg-accent/5 border-accent/20">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Package className="h-4 w-4 text-accent-foreground" />
                    Updates / Added Materials
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Materials added or modified after the initial quotation.
                  </p>
                  {viewAdditionalItems.map((group, idx) => (
                    <div key={idx} className="border rounded-lg overflow-hidden">
                      <div className="bg-muted/30 px-3 py-2 text-xs text-muted-foreground flex justify-between">
                        <span>Added: {formatManilaTime(group.quotation.created_at)}</span>
                        <Badge variant="outline" className="text-xs bg-accent/10">Added</Badge>
                      </div>
                      <table className="w-full text-sm">
                        <tbody>
                          {group.items.map((item) => {
                            // Check if this material exists in initial items
                            const existsInInitial = viewItems.some(
                              (vi) => vi.material_name.toUpperCase() === item.material_name.toUpperCase() && vi.unit.toLowerCase() === item.unit.toLowerCase()
                            );
                            return (
                              <tr key={item.id} className="border-t">
                                <td className="p-3 uppercase flex items-center gap-2">
                                  {item.material_name}
                                  <Badge variant="outline" className="text-[10px]">
                                    {existsInInitial ? "Updated" : "Added"}
                                  </Badge>
                                </td>
                                <td className="p-3">{item.unit}</td>
                                <td className="p-3 text-right font-medium">
                                  {existsInInitial ? `+${item.quantity}` : item.quantity}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ))}

                  {/* System totals */}
                  {(() => {
                    const totals = new Map<string, { name: string; unit: string; qty: number }>();
                    viewItems.forEach((i) => {
                      const key = `${i.material_name.toUpperCase()}||${i.unit.toLowerCase()}`;
                      totals.set(key, { name: i.material_name, unit: i.unit, qty: i.quantity });
                    });
                    viewAdditionalItems.forEach((group) => {
                      group.items.forEach((i) => {
                        const key = `${i.material_name.toUpperCase()}||${i.unit.toLowerCase()}`;
                        const existing = totals.get(key);
                        if (existing) {
                          existing.qty += i.quantity;
                        } else {
                          totals.set(key, { name: i.material_name, unit: i.unit, qty: i.quantity });
                        }
                      });
                    });

                    return (
                      <div className="mt-3 p-3 bg-primary/5 rounded border">
                        <Label className="text-xs font-medium text-primary">System Totals (Combined)</Label>
                        <div className="mt-2 space-y-1">
                          {Array.from(totals.values()).map((t, i) => (
                            <div key={i} className="flex justify-between text-sm">
                              <span className="uppercase">{t.name} ({t.unit})</span>
                              <span className="font-semibold">{t.qty}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {viewQuotation?.notes && (
                <div>
                  <Label className="text-sm font-medium">Notes</Label>
                  <p className="text-sm text-muted-foreground mt-1">{viewQuotation.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ===== CHANGE REQUEST DETAIL PREVIEW ===== */}
      <Dialog open={!!previewRequest} onOpenChange={(open) => !open && setPreviewRequest(null)}>
        <DialogContent className="max-w-2xl w-[calc(100%-2rem)]">
          <DialogHeader>
            <DialogTitle>
              Change Request — {previewRequest?.change_type.toUpperCase()}
            </DialogTitle>
          </DialogHeader>
          {previewRequest && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Project:</span>
                  <p className="font-medium">{previewRequest.project_name}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Requested By:</span>
                  <p className="font-medium">
                    {previewRequest.requester_name} ({previewRequest.requester_role.replace(/_/g, " ")})
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Requested At:</span>
                  <p className="font-medium">{formatManilaTime(previewRequest.created_at)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Status:</span>
                  <Badge
                    variant={previewRequest.status === "pending" ? "default" : previewRequest.status === "approved" ? "secondary" : "destructive"}
                    className="capitalize"
                  >
                    {previewRequest.status}
                  </Badge>
                </div>
              </div>

              {previewRequest.change_type === "delete" ? (
                <div className="p-4 bg-destructive/10 rounded-lg border border-destructive/20 text-sm">
                  <p className="font-medium text-destructive">Request to delete entire quotation</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Proposed Materials</Label>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left p-3 font-medium">Material</th>
                          <th className="text-left p-3 font-medium">Unit</th>
                          <th className="text-right p-3 font-medium">Qty</th>
                        </tr>
                      </thead>
                      <tbody>
                        {((previewRequest.payload as any)?.items || []).map((item: any, i: number) => (
                          <tr key={i} className="border-t">
                            <td className="p-3 uppercase">{item.material_name}</td>
                            <td className="p-3">{item.unit}</td>
                            <td className="p-3 text-right font-medium">{item.quantity}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {previewRequest.payload?.notes && (
                <div>
                  <Label className="text-sm font-medium">Notes</Label>
                  <p className="text-sm text-muted-foreground mt-1">{(previewRequest.payload as any).notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ===== REVIEW CONFIRMATION ===== */}
      <AlertDialog
        open={!!reviewingRequest && !!reviewAction}
        onOpenChange={(open) => {
          if (!open) {
            setReviewingRequest(null);
            setReviewAction(null);
            setReviewRemarks("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {reviewAction === "approved" ? "Approve" : "Reject"} Change Request?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {reviewAction === "approved"
                ? "This will apply the requested changes to the quotation."
                : "This will discard the requested changes."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label className="text-sm">Remarks (optional)</Label>
            <Textarea
              placeholder="Add remarks..."
              value={reviewRemarks}
              onChange={(e) => setReviewRemarks(e.target.value)}
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={reviewing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReview}
              disabled={reviewing}
              className={reviewAction === "rejected" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
            >
              {reviewing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : reviewAction === "approved" ? (
                "Approve"
              ) : (
                "Reject"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
