import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
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
import { Search, Loader2, Save, SendHorizonal, Mail, Settings } from "lucide-react";
import { ROLE_DISPLAY_NAMES } from "@/types/database";
import type { UserRole } from "@/types/database";
import { TestEmailNotificationModal } from "./TestEmailNotificationModal";

interface EmailUser {
  id: string;
  full_name: string | null;
  email: string;
  email_opt_in: boolean;
  email_pref_updated_at: string | null;
  email_pref_updated_by: string | null;
  roles: UserRole[];
  updater_name?: string;
}

interface NotificationSettings {
  id: string;
  provider: string;
  email_enabled: boolean;
  from_name: string | null;
  from_email: string | null;
  reply_to: string | null;
  api_key_set: boolean;
  api_key_updated_at: string | null;
  api_key_updated_by: string | null;
  updated_at: string;
  updated_by: string | null;
}

export function EmailNotificationsTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<EmailUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [testModalOpen, setTestModalOpen] = useState(false);

  // Settings state
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [fromName, setFromName] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [emailEnabled, setEmailEnabled] = useState(true);

  const fetchSettings = useCallback(async () => {
    setSettingsLoading(true);
    const { data } = await supabase
      .from("notification_settings")
      .select("*")
      .limit(1)
      .single();

    if (data) {
      setSettings(data as any);
      setFromName(data.from_name || "");
      setFromEmail(data.from_email || "");
      setReplyTo(data.reply_to || "");
      setEmailEnabled(data.email_enabled);
    }
    setSettingsLoading(false);
  }, []);

  const fetchUsers = useCallback(async () => {
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("id, full_name, email, email_opt_in, email_pref_updated_at, email_pref_updated_by").order("full_name"),
      supabase.from("user_roles").select("*"),
    ]);

    const profilesList = profiles || [];
    const rolesList = (roles || []) as UserRole[];

    const mapped: EmailUser[] = profilesList.map((p: any) => {
      const updaterProfile = p.email_pref_updated_by
        ? profilesList.find((pp: any) => pp.id === p.email_pref_updated_by)
        : null;
      return {
        id: p.id,
        full_name: p.full_name,
        email: p.email,
        email_opt_in: p.email_opt_in ?? true,
        email_pref_updated_at: p.email_pref_updated_at,
        email_pref_updated_by: p.email_pref_updated_by,
        roles: rolesList.filter((r) => r.user_id === p.id),
        updater_name: (updaterProfile as any)?.full_name || undefined,
      };
    });

    setUsers(mapped);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSettings();
    fetchUsers();
  }, [fetchSettings, fetchUsers]);

  const handleSaveSettings = async () => {
    if (!user || !settings) return;
    setSavingSettings(true);

    const { error } = await supabase
      .from("notification_settings")
      .update({
        from_name: fromName.trim() || null,
        from_email: fromEmail.trim() || null,
        reply_to: replyTo.trim() || null,
        email_enabled: emailEnabled,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq("id", settings.id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Settings saved", description: "Email notification settings updated." });
      fetchSettings();
    }
    setSavingSettings(false);
  };

  const handleToggleEmailOptIn = async (u: EmailUser, checked: boolean) => {
    if (!user) return;

    const { error } = await supabase
      .from("profiles")
      .update({
        email_opt_in: checked,
        email_pref_updated_at: new Date().toISOString(),
        email_pref_updated_by: user.id,
      })
      .eq("id", u.id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      fetchUsers();
    }
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
      u.roles.some((r) => ROLE_DISPLAY_NAMES[r.role]?.toLowerCase().includes(q))
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
                <Badge key={r.id} variant="secondary" className="text-xs">
                  {ROLE_DISPLAY_NAMES[r.role]}
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
      render: (u) => (
        <div className="text-xs text-muted-foreground">
          {u.email_pref_updated_at ? (
            <>
              <p>{formatManilaTime(u.email_pref_updated_at)}</p>
              {u.updater_name && <p>by {u.updater_name}</p>}
            </>
          ) : (
            "-"
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Resend Settings Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings className="h-4 w-4" />
            Email Provider Settings
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
                  <p className="text-xs text-muted-foreground">Resend</p>
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
                    value={fromEmail}
                    onChange={(e) => setFromEmail(e.target.value)}
                    placeholder="noreply@yourdomain.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Reply-To (optional)</Label>
                  <Input
                    value={replyTo}
                    onChange={(e) => setReplyTo(e.target.value)}
                    placeholder="support@yourdomain.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Resend API Key</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      value="••••••••••••••••"
                      disabled
                      className="font-mono text-xs"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Managed via Supabase project secrets (RESEND_API_KEY)
                  </p>
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
