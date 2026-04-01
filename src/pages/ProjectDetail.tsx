import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { projectsApi, quotationsApi, companyAssetsApi } from "@/lib/apiClient";
import type { BorrowTransaction } from "@/lib/apiClient";
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
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { useToast } from "@/hooks/use-toast";
import { useProjectProgress } from "@/hooks/useProjectProgress";
import { formatManilaTime } from "@/lib/notificationService";
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

function toLocalProject(p: any): Project {
  return {
    id: p.id,
    name: p.name,
    code: p.code ?? null,
    location: p.location ?? null,
    description: p.description ?? null,
    status: (p.status ?? "active") as ProjectStatus,
    start_date: p.startDate ?? null,
    end_date: p.endDate ?? null,
    estimated_cost: p.estimatedCost ?? null,
    is_hidden: p.isHidden ?? false,
    project_manager_id: p.projectManagerId ?? null,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
    created_by: p.createdBy ?? null,
  } as unknown as Project;
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAdmin, user, isOfficeAdmin, isProjectEngineer, isSuperAdmin } = useAuth();
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
  const [hasPendingQuotationRequest, setHasPendingQuotationRequest] = useState(false);
  const [progressKey, setProgressKey] = useState(0);

  // Borrow state
  const [companyAssets, setCompanyAssets] = useState<any[]>([]);
  const [borrowAssetId, setBorrowAssetId] = useState("");
  const [borrowQty, setBorrowQty] = useState(1);
  const [borrowLoading, setBorrowLoading] = useState(false);
  const [borrowedItems, setBorrowedItems] = useState<BorrowTransaction[]>([]);
  const [returnQty, setReturnQty] = useState<Record<string, number>>({});
  const [returnRemarks, setReturnRemarks] = useState<Record<string, string>>({});

  const [showBorrowConfirm, setShowBorrowConfirm] = useState(false);
  const [showReturnConfirm, setShowReturnConfirm] = useState<string | null>(null);

  const canBorrow = isSuperAdmin() || isAdmin() || isOfficeAdmin() || isProjectEngineer();

  const progress = useProjectProgress(id || "", progressKey);

  const fetchAllProjects = async () => {
    try {
      const result = await projectsApi.getAll({ includeHidden: isAdmin() });
      setAllProjects((result.data ?? []).map(toLocalProject));
    } catch {
      // non-critical, ignore
    }
  };

  const fetchProjectData = async () => {
    if (!id) return;
    try {
      const result = await projectsApi.getById(id);
      if (!result.data) {
        toast({ title: "Error", description: "Project not found", variant: "destructive" });
        navigate("/projects");
        return;
      }

      const p = result.data;
      if (p.isHidden && !isAdmin()) {
        toast({ title: "Error", description: "Project not available", variant: "destructive" });
        navigate("/projects");
        return;
      }

      setProject(toLocalProject(p));

      // Check quotation
      const quotResult = await quotationsApi.getAll(id);
      setHasQuotation((quotResult.data ?? []).length > 0);

      // Check pending change requests
      const crResult = await quotationsApi.getChangeRequests(id, "pending");
      setHasPendingQuotationRequest((crResult.data ?? []).length > 0);

      // Find current user's project role
      if (user) {
        const membersResult = await projectsApi.getMembers(id);
        const myMembership = (membersResult.data ?? []).find((m) => m.userId === user.id);
        if (myMembership) setUserProjectRole(myMembership.role as AppRole);
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Project not found", variant: "destructive" });
      navigate("/projects");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllProjects();
    fetchProjectData();
  }, [id]);

  const canEditQuotation =
    isSuperAdmin() || isAdmin() || isOfficeAdmin() || isProjectEngineer();

  const handleQuotationChange = () => {
    setProgressKey((prev) => prev + 1);
    fetchProjectData();
  };

  // === BORROW FUNCTIONS ===
  const fetchBorrowData = async () => {
    if (!id) return;
    try {
      // Get all assets
      const assetsResult = await companyAssetsApi.getAll();
      const assets = assetsResult.data ?? [];

      // Get all active borrows to calculate availability
      const allBorrowsResult = await companyAssetsApi.getAllBorrows();
      const allBorrows = (allBorrowsResult.data ?? []).filter(
        (b) => b.status === "Borrowed" || b.status === "Partially Returned"
      );

      const borrowedByAsset: Record<string, number> = {};
      allBorrows.forEach((b) => {
        borrowedByAsset[b.assetId] = (borrowedByAsset[b.assetId] || 0) + (b.borrowedQty - b.returnedQty);
      });

      setCompanyAssets(
        assets.map((a) => ({
          ...a,
          available_quantity: a.totalQuantity - (borrowedByAsset[a.id] || 0),
        }))
      );

      // Get project-specific active borrows
      const projectBorrowsResult = await companyAssetsApi.getAllBorrows(id);
      setBorrowedItems(
        (projectBorrowsResult.data ?? []).filter(
          (b) => b.status === "Borrowed" || b.status === "Partially Returned"
        )
      );
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  useEffect(() => {
    if (isBorrowModalOpen && id) fetchBorrowData();
  }, [isBorrowModalOpen, id]);

  const handleBorrowRequest = async () => {
    if (!user || !id || !borrowAssetId || borrowQty < 1) return;
    setBorrowLoading(true);
    try {
      const asset = companyAssets.find((a: any) => a.id === borrowAssetId);
      if (!asset) throw new Error("Asset not found");
      if (borrowQty > asset.available_quantity) throw new Error("Not enough available");

      await companyAssetsApi.borrow({ assetId: borrowAssetId, projectId: id, quantity: borrowQty });

      toast({ title: "Success", description: "Borrow request submitted." });
      setBorrowAssetId("");
      setBorrowQty(1);
      setShowBorrowConfirm(false);
      fetchBorrowData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setBorrowLoading(false);
    }
  };

  const handleReturnRequest = async (transactionId: string) => {
    if (!user || !id) return;
    const qty = returnQty[transactionId] || 0;
    const remarks = returnRemarks[transactionId] || "";
    if (qty < 1) return;

    const transaction = borrowedItems.find((b) => b.id === transactionId);
    if (!transaction) return;

    const maxReturnable = transaction.borrowedQty - transaction.returnedQty;
    if (qty > maxReturnable) {
      toast({ title: "Error", description: `Max returnable: ${maxReturnable}`, variant: "destructive" });
      return;
    }

    try {
      await companyAssetsApi.returnAsset(transactionId, { returnedQty: qty, remarks });
      toast({ title: "Success", description: "Return processed successfully." });
      setReturnQty((prev) => ({ ...prev, [transactionId]: 0 }));
      setReturnRemarks((prev) => ({ ...prev, [transactionId]: "" }));
      setShowReturnConfirm(null);
      fetchBorrowData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
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
      await projectsApi.update(project.id, {
        name: data.name,
        description: data.description || undefined,
        location: data.location,
        startDate: data.start_date,
        endDate: data.end_date,
        status: data.status,
      });
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
                  <span className="truncate">{p.name}</span>
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
        {(() => {
          // Non-admin/OA/PE roles can only view existing quotations
          const canAccessQuotation = canEditQuotation || hasQuotation;
          if (!canAccessQuotation) return null;

          // Admin lock: if pending approval exists, admin (non-super) cannot create new
          const isAdminLocked = isAdmin() && !isSuperAdmin() && hasPendingQuotationRequest && !hasQuotation;
          // Non-admin roles: blocked if pending approval
          const isNonAdminLocked = !isAdmin() && hasPendingQuotationRequest;
          const isLocked = isAdminLocked || isNonAdminLocked;

          return (
            <Button
              variant="outline"
              onClick={() => {
                if (isAdminLocked) {
                  toast({
                    title: "Pending Approval",
                    description: "You have a quotation pending approval. Please approve or reject it before creating a new one.",
                    variant: "destructive",
                  });
                  return;
                }
                setIsQuotationOpen(true);
              }}
              disabled={isNonAdminLocked}
              title={isLocked ? "Quotation is pending approval" : undefined}
            >
              <ClipboardList className="mr-2 h-4 w-4" />
              {isLocked
                ? "Quotation is for approval"
                : hasQuotation
                  ? "View Quotation"
                  : "Add Quotation"}
            </Button>
          );
        })()}
        <Button variant="outline" onClick={() => setIsActiveOrdersOpen(true)}>
          <Package className="mr-2 h-4 w-4" />
          View Active Orders
        </Button>
        <Button variant="outline" onClick={() => setIsDeliveredMaterialsOpen(true)}>
          <TruckIcon className="mr-2 h-4 w-4" />
          Delivered Materials
        </Button>
        {canBorrow && (
          <Button variant="outline" onClick={() => setIsBorrowModalOpen(true)}>
            <Wrench className="mr-2 h-4 w-4" />
            Borrow Equipments / Tools
          </Button>
        )}
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
        <DialogContent className="max-w-2xl w-[calc(100%-2rem)]">
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
                            {asset.assetName} — Avail: {asset.available_quantity} {asset.unit || "pcs"}
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
                onClick={() => setShowBorrowConfirm(true)}
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
                  {borrowedItems.map((item) => {
                    const remaining = item.borrowedQty - item.returnedQty;
                    return (
                      <div key={item.id} className="p-3 border rounded-lg bg-card space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{item.assetName}</p>
                            <p className="text-xs text-muted-foreground">
                              Borrowed: {item.borrowedQty} • Returned: {item.returnedQty} • Remaining: {remaining}
                            </p>
                          </div>
                          <Badge variant={item.status === "Borrowed" ? "default" : "secondary"}>{item.status}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Borrowed on {formatManilaTime(item.borrowedAt ?? item.createdAt)}
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
                                onChange={(e) =>
                                  setReturnRemarks((prev) => ({ ...prev, [item.id]: e.target.value }))
                                }
                                className="h-8"
                              />
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setShowReturnConfirm(item.id)}
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

      {/* Borrow Confirmation Dialog */}
      <AlertDialog open={showBorrowConfirm} onOpenChange={setShowBorrowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Borrow</AlertDialogTitle>
            <AlertDialogDescription>
              This will record the borrow transaction for the selected asset.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBorrowRequest} disabled={borrowLoading}>
              {borrowLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Return Confirmation Dialog */}
      <AlertDialog open={!!showReturnConfirm} onOpenChange={(open) => !open && setShowReturnConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Return</AlertDialogTitle>
            <AlertDialogDescription>
              This will process the return of the selected quantity.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => showReturnConfirm && handleReturnRequest(showReturnConfirm)}>
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
