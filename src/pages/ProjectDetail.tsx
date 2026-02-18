import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { StatusBadge } from "@/components/common/StatusBadge";
import { ProjectFormModal } from "@/components/projects/ProjectFormModal";
import { ProjectTeamTab } from "@/components/projects/ProjectTeamTab";
import { ProjectActivityTab } from "@/components/projects/ProjectActivityTab";
import { QuotationModal } from "@/components/projects/QuotationModal";
import { ProjectProgressModal } from "@/components/projects/ProjectProgressModal";
import { ActiveOrdersModal } from "@/components/projects/ActiveOrdersModal";
import { DeliveredMaterialsModal } from "@/components/projects/DeliveredMaterialsModal";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useProjectProgress } from "@/hooks/useProjectProgress";
import { logActivity } from "@/lib/activityLogger";
import { notifyProjectMembers, formatManilaTime } from "@/lib/notificationService";
import {
  ArrowLeft,
  Users,
  Activity,
  MapPin,
  Calendar,
  Pencil,
  ChevronsUpDown,
  FileText,
  ClipboardList,
  Package,
  TruckIcon,
  Wrench,
  Loader2,
  RotateCcw,
} from "lucide-react";
import type { Project, ProjectStatus, AppRole } from "@/types/database";
import { format } from "date-fns";

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAdmin, user } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isQuotationOpen, setIsQuotationOpen] = useState(false);
  const [isActiveOrdersOpen, setIsActiveOrdersOpen] = useState(false);
  const [isDeliveredMaterialsOpen, setIsDeliveredMaterialsOpen] = useState(false);
  const [isProgressModalOpen, setIsProgressModalOpen] = useState(false);
  const [isBorrowModalOpen, setIsBorrowModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userProjectRole, setUserProjectRole] = useState<AppRole | null>(null);
  const [hasQuotation, setHasQuotation] = useState(false);
  const [progressKey, setProgressKey] = useState(0);

  // Borrow state
  const [companyAssets, setCompanyAssets] = useState<any[]>([]);
  const [borrowAssetId, setBorrowAssetId] = useState("");
  const [borrowQty, setBorrowQty] = useState(1);
  const [borrowLoading, setBorrowLoading] = useState(false);
  const [borrowedItems, setBorrowedItems] = useState<any[]>([]);
  const [returnQty, setReturnQty] = useState<Record<string, number>>({});
  const [returnRemarks, setReturnRemarks] = useState<Record<string, string>>({});

  const progress = useProjectProgress(id || "", progressKey);

  const fetchAllProjects = async () => {
    const { data } = await supabase.from("projects").select("id, name, status").order("name", { ascending: true });
    setAllProjects((data || []) as Project[]);
  };

  const fetchProjectData = async () => {
    if (!id) return;

    const { data: projectData, error: projectError } = await supabase
      .from("projects")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (projectError || !projectData) {
      toast({ title: "Error", description: "Project not found", variant: "destructive" });
      navigate("/projects");
      return;
    }

    setProject(projectData as Project);

    const { data: quotationData } = await supabase
      .from("project_quotations")
      .select("id")
      .eq("project_id", id)
      .maybeSingle();

    setHasQuotation(!!quotationData);

    if (user) {
      const { data: memberData } = await supabase
        .from("project_members")
        .select("role")
        .eq("project_id", id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (memberData) {
        setUserProjectRole(memberData.role as AppRole);
      }
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchAllProjects();
    fetchProjectData();
  }, [id, navigate, toast, user]);

  const canEditQuotation = isAdmin() || userProjectRole === "project_manager" || userProjectRole === "site_lead" || userProjectRole === "project_engineer";

  const handleQuotationChange = () => {
    setProgressKey((prev) => prev + 1);
    fetchProjectData();
  };

  // === BORROW FUNCTIONS ===
  const fetchBorrowData = async () => {
    if (!id) return;

    // Fetch all assets
    const { data: assets } = await supabase.from("company_assets").select("*").order("asset_name");

    // Fetch ALL active borrows (not just this project) to compute availability
    const { data: allBorrows } = await supabase
      .from("borrow_transactions")
      .select("asset_id, borrowed_qty, returned_qty, status")
      .in("status", ["Borrowed", "Partially Returned"]);

    // Compute available qty per asset
    const borrowedByAsset: Record<string, number> = {};
    (allBorrows || []).forEach((b: any) => {
      borrowedByAsset[b.asset_id] = (borrowedByAsset[b.asset_id] || 0) + (b.borrowed_qty - b.returned_qty);
    });

    setCompanyAssets(
      (assets || []).map((a: any) => ({
        ...a,
        available_quantity: a.total_quantity - (borrowedByAsset[a.id] || 0),
      })),
    );

    // Fetch this project's active borrows
    const { data: borrows } = await supabase
      .from("borrow_transactions")
      .select("*, company_assets(asset_name, unit)")
      .eq("project_id", id)
      .in("status", ["Borrowed", "Partially Returned"])
      .order("borrowed_at", { ascending: false });
    setBorrowedItems(borrows || []);
  };

  useEffect(() => {
    if (isBorrowModalOpen && id) fetchBorrowData();
  }, [isBorrowModalOpen, id]);

  const handleBorrow = async () => {
    if (!user || !id || !borrowAssetId || borrowQty < 1) return;
    setBorrowLoading(true);
    try {
      const asset = companyAssets.find((a: any) => a.id === borrowAssetId);
      if (!asset) throw new Error("Asset not found");
      if (borrowQty > asset.available_quantity) throw new Error("Not enough available");

      const { error } = await supabase.from("borrow_transactions").insert({
        asset_id: borrowAssetId,
        project_id: id,
        borrowed_qty: borrowQty,
        borrowed_by: user.id,
      });
      if (error) throw error;

      const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
      const userName = profile?.full_name || "User";

      await logActivity({
        action: "asset_borrowed",
        tableName: "borrow_transactions",
        recordId: id,
        oldValues: null,
        newValues: { asset_name: asset.asset_name, qty: borrowQty, borrowed_by: userName },
        userId: user.id,
      });

      await notifyProjectMembers({
        projectId: id,
        title: "Asset Borrowed",
        message: `${userName} borrowed ${borrowQty} ${asset.unit || "pcs"} of ${asset.asset_name}`,
        type: "project",
        referenceType: "borrow_transaction",
        referenceId: id,
        excludeUserId: user.id,
      });

      toast({ title: "Success", description: `Borrowed ${borrowQty} ${asset.asset_name}` });
      setBorrowAssetId("");
      setBorrowQty(1);
      fetchBorrowData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setBorrowLoading(false);
    }
  };

  const handleReturn = async (transactionId: string) => {
    if (!user || !id) return;
    const qty = returnQty[transactionId] || 0;
    const remarks = returnRemarks[transactionId] || "";
    if (qty < 1) return;

    const transaction = borrowedItems.find((b: any) => b.id === transactionId);
    if (!transaction) return;

    const maxReturnable = transaction.borrowed_qty - transaction.returned_qty;
    if (qty > maxReturnable) {
      toast({ title: "Error", description: `Max returnable: ${maxReturnable}`, variant: "destructive" });
      return;
    }

    const newReturnedQty = transaction.returned_qty + qty;
    const newStatus = newReturnedQty >= transaction.borrowed_qty ? "Returned" : "Partially Returned";

    const { error } = await supabase
      .from("borrow_transactions")
      .update({
        returned_qty: newReturnedQty,
        returned_at: new Date().toISOString(),
        return_remarks: remarks || null,
        status: newStatus,
      })
      .eq("id", transactionId);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
    const userName = profile?.full_name || "User";

    await logActivity({
      action: "asset_returned",
      tableName: "borrow_transactions",
      recordId: id,
      oldValues: null,
      newValues: { asset_name: transaction.company_assets?.asset_name, qty, returned_by: userName, status: newStatus },
      userId: user.id,
    });

    await notifyProjectMembers({
      projectId: id,
      title: "Asset Returned",
      message: `${userName} returned ${qty} of ${transaction.company_assets?.asset_name}`,
      type: "project",
      referenceType: "borrow_transaction",
      referenceId: transactionId,
      excludeUserId: user.id,
    });

    toast({ title: "Success", description: `Returned ${qty} items` });
    setReturnQty((prev) => ({ ...prev, [transactionId]: 0 }));
    setReturnRemarks((prev) => ({ ...prev, [transactionId]: "" }));
    fetchBorrowData();
  };

  const handleEditSubmit = async (data: {
    name: string;
    description?: string;
    location: string;
    start_date: string;
    end_date: string;
    status: ProjectStatus;
  }) => {
    if (!project) return;
    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from("projects")
        .update({
          name: data.name,
          description: data.description || null,
          location: data.location,
          start_date: data.start_date,
          end_date: data.end_date,
          status: data.status,
        })
        .eq("id", project.id);

      if (error) throw error;
      toast({ title: "Success", description: "Project updated successfully" });
      setIsEditDialogOpen(false);
      fetchProjectData();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Something went wrong";
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleProjectSwitch = (projectId: string) => {
    navigate(`/projects/${projectId}`);
  };

  const getDateRangeDisplay = () => {
    if (!project) return "—";
    if (project.start_date && project.end_date) {
      const start = format(new Date(project.start_date), "MMM dd, yyyy");
      const end = format(new Date(project.end_date), "MMM dd, yyyy");
      return `${start} – ${end}`;
    }
    return "No dates set";
  };

  const formatDate = (date: string | null | undefined) => {
    if (!date) return "—";
    return format(new Date(date), "MMM dd, yyyy");
  };

  if (loading || !project) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header with Project Switcher */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/projects")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>

        <div className="flex-1 min-w-0">
          <Select value={project.id} onValueChange={handleProjectSwitch}>
            <SelectTrigger className="w-full max-w-xs bg-background">
              <div className="flex items-center gap-2">
                <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder="Select project" />
              </div>
            </SelectTrigger>
            <SelectContent className="bg-popover z-50 max-h-64">
              {allProjects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate">{p.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <StatusBadge status={project.status} className="text-sm px-4 py-1.5 font-semibold" />
          {isAdmin() && (
            <Button variant="outline" onClick={() => setIsEditDialogOpen(true)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
          )}
        </div>
      </div>

      {/* Project Title and Description */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-foreground">{project.name}</h1>
        {project.description && <p className="text-muted-foreground whitespace-pre-wrap">{project.description}</p>}
      </div>

      {/* Project Info Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardContent className="flex items-start gap-3 p-4">
            <div className="rounded-lg bg-primary/10 p-2 flex-shrink-0">
              <MapPin className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">Location</p>
              <p className="font-medium break-words">{project.location || "Not set"}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-start gap-3 p-4">
            <div className="rounded-lg bg-accent/10 p-2 flex-shrink-0">
              <Calendar className="h-5 w-5 text-accent-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">Duration</p>
              <p className="font-medium">{getDateRangeDisplay()}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-start gap-3 p-4">
            <div className="rounded-lg bg-muted p-2 flex-shrink-0">
              <FileText className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">Status</p>
              <div className="mt-1">
                <StatusBadge status={project.status} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress Section */}
      <Card className="cursor-pointer transition-colors hover:bg-muted/50" onClick={() => setIsProgressModalOpen(true)}>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-primary/10 p-2">
                <ClipboardList className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">Project Progress</p>
                <p className="text-sm text-muted-foreground">Based on quotation materials received</p>
              </div>
            </div>
            <span className="text-2xl font-bold text-primary">{progress.percentage.toFixed(0)}%</span>
          </div>
          <Progress value={progress.percentage} className="h-3" />
          {!progress.hasQuotation && (
            <p className="text-sm text-muted-foreground">No quotation set. Create a quotation to track progress.</p>
          )}
          <p className="text-xs text-muted-foreground">Click to view detailed progress</p>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        <Button variant="outline" onClick={() => setIsQuotationOpen(true)}>
          <ClipboardList className="mr-2 h-4 w-4" />
          {hasQuotation ? "View Quotation" : "Add Quotation"}
        </Button>
        <Button variant="outline" onClick={() => setIsActiveOrdersOpen(true)}>
          <Package className="mr-2 h-4 w-4" />
          View Active Orders
        </Button>
        <Button variant="outline" onClick={() => setIsDeliveredMaterialsOpen(true)}>
          <TruckIcon className="mr-2 h-4 w-4" />
          Delivered Materials
        </Button>
        <Button variant="outline" onClick={() => setIsBorrowModalOpen(true)}>
          <Wrench className="mr-2 h-4 w-4" />
          Borrow Equipments/Tools
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="team" className="space-y-4">
        <TabsList>
          <TabsTrigger value="team" className="gap-2">
            <Users className="h-4 w-4" />
            Team
          </TabsTrigger>
          <TabsTrigger value="activity" className="gap-2">
            <Activity className="h-4 w-4" />
            Activity
          </TabsTrigger>
        </TabsList>

        <TabsContent value="team">
          <ProjectTeamTab projectId={project.id} projectName={project.name} />
        </TabsContent>

        <TabsContent value="activity">
          <ProjectActivityTab projectId={project.id} />
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <ProjectFormModal
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        project={project}
        onSubmit={handleEditSubmit}
        isSubmitting={isSubmitting}
      />

      <QuotationModal
        open={isQuotationOpen}
        onOpenChange={setIsQuotationOpen}
        projectId={project.id}
        projectName={project.name}
        canEdit={canEditQuotation}
        hasExistingQuotation={hasQuotation}
        onQuotationChange={handleQuotationChange}
      />

      <ActiveOrdersModal
        open={isActiveOrdersOpen}
        onOpenChange={setIsActiveOrdersOpen}
        projectId={project.id}
        projectName={project.name}
      />

      <DeliveredMaterialsModal
        open={isDeliveredMaterialsOpen}
        onOpenChange={setIsDeliveredMaterialsOpen}
        projectId={project.id}
        projectName={project.name}
      />

      <ProjectProgressModal
        open={isProgressModalOpen}
        onOpenChange={setIsProgressModalOpen}
        projectId={project.id}
        projectName={project.name}
        refreshKey={progressKey}
      />

      {/* Borrow Equipments/Tools Modal */}
      <Dialog open={isBorrowModalOpen} onOpenChange={setIsBorrowModalOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5" />
              Borrow Equipments/Tools
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Borrow Form */}
            <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
              <Label className="font-medium">Borrow an Asset</Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <Select value={borrowAssetId} onValueChange={setBorrowAssetId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select asset..." />
                    </SelectTrigger>
                    <SelectContent>
                      {companyAssets
                        .filter((a: any) => a.available_quantity > 0)
                        .map((asset: any) => (
                          <SelectItem key={asset.id} value={asset.id}>
                            {asset.asset_name} — Avail: {asset.available_quantity} {asset.unit || "pcs"}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Input
                    type="number"
                    min={1}
                    max={companyAssets.find((a: any) => a.id === borrowAssetId)?.available_quantity || 1}
                    value={borrowQty}
                    onChange={(e) => setBorrowQty(parseInt(e.target.value) || 1)}
                    placeholder="Qty"
                  />
                </div>
              </div>
              <Button
                onClick={handleBorrow}
                disabled={!borrowAssetId || borrowQty < 1 || borrowLoading}
                className="w-full"
              >
                {borrowLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Package className="h-4 w-4 mr-2" />
                )}
                Borrow
              </Button>
            </div>

            {/* Currently Borrowed Items */}
            <div className="space-y-3">
              <Label className="font-medium">Currently Borrowed ({borrowedItems.length})</Label>
              {borrowedItems.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">No borrowed items for this project.</p>
              ) : (
                <div className="space-y-3">
                  {borrowedItems.map((item: any) => {
                    const remaining = item.borrowed_qty - item.returned_qty;
                    return (
                      <div key={item.id} className="p-3 border rounded-lg bg-card space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{item.company_assets?.asset_name}</p>
                            <p className="text-xs text-muted-foreground">
                              Borrowed: {item.borrowed_qty} • Returned: {item.returned_qty} • Remaining: {remaining}
                            </p>
                          </div>
                          <Badge variant={item.status === "Borrowed" ? "default" : "secondary"}>{item.status}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Borrowed on {formatManilaTime(item.borrowed_at)}
                        </p>
                        {remaining > 0 && (
                          <div className="flex gap-2 items-end">
                            <div className="flex-1">
                              <Input
                                type="number"
                                min={1}
                                max={remaining}
                                placeholder="Return qty"
                                value={returnQty[item.id] || ""}
                                onChange={(e) =>
                                  setReturnQty((prev) => ({ ...prev, [item.id]: parseInt(e.target.value) || 0 }))
                                }
                                className="h-8"
                              />
                            </div>
                            <div className="flex-1">
                              <Input
                                placeholder="Remarks (optional)"
                                value={returnRemarks[item.id] || ""}
                                onChange={(e) => setReturnRemarks((prev) => ({ ...prev, [item.id]: e.target.value }))}
                                className="h-8"
                              />
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleReturn(item.id)}
                              disabled={!returnQty[item.id] || returnQty[item.id] < 1}
                            >
                              <RotateCcw className="h-3.5 w-3.5 mr-1" />
                              Return
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
