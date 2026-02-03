import { useState, useEffect } from "react";
import { format } from "date-fns";
import {
  Plus,
  Trash2,
  Loader2,
  Clock,
  Package,
  Pencil,
  AlertTriangle,
  Lock,
} from "lucide-react";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { request } from "@/integrations/api";
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

interface MaterialOrderUsage {
  quotationItemId: string;
  orderedQty: number; // SUM from non-received/closed orders
  receivedClosedQty: number; // SUM from received/closed orders
  minimumAllowedQty: number; // orderedQty + receivedClosedQty
  isUsedInOrders: boolean;
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

/** ---------------------------
 * API helpers (adjust routes)
 * --------------------------*/
type QuotationGetResponse = {
  quotation: Quotation | null;
  items: QuotationItem[];
  creatorName?: string | null;
};
interface Quotation {
  id: string;
  project_id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  notes: string | null;
}
type ProjectMemberMeResponse = {
  userId: string;
  projectId: string;
  role: string; // e.g. "project_manager"
};

type ProjectOrdersResponse = {
  orders: { id: string; status: string; updated_at?: string | null }[];
};

type OrderItemsResponse = {
  items: {
    order_id: string;
    quotation_item_id: string;
    quantity_ordered?: number | null;
    quantity_received?: number | null;
  }[];
};

async function apiGetQuotationByProject(projectId: string) {
  // GET /api/projects/{projectId}/quotation
  console.log( projectId + "asdasdasdsadasdasdasdasdasdasdasdassssssssssssssssssssssssssss");
  return request<any>(`/api/projects/${projectId}/quotation`, {
    method: "GET",
  });
}

async function apiCreateQuotation(projectId: string, payload: { notes: string | null }) {
  // POST /api/projects/{projectId}/quotation
  return request<Quotation>(`/api/projects/${projectId}/quotation`, {
    method: "POST",
    body: payload,
  });
}

async function apiUpdateQuotation(quotationId: string, payload: { notes: string | null }) {
  // PUT /api/quotations/{quotationId}
  return request<void>(`/api/quotations/${quotationId}`, {
    method: "PUT",
    body: payload,
  });
}

// async function apiReplaceQuotationItems(
//   quotationId: string,
//   items: { id?: string; material_name: string; unit: string; quantity: number }[],
// ) {
//    // PUT /api/quotations/{quotationId}/items  (replace-all OR upsert)
//   console.log("apiReplaceQuotationItems", quotationId, items);
//   return request<void>(`/api/quotations/${quotationId}/items`, {
//     method: "PUT",
//     body: { items },
//   });
// }

async function apiReplaceQuotationItems(projectID:string, notes: string | null,
  quotationId: string,
  items: { id?: string; material_name: string; unit: string; quantity: number }[],
) {
   // PUT /api/quotations/{quotationId}/items  (replace-all OR upsert)
  console.log("apiReplaceQuotationItems", quotationId, items);

  return request<Quotation>(`/api/projects/${projectID}/quotation`, {
    method: "POST",
    body: { notes: notes || null, items },
  });
  
  return request<void>(`/api/quotations/${quotationId}/items`, {
    method: "PUT",
    body: { items },
  });
}


async function apiDeleteQuotation(quotationId: string) {
  // DELETE /api/quotations/{quotationId}
  return request<void>(`/api/quotations/${quotationId}`, { method: "DELETE" });
}

async function apiGetMyProjectRole(projectId: string) {
  // GET /api/projects/{projectId}/members/me
  return request<ProjectMemberMeResponse>(`/api/projects/${projectId}/members/me`, {
    method: "GET",
  });
}

async function apiGetProjectOrders(projectId: string) {
  // GET /api/projects/{projectId}/orders?excludeStatus=cancelled
  return request<ProjectOrdersResponse>(
    `/api/projects/${projectId}/orders?excludeStatus=cancelled`,
    { method: "GET" },
  );
}

async function apiGetOrderItems(orderIds: string[]) {
  // POST /api/order-items/by-orders
  return request<OrderItemsResponse>(`/api/order-items/by-orders`, {
    method: "POST",
    body: { orderIds },
  });
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

  const [materialProgress, setMaterialProgress] = useState<MaterialDeliveryProgress[]>();
  const [materialOrderUsage, setMaterialOrderUsage] = useState<Map<string, MaterialOrderUsage>>(new Map());

  // Check if user can delete quotation (Project Engineer/project_manager, Admin, Super Admin)
  useEffect(() => {
    const checkDeletePermission = async () => {
      if (!user) {
        setCanDelete(false);
        return;
      }

      const hasAdminRole =
        user.roles?.includes("admin") || user.roles?.includes("super_admin");

      if (hasAdminRole) {
        setCanDelete(true);
        return;
      }

      try {
        const me = await apiGetMyProjectRole(projectId);
        setCanDelete(me.role === "project_manager");
      } catch {
        setCanDelete(false);
      }
    };

    if (open) checkDeletePermission();
  }, [open, user, projectId]);

  const normalizeMaterialName = (name: string): string => name.trim().toUpperCase();

  const fetchMaterialOrderUsage = async (quotationItems: QuotationItem[]) => {
    try {
      if (quotationItems.length === 0) {
        setMaterialOrderUsage(new Map());
        return;
      }

      const ordersRes = await apiGetProjectOrders(projectId);
      const orders = ordersRes.orders ?? [];

      if (orders.length === 0) {
        const emptyUsage = new Map<string, MaterialOrderUsage>();
        quotationItems.forEach((qItem) => {
          emptyUsage.set(qItem.id, {
            quotationItemId: qItem.id,
            orderedQty: 0,
            receivedClosedQty: 0,
            minimumAllowedQty: 0,
            isUsedInOrders: false,
          });
        });
        setMaterialOrderUsage(emptyUsage);
        return;
      }

      const receivedClosedOrderIds = orders
        .filter((o) => o.status === "delivered" || o.status === "closed")
        .map((o) => o.id);

      const activeOrderIds = orders
        .filter((o) => o.status !== "delivered" && o.status !== "closed")
        .map((o) => o.id);

      const orderItemsRes = await apiGetOrderItems(orders.map((o) => o.id));
      const orderItems = orderItemsRes.items ?? [];

      const usageMap = new Map<string, MaterialOrderUsage>();

      quotationItems.forEach((qItem) => {
        let orderedQty = 0;
        let receivedClosedQty = 0;
        let isUsedInOrders = false;

        orderItems.forEach((oi) => {
          if (oi.quotation_item_id === qItem.id) {
            isUsedInOrders = true;

            if (receivedClosedOrderIds.includes(oi.order_id)) {
              receivedClosedQty += oi.quantity_received ?? 0;
            } else if (activeOrderIds.includes(oi.order_id)) {
              orderedQty += oi.quantity_ordered ?? 0;
            }
          }
        });

        usageMap.set(qItem.id, {
          quotationItemId: qItem.id,
          orderedQty,
          receivedClosedQty,
          minimumAllowedQty: orderedQty + receivedClosedQty,
          isUsedInOrders,
        });
      });

      setMaterialOrderUsage(usageMap);
    } catch (error) {
      console.error("Error fetching material order usage:", error);
    }
  };

  const fetchDeliveredMaterials = async (quotationItems: QuotationItem[]) => {
    try {
      const ordersRes = await apiGetProjectOrders(projectId);
      const orders = (ordersRes.orders ?? [])
        .filter((o) => o.status === "delivered" || o.status === "closed");

      if (orders.length === 0) {
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

      const orderItemsRes = await apiGetOrderItems(orders.map((o) => o.id));
      const orderItems = orderItemsRes.items ?? [];

      const receivedByQuotationItemId: Record<string, number> = {};
      orderItems.forEach((item) => {
        if (!item.quotation_item_id) return;
        const qty = item.quantity_received ?? 0;
        receivedByQuotationItemId[item.quotation_item_id] =
          (receivedByQuotationItemId[item.quotation_item_id] || 0) + qty;
      });

      const progress: MaterialDeliveryProgress[] = quotationItems.map((qItem) => {
        const receivedQty = receivedByQuotationItemId[qItem.id] || 0;
        const remainingQty = Math.max(0, qItem.quantity - receivedQty);
        const percentage =
          qItem.quantity > 0 ? Math.min(100, (receivedQty / qItem.quantity) * 100) : 0;

        return {
          quotationItemId: qItem.id,
          materialName: qItem.material_name,
          unit: qItem.unit,
          quotedQty: qItem.quantity,
          deliveredQty: receivedQty,
          remainingQty,
          percentage: Math.round(percentage * 10) / 10,
          isFullyDelivered: percentage >= 100,
        };
      });

      setMaterialProgress(progress);
    } catch (error) {
      console.error("Error fetching received materials:", error);
    }
  };

  const fetchQuotation = async () => {
    setLoading(true);
    try {

     
        const res = await apiGetQuotationByProject(projectId);
     console.log(res);
      
      console.log( 'ETOOOOOOOOOOOOO')
      if(res.id=="00000000-0000-0000-0000-000000000000")
        {
          
          setQuotation(null);
          setItems([{ id: crypto.randomUUID(), material_name: "", unit: "pcs", quantity: 0 }]);
          setNotes("");
          setIsEditMode(true);
          setMaterialProgress([]);
          setMaterialOrderUsage(new Map());
          setCreatorName("");
        }
        else
        {
          setQuotation({
            id: res.id,
            project_id: res.projectId,
            created_by: res.createdBy,
            created_at: res.createdAt,
            updated_at: res.updatedAt,
            notes: res.notes
          });
          console.log(quotation);
          setNotes(notes);
  
          setIsEditMode(false);
  
          setCreatorName(res.creatorName || "Unknown");
          setItems(res.items || []);
  
          await fetchDeliveredMaterials(res.items || []);
          await fetchMaterialOrderUsage(res.items || []);
        }
      // if (res.items) {
      //   setQuotation(res as unknown as Quotation);
      //   console.log(res);
        
      //   //const notes = (res?.notes ?? "") as string;

        
      //   // console.log(qt);
      //   // qt.notes = notes;
      //   // qt.id=res.id; res.
      //   // qt. project_id=res.project_id;
      //   // qt.created_by=res.created_by;
      //   // qt.created_at=res.created_at;
      //   // qt.updated_at=res.updated_at;
      //   // qt.notes=notes


      //   setQuotation({
      //     id: res.id,
      //     project_id: res.projectId,
      //     created_by: res.createdBy,
      //     created_at: res.createdAt,
      //     updated_at: res.updatedAt,
      //     notes: res.notes
      //   });
      //   console.log(quotation);
      //   setNotes(notes);

      //   setIsEditMode(false);

      //   setCreatorName(res.creatorName || "Unknown");
      //   setItems(res.items || []);

      //   await fetchDeliveredMaterials(res.items || []);
      //   await fetchMaterialOrderUsage(res.items || []);
      // } else {
      //   console.log("setIsEditMode",true);
      //   setQuotation(null);
      //   setItems([{ id: crypto.randomUUID(), material_name: "", unit: "pcs", quantity: 0 }]);
      //   setNotes("");
      //   setIsEditMode(true);
      //   setMaterialProgress([]);
      //   setMaterialOrderUsage(new Map());
      //   setCreatorName("");
      // }
    } catch (error: any) {
      console.log(error);

      
      toast({
        title: "Error",
        description: error?.message || "Failed to load quotation",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) fetchQuotation();
  }, [open, projectId]);

  const addItem = () => {
    console.log("addItem");
    setItems([...items, { id: crypto.randomUUID(), material_name: "", unit: "pcs", quantity: 0 }]);
  };

  const canDeleteMaterial = (itemId: string): boolean => {
    const usage = materialOrderUsage.get(itemId);
    return !usage?.isUsedInOrders;
  };

  const getMinimumAllowedQty = (itemId: string): number => {
    const usage = materialOrderUsage.get(itemId);
    return usage?.minimumAllowedQty || 0;
  };

  const removeItem = (id: string) => {
    if (items.length > 1) {
      if (!canDeleteMaterial(id)) {
        toast({
          title: "Cannot delete",
          description: "This material is already used in existing orders.",
          variant: "destructive",
        });
        return;
      }
      setItems(items.filter((item) => item.id !== id));
    }
  };

  const updateItem = (id: string, field: keyof QuotationItem, value: string | number) => {
    if (field === "material_name" && typeof value === "string") value = value.toUpperCase();

    if (field === "quantity" && typeof value === "number") {
      const minAllowed = getMinimumAllowedQty(id);
      if (value < minAllowed) {
        const usage = materialOrderUsage.get(id);
        toast({
          title: "Quantity adjusted",
          description: `Cannot set qty below already ordered/received amounts.\nOrdered: ${
            usage?.orderedQty || 0
          }\nReceived/Closed: ${usage?.receivedClosedQty || 0}\nMinimum allowed: ${minAllowed}`,
          variant: "destructive",
        });
        value = minAllowed;
      }
    }

    setItems(items.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  };

  const consolidateItems = (): QuotationItem[] => {
    const consolidated: Map<string, QuotationItem> = new Map();
    const mergedMaterials: string[] = [];

    items.forEach((item) => {
      const normalizedName = normalizeMaterialName(item.material_name);
      if (!normalizedName) return;

      if (consolidated.has(normalizedName)) {
        const existing = consolidated.get(normalizedName)!;
        existing.quantity += item.quantity || 0;
        mergedMaterials.push(normalizedName);
      } else {
        consolidated.set(normalizedName, { ...item, material_name: normalizedName });
      }
    });

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

    const consolidatedItems = consolidateItems();
    console.log("consolidatedItems", consolidatedItems);
    if (consolidatedItems.length === 0) {
      toast({
        title: "Validation Error",
        description: "At least one material item with a valid name is required",
        variant: "destructive",
      });
      return;
    }

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

    for (const item of consolidatedItems) {
      const minAllowed = getMinimumAllowedQty(item.id);
      if (item.quantity < minAllowed) {
        const usage = materialOrderUsage.get(item.id);
        toast({
          title: "Quantity Error",
          description: `${item.material_name}: Cannot set qty below ${minAllowed} (Ordered: ${
            usage?.orderedQty || 0
          }, Received: ${usage?.receivedClosedQty || 0})`,
          variant: "destructive",
        });
        return;
      }
    }

    setItems(consolidatedItems);
    setSaving(true);

    console.log("saving", consolidatedItems);

    try {
      const userName = user.fullName || user.email || "User";
      const roleName = user.roles?.[0] || "member";

      let quotationId = quotation?.id;

      if (quotationId) {
        await apiUpdateQuotation(quotationId, { notes: notes || null });
      } else {
        console.log("creating quotation");
        const created = await apiCreateQuotation(projectId, { notes: notes || null });
        quotationId = created.id;
      }

      // Replace/upsert items in ONE API call (recommended)
      await apiReplaceQuotationItems(projectId,notes,
        quotationId!,
        consolidatedItems.map((it) => ({
          id: quotation ? it.id : undefined, // optional; if your API generates IDs, omit on create
          material_name: normalizeMaterialName(it.material_name),
          unit: it.unit.trim(),
          quantity: it.quantity,
        })),
      );

      // Log + notify (keep your existing libs)
      await logActivity({
        action: quotation ? "update" : "create",
        tableName: "project_quotations",
        recordId: quotationId!,
        oldValues: null,
        newValues: {
          items_count: consolidatedItems.length,
          updated_by: userName,
          role: roleName,
        },
        userId: user.id,
      });

      await notifyProjectMembers({
        projectId,
        title: quotation ? "Quotation Updated" : "Quotation Created",
        message: `${userName} (${roleName}) ${quotation ? "updated" : "created"} the quotation for ${projectName} on ${formatManilaTime(
          new Date(),
        )}`,
        type: "project",
        referenceType: "project_quotations",
        referenceId: quotationId!,
        excludeUserId: user.id,
      });

      toast({ title: "Success", description: quotation ? "Quotation updated successfully" : "Quotation created successfully" });

      setIsEditMode(false);
      await fetchQuotation();
      onQuotationChange?.();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to save quotation",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEnterEditMode = () => setIsEditMode(true);

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
      const userName = user.fullName || user.email || "User";
      const roleName = user.roles?.[0] || "member";

      const quotationId = quotation.id;
      const itemsCount = items.length;

      await apiDeleteQuotation(quotationId);

      await logActivity({
        action: "delete",
        tableName: "project_quotations",
        recordId: quotationId,
        oldValues: { items_count: itemsCount },
        newValues: null,
        userId: user.id,
      });

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

      setShowDeleteConfirm(false);
      onOpenChange(false);
      onQuotationChange?.();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to delete quotation",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const getTotalProgress = () => {
    if (!materialProgress) return 0;
    const totalQuoted = materialProgress.reduce((sum, item) => sum + item.quotedQty, 0);
    const totalDelivered = materialProgress.reduce((sum, item) => sum + Math.min(item.deliveredQty, item.quotedQty), 0);
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

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">
                  Initial Quotation {isEditMode && <span className="text-destructive">*</span>}
                </Label>
              </div>

              <div className="space-y-2">
                {items.map((item) => {
                  const usage = materialOrderUsage.get(item.id);
                  const isUsedInOrders = usage?.isUsedInOrders || false;
                  const minAllowedQty = usage?.minimumAllowedQty || 0;

                  return (
                    <div key={item.id} className="space-y-1">
                      <div className="flex gap-2 items-center p-2 border rounded-lg bg-card">
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
                            min={minAllowedQty > 0 ? minAllowedQty : 1}
                            placeholder="Qty"
                            value={item.quantity || ""}
                            onChange={(e) => updateItem(item.id, "quantity", parseInt(e.target.value) || 0)}
                            disabled={!isEditMode}
                          />
                        </div>

                        {isEditMode && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => removeItem(item.id)}
                                    disabled={items.length === 1 || isUsedInOrders}
                                    className="shrink-0"
                                  >
                                    {isUsedInOrders ? (
                                      <Lock className="h-4 w-4 text-muted-foreground" />
                                    ) : (
                                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                                    )}
                                  </Button>
                                </span>
                              </TooltipTrigger>
                              {isUsedInOrders && (
                                <TooltipContent>
                                  <p>Cannot delete — this material is already used in existing orders.</p>
                                </TooltipContent>
                              )}
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>

                      {isEditMode && isUsedInOrders && minAllowedQty > 0 && (
                        <p className="text-xs text-muted-foreground pl-2">
                          Min qty: {minAllowedQty} (Ordered: {usage?.orderedQty || 0}, Received:{" "}
                          {usage?.receivedClosedQty || 0})
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              {isEditMode && (
                <Button type="button" variant="outline" size="sm" onClick={addItem} className="w-full">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Material
                </Button>
              )}
            </div>

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

            <div className="flex justify-between items-center gap-2 pt-4 border-t">
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
                <>
                  <div className="flex gap-3">
                    {quotation && canDelete && (
                      <Button variant="destructive" onClick={() => setShowDeleteConfirm(true)} tabIndex={1}>
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete Quotation
                      </Button>
                    )}
                    {quotation && canEdit && (
                      <Button onClick={handleEnterEditMode}>
                        <Pencil className="h-4 w-4 mr-1" />
                        Update Quotation
                      </Button>
                    )}
                  </div>
                  <Button variant="outline" onClick={() => onOpenChange(false)}>
                    Close
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </DialogContent>

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
