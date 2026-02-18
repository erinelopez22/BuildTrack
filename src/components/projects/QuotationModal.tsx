import { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import {
  Plus,
  Trash2,
  Loader2,
  Clock,
  Package,
  Pencil,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Lock,
  Upload,
  Download,
  ShieldCheck,
  ShieldAlert,
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
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
  duplicateError?: string;
}

interface Quotation {
  id: string;
  project_id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  notes: string | null;
  category: string;
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
  orderedQty: number;
  receivedClosedQty: number;
  minimumAllowedQty: number;
  isUsedInOrders: boolean;
}

interface ChangeRequest {
  id: string;
  change_type: string;
  status: string;
  payload: any;
  requested_by: string;
  created_at: string;
  quotation_id: string | null;
  requester_name?: string;
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
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [additionalQuotations, setAdditionalQuotations] = useState<Quotation[]>([]);
  const [additionalQuotationItems, setAdditionalQuotationItems] = useState<Map<string, QuotationItem[]>>(new Map());
  const [items, setItems] = useState<QuotationItem[]>([]);
  const [notes, setNotes] = useState("");
  const [isEditMode, setIsEditMode] = useState(false);
  const [creatorName, setCreatorName] = useState<string>("");
  const [canDelete, setCanDelete] = useState(false);
  const [isAdminUser, setIsAdminUser] = useState(false);

  // Category for new quotation
  const [editCategory, setEditCategory] = useState<"initial" | "additional">("initial");
  // Currently viewing quotation (for additional quotes)
  const [viewingQuotationId, setViewingQuotationId] = useState<string | null>(null);

  // Change requests
  const [pendingRequests, setPendingRequests] = useState<ChangeRequest[]>([]);

  const [materialProgress, setMaterialProgress] = useState<MaterialDeliveryProgress[]>();
  const [materialOrderUsage, setMaterialOrderUsage] = useState<Map<string, MaterialOrderUsage>>(new Map());

  const [skuCatalogue, setSkuCatalogue] = useState<{ id: string; name: string; unit: string; sku_code: string }[]>([]);
  const [activeAutocomplete, setActiveAutocomplete] = useState<string | null>(null);
  const [autocompleteFilter, setAutocompleteFilter] = useState("");

  useEffect(() => {
    const fetchSKUs = async () => {
      const { data } = await supabase
        .from("skus")
        .select("id, name, unit_of_measure, sku_code")
        .eq("is_active", true)
        .order("name");
      if (data) {
        setSkuCatalogue(data.map((s) => ({ id: s.id, name: s.name, unit: s.unit_of_measure, sku_code: s.sku_code })));
      }
    };
    if (open) fetchSKUs();
  }, [open]);

  // Check admin status and delete permission
  useEffect(() => {
    const checkPermissions = async () => {
      if (!user) {
        setCanDelete(false);
        setIsAdminUser(false);
        return;
      }

      const { data: userRoles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      const hasAdminRole = userRoles?.some(
        (r) => r.role === "admin" || r.role === "super_admin",
      );
      setIsAdminUser(!!hasAdminRole);

      if (hasAdminRole) {
        setCanDelete(true);
        return;
      }

      const { data: projectRole } = await supabase
        .from("project_members")
        .select("role")
        .eq("project_id", projectId)
        .eq("user_id", user.id)
        .maybeSingle();

      setCanDelete(projectRole?.role === "project_manager" || projectRole?.role === "site_lead" || projectRole?.role === "project_engineer");
    };

    if (open) {
      checkPermissions();
    }
  }, [open, user, projectId]);

  const fetchQuotation = async () => {
    setLoading(true);
    try {
      // Fetch all quotations for this project
      const { data: allQuotations, error: quotationError } = await supabase
        .from("project_quotations")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: true });

      if (quotationError) throw quotationError;

      const initialQuotation = allQuotations?.find((q) => q.category === "initial") || allQuotations?.[0] || null;
      const additionalQuotes = allQuotations?.filter((q) => q.category === "additional") || [];

      if (initialQuotation) {
        setQuotation(initialQuotation as Quotation);
        setAdditionalQuotations(additionalQuotes as Quotation[]);
        setNotes(initialQuotation.notes || "");
        setIsEditMode(false);

        const { data: profileData } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", initialQuotation.created_by)
          .maybeSingle();

        setCreatorName(profileData?.full_name || "Unknown");

        const { data: itemsData, error: itemsError } = await supabase
          .from("quotation_items")
          .select("*")
          .eq("quotation_id", initialQuotation.id)
          .order("created_at", { ascending: true });

        if (itemsError) throw itemsError;
        setItems(itemsData || []);

        // Fetch items for additional quotations
        const additionalItemsMap = new Map<string, QuotationItem[]>();
        for (const aq of additionalQuotes) {
          const { data: aqItems } = await supabase
            .from("quotation_items")
            .select("*")
            .eq("quotation_id", aq.id)
            .order("created_at", { ascending: true });
          additionalItemsMap.set(aq.id, aqItems || []);
        }
        setAdditionalQuotationItems(additionalItemsMap);

        await fetchDeliveredMaterials(initialQuotation.id, itemsData || []);
        await fetchMaterialOrderUsage(itemsData || []);
      } else {
        setQuotation(null);
        setAdditionalQuotations([]);
        setAdditionalQuotationItems(new Map());
        setItems([{ id: crypto.randomUUID(), material_name: "", unit: "pcs", quantity: 0 }]);
        setNotes("");
        setIsEditMode(true);
        setEditCategory("initial");
        setMaterialProgress([]);
        setMaterialOrderUsage(new Map());
      }

      // Fetch pending change requests
      await fetchChangeRequests();
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

  const fetchChangeRequests = async () => {
    const { data: requests } = await supabase
      .from("quotation_change_requests")
      .select("*")
      .eq("project_id", projectId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (requests && requests.length > 0) {
      // Fetch requester names
      const userIds = [...new Set(requests.map((r) => r.requested_by))];
      const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", userIds);
      const profileMap = new Map((profiles || []).map((p) => [p.id, p.full_name]));

      setPendingRequests(
        requests.map((r) => ({
          ...r,
          requester_name: profileMap.get(r.requested_by) || "Unknown",
        })),
      );
    } else {
      setPendingRequests([]);
    }
  };

  const fetchMaterialOrderUsage = async (quotationItems: QuotationItem[]) => {
    try {
      if (quotationItems.length === 0) {
        setMaterialOrderUsage(new Map());
        return;
      }

      const { data: orders, error: ordersError } = await supabase
        .from("orders")
        .select("id, status")
        .eq("project_id", projectId)
        .not("status", "eq", "cancelled");

      if (ordersError) throw ordersError;

      if (!orders || orders.length === 0) {
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
      const activeOrderIds = orders.filter((o) => o.status !== "delivered" && o.status !== "closed").map((o) => o.id);

      const { data: orderItems, error: itemsError } = await supabase
        .from("order_items")
        .select("quotation_item_id, quantity_ordered, quantity_received, order_id")
        .in(
          "order_id",
          orders.map((o) => o.id),
        );

      if (itemsError) throw itemsError;

      const usageMap = new Map<string, MaterialOrderUsage>();

      quotationItems.forEach((qItem) => {
        let orderedQty = 0;
        let receivedClosedQty = 0;
        let isUsedInOrders = false;

        orderItems?.forEach((oi) => {
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

  const fetchDeliveredMaterials = async (quotationId: string, quotationItems: QuotationItem[]) => {
    try {
      const { data: orders, error: ordersError } = await supabase
        .from("orders")
        .select("id, order_number, updated_at")
        .eq("project_id", projectId)
        .in("status", ["delivered", "closed"])
        .order("updated_at", { ascending: false });

      if (ordersError) throw ordersError;

      if (!orders || orders.length === 0) {
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

      const { data: orderItems, error: itemsError } = await supabase
        .from("order_items")
        .select("order_id, quotation_item_id, quantity_received")
        .in(
          "order_id",
          orders.map((o) => o.id),
        );

      if (itemsError) throw itemsError;

      const receivedByQuotationItemId: Record<string, number> = {};

      orderItems?.forEach((item: any) => {
        if (item.quotation_item_id) {
          const qty = item.quantity_received ?? 0;
          receivedByQuotationItemId[item.quotation_item_id] =
            (receivedByQuotationItemId[item.quotation_item_id] || 0) + qty;
        }
      });

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

  const normalizeMaterialName = (name: string): string => {
    return name.trim().toUpperCase();
  };

  useEffect(() => {
    if (!activeAutocomplete) return;
    const handler = () => setActiveAutocomplete(null);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [activeAutocomplete]);

  const addItem = () => {
    setItems([...items, { id: crypto.randomUUID(), material_name: "", unit: "pcs", quantity: 0 }]);
  };

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const XLSX = await import("xlsx");
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(sheet);

      const newItems: QuotationItem[] = rows
        .filter((row) => row["Material Name"] || row["material_name"] || row["MATERIAL NAME"])
        .map((row) => ({
          id: crypto.randomUUID(),
          material_name: (row["Material Name"] || row["material_name"] || row["MATERIAL NAME"] || "")
            .toString()
            .trim()
            .toUpperCase(),
          unit: (row["Unit"] || row["unit"] || row["UNIT"] || "pcs").toString().trim().toLowerCase(),
          quantity: parseInt(row["Qty"] || row["qty"] || row["QTY"] || row["Quantity"] || "0") || 0,
        }));

      if (newItems.length === 0) {
        toast({
          title: "No Data",
          description: "No valid rows found. Ensure headers: Material Name, Unit, Qty",
          variant: "destructive",
        });
        return;
      }

      setItems((prev) => {
        const filtered = prev.filter((i) => i.material_name.trim() !== "");
        return [...filtered, ...newItems];
      });
      toast({ title: "Imported", description: `${newItems.length} material(s) imported from Excel.` });
    } catch (err) {
      toast({ title: "Error", description: "Failed to parse Excel file.", variant: "destructive" });
    }
    e.target.value = "";
  };

  const handleDownloadTemplate = async () => {
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.aoa_to_sheet([
      ["Material Name", "Unit", "Qty"],
      ["SAMPLE MATERIAL", "pcs", 10],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "quotation_template.xlsx");
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
    if (field === "material_name" && typeof value === "string") {
      value = value.toUpperCase();
    }

    if (field === "quantity" && typeof value === "number") {
      const minAllowed = getMinimumAllowedQty(id);
      if (value < minAllowed) {
        const usage = materialOrderUsage.get(id);
        toast({
          title: "Quantity adjusted",
          description: `Cannot set qty below already ordered/received amounts.\nOrdered: ${usage?.orderedQty || 0}\nReceived/Closed: ${usage?.receivedClosedQty || 0}\nMinimum allowed: ${minAllowed}`,
          variant: "destructive",
        });
        value = minAllowed;
      }
    }

    setItems((prev) => {
      const updated = prev.map((item) =>
        item.id === id ? { ...item, [field]: value, duplicateError: undefined } : item,
      );

      if (field === "material_name" || field === "unit") {
        return updated.map((item) => {
          const normalizedName = normalizeMaterialName(item.material_name);
          if (!normalizedName) return { ...item, duplicateError: undefined };
          const normalizedUnit = item.unit.trim().toUpperCase();
          const isDuplicate = updated.some(
            (other) =>
              other.id !== item.id &&
              normalizeMaterialName(other.material_name) === normalizedName &&
              other.unit.trim().toUpperCase() === normalizedUnit,
          );
          return {
            ...item,
            duplicateError: isDuplicate ? "This material and unit is already added in the quotation." : undefined,
          };
        });
      }
      return updated;
    });
  };

  const consolidateItems = (): QuotationItem[] => {
    const consolidated: Map<string, QuotationItem> = new Map();
    const mergedMaterials: string[] = [];

    items.forEach((item) => {
      const normalizedName = normalizeMaterialName(item.material_name);
      if (!normalizedName) return;

      const key = `${normalizedName}||${item.unit.trim().toUpperCase()}`;

      if (consolidated.has(key)) {
        const existing = consolidated.get(key)!;
        existing.quantity += item.quantity || 0;
        mergedMaterials.push(normalizedName);
      } else {
        consolidated.set(key, {
          ...item,
          material_name: normalizedName,
        });
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

  // Create a change request instead of directly modifying
  const createChangeRequest = async (changeType: string, payload: any) => {
    if (!user) return;

    const { data: userProfile } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
    const userName = userProfile?.full_name || "User";

    const { error } = await supabase.from("quotation_change_requests").insert({
      project_id: projectId,
      quotation_id: quotation?.id || null,
      change_type: changeType,
      payload,
      requested_by: user.id,
    });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    // Log activity
    await logActivity({
      action: "change_request_created",
      tableName: "project_quotations",
      recordId: quotation?.id || projectId,
      oldValues: null,
      newValues: { change_type: changeType, requested_by: userName },
      userId: user.id,
    });

    // Notify project members + admins
    await notifyProjectMembers({
      projectId,
      title: "Quotation Change Request",
      message: `${userName} submitted a ${changeType} request for the quotation of ${projectName}. Awaiting admin approval.`,
      type: "project",
      referenceType: "quotation_change_request",
      referenceId: projectId,
      excludeUserId: user.id,
    });

    toast({
      title: "Change Request Submitted",
      description: "Your change request has been submitted for admin approval.",
    });

    setIsEditMode(false);
    fetchQuotation();
  };

  // Handle approve/reject change request (admin only)
  const handleReviewChangeRequest = async (requestId: string, action: "approved" | "rejected", remarks?: string) => {
    if (!user || !isAdminUser) return;

    const request = pendingRequests.find((r) => r.id === requestId);
    if (!request) return;

    const { data: userProfile } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
    const userName = userProfile?.full_name || "Admin";

    if (action === "approved") {
      // Apply the change
      const payload = request.payload as any;

      if (request.change_type === "create") {
        const { data: newQuotation, error: createError } = await supabase
          .from("project_quotations")
          .insert({
            project_id: projectId,
            created_by: request.requested_by,
            notes: payload.notes || null,
            category: payload.category || "initial",
          })
          .select()
          .single();

        if (createError) {
          toast({ title: "Error", description: createError.message, variant: "destructive" });
          return;
        }

        if (payload.items && payload.items.length > 0) {
          await supabase.from("quotation_items").insert(
            payload.items.map((item: any) => ({
              quotation_id: newQuotation.id,
              material_name: item.material_name,
              unit: item.unit,
              quantity: item.quantity,
            })),
          );
        }
      } else if (request.change_type === "update" && request.quotation_id) {
          // Create an "additional" quotation to preserve Initial vs Updates/Added separation
          const { data: additionalQuotation, error: addError } = await supabase
            .from("project_quotations")
            .insert({
              project_id: projectId,
              created_by: request.requested_by,
              notes: payload.notes || null,
              category: "additional",
            })
            .select()
            .single();

          if (addError) {
            toast({ title: "Error", description: addError.message, variant: "destructive" });
            return;
          }

          if (payload.items) {
            // Fetch existing initial items to determine deltas
            const { data: initialItems } = await supabase
              .from("quotation_items")
              .select("material_name, unit, quantity")
              .eq("quotation_id", request.quotation_id);

            const initialMap = new Map(
              (initialItems || []).map((i: any) => [
                `${i.material_name.toUpperCase()}||${i.unit.toLowerCase()}`,
                i.quantity,
              ])
            );

            const additionalItems = payload.items
              .map((item: any) => {
                const key = `${item.material_name.toUpperCase()}||${item.unit.toLowerCase()}`;
                const initialQty = initialMap.get(key);
                if (initialQty !== undefined) {
                  const delta = item.quantity - initialQty;
                  if (delta > 0) {
                    return {
                      quotation_id: additionalQuotation.id,
                      material_name: item.material_name,
                      unit: item.unit,
                      quantity: delta,
                    };
                  }
                  return null;
                }
                return {
                  quotation_id: additionalQuotation.id,
                  material_name: item.material_name,
                  unit: item.unit,
                  quantity: item.quantity,
                };
              })
              .filter(Boolean);

            if (additionalItems.length > 0) {
              await supabase.from("quotation_items").insert(additionalItems);
            }
          }

          // Update initial quotation's updated_at
          await supabase
            .from("project_quotations")
            .update({ updated_at: new Date().toISOString() })
            .eq("id", request.quotation_id);
        } else if (request.change_type === "delete" && request.quotation_id) {
          await supabase.from("quotation_items").delete().eq("quotation_id", request.quotation_id);
          await supabase.from("project_quotations").delete().eq("id", request.quotation_id);
        }
    }

    // Update the request status
    await supabase
      .from("quotation_change_requests")
      .update({
        status: action,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        review_remarks: remarks || null,
      })
      .eq("id", requestId);

    await logActivity({
      action: `change_request_${action}`,
      tableName: "project_quotations",
      recordId: request.quotation_id || projectId,
      oldValues: { status: "pending" },
      newValues: { status: action, reviewed_by: userName },
      userId: user.id,
    });

    await notifyProjectMembers({
      projectId,
      title: `Quotation Change ${action === "approved" ? "Approved" : "Rejected"}`,
      message: `${userName} ${action} the quotation ${request.change_type} request for ${projectName}`,
      type: "project",
      referenceType: "quotation_change_request",
      referenceId: requestId,
      excludeUserId: user.id,
    });

    toast({ title: "Success", description: `Change request ${action}.` });
    fetchQuotation();
    onQuotationChange?.();
  };

  const handleSave = async () => {
    if (!user) return;

    const consolidatedItems = consolidateItems();

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
          description: `${item.material_name}: Cannot set qty below ${minAllowed}`,
          variant: "destructive",
        });
        return;
      }
    }

    setItems(consolidatedItems);

    // Non-admin users: create change request instead
    if (!isAdminUser) {
      const payload = {
        items: consolidatedItems.map((i) => ({
          material_name: normalizeMaterialName(i.material_name),
          unit: i.unit.trim(),
          quantity: i.quantity,
        })),
        notes,
        category: editCategory,
      };

      if (quotation) {
        await createChangeRequest("update", payload);
      } else {
        await createChangeRequest("create", payload);
      }
      return;
    }

    // Admin: direct save
    setSaving(true);
    try {
      const { data: userProfile } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
      const userName = userProfile?.full_name || "User";
      const { data: userRole } = await supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
      const roleName = userRole?.role || "member";

      if (quotation) {
        const { error: updateError } = await supabase
          .from("project_quotations")
          .update({ notes, updated_at: new Date().toISOString() })
          .eq("id", quotation.id);

        if (updateError) throw updateError;

        const { data: existingItems } = await supabase
          .from("quotation_items")
          .select("id, material_name")
          .eq("quotation_id", quotation.id);

        const existingItemMap = new Map<string, string>();
        existingItems?.forEach((ei) => {
          existingItemMap.set(ei.material_name, ei.id);
        });

        for (const item of consolidatedItems) {
          const normalizedName = normalizeMaterialName(item.material_name);

          const existingId =
            item.id && existingItems?.find((ei) => ei.id === item.id) ? item.id : existingItemMap.get(normalizedName);

          if (existingId) {
            await supabase
              .from("quotation_items")
              .update({
                material_name: normalizedName,
                unit: item.unit.trim(),
                quantity: item.quantity,
                updated_at: new Date().toISOString(),
              })
              .eq("id", existingId);
          } else {
            await supabase.from("quotation_items").insert({
              quotation_id: quotation.id,
              material_name: normalizedName,
              unit: item.unit.trim(),
              quantity: item.quantity,
            });
          }
        }

        const consolidatedIds = consolidatedItems.map((ci) => ci.id);
        const consolidatedNames = consolidatedItems.map((ci) => normalizeMaterialName(ci.material_name));

        for (const existingItem of existingItems || []) {
          const isInConsolidated =
            consolidatedIds.includes(existingItem.id) || consolidatedNames.includes(existingItem.material_name);

          if (!isInConsolidated) {
            const usage = materialOrderUsage.get(existingItem.id);
            if (!usage?.isUsedInOrders) {
              await supabase.from("quotation_items").delete().eq("id", existingItem.id);
            }
          }
        }

        await logActivity({
          action: "update",
          tableName: "project_quotations",
          recordId: quotation.id,
          oldValues: null,
          newValues: { items_count: consolidatedItems.length, updated_by: userName, role: roleName },
          userId: user.id,
        });

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
        const { data: newQuotation, error: createError } = await supabase
          .from("project_quotations")
          .insert({
            project_id: projectId,
            created_by: user.id,
            notes,
            category: editCategory,
          })
          .select()
          .single();

        if (createError) throw createError;

        const { error: itemsError } = await supabase.from("quotation_items").insert(
          consolidatedItems.map((item) => ({
            quotation_id: newQuotation.id,
            material_name: normalizeMaterialName(item.material_name),
            unit: item.unit.trim(),
            quantity: item.quantity,
          })),
        );

        if (itemsError) throw itemsError;

        await logActivity({
          action: "create",
          tableName: "project_quotations",
          recordId: newQuotation.id,
          oldValues: null,
          newValues: {
            items_count: consolidatedItems.length,
            created_by: userName,
            role: roleName,
            category: editCategory,
          },
          userId: user.id,
        });

        await notifyProjectMembers({
          projectId,
          title: "Quotation Created",
          message: `${userName} (${roleName}) created a ${editCategory} quotation for ${projectName} on ${formatManilaTime(new Date())}`,
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
      toast({ title: "Error", description: error.message || "Failed to save quotation", variant: "destructive" });
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

    // Non-admin: create change request
    if (!isAdminUser) {
      await createChangeRequest("delete", { quotation_id: quotation.id });
      setShowDeleteConfirm(false);
      return;
    }

    setDeleting(true);
    try {
      const { data: userProfile } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
      const userName = userProfile?.full_name || "User";
      const { data: userRole } = await supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
      const roleName = userRole?.role || "member";

      const quotationId = quotation.id;
      const itemsCount = items.length;

      const { error: deleteItemsError } = await supabase
        .from("quotation_items")
        .delete()
        .eq("quotation_id", quotationId);

      if (deleteItemsError) throw deleteItemsError;

      const { error: deleteQuotationError } = await supabase.from("project_quotations").delete().eq("id", quotationId);

      if (deleteQuotationError) throw deleteQuotationError;

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

      toast({ title: "Quotation Deleted", description: "The quotation has been permanently deleted" });

      setShowDeleteConfirm(false);
      onOpenChange(false);
      onQuotationChange?.();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to delete quotation", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  // Start adding an additional quotation
  const handleAddAdditionalQuote = () => {
    setEditCategory("additional");
    setQuotation(null); // Temporarily clear so we go into create mode
    setItems([{ id: crypto.randomUUID(), material_name: "", unit: "pcs", quantity: 0 }]);
    setNotes("");
    setIsEditMode(true);
  };

  const getTotalProgress = () => {
    if (!materialProgress) return 0;
    const totalQuoted = materialProgress.reduce((sum, item) => sum + item.quotedQty, 0);
    const totalDelivered = materialProgress.reduce((sum, item) => {
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
            {!quotation && !isEditMode ? "Add Quotation" : isEditMode ? "Update Quotation" : "View Quotation"} -{" "}
            {projectName}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Pending Change Requests (Admin view) */}
            {isAdminUser && pendingRequests.length > 0 && (
              <div className="space-y-3 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-medium">
                  <ShieldAlert className="h-5 w-5" />
                  Pending Change Requests ({pendingRequests.length})
                </div>
                {pendingRequests.map((req) => (
                  <div key={req.id} className="p-3 bg-background rounded border space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <Badge variant="outline" className="capitalize">
                          {req.change_type}
                        </Badge>
                        <span className="text-sm ml-2">by {req.requester_name}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{formatManilaTime(req.created_at)}</span>
                    </div>
                    {req.payload?.items && (
                      <p className="text-xs text-muted-foreground">{(req.payload as any).items.length} material(s)</p>
                    )}
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleReviewChangeRequest(req.id, "approved")}>
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleReviewChangeRequest(req.id, "rejected")}
                      >
                        <AlertTriangle className="h-3.5 w-3.5 mr-1" /> Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Non-admin info */}
            {!isAdminUser && canEdit && quotation && !isEditMode && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
                <ShieldCheck className="h-4 w-4 flex-shrink-0" />
                Changes will require Admin/Super Admin approval before taking effect.
              </div>
            )}

            {/* Metadata */}
            {quotation && !isEditMode && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  <span>Created: {format(new Date(quotation.created_at), "MMM dd, yyyy h:mm a")}</span>
                </div>
                <span className="hidden sm:inline">•</span>
                <span>By: {creatorName}</span>
                <span className="hidden sm:inline">•</span>
                <Badge variant="outline" className="capitalize w-fit">
                  {quotation.category || "initial"}
                </Badge>
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

            {/* Initial Materials Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">
                  Initial Materials {isEditMode && <span className="text-destructive">*</span>}
                </Label>
              </div>

              <div className="space-y-2">
                {items.map((item, index) => {
                  const usage = materialOrderUsage.get(item.id);
                  const isUsedInOrders = usage?.isUsedInOrders || false;
                  const minAllowedQty = usage?.minimumAllowedQty || 0;

                  return (
                    <div key={item.id} className="space-y-1">
                      <div className="flex gap-2 items-center p-2 border rounded-lg bg-card">
                        <div className="flex-1 relative">
                          {isEditMode ? (
                            <div className="relative">
                              <Input
                                placeholder="Search or type material..."
                                value={item.material_name}
                                onChange={(e) => {
                                  updateItem(item.id, "material_name", e.target.value);
                                  setActiveAutocomplete(item.id);
                                  setAutocompleteFilter(e.target.value.toUpperCase());
                                }}
                                onFocus={() => {
                                  setActiveAutocomplete(item.id);
                                  setAutocompleteFilter(item.material_name);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Escape") {
                                    setActiveAutocomplete(null);
                                  }
                                }}
                                onPaste={(e) => {
                                  e.preventDefault();
                                  const pasted = e.clipboardData.getData("text").toUpperCase();
                                  updateItem(item.id, "material_name", pasted);
                                  setActiveAutocomplete(item.id);
                                  setAutocompleteFilter(pasted);
                                }}
                                className="h-9 text-sm uppercase"
                                style={{ textTransform: "uppercase" }}
                                autoComplete="off"
                              />
                              {activeAutocomplete === item.id &&
                                (() => {
                                  const filter = autocompleteFilter.trim().toUpperCase();
                                  const filtered = skuCatalogue.filter(
                                    (sku) =>
                                      !filter ||
                                      sku.name.toUpperCase().includes(filter) ||
                                      sku.sku_code.toUpperCase().includes(filter),
                                  );
                                  if (filtered.length === 0) return null;
                                  return (
                                    <div className="absolute z-50 top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-md border bg-popover shadow-md">
                                      {filtered.map((sku) => (
                                        <button
                                          key={sku.id}
                                          type="button"
                                          className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex flex-col"
                                          onMouseDown={(e) => {
                                            e.preventDefault();
                                            updateItem(item.id, "material_name", sku.name);
                                            updateItem(item.id, "unit", sku.unit);
                                            setActiveAutocomplete(null);
                                          }}
                                        >
                                          <span className="font-medium">{sku.name}</span>
                                          <span className="text-xs text-muted-foreground">
                                            {sku.sku_code} • {sku.unit}
                                          </span>
                                        </button>
                                      ))}
                                    </div>
                                  );
                                })()}
                              {item.duplicateError && (
                                <p className="text-xs text-destructive mt-0.5">{item.duplicateError}</p>
                              )}
                            </div>
                          ) : (
                            <Input
                              placeholder="Material name"
                              value={item.material_name}
                              disabled
                              className="uppercase"
                            />
                          )}
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
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={addItem} className="flex-1">
                    <Plus className="h-4 w-4 mr-1" />
                    Add Material
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById("excel-upload")?.click()}
                  >
                    <Upload className="h-4 w-4 mr-1" />
                    Upload Excel
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={handleDownloadTemplate}>
                    <Download className="h-4 w-4 mr-1" />
                    Template
                  </Button>
                  <input
                    id="excel-upload"
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={handleExcelUpload}
                  />
                </div>
              )}
            </div>

            {/* Additional / Updated Materials Section (from approved change requests) */}
            {isViewMode && additionalQuotations.length > 0 && (
              <div className="space-y-3 p-4 border rounded-lg bg-accent/5 border-accent/20">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Package className="h-4 w-4 text-accent-foreground" />
                  Updates / Added Materials
                </Label>
                <p className="text-xs text-muted-foreground">
                  Materials added or modified after the initial quotation.
                </p>
                {additionalQuotations.map((aq) => {
                  const aqItems = additionalQuotationItems.get(aq.id) || [];
                  if (aqItems.length === 0) return null;
                  return (
                    <div key={aq.id} className="border rounded-lg overflow-hidden">
                      <div className="bg-muted/30 px-3 py-2 text-xs text-muted-foreground flex justify-between">
                        <span>Added: {formatManilaTime(aq.created_at)}</span>
                        {aq.notes && <span className="italic">{aq.notes}</span>}
                      </div>
                      <table className="w-full text-sm">
                        <tbody>
                          {aqItems.map((item) => {
                            const existsInInitial = items.some(
                              (vi) =>
                                vi.material_name.toUpperCase() === item.material_name.toUpperCase() &&
                                vi.unit.toLowerCase() === item.unit.toLowerCase(),
                            );
                            return (
                              <tr key={item.id} className="border-t">
                                <td className="p-3 uppercase">
                                  <div className="flex items-center gap-2">
                                    {item.material_name}
                                    <Badge variant="outline" className="text-[10px]">
                                      {existsInInitial ? "Updated" : "Added"}
                                    </Badge>
                                  </div>
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
                  );
                })}

                {/* System totals */}
                {(() => {
                  const totals = new Map<string, { name: string; unit: string; qty: number }>();
                  items.forEach((i) => {
                    const key = `${i.material_name.toUpperCase()}||${i.unit.toLowerCase()}`;
                    totals.set(key, { name: i.material_name, unit: i.unit, qty: i.quantity });
                  });
                  additionalQuotations.forEach((aq) => {
                    const aqItems = additionalQuotationItems.get(aq.id) || [];
                    aqItems.forEach((i) => {
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
                            <span className="uppercase">
                              {t.name} ({t.unit})
                            </span>
                            <span className="font-semibold">{t.qty}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
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
                  <Button variant="outline" onClick={handleCancelEdit}>
                    Cancel
                  </Button>
                  <Button onClick={handleSave} disabled={saving}>
                    {saving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : !isAdminUser ? (
                      "Submit for Approval"
                    ) : quotation ? (
                      "Save Changes"
                    ) : (
                      "Create Quotation"
                    )}
                  </Button>
                </>
              ) : (
                <>
                  <div className="flex gap-3 flex-wrap">
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
              {!isAdminUser && (
                <p className="font-medium text-amber-600">This will submit a deletion request for admin approval.</p>
              )}
              {isAdminUser && (
                <p className="font-medium text-destructive">
                  This action cannot be undone and will affect project progress tracking.
                </p>
              )}
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
                  {isAdminUser ? "Deleting..." : "Submitting..."}
                </>
              ) : isAdminUser ? (
                "OK"
              ) : (
                "Submit Request"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
