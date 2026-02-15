import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { logActivity } from "@/lib/activityLogger";
import { notifyProjectMembers, formatManilaTime } from "@/lib/notificationService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  X,
  Upload,
  Truck,
  Check,
  Trash2,
  Plus,
  Package,
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
  readOnly?: boolean;
}

export function TrackingAssignmentSection({
  orderId,
  projectId,
  status,
  onValidationChange,
  onAssignmentsLoaded,
  readOnly = false,
}: TrackingAssignmentSectionProps) {
  const { user, isSuperAdmin, isAdmin, canProcessLogistics } = useAuth();
  const { toast } = useToast();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [assignments, setAssignments] = useState<DriverAssignment[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItemInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  const [driverSearchOpen, setDriverSearchOpen] = useState(false);
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  const canEdit = !readOnly && (isSuperAdmin() || isAdmin() || canProcessLogistics());
  const isPreparing = status === "preparing";

  useEffect(() => {
    fetchData();
  }, [orderId]);

  useEffect(() => {
    // Validate: at least 1 driver, all have plate numbers, and saved
    const isValid =
      assignments.length > 0 &&
      assignments.every((a) => a.plate_number.trim() !== "") &&
      hasSaved;
    onValidationChange?.(isValid);
  }, [assignments, hasSaved, onValidationChange]);

  const fetchData = async () => {
    setLoading(true);

    // Fetch order items for this order
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

    // Fetch drivers (users with tracking_driver role)
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

    // Fetch existing assignments
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

      const profileMap = new Map(
        (profiles || []).map((d) => [d.id, d])
      );

      // Fetch evidence for all assignments
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

      // Fetch material assignments
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

      const loadedAssignments: DriverAssignment[] = existingAssignments.map((a) => ({
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
      }));

      setAssignments(loadedAssignments);
      setHasSaved(true);
      onAssignmentsLoaded?.(true);
    } else {
      onAssignmentsLoaded?.(false);
    }

    setLoading(false);
  };

  // Calculate remaining quantity for a material across all drivers
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
        description: `${driver.full_name || driver.email} is already assigned to this order.`,
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
      },
    ]);
    setHasSaved(false);
    setDriverSearchOpen(false);
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
        oldValues: {
          driver_name: assignment.driver.full_name || assignment.driver.email,
          plate_number: assignment.plate_number,
        },
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

  // Material assignment handlers
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
        // Check if already has this material
        if (a.materials.some((m) => m.order_item_id === orderItemId)) {
          return a;
        }
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
      if (!file.type.startsWith("image/")) {
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

  const handleSaveAssignments = async () => {
    if (!user) return;

    // Validate material quantities
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

        // Save material assignments - delete old and re-insert
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

        // Log activity
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

      // Notify project members
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

      {/* Driver Cards */}
      {assignments.length > 0 && (
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
                    <p className="font-medium truncate">{assignment.driver.full_name || "No Name"}</p>
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
                      onChange={(e) => handleFieldChange(assignment.driver_user_id, "plate_number", e.target.value)}
                      className="h-9"
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
                                className={`w-full text-left px-3 py-2 rounded text-sm hover:bg-muted transition-colors ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                                onClick={() => !disabled && handleAddMaterial(assignment.driver_user_id, oi.id)}
                                disabled={disabled}
                              >
                                <span className="font-medium">{oi.sku_name}</span>
                                <span className="text-xs text-muted-foreground ml-2">
                                  {alreadyAdded ? '(added)' : `Remaining: ${remaining} ${oi.unit}`}
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
                  <p className="text-xs text-muted-foreground">Evidence Photos</p>
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
                      <div key={index} className="relative group">
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
                        {evidence.isUploading && (
                          <div className="absolute inset-0 bg-black/50 rounded-md flex items-center justify-center">
                            <Loader2 className="h-4 w-4 animate-spin text-white" />
                          </div>
                        )}
                        {isPreparing && canEdit && (
                          <button
                            className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => handleRemoveEvidence(assignment.driver_user_id, index)}
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
            </div>
          ))}
        </div>
      )}

      {/* Save Button */}
      {isPreparing && canEdit && assignments.length > 0 && (
        <div className="space-y-2">
          <Button
            className="w-full"
            onClick={handleSaveAssignments}
            disabled={saving || assignments.some((a) => !a.plate_number.trim())}
          >
            {saving ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
            ) : (
              <><Check className="h-4 w-4 mr-2" /> Save Tracking Assignment</>
            )}
          </Button>
          {!hasSaved && (
            <p className="text-xs text-amber-600 text-center">
              Assign and save at least one driver before marking On Transit.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
