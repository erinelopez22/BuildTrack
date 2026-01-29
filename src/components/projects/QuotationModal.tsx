import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Plus, Trash2, Loader2, Clock, Package, Pencil, CheckCircle2, AlertCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { logActivity } from "@/lib/activityLogger";
import { notifyProjectMembers, formatManilaTime } from "@/lib/notificationService";

interface QuotationItem {
  id: string;
  material_name: string;
  unit: string;
  quantity: number;
  received_quantity?: number;
}

interface Quotation {
  id: string;
  project_id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  notes: string | null;
}

interface MaterialDeliveryProgress {
  quotationItemId: string;
  materialName: string;
  unit: string;
  quotedQty: number;
  deliveredQty: number;
  remainingQty: number;
  percentage: number;
  isFullyDelivered: boolean;
}

interface QuotationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
  canEdit: boolean;
  hasExistingQuotation: boolean;
  onQuotationChange?: () => void;
}

export function QuotationModal({
  open,
  onOpenChange,
  projectId,
  projectName,
  canEdit,
  hasExistingQuotation,
  onQuotationChange,
}: QuotationModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [items, setItems] = useState<QuotationItem[]>([]);
  const [notes, setNotes] = useState("");
  const [isEditMode, setIsEditMode] = useState(false);
  const [creatorName, setCreatorName] = useState<string>("");
  const [canDelete, setCanDelete] = useState(false);

  // Delivery progress tracking (for progress bars only)
  const [materialProgress, setMaterialProgress] = useState<MaterialDeliveryProgress[]>();

  // Check if user can delete quotation (Project Engineer, Admin, Super Admin)
  useEffect(() => {
    const checkDeletePermission = async () => {
      if (!user) {
        setCanDelete(false);
        return;
      }

      // Check global roles (admin, super_admin)
      const { data: userRoles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);

      const hasAdminRole = userRoles?.some((r) => r.role === "admin" || r.role === "super_admin");

      if (hasAdminRole) {
        setCanDelete(true);
        return;
      }

      // Check project role (project_manager = Project Engineer)
      const { data: projectRole } = await supabase
        .from("project_members")
        .select("role")
        .eq("project_id", projectId)
        .eq("user_id", user.id)
        .maybeSingle();

      setCanDelete(projectRole?.role === "project_manager");
    };

    if (open) {
      checkDeletePermission();
    }
  }, [open, user, projectId]);

  const fetchQuotation = async () => {
    setLoading(true);
    try {
      // Fetch quotation
      const { data: quotationData, error: quotationError } = await supabase
        .from("project_quotations")
        .select("*")
        .eq("project_id", projectId)
        .maybeSingle();

      if (quotationError) throw quotationError;

      if (quotationData) {
        setQuotation(quotationData);
        setNotes(quotationData.notes || "");
        setIsEditMode(false);

        // Fetch creator name
        const { data: profileData } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", quotationData.created_by)
          .maybeSingle();

        setCreatorName(profileData?.full_name || "Unknown");

        // Fetch quotation items
        const { data: itemsData, error: itemsError } = await supabase
          .from("quotation_items")
          .select("*")
          .eq("quotation_id", quotationData.id)
          .order("created_at", { ascending: true });

        if (itemsError) throw itemsError;
        setItems(itemsData || []);
        // Fetch delivered materials progress
        await fetchDeliveredMaterials(quotationData.id, itemsData || []);
      } else {
        setQuotation(null);
        setItems([{ id: crypto.randomUUID(), material_name: "", unit: "pcs", quantity: 0 }]);
        setNotes("");
        setIsEditMode(true);
        setMaterialProgress([]);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load quotation",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchDeliveredMaterials = async (quotationId: string, quotationItems: QuotationItem[]) => {
    try {
      // Get DELIVERED and CLOSED orders for this project (Received + Completed)
      const { data: orders, error: ordersError } = await supabase
        .from("orders")
        .select("id, order_number, updated_at")
        .eq("project_id", projectId)
        .in("status", ["delivered", "closed"])
        .order("updated_at", { ascending: false });

      if (ordersError) throw ordersError;

      if (!orders || orders.length === 0) {
        // No received orders - set empty progress
        const emptyProgress = quotationItems.map((qItem) => ({
          quotationItemId: qItem.id,
          materialName: qItem.material_name,
          unit: qItem.unit,
          quotedQty: qItem.quantity,
          deliveredQty: 0,
          remainingQty: qItem.quantity,
          percentage: 0,
          isFullyDelivered: false,
        }));
        setMaterialProgress(emptyProgress);
        return;
      }

      // Get order items with quotation_item_id reference
      const { data: orderItems, error: itemsError } = await supabase
        .from("order_items")
        .select("order_id, quotation_item_id, quantity_received")
        .in(
          "order_id",
          orders.map((o) => o.id),
        );

      if (itemsError) throw itemsError;

      // Build received quantities map by quotation_item_id - use ONLY quantity_received
      const receivedByQuotationItemId: Record<string, number> = {};

      orderItems?.forEach((item: any) => {
        if (item.quotation_item_id) {
          // Use ONLY quantity_received (not quantity_ordered)
          const qty = item.quantity_received ?? 0;
          receivedByQuotationItemId[item.quotation_item_id] =
            (receivedByQuotationItemId[item.quotation_item_id] || 0) + qty;
        }
      });

      // Calculate per-material progress using quotation_item_id
      const progress: MaterialDeliveryProgress[] = quotationItems.map((qItem) => {
        const receivedQty = receivedByQuotationItemId[qItem.id] || 0;
        const remainingQty = Math.max(0, qItem.quantity - receivedQty);
        const percentage = qItem.quantity > 0 ? Math.min(100, (receivedQty / qItem.quantity) * 100) : 0;

        return {
          quotationItemId: qItem.id,
          materialName: qItem.material_name,
          unit: qItem.unit,
          quotedQty: qItem.quantity,
          deliveredQty: receivedQty,
          remainingQty: remainingQty,
          percentage: Math.round(percentage * 10) / 10,
          isFullyDelivered: percentage >= 100,
        };
      });
      setMaterialProgress(progress);
    } catch (error) {
      console.error("Error fetching received materials:", error);
    }
  };

  useEffect(() => {
    if (open) {
      fetchQuotation();
    }
  }, [open, projectId]);

  // Normalize material name: trim and uppercase
  const normalizeMaterialName = (name: string): string => {
    return name.trim().toUpperCase();
  };

  const addItem = () => {
    setItems([...items, { id: crypto.randomUUID(), material_name: "", unit: "pcs", quantity: 0 }]);
  };

  const removeItem = (id: string) => {
    if (items.length > 1) {
      setItems(items.filter((item) => item.id !== id));
    }
  };

  const updateItem = (id: string, field: keyof QuotationItem, value: string | number) => {
    if (field === "material_name" && typeof value === "string") {
      // Auto-convert to uppercase while typing
      value = value.toUpperCase();
    }
    setItems(items.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  };

  // Merge duplicates and normalize material names before save
  const consolidateItems = (): QuotationItem[] => {
    const consolidated: Map<string, QuotationItem> = new Map();
    const mergedMaterials: string[] = [];

    items.forEach((item) => {
      const normalizedName = normalizeMaterialName(item.material_name);
      if (!normalizedName) return; // Skip empty names

      if (consolidated.has(normalizedName)) {
        // Merge quantity into existing item
        const existing = consolidated.get(normalizedName)!;
        existing.quantity += item.quantity || 0;
        mergedMaterials.push(normalizedName);
      } else {
        // Add new consolidated item
        consolidated.set(normalizedName, {
          ...item,
          material_name: normalizedName,
        });
      }
    });

    // Show toast for merged materials
    if (mergedMaterials.length > 0) {
      const uniqueMerged = [...new Set(mergedMaterials)];
      toast({
        title: "Materials Merged",
        description: `${uniqueMerged.join(", ")} already exists — quantity added to existing item.`,
      });
    }

    return Array.from(consolidated.values());
  };

  const handleSave = async () => {
    if (!user) return;

    // First consolidate and normalize items (merge duplicates)
    const consolidatedItems = consolidateItems();

    // Validate - check if we have at least one valid item
    if (consolidatedItems.length === 0) {
      toast({
        title: "Validation Error",
        description: "At least one material item with a valid name is required",
        variant: "destructive",
      });
      return;
    }

    // Validate each consolidated item
    const hasInvalidItem = consolidatedItems.some(
      (item) => !item.material_name.trim() || item.quantity < 1 || !item.unit.trim(),
    );
    if (hasInvalidItem) {
      toast({
        title: "Validation Error",
        description: "All materials must have a name, unit, and quantity of at least 1",
        variant: "destructive",
      });
      return;
    }

    // Update items state with consolidated version
    setItems(consolidatedItems);

    setSaving(true);
    try {
      // Get user profile for activity log
      const { data: userProfile } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();

      const userName = userProfile?.full_name || "User";

      // Get user role
      const { data: userRole } = await supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();

      const roleName = userRole?.role || "member";

      if (quotation) {
        // Update existing quotation
        const { error: updateError } = await supabase
          .from("project_quotations")
          .update({ notes, updated_at: new Date().toISOString() })
          .eq("id", quotation.id);

        if (updateError) throw updateError;

        // Delete existing items and insert new ones
        await supabase.from("quotation_items").delete().eq("quotation_id", quotation.id);

        const { error: itemsError } = await supabase.from("quotation_items").insert(
          consolidatedItems.map((item) => ({
            quotation_id: quotation.id,
            material_name: normalizeMaterialName(item.material_name),
            unit: item.unit.trim(),
            quantity: item.quantity,
          })),
        );

        if (itemsError) throw itemsError;

        // Log activity
        await logActivity({
          action: "update",
          tableName: "project_quotations",
          recordId: quotation.id,
          oldValues: null,
          newValues: {
            items_count: consolidatedItems.length,
            updated_by: userName,
            role: roleName,
          },
          userId: user.id,
        });

        // Notify project members
        await notifyProjectMembers({
          projectId,
          title: "Quotation Updated",
          message: `${userName} (${roleName}) updated the quotation for ${projectName} on ${formatManilaTime(new Date())}`,
          type: "project",
          referenceType: "project_quotations",
          referenceId: quotation.id,
          excludeUserId: user.id,
        });

        toast({ title: "Success", description: "Quotation updated successfully" });
      } else {
        // Create new quotation
        const { data: newQuotation, error: createError } = await supabase
          .from("project_quotations")
          .insert({
            project_id: projectId,
            created_by: user.id,
            notes,
          })
          .select()
          .single();

        if (createError) throw createError;

        // Insert items
        const { error: itemsError } = await supabase.from("quotation_items").insert(
          consolidatedItems.map((item) => ({
            quotation_id: newQuotation.id,
            material_name: normalizeMaterialName(item.material_name),
            unit: item.unit.trim(),
            quantity: item.quantity,
          })),
        );

        if (itemsError) throw itemsError;

        // Log activity
        await logActivity({
          action: "create",
          tableName: "project_quotations",
          recordId: newQuotation.id,
          oldValues: null,
          newValues: {
            items_count: consolidatedItems.length,
            created_by: userName,
            role: roleName,
          },
          userId: user.id,
        });

        // Notify project members
        await notifyProjectMembers({
          projectId,
          title: "Quotation Created",
          message: `${userName} (${roleName}) created a quotation for ${projectName} on ${formatManilaTime(new Date())}`,
          type: "project",
          referenceType: "project_quotations",
          referenceId: newQuotation.id,
          excludeUserId: user.id,
        });

        toast({ title: "Success", description: "Quotation created successfully" });
      }

      setIsEditMode(false);
      fetchQuotation();
      onQuotationChange?.();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save quotation",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEnterEditMode = () => {
    setIsEditMode(true);
  };

  const handleCancelEdit = () => {
    if (quotation) {
      setIsEditMode(false);
      fetchQuotation();
    } else {
      onOpenChange(false);
    }
  };

  const handleDeleteQuotation = async () => {
    if (!user || !quotation) return;

    setDeleting(true);
    try {
      // Get user profile for activity log
      const { data: userProfile } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();

      const userName = userProfile?.full_name || "User";

      // Get user role
      const { data: userRole } = await supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();

      const roleName = userRole?.role || "member";

      const quotationId = quotation.id;
      const itemsCount = items.length;

      // Delete quotation items first (child records)
      const { error: deleteItemsError } = await supabase
        .from("quotation_items")
        .delete()
        .eq("quotation_id", quotationId);

      if (deleteItemsError) throw deleteItemsError;

      // Delete the quotation
      const { error: deleteQuotationError } = await supabase.from("project_quotations").delete().eq("id", quotationId);

      if (deleteQuotationError) throw deleteQuotationError;

      // Log activity
      await logActivity({
        action: "delete",
        tableName: "project_quotations",
        recordId: quotationId,
        oldValues: {
          items_count: itemsCount,
        },
        newValues: null,
        userId: user.id,
      });

      // Notify project members
      await notifyProjectMembers({
        projectId,
        title: "Quotation Deleted",
        message: `${userName} (${roleName}) deleted the quotation for ${projectName} on ${formatManilaTime(new Date())}`,
        type: "project",
        referenceType: "project_quotations",
        referenceId: quotationId,
        excludeUserId: user.id,
      });

      toast({
        title: "Quotation Deleted",
        description: "The quotation has been permanently deleted",
      });

      // Close modal and refresh parent
      setShowDeleteConfirm(false);
      onOpenChange(false);
      onQuotationChange?.();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete quotation",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const getTotalProgress = () => {
    if (!materialProgress) return 0;
    const totalQuoted = materialProgress.reduce((sum, item) => sum + item.quotedQty, 0);
    const totalDelivered = materialProgress.reduce((sum, item) => {
      // Cap delivered at quoted amount for percentage calculation
      return sum + Math.min(item.deliveredQty, item.quotedQty);
    }, 0);
    return totalQuoted > 0 ? Math.min(100, (totalDelivered / totalQuoted) * 100) : 0;
  };

  const isViewMode = !isEditMode && quotation !== null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {!quotation ? "Add Quotation" : isEditMode ? "Update Quotation" : "View Quotation"} - {projectName}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Metadata */}
            {quotation && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  <span>Created: {format(new Date(quotation.created_at), "MMM dd, yyyy h:mm a")}</span>
                </div>
                <span className="hidden sm:inline">•</span>
                <span>By: {creatorName}</span>
                {quotation.updated_at !== quotation.created_at && (
                  <>
                    <span className="hidden sm:inline">•</span>
                    <span>Updated: {format(new Date(quotation.updated_at), "MMM dd, yyyy h:mm a")}</span>
                  </>
                )}
              </div>
            )}

            {/* Overall Progress Summary */}
            {isViewMode && materialProgress && materialProgress.length > 0 && (
              <div className="space-y-3 p-4 bg-primary/5 rounded-lg border">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Overall Project Progress</span>
                  <span className="text-lg font-bold text-primary">{getTotalProgress().toFixed(0)}%</span>
                </div>
                <Progress value={getTotalProgress()} className="h-3" />
                <div className="grid grid-cols-3 gap-4 text-center text-sm">
                  <div>
                    <div className="font-semibold">{materialProgress.reduce((sum, m) => sum + m.quotedQty, 0)}</div>
                    <div className="text-xs text-muted-foreground">Total Quoted</div>
                  </div>
                  <div>
                    <div className="font-semibold text-primary">
                      {materialProgress.reduce((sum, m) => sum + m.deliveredQty, 0)}
                    </div>
                    <div className="text-xs text-muted-foreground">Total Received</div>
                  </div>
                  <div>
                    <div className="font-semibold text-orange-600">
                      {materialProgress.reduce((sum, m) => sum + m.remainingQty, 0)}
                    </div>
                    <div className="text-xs text-muted-foreground">Remaining</div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Based on quantity_received from Delivered + Closed orders
                </p>
              </div>
            )}

            {/* Initial Quotation List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">
                  Initial Quotation {isEditMode && <span className="text-destructive">*</span>}
                </Label>
              </div>

              <div className="space-y-2">
                {items.map((item, index) => (
                  <div key={item.id} className="flex gap-2 items-center p-2 border rounded-lg bg-card">
                    <div className="flex-1">
                      <Input
                        placeholder="Material name"
                        value={item.material_name}
                        onChange={(e) => updateItem(item.id, "material_name", e.target.value)}
                        disabled={!isEditMode}
                      />
                    </div>
                    <div className="w-20">
                      <Input
                        placeholder="Unit"
                        value={item.unit}
                        onChange={(e) => updateItem(item.id, "unit", e.target.value)}
                        disabled={!isEditMode}
                      />
                    </div>
                    <div className="w-24">
                      <Input
                        type="number"
                        min={1}
                        placeholder="Qty"
                        value={item.quantity || ""}
                        onChange={(e) => updateItem(item.id, "quantity", parseInt(e.target.value) || 0)}
                        disabled={!isEditMode}
                      />
                    </div>
                    {isEditMode && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeItem(item.id)}
                        disabled={items.length === 1}
                        className="shrink-0"
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              {isEditMode && (
                <Button type="button" variant="outline" size="sm" onClick={addItem} className="w-full">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Material
                </Button>
              )}
            </div>

            {/* Progress Tracking Section (View Mode Only) */}
            {isViewMode && materialProgress && materialProgress.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-primary" />
                  <Label className="text-sm font-medium">Quotation Progress</Label>
                </div>

                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-2 font-medium">Material</th>
                        <th className="text-center p-2 font-medium w-16">Unit</th>
                        <th className="text-center p-2 font-medium w-20">Quoted</th>
                        <th className="text-center p-2 font-medium w-20">Received</th>
                        <th className="text-center p-2 font-medium w-20">Remaining</th>
                        <th className="text-center p-2 font-medium w-28">Progress</th>
                        <th className="text-center p-2 font-medium w-20">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {materialProgress.map((material) => (
                        <tr key={material.quotationItemId} className="hover:bg-muted/30">
                          <td className="p-2 font-medium">{material.materialName}</td>
                          <td className="p-2 text-center text-muted-foreground">{material.unit}</td>
                          <td className="p-2 text-center">{material.quotedQty}</td>
                          <td className="p-2 text-center font-medium text-primary">{material.deliveredQty}</td>
                          <td className="p-2 text-center text-muted-foreground">{material.remainingQty}</td>
                          <td className="p-2">
                            <div className="flex items-center gap-2">
                              <Progress value={material.percentage} className="h-2 flex-1" />
                              <span className="text-xs font-medium w-10 text-right">{material.percentage}%</span>
                            </div>
                          </td>
                          <td className="p-2 text-center">
                            {material.isFullyDelivered ? (
                              <Badge variant="default" className="bg-green-600 hover:bg-green-700 text-xs">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Complete
                              </Badge>
                            ) : material.deliveredQty > 0 ? (
                              <Badge variant="secondary" className="text-xs">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                Partial
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs text-muted-foreground">
                                Pending
                              </Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Notes */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Notes</Label>
              <Textarea
                placeholder="Add notes about this quotation..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                disabled={!isEditMode}
              />
            </div>

            {/* Actions */}
            <div className="flex justify-between items-center gap-2 pt-4 border-t">
              {isEditMode ? (
                <>
                  {/* Edit mode: Cancel on left, Save on right */}
                  <Button variant="outline" onClick={handleCancelEdit}>
                    Cancel
                  </Button>
                  <Button onClick={handleSave} disabled={saving}>
                    {saving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : quotation ? (
                      "Save Changes"
                    ) : (
                      "Create Quotation"
                    )}
                  </Button>
                </>
              ) : isViewMode && quotation ? (
                <>
                  {/* View mode with existing quotation: Delete left, Update right (for authorized users) */}
                  <div className="flex gap-3">
                    {canDelete && (
                      <Button 
                        variant="destructive" 
                        onClick={() => setShowDeleteConfirm(true)} 
                        className="gap-2"
                        tabIndex={1}
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete Quotation
                      </Button>
                    )}
                    {canEdit && (
                      <Button onClick={handleEnterEditMode} className="gap-2">
                        <Pencil className="h-4 w-4" />
                        Update Quotation
                      </Button>
                    )}
                  </div>
                  <Button variant="outline" onClick={() => onOpenChange(false)}>
                    Close
                  </Button>
                </>
              ) : (
                <div className="ml-auto">
                  <Button variant="outline" onClick={() => onOpenChange(false)}>
                    Close
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Delete Quotation
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>You are about to permanently delete the existing quotation for this project.</p>
              <p className="font-medium text-destructive">
                This action cannot be undone and will affect project progress tracking.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteQuotation}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "OK"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
