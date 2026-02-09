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
  Loader2,
  X,
  Upload,
  Truck,
  Check,
  Trash2,
  Plus,
} from "lucide-react";

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
  tracking_reference: string;
  notes: string;
  evidence: EvidenceFile[];
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
      .eq("order_id", orderId)
      .order("created_at", { ascending: true });

    if (existingAssignments && existingAssignments.length > 0) {
      // Fetch driver profiles for assignments
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
        created_by: a.created_by,
        created_at: a.created_at,
        creator: a.created_by ? profileMap.get(a.created_by) : undefined,
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
        tracking_reference: "",
        notes: "",
        evidence: [],
        isNew: true,
        isEditing: true,
      },
    ]);
    setDriverSearchOpen(false);
  };

  const handleRemoveDriver = async (driverUserId: string) => {
    const assignment = assignments.find((a) => a.driver_user_id === driverUserId);
    
    // If it's a saved assignment, delete from database
    if (assignment?.id && !assignment.isNew) {
      const { error } = await supabase
        .from("order_tracking_assignments")
        .delete()
        .eq("id", assignment.id);
      
      if (error) {
        toast({
          title: "Error",
          description: "Failed to remove driver assignment",
          variant: "destructive",
        });
        return;
      }

      // Log activity
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

      // Notify project members
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
  };

  const handleFieldChange = (driverUserId: string, field: keyof DriverAssignment, value: string) => {
    setAssignments((prev) =>
      prev.map((a) =>
        a.driver_user_id === driverUserId ? { ...a, [field]: value } : a
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
          action: assignment.isNew ? "tracking_assigned" : "tracking_updated",
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

      {/* Driver Table - Desktop with horizontal scroll */}
      {assignments.length > 0 && (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="min-w-[150px]">Driver</TableHead>
                    <TableHead className="min-w-[120px]">Plate Number</TableHead>
                    <TableHead className="min-w-[100px]">Evidence</TableHead>
                    <TableHead className="min-w-[120px]">Added By</TableHead>
                    <TableHead className="min-w-[150px]">Date/Time Added</TableHead>
                    {isPreparing && canEdit && (
                      <TableHead className="w-[80px] text-right">Actions</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignments.map((assignment) => (
                    <TableRow key={assignment.driver_user_id}>
                      {/* Driver Column */}
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <Truck className="h-4 w-4 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">
                              {assignment.driver.full_name || "No Name"}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {assignment.driver.email}
                            </p>
                          </div>
                        </div>
                      </TableCell>

                      {/* Plate Number Column */}
                      <TableCell>
                        {isPreparing && canEdit ? (
                          <Input
                            placeholder="Enter plate #"
                            value={assignment.plate_number}
                            onChange={(e) =>
                              handleFieldChange(assignment.driver_user_id, "plate_number", e.target.value)
                            }
                            className="h-8 text-sm"
                          />
                        ) : (
                          <span className="font-mono text-sm">
                            {assignment.plate_number || "—"}
                          </span>
                        )}
                      </TableCell>

                      {/* Evidence Column */}
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {assignment.evidence.length > 0 ? (
                            <div className="flex -space-x-2">
                              {assignment.evidence.slice(0, 3).map((evidence, index) => (
                                <img
                                  key={index}
                                  src={evidence.file_url}
                                  alt={evidence.file_name}
                                  className="h-8 w-8 rounded border-2 border-background object-cover cursor-pointer hover:z-10 hover:scale-110 transition-transform"
                                  onClick={() => {
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
                              ))}
                              {assignment.evidence.length > 3 && (
                                <div className="h-8 w-8 rounded border-2 border-background bg-muted flex items-center justify-center text-xs font-medium">
                                  +{assignment.evidence.length - 3}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">None</span>
                          )}
                          
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
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() =>
                                  fileInputRefs.current[assignment.driver_user_id]?.click()
                                }
                              >
                                <Upload className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>

                      {/* Added By Column */}
                      <TableCell>
                        <span className="text-sm truncate">
                          {assignment.creator?.full_name || assignment.creator?.email || "—"}
                        </span>
                      </TableCell>

                      {/* Date/Time Column */}
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {assignment.created_at ? formatManilaTime(assignment.created_at) : "—"}
                        </span>
                      </TableCell>

                      {/* Actions Column */}
                      {isPreparing && canEdit && (
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => handleRemoveDriver(assignment.driver_user_id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-3">
            {assignments.map((assignment) => (
              <div
                key={assignment.driver_user_id}
                className="border rounded-lg p-4 space-y-3 bg-card"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Truck className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate">
                        {assignment.driver.full_name || "No Name"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {assignment.driver.email}
                      </p>
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

                {/* Fields */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Plate Number</p>
                    {isPreparing && canEdit ? (
                      <Input
                        placeholder="Enter plate #"
                        value={assignment.plate_number}
                        onChange={(e) =>
                          handleFieldChange(assignment.driver_user_id, "plate_number", e.target.value)
                        }
                        className="h-9"
                      />
                    ) : (
                      <p className="font-mono">{assignment.plate_number || "—"}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Added By</p>
                    <p className="truncate">
                      {assignment.creator?.full_name || assignment.creator?.email || "—"}
                    </p>
                  </div>
                </div>

                {/* Date */}
                {assignment.created_at && (
                  <p className="text-xs text-muted-foreground">
                    Added: {formatManilaTime(assignment.created_at)}
                  </p>
                )}

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
                          ref={(el) => {
                            fileInputRefs.current[`mobile-${assignment.driver_user_id}`] = el;
                          }}
                          onChange={(e) =>
                            handleFileSelect(assignment.driver_user_id, e.target.files)
                          }
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() =>
                            fileInputRefs.current[`mobile-${assignment.driver_user_id}`]?.click()
                          }
                        >
                          <Upload className="h-3 w-3 mr-1" />
                          Upload
                        </Button>
                      </>
                    )}
                  </div>
                  
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
                    <p className="text-xs text-muted-foreground italic">No evidence uploaded</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Save Button */}
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
