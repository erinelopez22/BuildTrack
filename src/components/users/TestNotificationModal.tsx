import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
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
import { Checkbox } from "@/components/ui/checkbox";
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
  Phone,
  Mail,
  CheckCircle2,
  XCircle,
  ChevronsUpDown,
  Check,
} from "lucide-react";
import { ROLE_DISPLAY_NAMES } from "@/types/database";
import type { UserRole } from "@/types/database";
import { cn } from "@/lib/utils";

interface TestNotificationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface UserOption {
  id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  sms_opt_in: boolean;
  roles: UserRole[];
}

interface SendResult {
  sms?: { status: "sent" | "failed"; error?: string };
  email?: { status: "sent" | "failed"; error?: string };
}

const E164_REGEX = /^\+[1-9]\d{7,14}$/;

export function TestNotificationModal({ open, onOpenChange }: TestNotificationModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();

  // Recipient mode
  const [recipientMode, setRecipientMode] = useState<"user" | "custom">("user");

  // User mode
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [userPickerOpen, setUserPickerOpen] = useState(false);

  // Custom mode
  const [customEmail, setCustomEmail] = useState("");
  const [customNumber, setCustomNumber] = useState("");
  const [customLabel, setCustomLabel] = useState("");

  // Channels
  const [sendSms, setSendSms] = useState(true);
  const [sendEmail, setSendEmail] = useState(false);

  // Message content
  const [title, setTitle] = useState("BuildTrack Test Notification");
  const [smsMessage, setSmsMessage] = useState(
    "[BuildTrack] Test SMS notification. Reply STOP to opt-out."
  );
  const [emailSubject, setEmailSubject] = useState("BuildTrack Test Email");
  const [emailBody, setEmailBody] = useState(
    "This is a test email notification from BuildTrack."
  );

  // State
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<SendResult | null>(null);

  // Validation errors
  const [numberError, setNumberError] = useState("");
  const [emailError, setEmailError] = useState("");

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
    setCustomNumber("");
    setCustomLabel("");
    setSendSms(true);
    setSendEmail(false);
    setTitle("BuildTrack Test Notification");
    setSmsMessage("[BuildTrack] Test SMS notification. Reply STOP to opt-out.");
    setEmailSubject("BuildTrack Test Email");
    setEmailBody("This is a test email notification from BuildTrack.");
    setResult(null);
    setNumberError("");
    setEmailError("");
  };

  const fetchUsers = async () => {
    setLoadingUsers(true);
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, email, phone, sms_opt_in")
        .order("full_name"),
      supabase.from("user_roles").select("*"),
    ]);
    const rolesList = (roles || []) as UserRole[];
    setUsers(
      (profiles || []).map((p) => ({
        id: p.id,
        full_name: p.full_name,
        email: p.email,
        phone: p.phone,
        sms_opt_in: p.sms_opt_in ?? false,
        roles: rolesList.filter((r) => r.user_id === p.id),
      }))
    );
    setLoadingUsers(false);
  };

  // Validation
  const validateCustomNumber = (v: string) => {
    if (!v.trim()) {
      setNumberError("");
      return true;
    }
    if (!E164_REGEX.test(v.trim())) {
      setNumberError("Must be E.164 format (e.g., +639171234567)");
      return false;
    }
    setNumberError("");
    return true;
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

  const getChannelErrors = (): string[] => {
    const errors: string[] = [];
    if (!sendSms && !sendEmail) {
      errors.push("At least one channel must be selected.");
      return errors;
    }
    if (recipientMode === "user" && selectedUser) {
      if (sendSms && (!selectedUser.phone || !selectedUser.sms_opt_in)) {
        errors.push(
          !selectedUser.phone
            ? "Selected user has no mobile number."
            : "Selected user has SMS disabled (opt-in off)."
        );
      }
      if (sendEmail && !selectedUser.email) {
        errors.push("Selected user has no email.");
      }
    }
    if (recipientMode === "custom") {
      if (sendSms && !customNumber.trim()) {
        errors.push("Mobile number is required for SMS channel.");
      } else if (sendSms && !E164_REGEX.test(customNumber.trim())) {
        errors.push("Mobile number must be valid E.164 format.");
      }
      if (sendEmail && !customEmail.trim()) {
        errors.push("Email is required for Email channel.");
      }
    }
    return errors;
  };

  const channelErrors = getChannelErrors();
  const canSend =
    (recipientMode === "user" ? !!selectedUserId : true) &&
    channelErrors.length === 0 &&
    !sending;

  const handleSend = async () => {
    if (!canSend) return;
    setSending(true);
    setResult(null);

    try {
      const payload: Record<string, unknown> =
        recipientMode === "user"
          ? {
              mode: "test",
              recipientMode: "user",
              toUserId: selectedUserId,
              channels: { sms: sendSms, email: sendEmail },
              title,
              smsMessage,
              emailSubject,
              emailHtml: emailBody,
            }
          : {
              mode: "test",
              recipientMode: "custom",
              to: {
                email: customEmail.trim() || undefined,
                number: customNumber.trim() || undefined,
                label: customLabel.trim() || undefined,
              },
              channels: { sms: sendSms, email: sendEmail },
              title,
              smsMessage,
              emailSubject,
              emailHtml: emailBody,
            };

      const { data, error } = await supabase.functions.invoke(
        "send-test-notification",
        { body: payload }
      );

      if (error) {
        toast({
          title: "Error",
          description: error.message || "Failed to send test notification.",
          variant: "destructive",
        });
        setResult({
          sms: sendSms ? { status: "failed", error: error.message } : undefined,
          email: sendEmail ? { status: "failed", error: error.message } : undefined,
        });
      } else {
        setResult(data?.results || {});
        toast({ title: "Test sent", description: "Check results below." });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Test Notification</DialogTitle>
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
                <SelectItem value="custom">Send to Custom Recipient</SelectItem>
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
                              <span className="text-sm">
                                {u.full_name || "Unknown"}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {u.email}
                              </span>
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
                    <span className="font-medium">
                      {selectedUser.full_name || "Unknown"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedUser.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className={selectedUser.phone ? "font-mono" : "text-muted-foreground"}>
                      {selectedUser.phone || "Not set"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">SMS Opt-in:</span>
                    <Badge variant={selectedUser.sms_opt_in ? "default" : "secondary"}>
                      {selectedUser.sms_opt_in ? "Enabled" : "Disabled"}
                    </Badge>
                  </div>
                  {selectedUser.roles.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {selectedUser.roles.map((r) => (
                        <Badge key={r.id} variant="outline" className="text-xs">
                          {ROLE_DISPLAY_NAMES[r.role]}
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
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Label (optional)</Label>
                <Input
                  value={customLabel}
                  onChange={(e) => setCustomLabel(e.target.value)}
                  placeholder='e.g., "Test Device"'
                />
              </div>
              <div className="space-y-1.5">
                <Label>Mobile Number (E.164)</Label>
                <Input
                  value={customNumber}
                  onChange={(e) => {
                    setCustomNumber(e.target.value);
                    validateCustomNumber(e.target.value);
                  }}
                  placeholder="+639171234567"
                />
                {numberError && (
                  <p className="text-xs text-destructive">{numberError}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
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
            </div>
          )}

          {/* Channels */}
          <div className="space-y-2">
            <Label>Channels</Label>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={sendSms}
                  onCheckedChange={(c) => setSendSms(!!c)}
                />
                <span className="text-sm">Send SMS</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={sendEmail}
                  onCheckedChange={(c) => setSendEmail(!!c)}
                />
                <span className="text-sm">Send Email</span>
              </label>
            </div>
            {channelErrors.length > 0 && (
              <div className="space-y-1">
                {channelErrors.map((e, i) => (
                  <p key={i} className="text-xs text-destructive">
                    {e}
                  </p>
                ))}
              </div>
            )}
          </div>

          {/* Message Content */}
          <div className="space-y-3">
            <Label className="text-base font-medium">Message Content</Label>
            <div className="space-y-1.5">
              <Label className="text-xs">Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            {sendSms && (
              <div className="space-y-1.5">
                <Label className="text-xs">SMS Message</Label>
                <Textarea
                  value={smsMessage}
                  onChange={(e) => setSmsMessage(e.target.value)}
                  rows={2}
                />
              </div>
            )}
            {sendEmail && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs">Email Subject</Label>
                  <Input
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Email Body</Label>
                  <Textarea
                    value={emailBody}
                    onChange={(e) => setEmailBody(e.target.value)}
                    rows={3}
                  />
                </div>
              </>
            )}
          </div>

          {/* Result Panel */}
          {result && (
            <div className="rounded-md border p-3 space-y-2 bg-muted/30">
              <p className="text-sm font-medium">Results</p>
              {result.sms && (
                <div className="flex items-center gap-2 text-sm">
                  {result.sms.status === "sent" ? (
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive" />
                  )}
                  <span>SMS: {result.sms.status === "sent" ? "Sent" : "Failed"}</span>
                  {result.sms.error && (
                    <span className="text-xs text-destructive">
                      — {result.sms.error}
                    </span>
                  )}
                </div>
              )}
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
            Send Test
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
