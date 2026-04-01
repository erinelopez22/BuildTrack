import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { logActivity } from "@/lib/activityLogger";
import { formatManilaTime } from "@/lib/notificationService";
import { Wrench, Plus, Search, Pencil, Trash2, Loader2, Package, ArrowLeftRight, Check, X, Eye, History, ClipboardList, RotateCcw } from "lucide-react";
import type { AssetType, AssetCondition } from "@/types/database";
import { EquipmentHistoryTab } from "@/components/equipment/EquipmentHistoryTab";
import { BorrowRequestsTab } from "@/components/equipment/BorrowRequestsTab";
import { ReturnRequestsTab } from "@/components/equipment/ReturnRequestsTab";
import { companyAssetsApi, projectsApi, truncateApi, type CompanyAsset as CompanyAssetDTO, type BorrowTransaction as BorrowTransactionDTO } from "@/lib/apiClient";
import { TruncateButton } from "@/components/common/TruncateButton";

interface BorrowWithDetails extends BorrowTransactionDTO {
  // projectName and borrowedByName are already on BorrowTransactionDTO
}

export default function CompanyAssets() {
  const { user, isAdmin, isSuperAdmin, isOfficeAdmin, isProjectEngineer, isChecker } = useAuth();
  const { toast } = useToast();
  const [assets, setAssets] = useState<CompanyAssetDTO[]>([]);
  const [borrowTransactions, setBorrowTransactions] = useState<BorrowWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<CompanyAssetDTO | null>(null);
  const [deleteAsset, setDeleteAsset] = useState<CompanyAssetDTO | null>(null);
  const [saving, setSaving] = useState(false);

  // Asset detail modal (Admin/Super Admin only)
  const [selectedAsset, setSelectedAsset] = useState<CompanyAssetDTO | null>(null);
  const [assetBorrows, setAssetBorrows] = useState<BorrowTransactionDTO[]>([]);
  const [assetBorrowsLoading, setAssetBorrowsLoading] = useState(false);

  // Return modal
  const [returnTransaction, setReturnTransaction] = useState<BorrowWithDetails | null>(null);
  const [returnQty, setReturnQty] = useState(0);
  const [returnRemarks, setReturnRemarks] = useState("");
  const [returning, setReturning] = useState(false);

  // Form state
  const [form, setForm] = useState({
    asset_name: "",
    asset_type: "Material" as AssetType,
    asset_code: "",
    unit: "",
    total_quantity: 0,
    condition: "Available" as AssetCondition,
    notes: "",
  });

  // Top-level tab + history project selector
  const [activeTopTab, setActiveTopTab] = useState("assets");
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");

  const canManage = isAdmin();
  const canClickCards = isSuperAdmin() || isAdmin();
  const canAccessPage = isSuperAdmin() || isAdmin() || isOfficeAdmin() || isProjectEngineer() || isChecker();

  const fetchData = async () => {
    setLoading(true);
    try {
      const [assetsData, borrowsData] = await Promise.all([
        companyAssetsApi.getAll(),
        companyAssetsApi.getAllBorrows(),
      ]);

      setAssets(assetsData.data || []);

      const activeBorrows = (borrowsData.data || []).filter(
        (t) => t.status !== "Returned",
      );
      setBorrowTransactions(activeBorrows);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setLoading(false);
  };

  const fetchProjects = async () => {
    try {
      const res = await projectsApi.getAll();
      const projectList = (res.data || [])
        .filter((p) => p.status !== "deleted" && !p.isHidden)
        .map((p) => ({ id: p.id, name: p.name }));
      setProjects(projectList);
      if (projectList.length > 0 && !selectedProjectId) {
        setSelectedProjectId(projectList[0].id);
      }
    } catch {
      // non-critical
    }
  };

  useEffect(() => {
    fetchData();
    fetchProjects();
  }, []);

  const getAvailableQty = (asset: CompanyAssetDTO): number => {
    return asset.availableQuantity ?? Math.max(0, asset.totalQuantity - getBorrowedQty(asset));
  };

  const getBorrowedQty = (asset: CompanyAssetDTO): number => {
    return asset.borrowedQuantity ??
      borrowTransactions
        .filter((t) => t.assetId === asset.id && t.status !== "Returned")
        .reduce((sum, t) => sum + (t.borrowedQty - t.returnedQty), 0);
  };

  const filteredAssets = useMemo(() => {
    if (!search) return assets;
    const q = search.toLowerCase();
    return assets.filter(
      (a) =>
        a.assetName.toLowerCase().includes(q) ||
        (a.assetType || "").toLowerCase().includes(q) ||
        (a.assetCode || "").toLowerCase().includes(q),
    );
  }, [assets, search]);

  // Fetch borrow transactions for a specific asset
  const fetchAssetBorrows = async (assetId: string) => {
    setAssetBorrowsLoading(true);
    try {
      const data = await companyAssetsApi.getBorrows(assetId);
      setAssetBorrows(data.data || []);
    } catch {
      setAssetBorrows([]);
    }
    setAssetBorrowsLoading(false);
  };

  const handleCardClick = (asset: CompanyAssetDTO) => {
    if (!canClickCards) return;
    setSelectedAsset(asset);
    fetchAssetBorrows(asset.id);
  };

  const handleApproveReturn = async (txn: BorrowTransactionDTO) => {
    if (!user) return;
    try {
      await companyAssetsApi.returnAsset(txn.id, {
        returnedQty: txn.borrowedQty - txn.returnedQty,
        remarks: undefined,
      });

      await logActivity({
        action: "asset_returned",
        tableName: "borrow_transactions",
        recordId: txn.projectId || txn.id,
        oldValues: null,
        newValues: { assetId: txn.assetId, qty: txn.borrowedQty - txn.returnedQty, approvedBy: user.id },
        userId: user.id,
      });

      toast({ title: "Approved", description: "Return approved and executed." });
      fetchData();
      if (selectedAsset) fetchAssetBorrows(selectedAsset.id);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const openCreate = () => {
    setEditingAsset(null);
    setForm({
      asset_name: "",
      asset_type: "Material",
      asset_code: "",
      unit: "",
      total_quantity: 0,
      condition: "Available",
      notes: "",
    });
    setIsFormOpen(true);
  };

  const openEdit = (asset: CompanyAssetDTO) => {
    setEditingAsset(asset);
    setForm({
      asset_name: asset.assetName,
      asset_type: (asset.assetType as AssetType) || "Material",
      asset_code: asset.assetCode || "",
      unit: asset.unit || "",
      total_quantity: asset.totalQuantity,
      condition: (asset.condition as AssetCondition) || "Available",
      notes: asset.notes || "",
    });
    setIsFormOpen(true);
  };

  const handleSave = async () => {
    if (!form.asset_name.trim()) {
      toast({ title: "Error", description: "Asset name is required", variant: "destructive" });
      return;
    }
    setSaving(true);

    try {
      if (editingAsset) {
        const borrowed = getBorrowedQty(editingAsset);
        if (form.total_quantity < borrowed) {
          toast({
            title: "Error",
            description: `Total quantity cannot be lower than currently borrowed quantity (${borrowed}).`,
            variant: "destructive",
          });
          setSaving(false);
          return;
        }
        await companyAssetsApi.update(editingAsset.id, {
          assetName: form.asset_name.trim(),
          assetType: form.asset_type,
          unit: form.unit.trim() || undefined,
          totalQuantity: form.total_quantity,
          condition: form.condition,
          notes: form.notes.trim() || undefined,
        });
        toast({ title: "Success", description: "Asset updated" });
      } else {
        await companyAssetsApi.create({
          assetName: form.asset_name.trim(),
          assetType: form.asset_type,
          unit: form.unit.trim() || undefined,
          totalQuantity: form.total_quantity,
          condition: form.condition,
          notes: form.notes.trim() || undefined,
        });
        toast({ title: "Success", description: "Asset created" });
      }
      setIsFormOpen(false);
      fetchData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteAsset) return;
    const borrowed = getBorrowedQty(deleteAsset);
    if (borrowed > 0) {
      toast({
        title: "Error",
        description: `Cannot delete this asset because there are still borrowed items (${borrowed}).`,
        variant: "destructive",
      });
      setDeleteAsset(null);
      return;
    }
    try {
      await companyAssetsApi.delete(deleteAsset.id);
      toast({ title: "Success", description: "Asset deleted" });
      fetchData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setDeleteAsset(null);
  };

  const handleReturn = async () => {
    if (!returnTransaction || returnQty <= 0) return;
    setReturning(true);

    const maxReturnable = returnTransaction.borrowedQty - returnTransaction.returnedQty;
    const actualReturn = Math.min(returnQty, maxReturnable);

    try {
      await companyAssetsApi.returnAsset(returnTransaction.id, {
        returnedQty: actualReturn,
        remarks: returnRemarks.trim() || undefined,
      });

      await logActivity({
        action: "return",
        tableName: "borrow_transactions",
        recordId: returnTransaction.id,
        newValues: { returned_qty: actualReturn },
        userId: user?.id || null,
      });

      toast({ title: "Success", description: `Returned ${actualReturn} item(s)` });
      setReturnTransaction(null);
      setReturnQty(0);
      setReturnRemarks("");
      fetchData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setReturning(false);
  };

  if (!canAccessPage) {
    return (
      <div className="animate-fade-in space-y-6">
        <PageHeader title="Equipments & Tools" description="You do not have access to this page." />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Equipments & Tools"
        description="Manage company-owned assets that can be borrowed by projects"
        action={
          <TruncateButton
            label="Equipment"
            description="This will permanently delete ALL equipment/tools and their borrow transaction records."
            onTruncate={truncateApi.equipment}
            onSuccess={() => window.location.reload()}
          />
        }
      />

      <Tabs value={activeTopTab} onValueChange={setActiveTopTab}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="assets" className="gap-1.5">
            <Package className="h-4 w-4" />
            Assets
          </TabsTrigger>
          <TabsTrigger value="borrow_requests" className="gap-1.5">
            <ClipboardList className="h-4 w-4" />
            Borrow Requests
          </TabsTrigger>
          <TabsTrigger value="return_requests" className="gap-1.5">
            <RotateCcw className="h-4 w-4" />
            Return Requests
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5">
            <History className="h-4 w-4" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="assets" className="space-y-4 mt-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search assets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {canManage && (
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Add Asset
          </Button>
        )}
      </div>

      {filteredAssets.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title="No assets yet"
          description="Add company materials, tools, or equipment to manage."
          action={canManage ? { label: "Add Asset", onClick: openCreate } : undefined}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredAssets.map((asset) => {
            const available = getAvailableQty(asset);
            const borrowed = getBorrowedQty(asset);
            const assetActiveBorrows = borrowTransactions.filter((t) => t.assetId === asset.id && t.status !== "Returned");

            return (
              <Card
                key={asset.id}
                className={`transition-shadow ${canClickCards ? "hover:shadow-md cursor-pointer" : "hover:shadow-md"}`}
                onClick={() => handleCardClick(asset)}
                title={!canClickCards ? "View only" : undefined}
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-foreground truncate">{asset.assetName}</h3>
                        {!canClickCards && <Eye className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="text-xs">
                          {asset.assetType}
                        </Badge>
                        {asset.assetCode && (
                          <span className="text-xs text-muted-foreground font-mono">{asset.assetCode}</span>
                        )}
                      </div>
                    </div>
                    {canManage && (
                      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(asset)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => setDeleteAsset(asset)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-md bg-muted/50 p-2">
                      <p className="text-lg font-bold text-foreground">{asset.totalQuantity}</p>
                      <p className="text-[10px] text-muted-foreground">Total</p>
                    </div>
                    <div className="rounded-md bg-success/10 p-2">
                      <p className="text-lg font-bold text-success">{available}</p>
                      <p className="text-[10px] text-muted-foreground">Available</p>
                    </div>
                    <div className="rounded-md bg-warning/10 p-2">
                      <p className="text-lg font-bold text-warning">{borrowed}</p>
                      <p className="text-[10px] text-muted-foreground">Borrowed</p>
                    </div>
                  </div>

                  {asset.unit && <p className="text-xs text-muted-foreground">Unit: {asset.unit}</p>}

                  {/* Current borrows */}
                  {assetActiveBorrows.length > 0 && (
                    <div className="space-y-1.5 pt-2 border-t">
                      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                        <ArrowLeftRight className="h-3 w-3" />
                        Currently Borrowed
                      </p>
                      {assetActiveBorrows.map((bt) => (
                        <div
                          key={bt.id}
                          className="flex items-center justify-between text-xs bg-muted/30 rounded px-2 py-1.5"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-medium truncate">{bt.projectName || "Unknown Project"}</p>
                            <p className="text-muted-foreground">
                              Qty: {bt.borrowedQty - bt.returnedQty} • {bt.borrowedByName || "Unknown"}
                            </p>
                          </div>
                          {canManage && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 text-[10px] px-2 ml-2"
                              onClick={(e) => {
                                e.stopPropagation();
                                setReturnTransaction(bt);
                                setReturnQty(bt.borrowedQty - bt.returnedQty);
                                setReturnRemarks("");
                              }}
                            >
                              Return
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
        </TabsContent>

        <TabsContent value="borrow_requests" className="mt-4">
          <BorrowRequestsTab />
        </TabsContent>

        <TabsContent value="return_requests" className="mt-4">
          <ReturnRequestsTab />
        </TabsContent>

        <TabsContent value="history" className="mt-4 space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="w-full max-w-xs">
              <Label className="text-xs text-muted-foreground mb-1 block">Select Project</Label>
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {selectedProjectId ? (
            <EquipmentHistoryTab projectId={selectedProjectId} />
          ) : (
            <EmptyState
              icon={History}
              title="Select a project"
              description="Choose a project above to view equipment history."
            />
          )}
        </TabsContent>
      </Tabs>

      {/* Asset Detail Modal (Admin/Super Admin only) */}
      <Dialog open={!!selectedAsset} onOpenChange={(open) => !open && setSelectedAsset(null)}>
        <DialogContent className="max-w-2xl w-[calc(100%-2rem)] max-h-[85vh] flex flex-col p-0 gap-0">
          <DialogHeader className="flex-shrink-0 px-6 py-4 border-b">
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              {selectedAsset?.assetName}
              {selectedAsset?.assetCode && (
                <span className="text-sm font-mono text-muted-foreground">{selectedAsset.assetCode}</span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {assetBorrowsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Tabs defaultValue="borrows" className="space-y-4">
                <TabsList className="w-full">
                  <TabsTrigger value="borrows" className="flex-1">Active Borrows</TabsTrigger>
                  <TabsTrigger value="all_borrows" className="flex-1">All Transactions</TabsTrigger>
                </TabsList>

                <TabsContent value="borrows">
                  {(() => {
                    const activeBorrows = assetBorrows.filter((t) => t.status !== "Returned");
                    return activeBorrows.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic py-4">No active borrows.</p>
                    ) : (
                      <div className="space-y-2">
                        {activeBorrows.map((bt) => (
                          <div key={bt.id} className="p-3 border rounded-lg text-sm space-y-1">
                            <div className="flex justify-between">
                              <span className="font-medium">{bt.projectName || "Unknown"}</span>
                              <Badge variant="secondary">{bt.status}</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Qty: {bt.borrowedQty - bt.returnedQty} remaining •{" "}
                              {bt.borrowedByName || "Unknown"} •{" "}
                              {bt.borrowedAt ? formatManilaTime(bt.borrowedAt) : ""}
                            </p>
                            {canManage && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs gap-1 text-success border-success/30"
                                onClick={() => handleApproveReturn(bt)}
                              >
                                <Check className="h-3 w-3" /> Process Return
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </TabsContent>

                <TabsContent value="all_borrows">
                  {assetBorrows.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic py-4">No transactions.</p>
                  ) : (
                    <div className="space-y-2">
                      {assetBorrows.map((bt) => (
                        <div key={bt.id} className="p-3 border rounded-lg text-sm space-y-1">
                          <div className="flex justify-between">
                            <span className="font-medium">{bt.projectName || "Unknown"}</span>
                            <Badge variant="secondary">{bt.status}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Borrowed: {bt.borrowedQty} • Returned: {bt.returnedQty} •{" "}
                            {bt.borrowedByName || "Unknown"} •{" "}
                            {bt.borrowedAt ? formatManilaTime(bt.borrowedAt) : ""}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Modal */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-md w-[calc(100%-2rem)]">
          <DialogHeader>
            <DialogTitle>{editingAsset ? "Edit Asset" : "Add Asset"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>
                Asset Name <span className="text-destructive">*</span>
              </Label>
              <Input
                value={form.asset_name}
                onChange={(e) => setForm({ ...form, asset_name: e.target.value })}
                placeholder="e.g. Concrete Mixer"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type</Label>
                <Select value={form.asset_type} onValueChange={(v) => setForm({ ...form, asset_type: v as AssetType })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Material">Material</SelectItem>
                    <SelectItem value="Tool">Tool</SelectItem>
                    <SelectItem value="Equipment">Equipment</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Condition</Label>
                <Select
                  value={form.condition}
                  onValueChange={(v) => setForm({ ...form, condition: v as AssetCondition })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Available">Available</SelectItem>
                    <SelectItem value="Maintenance">Maintenance</SelectItem>
                    <SelectItem value="Retired">Retired</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Asset Code</Label>
                {editingAsset ? (
                  <Input value={form.asset_code} readOnly disabled className="bg-muted font-mono" />
                ) : (
                  <Input value="Auto-generated" readOnly disabled className="bg-muted text-muted-foreground italic" />
                )}
              </div>
              <div>
                <Label>Unit</Label>
                <Input
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  placeholder="e.g. pcs"
                />
              </div>
            </div>
            <div>
              <Label>Total Quantity</Label>
              <Input
                type="number"
                min={0}
                value={form.total_quantity}
                onChange={(e) => setForm({ ...form, total_quantity: parseInt(e.target.value) || 0 })}
              />
              {editingAsset &&
                (() => {
                  const borrowed = getBorrowedQty(editingAsset);
                  const available = getAvailableQty(editingAsset);
                  const newTotal = form.total_quantity;
                  const isBelowBorrowed = newTotal < borrowed;
                  return (
                    <div className="mt-1 space-y-0.5">
                      <p className="text-xs text-muted-foreground">
                        Currently Borrowed: <span className="font-medium text-foreground">{borrowed}</span> · Available:{" "}
                        <span className="font-medium text-foreground">{available}</span>
                      </p>
                      {isBelowBorrowed && (
                        <p className="text-xs text-destructive">
                          Not allowed: Total quantity cannot be lower than currently borrowed quantity ({borrowed}).
                        </p>
                      )}
                    </div>
                  );
                })()}
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Optional notes"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFormOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || (editingAsset ? form.total_quantity < getBorrowedQty(editingAsset) : false)}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingAsset ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteAsset} onOpenChange={() => setDeleteAsset(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Asset</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteAsset && getBorrowedQty(deleteAsset) > 0
                ? `Cannot delete this asset because there are still borrowed items (${getBorrowedQty(deleteAsset!)}). Please return all borrowed items before deleting.`
                : `Are you sure you want to delete "${deleteAsset?.assetName}"? This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteAsset ? getBorrowedQty(deleteAsset) > 0 : false}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Return Modal */}
      <Dialog open={!!returnTransaction} onOpenChange={() => setReturnTransaction(null)}>
        <DialogContent className="sm:max-w-sm w-full p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Return Asset</DialogTitle>
          </DialogHeader>
          {returnTransaction && (
            <div className="space-y-4">
              <div className="text-sm">
                <p className="text-muted-foreground">Borrowed: {returnTransaction.borrowedQty}</p>
                <p className="text-muted-foreground">Already returned: {returnTransaction.returnedQty}</p>
                <p className="font-medium">
                  Remaining: {returnTransaction.borrowedQty - returnTransaction.returnedQty}
                </p>
              </div>
              <div>
                <Label>Return Quantity</Label>
                <Input
                  type="number"
                  min={1}
                  max={returnTransaction.borrowedQty - returnTransaction.returnedQty}
                  value={returnQty}
                  onChange={(e) => setReturnQty(parseInt(e.target.value) || 0)}
                />
              </div>
              <div>
                <Label>Remarks</Label>
                <Textarea
                  value={returnRemarks}
                  onChange={(e) => setReturnRemarks(e.target.value)}
                  placeholder="Optional"
                  rows={2}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReturnTransaction(null)}>
              Cancel
            </Button>
            <Button onClick={handleReturn} disabled={returning || returnQty <= 0}>
              {returning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm Return
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
