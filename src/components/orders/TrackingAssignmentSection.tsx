import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { logActivity } from "@/lib/activityLogger";
import { notifyProjectMembers, formatManilaTime } from "@/lib/notificationService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
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
  Loader2,
  UserPlus,
  X,
  Upload,
  Image as ImageIcon,
  Truck,
  Check,
  ChevronsUpDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Driver {
  id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
}

interface DriverAssignment {
  id?: string;
  driver_user_id: string;
  driver: Driver;
  plate_number: string;
  evidence: EvidenceFile[];
  isNew?: boolean;
}

interface EvidenceFile {
  id?: string;
  file_url: string;
  file_name: string;
  file?: File;
  isUploading?: boolean;
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [driverSearchOpen, setDriverSearchOpen] = useState(false);
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  const canEdit = !readOnly && (isSuperAdmin() || isAdmin() || canProcessLogistics());
  const isPreparing = status === "preparing";

  useEffect(() => {
    fetchData();
  }, [orderId]);

  useEffect(() => {
    // Validate: at least 1 driver, all have plate numbers
    const isValid =
      assignments.length > 0 &&
      assignments.every((a) => a.plate_number.trim() !== "");
    onValidationChange?.(isValid);
  }, [assignments, onValidationChange]);

  const fetchData = async () => {
    setLoading(true);
    
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
      .eq("order_id", orderId);

    if (existingAssignments && existingAssignments.length > 0) {
      // Fetch driver profiles for assignments
      const driverIds = existingAssignments.map((a) => a.driver_user_id);
      const { data: assignedDriverProfiles } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone")
        .in("id", driverIds);

      const driverMap = new Map(
        (assignedDriverProfiles || []).map((d) => [d.id, d])
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
        });
        evidenceMap.set(e.order_tracking_assignment_id, list);
      });

      const loadedAssignments: DriverAssignment[] = existingAssignments.map((a) => ({
        id: a.id,
        driver_user_id: a.driver_user_id,
        driver: driverMap.get(a.driver_user_id) || {
          id: a.driver_user_id,
          full_name: null,
          email: "Unknown",
          phone: null,
        },
        plate_number: a.plate_number,
        evidence: evidenceMap.get(a.id) || [],
      }));

      setAssignments(loadedAssignments);
      onAssignmentsLoaded?.(true);
    } else {
      onAssignmentsLoaded?.(false);
    }

    setLoading(false);
  };

  const handleAddDriver = (driver: Driver) => {
    // Check if already assigned
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
        evidence: [],
        isNew: true,
      },
    ]);
    setDriverSearchOpen(false);
  };

  const handleRemoveDriver = (driverUserId: string) => {
    setAssignments((prev) => prev.filter((a) => a.driver_user_id !== driverUserId));
  };

  const handlePlateChange = (driverUserId: string, plateNumber: string) => {
    setAssignments((prev) =>
      prev.map((a) =>
        a.driver_user_id === driverUserId ? { ...a, plate_number: plateNumber } : a
      )
    );
  };

  const handleFileSelect = async (
    driverUserId: string,
    files: FileList | null
  ) => {
    if (!files || !user) return;

    const assignment = assignments.find((a) => a.driver_user_id === driverUserId);
    if (!assignment) return;

    const newEvidence: EvidenceFile[] = [];

    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) {
        toast({
          title: "Invalid File",
          description: "Only image files are allowed.",
          variant: "destructive",
        });
        continue;
      }

      // Create preview
      newEvidence.push({
        file_url: URL.createObjectURL(file),
        file_name: file.name,
        file,
        isUploading: true,
      });
    }

    // Add to assignments
    setAssignments((prev) =>
      prev.map((a) =>
        a.driver_user_id === driverUserId
          ? { ...a, evidence: [...a.evidence, ...newEvidence] }
          : a
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
    setSaving(true);

    try {
      for (const assignment of assignments) {
        let assignmentId = assignment.id;

        // Create or update assignment
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
          // Update plate number
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

            // Save evidence record
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

        // Log activity
        await logActivity({
          action: "tracking_assigned",
          tableName: "orders",
          recordId: orderId,
          oldValues: null,
          newValues: {
            driver_name: assignment.driver.full_name || assignment.driver.email,
            plate_number: assignment.plate_number,
          },
          userId: user.id,
        });
      }

      // Notify project members
      await notifyProjectMembers({
        projectId,
        title: "Tracking Assigned",
        message: `Tracking drivers have been assigned with ${assignments.length} driver(s)`,
        type: "order",
        referenceType: "order",
        referenceId: orderId,
        excludeUserId: user.id,
      });

      toast({ title: "Saved", description: "Tracking assignments saved successfully." });
      
      // Refresh data
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
      <div className="flex items-center gap-2 text-sm font-medium">
        <Truck className="h-4 w-4 text-muted-foreground" />
        {isPreparing ? "Tracking Assignment" : "Tracking Details"}
      </div>

      {/* Driver Selection (only in preparing status) */}
      {isPreparing && canEdit && (
        <Popover open={driverSearchOpen} onOpenChange={setDriverSearchOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full justify-between">
              <span className="flex items-center gap-2">
                <UserPlus className="h-4 w-4" />
                Add Driver
              </span>
              <ChevronsUpDown className="h-4 w-4 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[300px] p-0" align="start">
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
      )}

      {/* No drivers message */}
      {assignments.length === 0 && (
        <p className="text-sm text-muted-foreground italic text-center py-4">
          No drivers assigned yet.
        </p>
      )}

      {/* Driver Cards */}
      <div className="space-y-3">
        {assignments.map((assignment) => (
          <div
            key={assignment.driver_user_id}
            className="rounded-lg border bg-muted/30 p-4 space-y-3"
          >
            {/* Driver Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Truck className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">
                    {assignment.driver.full_name || "No Name"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {assignment.driver.email}
                  </p>
                </div>
              </div>
              {isPreparing && canEdit && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => handleRemoveDriver(assignment.driver_user_id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* Plate Number */}
            <div className="space-y-1">
              <Label className="text-xs">Plate Number</Label>
              {isPreparing && canEdit ? (
                <Input
                  placeholder="Enter plate number"
                  value={assignment.plate_number}
                  onChange={(e) =>
                    handlePlateChange(assignment.driver_user_id, e.target.value)
                  }
                  className="h-9"
                />
              ) : (
                <p className="text-sm font-medium">
                  {assignment.plate_number || "Not set"}
                </p>
              )}
            </div>

            {/* Evidence */}
            <div className="space-y-2">
              <Label className="text-xs">Evidence Photos</Label>
              
              {/* Upload button (only in preparing) */}
              {isPreparing && canEdit && (
                <>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    ref={(el) => {
                      fileInputRefs.current[assignment.driver_user_id] = el;
                    }}
                    onChange={(e) =>
                      handleFileSelect(assignment.driver_user_id, e.target.files)
                    }
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() =>
                      fileInputRefs.current[assignment.driver_user_id]?.click()
                    }
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Photos
                  </Button>
                </>
              )}

              {/* Evidence Thumbnails */}
              {assignment.evidence.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {assignment.evidence.map((evidence, index) => (
                    <div
                      key={index}
                      className="relative group"
                    >
                      <img
                        src={evidence.file_url}
                        alt={evidence.file_name}
                        className="h-16 w-16 object-cover rounded-md border cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => {
                          // Will trigger lightbox - handled by parent component
                          const event = new CustomEvent("open-lightbox", {
                            detail: {
                              images: assignment.evidence.map((e) => ({
                                url: e.file_url,
                                name: e.file_name,
                              })),
                              startIndex: index,
                            },
                          });
                          window.dispatchEvent(event);
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
                          onClick={() =>
                            handleRemoveEvidence(assignment.driver_user_id, index)
                          }
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">
                  No evidence uploaded
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Save Button (only in preparing) */}
      {isPreparing && canEdit && assignments.length > 0 && (
        <Button
          className="w-full"
          onClick={handleSaveAssignments}
          disabled={
            saving ||
            assignments.some((a) => !a.plate_number.trim())
          }
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Check className="h-4 w-4 mr-2" />
              Save Tracking Assignments
            </>
          )}
        </Button>
      )}
    </div>
  );
}
