import { useState, useEffect } from "react";
import { format } from "date-fns";
import {
  Plus,
  Trash2,
  Loader2,
  Clock,
  Package,
  Pencil,
  TruckIcon,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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

interface DeliveredOrderInfo {
  id: string;
  order_number: string;
  delivered_at: string | null;
  items: {
    material_name: string;
    unit: string;
    quantity: number;
  }[];
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
  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [items, setItems] = useState<QuotationItem[]>([]);
  const [notes, setNotes] = useState("");
  const [isEditMode, setIsEditMode] = useState(false);
  const [creatorName, setCreatorName] = useState<string>("");

  // Delivered materials tracking
  const [materialProgress, setMaterialProgress] = useState<MaterialDeliveryProgress[]>([]);
  const [deliveredOrders, setDeliveredOrders] = useState<DeliveredOrderInfo[]>([]);
  const [isDeliveredOrdersOpen, setIsDeliveredOrdersOpen] = useState(false);

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
        console.log(itemsData);
        // Fetch delivered materials progress
        await fetchDeliveredMaterials(quotationData.id, itemsData || []);
      } else {
        setQuotation(null);
        setItems([{ id: crypto.randomUUID(), material_name: "", unit: "pcs", quantity: 0 }]);
        setNotes("");
        setIsEditMode(true);
        setMaterialProgress([]);
        setDeliveredOrders([]);
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
      // Get only DELIVERED orders for this project
      const { data: orders, error: ordersError } = await supabase
        .from("orders")
        .select("id, order_number, updated_at")
        .eq("project_id", projectId)
        .eq("status", "delivered")
        .order("updated_at", { ascending: false });

      if (ordersError) throw ordersError;

      if (!orders || orders.length === 0) {
        // No delivered orders - set empty progress
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
        setDeliveredOrders([]);
        return;
      } else {
        console.log(orders);
        console.log(deliveredOrders);
      }

      // Get order items with quotation_item_id reference and SKU info
      const { data: orderItems, error: itemsError } = await supabase
        .from("order_items")
        .select("order_id, quotation_item_id, quantity_ordered, quantity_received, sku:skus(name, unit_of_measure)")
        .in(
          "order_id",
          orders.map((o) => o.id),
        );

      if (itemsError) throw itemsError;

      // Build delivered quantities map by quotation_item_id
      const deliveredByQuotationItemId: Record<string, number> = {};

      orderItems?.forEach((item: any) => {
        if (item.quotation_item_id) {
          const qty = item.quantity_received ?? item.quantity_ordered ?? 0;
          deliveredByQuotationItemId[item.quotation_item_id] =
            (deliveredByQuotationItemId[item.quotation_item_id] || 0) + qty;
        }
      });

      // Calculate per-material progress using quotation_item_id
      const progress: MaterialDeliveryProgress[] = quotationItems.map((qItem) => {
        const deliveredQty = deliveredByQuotationItemId[qItem.id] || 0;
        const remainingQty = Math.max(0, qItem.quantity - deliveredQty);
        const percentage = qItem.quantity > 0 ? Math.min(100, (deliveredQty / qItem.quantity) * 100) : 0;

        return {
          quotationItemId: qItem.id,
          materialName: qItem.material_name,
          unit: qItem.unit,
          quotedQty: qItem.quantity,
          deliveredQty: deliveredQty,
          remainingQty: remainingQty,
          percentage: Math.round(percentage * 10) / 10,
          isFullyDelivered: percentage >= 100,
        };
      });
      setMaterialProgress(progress);

      // Build delivered orders info for expandable section
      const ordersInfo: DeliveredOrderInfo[] = orders.map((order) => {
        const orderItemsList = orderItems?.filter((item: any) => item.order_id === order.id) || [];
        return {
          id: order.id,
          order_number: order.order_number,
          delivered_at: order.updated_at,
          items: orderItemsList.map((item: any) => ({
            material_name: item.sku?.name || "Unknown Material",
            unit: item.sku?.unit_of_measure || "pcs",
            quantity: item.quantity_received ?? item.quantity_ordered ?? 0,
          })),
        };
      });
      setDeliveredOrders(ordersInfo.filter((o) => o.items.length > 0));
    } catch (error) {
      console.error("Error fetching delivered materials:", error);
    }
  };

  useEffect(() => {
    if (open) {
      fetchQuotation();
    }
  }, [open, projectId]);

  const addItem = () => {
    setItems([...items, { id: crypto.randomUUID(), material_name: "", unit: "pcs", quantity: 0 }]);
  };

  const removeItem = (id: string) => {
    if (items.length > 1) {
      setItems(items.filter((item) => item.id !== id));
    }
  };

  const updateItem = (id: string, field: keyof QuotationItem, value: string | number) => {
    setItems(items.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  };

  const handleSave = async () => {
    if (!user) return;

    // Validate
    const hasInvalidItem = items.some((item) => !item.material_name.trim() || item.quantity < 1 || !item.unit.trim());
    if (hasInvalidItem) {
      toast({
        title: "Validation Error",
        description: "All materials must have a name, unit, and quantity of at least 1",
        variant: "destructive",
      });
      return;
    }

    if (items.length === 0) {
      toast({
        title: "Validation Error",
        description: "At least one material item is required",
        variant: "destructive",
      });
      return;
    }

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
          items.map((item) => ({
            quotation_id: quotation.id,
            material_name: item.material_name.trim(),
            unit: item.unit,
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
            items_count: items.length,
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
          items.map((item) => ({
            quotation_id: newQuotation.id,
            material_name: item.material_name.trim(),
            unit: item.unit,
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
            items_count: items.length,
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

  const getTotalProgress = () => {
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
            {isViewMode && materialProgress.length > 0 && (
              <div className="space-y-2 p-4 bg-primary/5 rounded-lg border">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Overall Project Progress</span>
                  <span className="text-lg font-bold text-primary">{getTotalProgress().toFixed(0)}%</span>
                </div>
                <Progress value={getTotalProgress()} className="h-3" />
                <p className="text-xs text-muted-foreground">Based on materials delivered vs. quoted quantities</p>
              </div>
            )}

            {/* Initial Quotation List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">
                  Initial Quotation {isEditMode && <span className="text-destructive">*</span>}
                </Label>
                {isViewMode && canEdit && (
                  <Button type="button" variant="outline" size="sm" onClick={handleEnterEditMode}>
                    <Pencil className="h-4 w-4 mr-1" />
                    Update Quotation
                  </Button>
                )}
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

            {/* Delivered Materials Section (View Mode Only) */}
            {isViewMode && materialProgress.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <TruckIcon className="h-4 w-4 text-primary" />
                  <Label className="text-sm font-medium">Delivered Materials</Label>
                </div>

                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-2 font-medium">Material</th>
                        <th className="text-center p-2 font-medium w-16">Unit</th>
                        <th className="text-center p-2 font-medium w-20">Quoted</th>
                        <th className="text-center p-2 font-medium w-20">Delivered</th>
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

                {/* View Delivered Orders Collapsible */}
                {deliveredOrders.length > 0 && (
                  <Collapsible open={isDeliveredOrdersOpen} onOpenChange={setIsDeliveredOrdersOpen}>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="w-full justify-between hover:bg-muted/50">
                        <span className="flex items-center gap-2">
                          <TruckIcon className="h-4 w-4" />
                          View Delivered Orders ({deliveredOrders.length})
                        </span>
                        {isDeliveredOrdersOpen ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-2 pt-2">
                      {deliveredOrders.map((order) => (
                        <div key={order.id} className="border rounded-lg p-3 bg-muted/30">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-sm">{order.order_number}</span>
                            <span className="text-xs text-muted-foreground">
                              {order.delivered_at ? formatManilaTime(new Date(order.delivered_at)) : "Unknown date"}
                            </span>
                          </div>
                          <div className="space-y-1">
                            {order.items.map((item, idx) => (
                              <div key={idx} className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground">{item.material_name}</span>
                                <span className="font-medium">
                                  {item.quantity} {item.unit}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                )}
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
            <div className="flex justify-end gap-2 pt-2">
              {isEditMode ? (
                <>
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
              ) : (
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Close
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
