import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { logActivity } from "@/lib/activityLogger";
import { notifyProjectMembers, formatManilaTime } from "@/lib/notificationService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
  Loader2,
  X,
  Upload,
  Truck,
  Check,
  Trash2,
  Plus,
  Package,
  ChevronDown,
  ChevronRight,
  MapPin,
  PauseCircle,
  CheckCircle2,
  Clock,
  AlertTriangle,
} from "lucide-react";

interface Driver {
  id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
}

interface MaterialAssignment {
  order_item_id: string;
  material_name: string;
  unit: string;
  assigned_quantity: number;
  max_quantity: number;
}

interface DriverAssignment {
  id?: string;
  driver_user_id: string;
  driver: Driver;
  plate_number: string;
  tracking_reference: string;
  notes: string;
  evidence: EvidenceFile[];
  materials: MaterialAssignment[];
  created_by?: string;
  created_at?: string;
  creator?: Driver;
  isNew?: boolean;
  isEditing?: boolean;
  // Per-driver status fields
  tracking_status: string; // 'on_transit' | 'arrived' | 'on_hold'
  arrived_at?: string | null;
  hold_remarks?: string | null;
  held_at?: string | null;
  resumed_at?: string | null;
  resume_remarks?: string | null;
}

interface EvidenceFile {
  id?: string;
  file_url: string;
  file_name: string;
  file?: File;
  isUploading?: boolean;
  uploaded_by?: string;
  uploaded_at?: string;
}

interface ReceiverEvidenceFile {
  id: string;
  file_url: string;
  file_name: string;
  uploaded_by: string;
  uploaded_at: string;
  remarks?: string;
}

interface OrderItemInfo {
  id: string;
  sku_name: string;
  unit: string;
  quantity_ordered: number;
}

interface TrackingAssignmentSectionProps {
  orderId: string;
  projectId: string;
  status: string;
  onValidationChange?: (isValid: boolean) => void;
  onAssignmentsLoaded?: (hasAssignments: boolean) => void;
  onAllDriversArrived?: (allArrived: boolean) => void;
  readOnly?: boolean;
}

export function TrackingAssignmentSection({
  orderId,
  projectId,
  status,
  onValidationChange,
  onAssignmentsLoaded,
  onAllDriversArrived,
  readOnly = false,
}: TrackingAssignmentSectionProps) {
  const { user, isSuperAdmin, isAdmin, canProcessLogistics, canReceiveOrders } = useAuth();
  const { toast } = useToast();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [assignments, setAssignments] = useState<DriverAssignment[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItemInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  const [driverSearchOpen, setDriverSearchOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [holdDialogDriverId, setHoldDialogDriverId] = useState<string | null>(null);
  const [holdRemarks, setHoldRemarks] = useState("");
  const [resumeDialogDriverId, setResumeDialogDriverId] = useState<string | null>(null);
  const [resumeRemarks, setResumeRemarks] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [receiverEvidence, setReceiverEvidence] = useState<Record<string, ReceiverEvidenceFile[]>>({});
  const [trackingRemarksMap, setTrackingRemarksMap] = useState<Record<string, string>>({});
  const [remarksSaving, setRemarksSaving] = useState<string | null>(null);
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  const canEdit = !readOnly && (isSuperAdmin() || isAdmin() || canProcessLogistics());
  const canDoDriverActions = isSuperAdmin() || isAdmin() || canProcessLogistics() || canReceiveOrders();
  const isPreparing = status === "preparing";
  const isInTransit = status === "in_transit";
  const isDelivered = status === "delivered";

  useEffect(() => {
    fetchData();
  }, [orderId]);

  useEffect(() => {
    const isValid =
      assignments.length > 0 &&
      assignments.every((a) => a.plate_number.trim() !== "" && a.evidence.length > 0) &&
      hasSaved;
    onValidationChange?.(isValid);
  }, [assignments, hasSaved, onValidationChange]);

  useEffect(() => {
    if (assignments.length > 0) {
      const allArrived = assignments.every((a) => a.tracking_status === "arrived");
      onAllDriversArrived?.(allArrived);
    } else {
      onAllDriversArrived?.(false);
    }
  }, [assignments, onAllDriversArrived]);

  const fetchData = async () => {
    setLoading(true);

    const { data: items } = await supabase
      .from("order_items")
      .select("id, quantity_ordered, skus(name, unit_of_measure)")
      .eq("order_id", orderId);

    if (items) {
      setOrderItems(
        items.map((item: any) => ({
          id: item.id,
          sku_name: item.skus?.name || "Unknown",
          unit: item.skus?.unit_of_measure || "pcs",
          quantity_ordered: item.quantity_ordered,
        }))
      );
    }

    const { data: driverRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "tracking_driver");

    if (driverRoles && driverRoles.length > 0) {
      const driverIds = driverRoles.map((r) => r.user_id);
      const { data: driverProfiles } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone")
        .in("id", driverIds);

      if (driverProfiles) {
        setDrivers(driverProfiles);
      }
    }

    const { data: existingAssignments } = await supabase
      .from("order_tracking_assignments")
      .select("*")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true });

    if (existingAssignments && existingAssignments.length > 0) {
      const driverIds = existingAssignments.map((a) => a.driver_user_id);
      const creatorIds = existingAssignments.map((a) => a.created_by).filter(Boolean);
      const allProfileIds = [...new Set([...driverIds, ...creatorIds])];

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone")
        .in("id", allProfileIds);

      const profileMap = new Map((profiles || []).map((d) => [d.id, d]));

      const assignmentIds = existingAssignments.map((a) => a.id);
      const { data: evidenceData } = await supabase
        .from("order_tracking_evidence")
        .select("*")
        .in("order_tracking_assignment_id", assignmentIds);

      const evidenceMap = new Map<string, EvidenceFile[]>();
      (evidenceData || []).forEach((e) => {
        const list = evidenceMap.get(e.order_tracking_assignment_id) || [];
        list.push({
          id: e.id,
          file_url: e.file_url,
          file_name: e.file_name,
          uploaded_by: e.uploaded_by,
          uploaded_at: e.uploaded_at,
        });
        evidenceMap.set(e.order_tracking_assignment_id, list);
      });

      const { data: materialData } = await supabase
        .from("tracking_driver_materials")
        .select("*")
        .in("tracking_assignment_id", assignmentIds);

      const materialMap = new Map<string, MaterialAssignment[]>();
      (materialData || []).forEach((m: any) => {
        const list = materialMap.get(m.tracking_assignment_id) || [];
        const orderItem = items?.find((i: any) => i.id === m.order_item_id);
        list.push({
          order_item_id: m.order_item_id,
          material_name: orderItem?.skus?.name || "Unknown",
          unit: orderItem?.skus?.unit_of_measure || "pcs",
          assigned_quantity: m.assigned_quantity,
          max_quantity: orderItem?.quantity_ordered || 0,
        });
        materialMap.set(m.tracking_assignment_id, list);
      });

      const loadedAssignments: DriverAssignment[] = existingAssignments.map((a: any) => ({
        id: a.id,
        driver_user_id: a.driver_user_id,
        driver: profileMap.get(a.driver_user_id) || {
          id: a.driver_user_id,
          full_name: null,
          email: "Unknown",
          phone: null,
        },
        plate_number: a.plate_number,
        tracking_reference: "",
        notes: "",
        evidence: evidenceMap.get(a.id) || [],
        materials: materialMap.get(a.id) || [],
        created_by: a.created_by,
        created_at: a.created_at,
        creator: a.created_by ? profileMap.get(a.created_by) : undefined,
        tracking_status: a.tracking_status || "on_transit",
        arrived_at: a.arrived_at,
        hold_remarks: a.hold_remarks,
        held_at: a.held_at,
        resumed_at: a.resumed_at,
        resume_remarks: a.resume_remarks,
      }));

      setAssignments(loadedAssignments);
      // Initialize remarks map
      const remarksInit: Record<string, string> = {};
      existingAssignments.forEach((a: any) => {
        if (a.id && a.tracking_remarks) remarksInit[a.id] = a.tracking_remarks;
      });
      setTrackingRemarksMap(remarksInit);
      setHasSaved(true);
      onAssignmentsLoaded?.(true);

      // Fetch receiver evidence separately
      const { data: recEvData } = await supabase
        .from("receiver_evidence")
        .select("*")
        .in("order_tracking_assignment_id", assignmentIds);

      const recEvMap: Record<string, ReceiverEvidenceFile[]> = {};
      (recEvData || []).forEach((re: any) => {
        const list = recEvMap[re.order_tracking_assignment_id] || [];
        list.push({
          id: re.id,
          file_url: re.file_url,
          file_name: re.file_name,
          uploaded_by: re.uploaded_by,
          uploaded_at: re.uploaded_at,
          remarks: re.remarks,
        });
        recEvMap[re.order_tracking_assignment_id] = list;
      });
      setReceiverEvidence(recEvMap);
    } else {
      onAssignmentsLoaded?.(false);
    }

    setLoading(false);
  };

  const getRemainingQuantity = (orderItemId: string, excludeDriverUserId?: string) => {
    const orderItem = orderItems.find((i) => i.id === orderItemId);
    if (!orderItem) return 0;

    const totalAssigned = assignments.reduce((sum, a) => {
      if (excludeDriverUserId && a.driver_user_id === excludeDriverUserId) return sum;
      const mat = a.materials.find((m) => m.order_item_id === orderItemId);
      return sum + (mat?.assigned_quantity || 0);
    }, 0);

    return Math.max(0, orderItem.quantity_ordered - totalAssigned);
  };

  const handleAddDriver = (driver: Driver) => {
    if (assignments.some((a) => a.driver_user_id === driver.id)) {
      toast({
        title: "Already Assigned",
        description: `${driver.full_name || driver.email} is already assigned.`,
        variant: "destructive",
      });
      return;
    }

    setAssignments((prev) => [
      ...prev,
      {
        driver_user_id: driver.id,
        driver,
        plate_number: "",
        tracking_reference: "",
        notes: "",
        evidence: [],
        materials: [],
        isNew: true,
        isEditing: true,
        tracking_status: "on_transit",
      },
    ]);
    setHasSaved(false);
    setDriverSearchOpen(false);
    setIsExpanded(true);
  };

  const handleRemoveDriver = async (driverUserId: string) => {
    const assignment = assignments.find((a) => a.driver_user_id === driverUserId);

    if (assignment?.id && !assignment.isNew) {
      const { error } = await supabase
        .from("order_tracking_assignments")
        .delete()
        .eq("id", assignment.id);

      if (error) {
        toast({ title: "Error", description: "Failed to remove driver assignment", variant: "destructive" });
        return;
      }

      await logActivity({
        action: "tracking_removed",
        tableName: "orders",
        recordId: orderId,
        oldValues: { driver_name: assignment.driver.full_name || assignment.driver.email, plate_number: assignment.plate_number },
        newValues: null,
        userId: user?.id,
      });

      await notifyProjectMembers({
        projectId,
        title: "Driver Assignment Removed",
        message: `Driver ${assignment.driver.full_name || assignment.driver.email} was removed from tracking`,
        type: "order",
        referenceType: "order",
        referenceId: orderId,
        excludeUserId: user?.id,
      });
    }

    setAssignments((prev) => prev.filter((a) => a.driver_user_id !== driverUserId));
    setHasSaved(false);
  };

  const handleFieldChange = (driverUserId: string, field: keyof DriverAssignment, value: string) => {
    setAssignments((prev) =>
      prev.map((a) =>
        a.driver_user_id === driverUserId ? { ...a, [field]: value } : a
      )
    );
    setHasSaved(false);
  };

  const handleAddMaterial = (driverUserId: string, orderItemId: string) => {
    const orderItem = orderItems.find((i) => i.id === orderItemId);
    if (!orderItem) return;

    const remaining = getRemainingQuantity(orderItemId);
    if (remaining <= 0) {
      toast({ title: "No Remaining", description: "All quantity has been assigned.", variant: "destructive" });
      return;
    }

    setAssignments((prev) =>
      prev.map((a) => {
        if (a.driver_user_id !== driverUserId) return a;
        if (a.materials.some((m) => m.order_item_id === orderItemId)) return a;
        return {
          ...a,
          materials: [
            ...a.materials,
            {
              order_item_id: orderItemId,
              material_name: orderItem.sku_name,
              unit: orderItem.unit,
              assigned_quantity: 1,
              max_quantity: orderItem.quantity_ordered,
            },
          ],
        };
      })
    );
    setHasSaved(false);
  };

  const handleRemoveMaterial = (driverUserId: string, orderItemId: string) => {
    setAssignments((prev) =>
      prev.map((a) => {
        if (a.driver_user_id !== driverUserId) return a;
        return { ...a, materials: a.materials.filter((m) => m.order_item_id !== orderItemId) };
      })
    );
    setHasSaved(false);
  };

  const handleMaterialQuantityChange = (driverUserId: string, orderItemId: string, qty: number) => {
    const remaining = getRemainingQuantity(orderItemId, driverUserId);
    const clampedQty = Math.max(1, Math.min(qty, remaining));

    setAssignments((prev) =>
      prev.map((a) => {
        if (a.driver_user_id !== driverUserId) return a;
        return {
          ...a,
          materials: a.materials.map((m) =>
            m.order_item_id === orderItemId ? { ...m, assigned_quantity: clampedQty } : m
          ),
        };
      })
    );
    setHasSaved(false);
  };

  const handleFileSelect = async (driverUserId: string, files: FileList | null) => {
    if (!files || !user) return;

    const newEvidence: EvidenceFile[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
        toast({ title: "Invalid File", description: "Only image files are allowed.", variant: "destructive" });
        continue;
      }
      newEvidence.push({ file_url: URL.createObjectURL(file), file_name: file.name, file, isUploading: true });
    }

    setAssignments((prev) =>
      prev.map((a) =>
        a.driver_user_id === driverUserId ? { ...a, evidence: [...a.evidence, ...newEvidence] } : a
      )
    );
  };

  const handleRemoveEvidence = (driverUserId: string, index: number) => {
    setAssignments((prev) =>
      prev.map((a) =>
        a.driver_user_id === driverUserId
          ? { ...a, evidence: a.evidence.filter((_, i) => i !== index) }
          : a
      )
    );
  };

  // === PER-DRIVER ACTIONS (On Transit page) ===

  // Upload evidence file immediately (for On Transit stage)
  const handleInTransitEvidenceUpload = async (assignmentId: string, driverUserId: string, files: FileList | null) => {
    if (!files || !user || !assignmentId) return;

    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) {
        toast({ title: "Invalid File", description: "Only image files are allowed.", variant: "destructive" });
        continue;
      }

      const fileExt = file.name.split(".").pop();
      const fileName = `${orderId}/${assignmentId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("tracking-evidence")
        .upload(fileName, file);

      if (uploadError) {
        toast({ title: "Upload Error", description: uploadError.message, variant: "destructive" });
        continue;
      }

      const { data: urlData } = supabase.storage
        .from("tracking-evidence")
        .getPublicUrl(fileName);

      const { error: evidenceError } = await supabase
        .from("order_tracking_evidence")
        .insert({
          order_tracking_assignment_id: assignmentId,
          file_url: urlData.publicUrl,
          file_name: file.name,
          uploaded_by: user.id,
        });

      if (evidenceError) {
        toast({ title: "Error", description: evidenceError.message, variant: "destructive" });
        continue;
      }

      // Update local state
      setAssignments((prev) =>
        prev.map((a) =>
          a.driver_user_id === driverUserId
            ? {
                ...a,
                evidence: [
                  ...a.evidence,
                  { file_url: urlData.publicUrl, file_name: file.name, uploaded_by: user.id, uploaded_at: new Date().toISOString() },
                ],
              }
            : a
        )
      );
    }

    toast({ title: "Uploaded", description: "Evidence photo uploaded successfully." });
  };

  // Upload receiver's evidence (separate from preparing evidence)
  const handleReceiverEvidenceUpload = async (assignmentId: string, files: FileList | null) => {
    if (!files || !user || !assignmentId) return;

    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) {
        toast({ title: "Invalid File", description: "Only image files are allowed.", variant: "destructive" });
        continue;
      }

      const fileExt = file.name.split(".").pop();
      const fileName = `${orderId}/receiver/${assignmentId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("tracking-evidence")
        .upload(fileName, file);

      if (uploadError) {
        toast({ title: "Upload Error", description: uploadError.message, variant: "destructive" });
        continue;
      }

      const { data: urlData } = supabase.storage
        .from("tracking-evidence")
        .getPublicUrl(fileName);

      const { data: inserted, error: insertError } = await supabase
        .from("receiver_evidence")
        .insert({
          order_tracking_assignment_id: assignmentId,
          file_url: urlData.publicUrl,
          file_name: file.name,
          uploaded_by: user.id,
        })
        .select()
        .single();

      if (insertError) {
        toast({ title: "Error", description: insertError.message, variant: "destructive" });
        continue;
      }

      // Update local state
      setReceiverEvidence((prev) => ({
        ...prev,
        [assignmentId]: [
          ...(prev[assignmentId] || []),
          {
            id: inserted.id,
            file_url: urlData.publicUrl,
            file_name: file.name,
            uploaded_by: user.id,
            uploaded_at: new Date().toISOString(),
          },
        ],
      }));
    }

    await logActivity({
      action: "receiver_evidence_uploaded",
      tableName: "orders",
      recordId: orderId,
      oldValues: null,
      newValues: { assignment_id: assignmentId, uploaded_by: user.id },
      userId: user.id,
    });

    await notifyProjectMembers({
      projectId,
      title: "Receiver Evidence Uploaded",
      message: `Receiver evidence has been uploaded for order tracking`,
      type: "order",
      referenceType: "order",
      referenceId: orderId,
      excludeUserId: user.id,
    });

    toast({ title: "Uploaded", description: "Receiver's evidence uploaded successfully." });
  };

  // Remove receiver evidence
  const handleRemoveReceiverEvidence = async (assignmentId: string, evidenceId: string, fileName: string) => {
    if (!user) return;

    // Block deletion for delivered orders
    if (status === "delivered") {
      toast({ title: "Locked", description: "Evidence cannot be removed from delivered orders.", variant: "destructive" });
      return;
    }

    // Check permission: uploader, super admin, admin, or logistics admin
    const canRemove = isSuperAdmin() || isAdmin() || canProcessLogistics();
    const ev = (receiverEvidence[assignmentId] || []).find((e) => e.id === evidenceId);
    if (!canRemove && ev?.uploaded_by !== user.id) {
      toast({ title: "Permission Denied", description: "Only the uploader, Admin, or Tracking Admin can remove evidence.", variant: "destructive" });
      return;
    }

    // Delete from DB
    const { error } = await supabase.from("receiver_evidence").delete().eq("id", evidenceId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    // Try deleting from storage (best effort)
    try {
      const urlParts = ev?.file_url?.split("/tracking-evidence/");
      if (urlParts && urlParts[1]) {
        await supabase.storage.from("tracking-evidence").remove([decodeURIComponent(urlParts[1])]);
      }
    } catch {}

    // Update local state
    setReceiverEvidence((prev) => ({
      ...prev,
      [assignmentId]: (prev[assignmentId] || []).filter((e) => e.id !== evidenceId),
    }));

    await logActivity({
      action: "receiver_evidence_removed",
      tableName: "orders",
      recordId: orderId,
      oldValues: { file_name: fileName, assignment_id: assignmentId },
      newValues: null,
      userId: user.id,
    });

    await notifyProjectMembers({
      projectId,
      title: "Receiver Evidence Removed",
      message: `Receiver evidence "${fileName}" has been removed`,
      type: "order",
      referenceType: "order",
      referenceId: orderId,
      excludeUserId: user.id,
    });

    toast({ title: "Removed", description: "Receiver evidence removed." });
  };

  // Remove preparing evidence (saved evidence with id)
  const handleRemovePreparingEvidence = async (assignmentId: string, evidenceId: string, driverUserId: string, fileName: string) => {
    if (!user) return;

    // Block deletion for delivered orders
    if (status === "delivered") {
      toast({ title: "Locked", description: "Evidence cannot be removed from delivered orders.", variant: "destructive" });
      return;
    }

    const canRemove = isSuperAdmin() || isAdmin() || canProcessLogistics();
    if (!canRemove) {
      toast({ title: "Permission Denied", description: "Only Admin or Tracking Admin can remove evidence.", variant: "destructive" });
      return;
    }

    // Delete from DB
    const { error } = await supabase.from("order_tracking_evidence").delete().eq("id", evidenceId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    // Try deleting from storage (best effort)
    const ev = assignments.find((a) => a.driver_user_id === driverUserId)?.evidence.find((e) => e.id === evidenceId);
    try {
      const urlParts = ev?.file_url?.split("/tracking-evidence/");
      if (urlParts && urlParts[1]) {
        await supabase.storage.from("tracking-evidence").remove([decodeURIComponent(urlParts[1])]);
      }
    } catch {}

    // Update local state
    setAssignments((prev) =>
      prev.map((a) =>
        a.driver_user_id === driverUserId
          ? { ...a, evidence: a.evidence.filter((e) => e.id !== evidenceId) }
          : a
      )
    );

    await logActivity({
      action: "preparing_evidence_removed",
      tableName: "orders",
      recordId: orderId,
      oldValues: { file_name: fileName, assignment_id: assignmentId },
      newValues: null,
      userId: user.id,
    });

    await notifyProjectMembers({
      projectId,
      title: "Preparing Evidence Removed",
      message: `Preparing evidence "${fileName}" has been removed`,
      type: "order",
      referenceType: "order",
      referenceId: orderId,
      excludeUserId: user.id,
    });

    toast({ title: "Removed", description: "Preparing evidence removed." });
  };

  const handleTrackArrived = async (assignmentId: string, driverName: string) => {
    if (!user || !assignmentId) return;

    // Check RECEIVER evidence exists (not preparing evidence)
    const recEv = receiverEvidence[assignmentId] || [];
    if (recEv.length === 0) {
      toast({ title: "Evidence Required", description: "Receiver's evidence photo is required before tracking arrived.", variant: "destructive" });
      return;
    }

    setActionLoading(assignmentId);

    const arrivedAt = new Date().toISOString();
    const { error } = await supabase
      .from("order_tracking_assignments")
      .update({ tracking_status: "arrived", arrived_at: arrivedAt })
      .eq("id", assignmentId);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setActionLoading(null);
      return;
    }

    setAssignments((prev) =>
      prev.map((a) =>
        a.id === assignmentId ? { ...a, tracking_status: "arrived", arrived_at: arrivedAt } : a
      )
    );

    await logActivity({
      action: "driver_arrived",
      tableName: "orders",
      recordId: orderId,
      oldValues: { tracking_status: "on_transit" },
      newValues: { tracking_status: "arrived", driver_name: driverName, arrived_at: arrivedAt },
      userId: user.id,
    });

    await notifyProjectMembers({
      projectId,
      title: "Driver Arrived",
      message: `Driver ${driverName} has arrived for the order`,
      type: "order",
      referenceType: "order",
      referenceId: orderId,
      excludeUserId: user.id,
    });

    toast({ title: "Driver Arrived", description: `${driverName} marked as arrived.` });
    setActionLoading(null);
  };

  const handleHoldDriver = async () => {
    if (!user || !holdDialogDriverId || !holdRemarks.trim()) return;
    
    const assignment = assignments.find((a) => a.id === holdDialogDriverId);
    if (!assignment) return;

    setActionLoading(holdDialogDriverId);
    const heldAt = new Date().toISOString();

    const { error } = await supabase
      .from("order_tracking_assignments")
      .update({ tracking_status: "on_hold", hold_remarks: holdRemarks.trim(), held_at: heldAt })
      .eq("id", holdDialogDriverId);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setActionLoading(null);
      return;
    }

    const driverName = assignment.driver.full_name || assignment.driver.email;

    setAssignments((prev) =>
      prev.map((a) =>
        a.id === holdDialogDriverId
          ? { ...a, tracking_status: "on_hold", hold_remarks: holdRemarks.trim(), held_at: heldAt }
          : a
      )
    );

    await logActivity({
      action: "driver_hold",
      tableName: "orders",
      recordId: orderId,
      oldValues: { tracking_status: "on_transit" },
      newValues: { tracking_status: "on_hold", driver_name: driverName, hold_remarks: holdRemarks.trim() },
      userId: user.id,
    });

    await notifyProjectMembers({
      projectId,
      title: "Driver On Hold",
      message: `Driver ${driverName} placed on hold: ${holdRemarks.trim()}`,
      type: "order",
      referenceType: "order",
      referenceId: orderId,
      excludeUserId: user.id,
    });

    toast({ title: "Driver On Hold", description: `${driverName} placed on hold.` });
    setHoldDialogDriverId(null);
    setHoldRemarks("");
    setActionLoading(null);
  };

  const handleResumeDriver = async () => {
    if (!user || !resumeDialogDriverId || !resumeRemarks.trim()) return;

    const assignment = assignments.find((a) => a.id === resumeDialogDriverId);
    if (!assignment) return;

    setActionLoading(resumeDialogDriverId);
    const resumedAt = new Date().toISOString();

    const { error } = await supabase
      .from("order_tracking_assignments")
      .update({ tracking_status: "on_transit", resumed_at: resumedAt, resume_remarks: resumeRemarks.trim() })
      .eq("id", resumeDialogDriverId);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setActionLoading(null);
      return;
    }

    const driverName = assignment.driver.full_name || assignment.driver.email;

    setAssignments((prev) =>
      prev.map((a) =>
        a.id === resumeDialogDriverId
          ? { ...a, tracking_status: "on_transit", resumed_at: resumedAt, resume_remarks: resumeRemarks.trim() }
          : a
      )
    );

    await logActivity({
      action: "driver_resumed",
      tableName: "orders",
      recordId: orderId,
      oldValues: { tracking_status: "on_hold", hold_remarks: assignment.hold_remarks },
      newValues: { tracking_status: "on_transit", driver_name: driverName, resume_remarks: resumeRemarks.trim(), resumed_at: resumedAt },
      userId: user.id,
    });

    await notifyProjectMembers({
      projectId,
      title: "Driver Resumed",
      message: `Driver ${driverName} resumed from hold: ${resumeRemarks.trim()}`,
      type: "order",
      referenceType: "order",
      referenceId: orderId,
      excludeUserId: user.id,
    });

    toast({ title: "Driver Resumed", description: `${driverName} is back on transit.` });
    setResumeDialogDriverId(null);
    setResumeRemarks("");
    setActionLoading(null);
  };

  // C) Remarks handler
  const handleSaveRemarks = async (assignmentId: string) => {
    if (!user || !assignmentId) return;
    setRemarksSaving(assignmentId);
    const remarks = trackingRemarksMap[assignmentId] || "";
    const { error } = await supabase
      .from("order_tracking_assignments")
      .update({
        tracking_remarks: remarks,
        remarks_updated_at: new Date().toISOString(),
        remarks_updated_by: user.id,
      })
      .eq("id", assignmentId);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      await logActivity({
        action: "tracking_remarks_updated",
        tableName: "orders",
        recordId: orderId,
        oldValues: null,
        newValues: { assignment_id: assignmentId, remarks },
        userId: user.id,
      });
      toast({ title: "Saved", description: "Remarks updated." });
    }
    setRemarksSaving(null);
  };

  const handleSaveAssignments = async () => {
    if (!user) return;

    for (const oi of orderItems) {
      const totalAssigned = assignments.reduce((sum, a) => {
        const mat = a.materials.find((m) => m.order_item_id === oi.id);
        return sum + (mat?.assigned_quantity || 0);
      }, 0);
      if (totalAssigned > oi.quantity_ordered) {
        toast({
          title: "Over-allocation",
          description: `${oi.sku_name} has ${totalAssigned} assigned but only ${oi.quantity_ordered} ordered.`,
          variant: "destructive",
        });
        return;
      }
    }

    setSaving(true);

    try {
      for (const assignment of assignments) {
        let assignmentId = assignment.id;

        if (assignment.isNew || !assignmentId) {
          const { data: newAssignment, error: insertError } = await supabase
            .from("order_tracking_assignments")
            .insert({
              order_id: orderId,
              driver_user_id: assignment.driver_user_id,
              plate_number: assignment.plate_number,
              created_by: user.id,
            })
            .select()
            .single();

          if (insertError) throw insertError;
          assignmentId = newAssignment.id;
        } else {
          const { error: updateError } = await supabase
            .from("order_tracking_assignments")
            .update({ plate_number: assignment.plate_number })
            .eq("id", assignmentId);

          if (updateError) throw updateError;
        }

        // Upload new evidence files
        for (const evidence of assignment.evidence) {
          if (evidence.file && evidence.isUploading) {
            const fileExt = evidence.file.name.split(".").pop();
            const fileName = `${orderId}/${assignmentId}/${Date.now()}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
              .from("tracking-evidence")
              .upload(fileName, evidence.file);

            if (uploadError) throw uploadError;

            const { data: urlData } = supabase.storage
              .from("tracking-evidence")
              .getPublicUrl(fileName);

            const { error: evidenceError } = await supabase
              .from("order_tracking_evidence")
              .insert({
                order_tracking_assignment_id: assignmentId,
                file_url: urlData.publicUrl,
                file_name: evidence.file_name,
                uploaded_by: user.id,
              });

            if (evidenceError) throw evidenceError;
          }
        }

        // Save material assignments
        if (assignmentId) {
          await supabase
            .from("tracking_driver_materials")
            .delete()
            .eq("tracking_assignment_id", assignmentId);

          if (assignment.materials.length > 0) {
            const materialInserts = assignment.materials.map((m) => ({
              tracking_assignment_id: assignmentId!,
              order_item_id: m.order_item_id,
              assigned_quantity: m.assigned_quantity,
            }));

            const { error: matError } = await supabase
              .from("tracking_driver_materials")
              .insert(materialInserts);

            if (matError) throw matError;
          }
        }

        await logActivity({
          action: assignment.isNew ? "tracking_assigned" : "tracking_updated",
          tableName: "orders",
          recordId: orderId,
          oldValues: null,
          newValues: {
            driver_name: assignment.driver.full_name || assignment.driver.email,
            plate_number: assignment.plate_number,
            materials_count: assignment.materials.length,
          },
          userId: user.id,
        });
      }

      await notifyProjectMembers({
        projectId,
        title: "Tracking Assigned",
        message: `Tracking drivers have been assigned with ${assignments.length} driver(s) and materials`,
        type: "order",
        referenceType: "order",
        referenceId: orderId,
        excludeUserId: user.id,
      });

      toast({ title: "Saved", description: "Tracking assignments saved successfully." });
      setHasSaved(true);
      await fetchData();
    } catch (error: unknown) {
      console.error("Error saving assignments:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save assignments",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // === STATUS BADGE HELPER ===
  const getDriverStatusBadge = (trackingStatus: string) => {
    switch (trackingStatus) {
      case "arrived":
        return <Badge className="bg-success/20 text-success border-success/30 text-[10px]"><CheckCircle2 className="h-3 w-3 mr-1" />Arrived</Badge>;
      case "on_hold":
        return <Badge className="bg-amber-500/20 text-amber-600 border-amber-500/30 text-[10px]"><PauseCircle className="h-3 w-3 mr-1" />Hold</Badge>;
      default:
        return <Badge className="bg-blue-500/20 text-blue-600 border-blue-500/30 text-[10px]"><Truck className="h-3 w-3 mr-1" />On Transit</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const availableDrivers = drivers.filter(
    (d) => !assignments.some((a) => a.driver_user_id === d.id)
  );

  // === COLLAPSED VIEW (compact summary per driver) ===
  const collapsedViewContent = (
    <div className="space-y-1.5">
      {assignments.map((a) => (
        <div key={a.driver_user_id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-md border bg-muted/30 text-sm">
          <div className="flex items-center gap-2 min-w-0">
            <Truck className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className="font-medium truncate">{a.driver.full_name || a.driver.email}</span>
            <span className="text-xs text-muted-foreground font-mono">{a.plate_number || "—"}</span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {getDriverStatusBadge(a.tracking_status)}
            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
              {a.tracking_status === "arrived" && a.arrived_at
                ? `Arrived: ${formatManilaTime(a.arrived_at)}`
                : a.tracking_status === "on_hold" && a.held_at
                ? `Held: ${formatManilaTime(a.held_at)}`
                : a.tracking_status === "on_transit" && a.resumed_at
                ? `Since: ${formatManilaTime(a.resumed_at)}`
                : a.created_at
                ? `Since: ${formatManilaTime(a.created_at)}`
                : ""}
            </span>
          </div>
        </div>
      ))}
    </div>
  );

  // === EXPANDED VIEW (full details + actions) ===
  const expandedViewContent = (
    <div className="space-y-4">
      {assignments.map((assignment) => (
        <div
          key={assignment.driver_user_id}
          className="border rounded-lg p-4 space-y-3 bg-card"
        >
          {/* Driver Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Truck className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium truncate">{assignment.driver.full_name || "No Name"}</p>
                  {getDriverStatusBadge(assignment.tracking_status)}
                </div>
                <p className="text-xs text-muted-foreground truncate">{assignment.driver.email}</p>
              </div>
            </div>
            {isPreparing && canEdit && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive flex-shrink-0"
                onClick={() => handleRemoveDriver(assignment.driver_user_id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Plate Number + Meta */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Plate Number</p>
              {isPreparing && canEdit ? (
                <Input
                  placeholder="Enter plate #"
                  value={assignment.plate_number}
                  onChange={(e) => {
                    const val = e.target.value.toUpperCase().replace(/[^A-Z0-9\s\-]/g, "");
                    handleFieldChange(assignment.driver_user_id, "plate_number", val);
                  }}
                  className="h-9 uppercase"
                />
              ) : (
                <p className="font-mono">{assignment.plate_number || "—"}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Added By</p>
              <p className="truncate">{assignment.creator?.full_name || assignment.creator?.email || "—"}</p>
            </div>
            {assignment.created_at && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Date/Time</p>
                <p className="text-sm">{formatManilaTime(assignment.created_at)}</p>
              </div>
            )}
          </div>

          {/* Milestone Timestamps */}
          {assignment.id && (assignment.created_at || assignment.arrived_at || assignment.held_at || assignment.resumed_at) && (
            <div className="space-y-1.5 border rounded-md px-3 py-2.5 bg-muted/30">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1 mb-1.5">
                <Clock className="h-3 w-3" /> Tracking Timeline
              </p>
              {assignment.created_at && (
                <div className="flex items-center gap-2 text-xs">
                  <Truck className="h-3 w-3 text-blue-600 flex-shrink-0" />
                  <span className="text-muted-foreground">On Transit:</span>
                  <span className="font-medium">{formatManilaTime(assignment.created_at)}</span>
                </div>
              )}
              {assignment.held_at && (
                <div className="flex items-center gap-2 text-xs">
                  <PauseCircle className="h-3 w-3 text-amber-600 flex-shrink-0" />
                  <span className="text-muted-foreground">Hold:</span>
                  <span className="font-medium text-amber-700 dark:text-amber-400">{formatManilaTime(assignment.held_at)}</span>
                </div>
              )}
              {assignment.resumed_at && (
                <div className="flex items-center gap-2 text-xs">
                  <Truck className="h-3 w-3 text-blue-600 flex-shrink-0" />
                  <span className="text-muted-foreground">Resumed:</span>
                  <span className="font-medium">{formatManilaTime(assignment.resumed_at)}</span>
                </div>
              )}
              {assignment.arrived_at && (
                <div className="flex items-center gap-2 text-xs">
                  <CheckCircle2 className="h-3 w-3 text-success flex-shrink-0" />
                  <span className="text-muted-foreground">Arrived:</span>
                  <span className="font-medium text-success">{formatManilaTime(assignment.arrived_at)}</span>
                </div>
              )}
            </div>
          )}

          {/* Arrival / Hold info (status banners) */}
          {assignment.tracking_status === "arrived" && assignment.arrived_at && (
            <div className="flex items-center gap-2 text-sm bg-success/10 border border-success/20 rounded-md px-3 py-2">
              <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" />
              <span className="text-success font-medium">Arrived at: {formatManilaTime(assignment.arrived_at)}</span>
            </div>
          )}

          {assignment.tracking_status === "on_hold" && (
            <div className="space-y-1 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md px-3 py-2">
              <div className="flex items-center gap-2 text-sm">
                <PauseCircle className="h-4 w-4 text-amber-600 flex-shrink-0" />
                <span className="font-medium text-amber-700 dark:text-amber-400">
                  Held at: {assignment.held_at ? formatManilaTime(assignment.held_at) : "—"}
                </span>
              </div>
              {assignment.hold_remarks && (
                <p className="text-xs text-amber-700 dark:text-amber-400 pl-6">
                  <span className="font-semibold">HOLD REMARKS:</span> {assignment.hold_remarks}
                </p>
              )}
            </div>
          )}

          {/* Resume info */}
          {assignment.resumed_at && (
            <div className="flex items-center gap-2 text-sm bg-blue-500/10 border border-blue-500/20 rounded-md px-3 py-2">
              <Truck className="h-4 w-4 text-blue-600 flex-shrink-0" />
              <div>
                <span className="text-blue-600 font-medium">Resumed at: {formatManilaTime(assignment.resumed_at)}</span>
                {assignment.resume_remarks && (
                  <p className="text-xs text-blue-600 mt-0.5">
                    <span className="font-semibold">RESUME REMARKS:</span> {assignment.resume_remarks}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* C) Remarks Section */}
          {assignment.id && (isPreparing || isInTransit || assignment.tracking_status === "arrived") && (
            <div className="space-y-2 border-t pt-3">
              <p className="text-xs font-medium text-muted-foreground">Remarks</p>
              {(canEdit || canDoDriverActions) && !isDelivered ? (
                <div className="space-y-2">
                  <Textarea
                    placeholder="Add remarks for this driver assignment..."
                    value={trackingRemarksMap[assignment.id] || ""}
                    onChange={(e) => setTrackingRemarksMap((prev) => ({ ...prev, [assignment.id!]: e.target.value }))}
                    rows={2}
                    className="text-sm"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => handleSaveRemarks(assignment.id!)}
                    disabled={remarksSaving === assignment.id}
                  >
                    {remarksSaving === assignment.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                    Save Remarks
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  {trackingRemarksMap[assignment.id] || "No remarks"}
                </p>
              )}
            </div>
          )}

          {/* Per-driver action buttons (On Transit page only) */}
          {isInTransit && canDoDriverActions && assignment.id && assignment.tracking_status === "on_transit" && (() => {
            const driverReceiverEv = receiverEvidence[assignment.id!] || [];
            const hasReceiverEvidence = driverReceiverEv.length > 0;
            return (
            <div className="space-y-3 pt-1">
              {/* Receiver's Evidence requirement notice */}
              {!hasReceiverEvidence && (
                <div className="flex items-center gap-2 text-xs bg-amber-500/10 border border-amber-500/20 rounded-md px-3 py-2 text-amber-600">
                  <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                  Receiver's evidence photo is required before tracking arrived.
                </div>
              )}
              {/* Receiver's Evidence Upload */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">Receiver's Evidence</p>
                  <div>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      ref={(el) => { fileInputRefs.current[`receiver_${assignment.id}`] = el; }}
                      onChange={(e) => handleReceiverEvidenceUpload(assignment.id!, e.target.files)}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => fileInputRefs.current[`receiver_${assignment.id}`]?.click()}
                    >
                      <Upload className="h-3 w-3 mr-1" /> Upload Receiver Evidence
                    </Button>
                  </div>
                </div>
                {driverReceiverEv.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {driverReceiverEv.map((ev, index) => (
                      <div key={ev.id} className="relative">
                        <img
                          src={ev.file_url}
                          alt={ev.file_name}
                          className="h-16 w-16 object-cover rounded-md border cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => {
                            window.dispatchEvent(new CustomEvent("open-lightbox", {
                              detail: {
                                images: driverReceiverEv.map((e) => ({ url: e.file_url, name: e.file_name })),
                                startIndex: index,
                              },
                            }));
                          }}
                        />
                        {!isDelivered && (
                        <button
                          className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-sm"
                          onClick={() => handleRemoveReceiverEvidence(assignment.id!, ev.id, ev.file_name)}
                          title="Remove evidence"
                        >
                          <X className="h-3 w-3" />
                        </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">No receiver evidence uploaded yet</p>
                )}
              </div>
              {/* Action buttons */}
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-success border-success/30 hover:bg-success/10"
                  onClick={() => handleTrackArrived(assignment.id!, assignment.driver.full_name || assignment.driver.email)}
                  disabled={actionLoading === assignment.id || !hasReceiverEvidence}
                >
                  {actionLoading === assignment.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <MapPin className="h-3.5 w-3.5" />
                  )}
                  Track Arrived
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-amber-600 border-amber-500/30 hover:bg-amber-500/10"
                  onClick={() => setHoldDialogDriverId(assignment.id!)}
                  disabled={actionLoading === assignment.id}
                >
                  <PauseCircle className="h-3.5 w-3.5" />
                  Hold
                </Button>
              </div>
            </div>
            );
          })()}

          {/* Resume button for On Hold drivers */}
          {isInTransit && canDoDriverActions && assignment.id && assignment.tracking_status === "on_hold" && (
            <div className="flex items-center gap-2 pt-1">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-blue-600 border-blue-500/30 hover:bg-blue-500/10"
                onClick={() => setResumeDialogDriverId(assignment.id!)}
                disabled={actionLoading === assignment.id}
              >
                {actionLoading === assignment.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Truck className="h-3.5 w-3.5" />
                )}
                Resume
              </Button>
            </div>
          )}

          {/* Material Assignment */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Package className="h-3 w-3" /> Assigned Materials
              </p>
              {isPreparing && canEdit && orderItems.length > 0 && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-7 text-xs">
                      <Plus className="h-3 w-3 mr-1" /> Add Material
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[280px] p-2" align="end">
                    <div className="space-y-1">
                      {orderItems.map((oi) => {
                        const remaining = getRemainingQuantity(oi.id);
                        const alreadyAdded = assignment.materials.some((m) => m.order_item_id === oi.id);
                        const disabled = alreadyAdded || remaining <= 0;
                        return (
                          <button
                            key={oi.id}
                            className={`w-full text-left px-3 py-2 rounded text-sm hover:bg-muted transition-colors ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
                            onClick={() => !disabled && handleAddMaterial(assignment.driver_user_id, oi.id)}
                            disabled={disabled}
                          >
                            <span className="font-medium">{oi.sku_name}</span>
                            <span className="text-xs text-muted-foreground ml-2">
                              {alreadyAdded ? "(added)" : `Remaining: ${remaining} ${oi.unit}`}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </div>

            {assignment.materials.length > 0 ? (
              <div className="border rounded divide-y text-sm">
                {assignment.materials.map((mat) => {
                  const remaining = getRemainingQuantity(mat.order_item_id, assignment.driver_user_id);
                  const maxForThisDriver = remaining + mat.assigned_quantity;
                  return (
                    <div key={mat.order_item_id} className="flex items-center justify-between px-3 py-2 gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{mat.material_name}</p>
                        <p className="text-xs text-muted-foreground">
                          Max: {mat.max_quantity} {mat.unit} • Remaining: {remaining} {mat.unit}
                        </p>
                      </div>
                      {isPreparing && canEdit ? (
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min={1}
                            max={maxForThisDriver}
                            value={mat.assigned_quantity}
                            onChange={(e) =>
                              handleMaterialQuantityChange(
                                assignment.driver_user_id,
                                mat.order_item_id,
                                parseInt(e.target.value) || 1
                              )
                            }
                            className="h-8 w-20 text-sm"
                          />
                          <span className="text-xs text-muted-foreground">{mat.unit}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={() => handleRemoveMaterial(assignment.driver_user_id, mat.order_item_id)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <span className="font-mono text-sm">{mat.assigned_quantity} {mat.unit}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">No materials assigned to this driver.</p>
            )}
          </div>

          {/* Evidence */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Evidence Photos ({assignment.evidence.length})</p>
              {isPreparing && canEdit && (
                <>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    ref={(el) => { fileInputRefs.current[assignment.driver_user_id] = el; }}
                    onChange={(e) => handleFileSelect(assignment.driver_user_id, e.target.files)}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => fileInputRefs.current[assignment.driver_user_id]?.click()}
                  >
                    <Upload className="h-3 w-3 mr-1" /> Upload
                  </Button>
                </>
              )}
            </div>
            {assignment.evidence.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {assignment.evidence.map((evidence, index) => (
                  <div key={evidence.id || index} className="relative group">
                    <div>
                      <img
                        src={evidence.file_url}
                        alt={evidence.file_name}
                        className="h-16 w-16 object-cover rounded-md border cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => {
                          window.dispatchEvent(new CustomEvent("open-lightbox", {
                            detail: {
                              images: assignment.evidence.map((e) => ({ url: e.file_url, name: e.file_name })),
                              startIndex: index,
                            },
                          }));
                        }}
                      />
                      {evidence.uploaded_at && (
                        <p className="text-[9px] text-muted-foreground mt-0.5 text-center w-16 truncate" title={formatManilaTime(evidence.uploaded_at)}>
                          {formatManilaTime(evidence.uploaded_at)}
                        </p>
                      )}
                    </div>
                    {evidence.isUploading && (
                      <div className="absolute inset-0 bg-black/50 rounded-md flex items-center justify-center" style={{ bottom: evidence.uploaded_at ? '18px' : '0' }}>
                        <Loader2 className="h-4 w-4 animate-spin text-white" />
                      </div>
                    )}
                    {isPreparing && canEdit && !evidence.isUploading && !isDelivered && (
                      <button
                        className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-sm"
                        onClick={() => {
                          if (evidence.id && assignment.id) {
                            handleRemovePreparingEvidence(assignment.id, evidence.id, assignment.driver_user_id, evidence.file_name);
                          } else {
                            handleRemoveEvidence(assignment.driver_user_id, index);
                          }
                        }}
                        title="Remove evidence"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">No evidence uploaded</p>
            )}
          </div>

          {/* Receiver's Evidence (display for all statuses, with remove for authorized) */}
          {assignment.id && (receiverEvidence[assignment.id] || []).length > 0 && !isInTransit && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Receiver's Evidence ({(receiverEvidence[assignment.id] || []).length})</p>
              <div className="flex flex-wrap gap-2">
                {(receiverEvidence[assignment.id] || []).map((ev, index) => {
                  const canRemoveEvidence = isSuperAdmin() || isAdmin() || canProcessLogistics() || ev.uploaded_by === user?.id;
                  return (
                  <div key={ev.id} className="relative">
                    <div>
                      <img
                        src={ev.file_url}
                        alt={ev.file_name}
                        className="h-16 w-16 object-cover rounded-md border cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => {
                          window.dispatchEvent(new CustomEvent("open-lightbox", {
                            detail: {
                              images: (receiverEvidence[assignment.id!] || []).map((e) => ({ url: e.file_url, name: e.file_name })),
                              startIndex: index,
                            },
                          }));
                        }}
                      />
                      {ev.uploaded_at && (
                        <p className="text-[9px] text-muted-foreground mt-0.5 text-center w-16 truncate" title={formatManilaTime(ev.uploaded_at)}>
                          {formatManilaTime(ev.uploaded_at)}
                        </p>
                      )}
                    </div>
                    {canRemoveEvidence && !isDelivered && (
                      <button
                        className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-sm"
                        onClick={() => handleRemoveReceiverEvidence(assignment.id!, ev.id, ev.file_name)}
                        title="Remove evidence"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Add Driver Button */}
      {isPreparing && canEdit && (
        <div className="flex justify-end">
          <Popover open={driverSearchOpen} onOpenChange={setDriverSearchOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Add Driver
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0" align="end">
              <Command>
                <CommandInput placeholder="Search drivers..." />
                <CommandList>
                  <CommandEmpty>No drivers found.</CommandEmpty>
                  <CommandGroup>
                    {availableDrivers.map((driver) => (
                      <CommandItem
                        key={driver.id}
                        value={driver.full_name || driver.email}
                        onSelect={() => handleAddDriver(driver)}
                      >
                        <div className="flex flex-col">
                          <span>{driver.full_name || "No Name"}</span>
                          <span className="text-xs text-muted-foreground">
                            {driver.email}
                            {driver.phone && ` • ${driver.phone}`}
                          </span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      )}

      {/* No drivers message */}
      {assignments.length === 0 && (
        <div className="text-center py-6 border border-dashed rounded-lg">
          <Truck className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">No drivers assigned yet.</p>
          {isPreparing && canEdit && (
            <p className="text-xs text-muted-foreground mt-1">Click "Add Driver" to assign tracking drivers.</p>
          )}
        </div>
      )}

      {/* Driver Tracking - Collapsible */}
      {assignments.length > 0 && (
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleTrigger asChild>
            <button className="flex items-center justify-between w-full px-3 py-2 rounded-md border bg-muted/50 hover:bg-muted transition-colors text-sm font-medium">
              <div className="flex items-center gap-2">
                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <span>Driver Tracking ({assignments.length})</span>
                {isInTransit && (
                  <span className="text-[10px] text-muted-foreground">
                    {assignments.filter((a) => a.tracking_status === "arrived").length}/{assignments.length} arrived
                  </span>
                )}
              </div>
            </button>
          </CollapsibleTrigger>

          {/* Collapsed summary */}
          {!isExpanded && <div className="mt-2">{collapsedViewContent}</div>}

          {/* Expanded full view */}
          <CollapsibleContent className="mt-3">
            {expandedViewContent}
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Save Button */}
      {isPreparing && canEdit && assignments.length > 0 && (
        <div className="space-y-2">
          <Button
            className="w-full"
            onClick={handleSaveAssignments}
            disabled={saving || assignments.some((a) => !a.plate_number.trim()) || assignments.some((a) => a.evidence.length === 0)}
          >
            {saving ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
            ) : (
              <><Check className="h-4 w-4 mr-2" /> Save Tracking Assignment</>
            )}
          </Button>
          {!hasSaved && (
            <p className="text-xs text-amber-600 text-center">
              Assign at least one driver with a plate number and evidence photo before marking On Transit.
            </p>
          )}
          {assignments.some((a) => a.evidence.length === 0) && (
            <p className="text-xs text-destructive text-center">
              Evidence photo is required for each driver assignment.
            </p>
          )}
        </div>
      )}

      {/* Hold Remarks Dialog */}
      <AlertDialog open={!!holdDialogDriverId} onOpenChange={(open) => { if (!open) { setHoldDialogDriverId(null); setHoldRemarks(""); } }}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
              <PauseCircle className="h-5 w-5" />
              Hold Driver
            </AlertDialogTitle>
            <AlertDialogDescription>
              Please provide remarks for placing this driver on hold.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="e.g. Hold because the material arrived is wrong..."
              value={holdRemarks}
              onChange={(e) => setHoldRemarks(e.target.value)}
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setHoldDialogDriverId(null); setHoldRemarks(""); }}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleHoldDriver}
              disabled={!holdRemarks.trim() || !!actionLoading}
              className="bg-amber-500 text-white hover:bg-amber-600"
            >
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Place On Hold
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Resume Remarks Dialog */}
      <AlertDialog open={!!resumeDialogDriverId} onOpenChange={(open) => { if (!open) { setResumeDialogDriverId(null); setResumeRemarks(""); } }}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-blue-600">
              <Truck className="h-5 w-5" />
              Resume Driver
            </AlertDialogTitle>
            <AlertDialogDescription>
              Please provide remarks for resuming this driver from hold.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="e.g. Issue resolved, materials replaced..."
              value={resumeRemarks}
              onChange={(e) => setResumeRemarks(e.target.value)}
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setResumeDialogDriverId(null); setResumeRemarks(""); }}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResumeDriver}
              disabled={!resumeRemarks.trim() || !!actionLoading}
              className="bg-blue-500 text-white hover:bg-blue-600"
            >
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Resume Transit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
