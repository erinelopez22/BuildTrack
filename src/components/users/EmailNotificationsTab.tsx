import { useState, useEffect, useCallback } from "react";
import { usersApi } from "@/lib/apiClient";
import type { User } from "@/lib/apiClient";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { DataTable, Column } from "@/components/common/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Search, Loader2, Save, SendHorizonal, Settings, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { ROLE_DISPLAY_NAMES } from "@/types/database";
import type { AppRole } from "@/types/database";
import { TestEmailNotificationModal } from "./TestEmailNotificationModal";

interface EmailUser {
  id: string;
  full_name: string | null;
  email: string;
  email_opt_in: boolean;
  roles: string[];
}

export function EmailNotificationsTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<EmailUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [testModalOpen, setTestModalOpen] = useState(false);

  // Settings state — SMTP is server-side only; these fields are display/reference only
  const [settingsLoading] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [smtpHost, setSmtpHost] = useState("smtp.gmail.com");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fromName, setFromName] = useState("BuildTrack");
  const [replyTo, setReplyTo] = useState("");
  const [hasExistingPassword] = useState(false);

  const fetchUsers = useCallback(async () => {
    const res = await usersApi.getAll();
    if (!res.success || !res.data) {
      toast({ title: "Error", description: res.message || "Failed to load users", variant: "destructive" });
      setLoading(false);
      return;
    }

    const mapped: EmailUser[] = res.data.map((u: User) => ({
      id: u.id,
      full_name: u.fullName || null,
      email: u.email,
      // The REST API User does not expose email_opt_in; default to true (opted in)
      email_opt_in: true,
      roles: u.roles,
    }));

    setUsers(mapped);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // SMTP settings are server-side; notify user and no-op
  const handleSaveSettings = async () => {
    setSavingSettings(true);
    toast({
      title: "Info",
      description: "SMTP settings are configured via server environment variables and cannot be changed here.",
    });
    setSavingSettings(false);
  };

  const handleToggleEmailOptIn = async (u: EmailUser, checked: boolean) => {
    // The REST API does not expose an email_opt_in field on users.
    // Optimistically update local state only.
    setUsers((prev) =>
      prev.map((existing) =>
        existing.id === u.id ? { ...existing, email_opt_in: checked } : existing
      )
    );
  };

  const formatManilaTime = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString("en-PH", {
        timeZone: "Asia/Manila",
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).replace(",", " –");
    } catch {
      return dateStr;
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = search.toLowerCase();
    return (
      !q ||
      u.full_name?.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.roles.some((r) => ROLE_DISPLAY_NAMES[r as AppRole]?.toLowerCase().includes(q))
    );
  });

  const columns: Column<EmailUser>[] = [
    {
      key: "name",
      header: "Name",
      render: (u) => (
        <div>
          <p className="font-medium">{u.full_name || "Unknown"}</p>
          <p className="text-xs text-muted-foreground">{u.email}</p>
        </div>
      ),
    },
    {
      key: "roles",
      header: "Role(s)",
      render: (u) => (
        <div className="flex flex-wrap gap-1">
          {u.roles.length > 0
            ? u.roles.map((r) => (
                <Badge key={r} variant="secondary" className="text-xs">
                  {ROLE_DISPLAY_NAMES[r as AppRole] ?? r}
                </Badge>
              ))
            : <span className="text-muted-foreground text-xs">No roles</span>}
        </div>
      ),
    },
    {
      key: "email_opt_in",
      header: "Email Notifications",
      render: (u) => (
        <Switch
          checked={u.email_opt_in}
          onCheckedChange={(checked) => handleToggleEmailOptIn(u, checked)}
        />
      ),
      className: "w-36",
    },
    {
      key: "updated",
      header: "Last Updated",
      render: () => (
        <div className="text-xs text-muted-foreground">-</div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Gmail SMTP Settings Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings className="h-4 w-4" />
            Gmail SMTP Configuration
          </CardTitle>
        </CardHeader>
        <CardContent>
          {settingsLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Provider</p>
                  <p className="text-xs text-muted-foreground">Gmail SMTP (STARTTLS)</p>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="email-enabled" className="text-sm">Enable Email Notifications</Label>
                  <Switch
                    id="email-enabled"
                    checked={emailEnabled}
                    onCheckedChange={setEmailEnabled}
                  />
                </div>
              </div>

              <Separator />

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">SMTP Host</Label>
                  <Input
                    value={smtpHost}
                    onChange={(e) => setSmtpHost(e.target.value)}
                    placeholder="smtp.gmail.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">SMTP Port</Label>
                  <Input
                    value={smtpPort}
                    onChange={(e) => setSmtpPort(e.target.value)}
                    placeholder="587"
                    type="number"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">SMTP Username (Gmail)</Label>
                  <Input
                    value={smtpUser}
                    onChange={(e) => setSmtpUser(e.target.value)}
                    placeholder="yourapp@gmail.com"
                    type="email"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">SMTP App Password</Label>
                  <div className="relative">
                    <Input
                      value={smtpPass}
                      onChange={(e) => setSmtpPass(e.target.value)}
                      placeholder={hasExistingPassword ? "••••••••••••••••" : "Enter Gmail App Password"}
                      type={showPassword ? "text" : "password"}
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  {hasExistingPassword && !smtpPass && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3 text-primary" />
                      Password configured. Leave blank to keep current.
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Use a Gmail App Password, not your regular password.
                  </p>
                </div>
              </div>

              <Separator />

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">From Name</Label>
                  <Input
                    value={fromName}
                    onChange={(e) => setFromName(e.target.value)}
                    placeholder="BuildTrack"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">From Email</Label>
                  <Input
                    value={smtpUser || ""}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">Auto-set to SMTP username to prevent spoofing.</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Reply-To (optional)</Label>
                  <Input
                    value={replyTo}
                    onChange={(e) => setReplyTo(e.target.value)}
                    placeholder="support@yourcompany.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Security</Label>
                  <Input value="TLS (STARTTLS)" disabled className="bg-muted" />
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSaveSettings} disabled={savingSettings} size="sm">
                  {savingSettings ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
                  Save Settings
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Per-User Email Preferences */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search users..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Button onClick={() => setTestModalOpen(true)} size="sm">
            <SendHorizonal className="mr-1 h-4 w-4" />
            Test Notification
          </Button>
        </div>

        <DataTable columns={columns} data={filteredUsers} loading={loading} emptyMessage="No users found" />
      </div>

      <TestEmailNotificationModal open={testModalOpen} onOpenChange={setTestModalOpen} />
    </div>
  );
}
