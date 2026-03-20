import { useState, useEffect } from "react";
import { usersApi } from "@/lib/apiClient";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Loader2,
  Send,
  User,
  Mail,
  CheckCircle2,
  XCircle,
  ChevronsUpDown,
  Check,
} from "lucide-react";
import { ROLE_DISPLAY_NAMES } from "@/types/database";
import type { AppRole } from "@/types/database";
import { cn } from "@/lib/utils";

interface TestEmailNotificationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface UserOption {
  id: string;
  full_name: string | null;
  email: string;
  roles: AppRole[];
}

interface SendResult {
  email?: { status: "sent" | "failed"; error?: string };
}

export function TestEmailNotificationModal({ open, onOpenChange }: TestEmailNotificationModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [recipientMode, setRecipientMode] = useState<"user" | "custom">("user");
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [userPickerOpen, setUserPickerOpen] = useState(false);

  const [customEmail, setCustomEmail] = useState("");
  const [emailError, setEmailError] = useState("");

  const [title, setTitle] = useState("BuildTrack Test Notification");
  const [emailSubject, setEmailSubject] = useState("BuildTrack Test Email");
  const [emailBody, setEmailBody] = useState(
    "This is a test email notification from BuildTrack."
  );

  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<SendResult | null>(null);

  const selectedUser = users.find((u) => u.id === selectedUserId);

  useEffect(() => {
    if (open) {
      fetchUsers();
      resetForm();
    }
  }, [open]);

  const resetForm = () => {
    setRecipientMode("user");
    setSelectedUserId("");
    setCustomEmail("");
    setTitle("BuildTrack Test Notification");
    setEmailSubject("BuildTrack Test Email");
    setEmailBody("This is a test email notification from BuildTrack.");
    setResult(null);
    setEmailError("");
  };

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const result = await usersApi.getAll();
      setUsers(
        (result.data ?? []).map((u) => ({
          id: u.id,
          full_name: u.fullName ?? null,
          email: u.email,
          roles: u.roles as AppRole[],
        }))
      );
    } catch {
      setUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  };

  const validateCustomEmail = (v: string) => {
    if (!v.trim()) {
      setEmailError("");
      return true;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())) {
      setEmailError("Invalid email format");
      return false;
    }
    setEmailError("");
    return true;
  };

  const getErrors = (): string[] => {
    const errors: string[] = [];
    if (recipientMode === "user" && !selectedUserId) {
      errors.push("Please select a user.");
    }
    if (recipientMode === "custom" && !customEmail.trim()) {
      errors.push("Email is required.");
    } else if (recipientMode === "custom" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customEmail.trim())) {
      errors.push("Invalid email format.");
    }
    return errors;
  };

  const errors = getErrors();
  const canSend = errors.length === 0 && !sending;

  const handleSend = async () => {
    if (!canSend) return;
    setSending(true);
    setResult(null);

    try {
      const payload: Record<string, unknown> = {
        mode: "test",
        recipientMode,
        ...(recipientMode === "user"
          ? { toUserId: selectedUserId }
          : { toEmail: customEmail.trim() }),
        subject: emailSubject,
        title,
        message: emailBody,
      };

      // Email sending via edge functions is not available in the REST API backend.
      toast({ title: "Not available", description: "Email test notifications require SMTP configuration on the backend.", variant: "destructive" });
      setResult({ email: { status: "failed", error: "Email sending not configured." } });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-[calc(100%-2rem)]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Test Email Notification
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Recipient Mode */}
          <div className="space-y-2">
            <Label>Recipient Mode</Label>
            <Select
              value={recipientMode}
              onValueChange={(v) => setRecipientMode(v as "user" | "custom")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">Send to Existing User</SelectItem>
                <SelectItem value="custom">Send to Custom Email</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* User mode */}
          {recipientMode === "user" && (
            <div className="space-y-3">
              <Label>Select User</Label>
              <Popover open={userPickerOpen} onOpenChange={setUserPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between font-normal"
                  >
                    {selectedUser
                      ? selectedUser.full_name || selectedUser.email
                      : "Search users..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search by name or email..." />
                    <CommandList>
                      <CommandEmpty>
                        {loadingUsers ? "Loading..." : "No users found."}
                      </CommandEmpty>
                      <CommandGroup>
                        {users.map((u) => (
                          <CommandItem
                            key={u.id}
                            value={`${u.full_name || ""} ${u.email}`}
                            onSelect={() => {
                              setSelectedUserId(u.id);
                              setUserPickerOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedUserId === u.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <div className="flex flex-col">
                              <span className="text-sm">{u.full_name || "Unknown"}</span>
                              <span className="text-xs text-muted-foreground">{u.email}</span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              {selectedUser && (
                <div className="rounded-md border p-3 space-y-1.5 bg-muted/50 text-sm">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{selectedUser.full_name || "Unknown"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedUser.email}</span>
                  </div>
                  {selectedUser.roles.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {selectedUser.roles.map((r) => (
                        <Badge key={r} variant="outline" className="text-xs">
                          {ROLE_DISPLAY_NAMES[r]}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Custom mode */}
          {recipientMode === "custom" && (
            <div className="space-y-1.5">
              <Label>Email Address</Label>
              <Input
                value={customEmail}
                onChange={(e) => {
                  setCustomEmail(e.target.value);
                  validateCustomEmail(e.target.value);
                }}
                placeholder="test@example.com"
              />
              {emailError && (
                <p className="text-xs text-destructive">{emailError}</p>
              )}
            </div>
          )}

          {/* Message Content */}
          <div className="space-y-3">
            <Label className="text-base font-medium">Message Content</Label>
            <div className="space-y-1.5">
              <Label className="text-xs">Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Email Subject</Label>
              <Input
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Email Body (HTML allowed)</Label>
              <Textarea
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          {/* Result Panel */}
          {result && (
            <div className="rounded-md border p-3 space-y-2 bg-muted/30">
              <p className="text-sm font-medium">Results</p>
              {result.email && (
                <div className="flex items-center gap-2 text-sm">
                  {result.email.status === "sent" ? (
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive" />
                  )}
                  <span>
                    Email: {result.email.status === "sent" ? "Sent" : "Failed"}
                  </span>
                  {result.email.error && (
                    <span className="text-xs text-destructive">
                      — {result.email.error}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={!canSend}>
            {sending ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-1 h-4 w-4" />
            )}
            Send Test Email
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
