import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { DataTable, Column } from "@/components/common/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Search, Phone, Loader2, Save, Trash2, SendHorizonal } from "lucide-react";
import { ROLE_DISPLAY_NAMES } from "@/types/database";
import type { AppRole, UserRole } from "@/types/database";
import { TestNotificationModal } from "./TestNotificationModal";

interface SMSUser {
  id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  sms_opt_in: boolean;
  mobile_updated_at: string | null;
  mobile_updated_by: string | null;
  roles: UserRole[];
  updater_name?: string;
}

const E164_REGEX = /^\+[1-9]\d{7,14}$/;

export function SMSNotificationsTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<SMSUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editingUser, setEditingUser] = useState<SMSUser | null>(null);
  const [editPhone, setEditPhone] = useState("");
  const [editSmsOptIn, setEditSmsOptIn] = useState(false);
  const [phoneError, setPhoneError] = useState("");
  const [saving, setSaving] = useState(false);
  const [testModalOpen, setTestModalOpen] = useState(false);

  const fetchUsers = useCallback(async () => {
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("id, full_name, email, phone, sms_opt_in, mobile_updated_at, mobile_updated_by").order("full_name"),
      supabase.from("user_roles").select("*"),
    ]);

    const profilesList = profiles || [];
    const rolesList = (roles || []) as UserRole[];

    const mapped: SMSUser[] = profilesList.map((p) => {
      const updaterProfile = p.mobile_updated_by
        ? profilesList.find((pp) => pp.id === p.mobile_updated_by)
        : null;
      return {
        id: p.id,
        full_name: p.full_name,
        email: p.email,
        phone: p.phone,
        sms_opt_in: p.sms_opt_in ?? false,
        mobile_updated_at: p.mobile_updated_at,
        mobile_updated_by: p.mobile_updated_by,
        roles: rolesList.filter((r) => r.user_id === p.id),
        updater_name: updaterProfile?.full_name || undefined,
      };
    });

    setUsers(mapped);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const validatePhone = (value: string) => {
    if (!value.trim()) {
      setPhoneError("");
      return true;
    }
    if (!E164_REGEX.test(value.trim())) {
      setPhoneError("Must be E.164 format: +[countrycode][number] (e.g., +639171234567)");
      return false;
    }
    setPhoneError("");
    return true;
  };

  const handleEdit = (u: SMSUser) => {
    setEditingUser(u);
    setEditPhone(u.phone || "");
    setEditSmsOptIn(u.sms_opt_in);
    setPhoneError("");
  };

  const handleSave = async () => {
    if (!editingUser || !user) return;

    const trimmedPhone = editPhone.trim();
    if (trimmedPhone && !E164_REGEX.test(trimmedPhone)) {
      setPhoneError("Must be E.164 format: +[countrycode][number] (e.g., +639171234567)");
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        phone: trimmedPhone || null,
        sms_opt_in: trimmedPhone ? editSmsOptIn : false,
        mobile_updated_at: new Date().toISOString(),
        mobile_updated_by: user.id,
      })
      .eq("id", editingUser.id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Success", description: "SMS settings updated." });
      setEditingUser(null);
      fetchUsers();
    }
    setSaving(false);
  };

  const handleUnassign = async () => {
    if (!editingUser || !user) return;
    setSaving(true);

    const { error } = await supabase
      .from("profiles")
      .update({
        phone: null,
        sms_opt_in: false,
        mobile_updated_at: new Date().toISOString(),
        mobile_updated_by: user.id,
      })
      .eq("id", editingUser.id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Mobile number unassigned." });
      setEditingUser(null);
      fetchUsers();
    }
    setSaving(false);
  };

  const handleToggleSmsOptIn = async (u: SMSUser, checked: boolean) => {
    if (!user) return;
    if (!u.phone && checked) {
      toast({ title: "No phone number", description: "Add a mobile number before enabling SMS.", variant: "destructive" });
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        sms_opt_in: checked,
        mobile_updated_at: new Date().toISOString(),
        mobile_updated_by: user.id,
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
      u.phone?.includes(q) ||
      u.roles.some((r) => ROLE_DISPLAY_NAMES[r.role]?.toLowerCase().includes(q))
    );
  });

  const columns: Column<SMSUser>[] = [
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
      key: "phone",
      header: "Mobile Number",
      render: (u) => (
        <span className={u.phone ? "font-mono text-sm" : "text-muted-foreground text-sm"}>
          {u.phone || "Not set"}
        </span>
      ),
    },
    {
      key: "sms_opt_in",
      header: "SMS Enabled",
      render: (u) => (
        <Switch
          checked={u.sms_opt_in}
          onCheckedChange={(checked) => handleToggleSmsOptIn(u, checked)}
          disabled={!u.phone}
        />
      ),
      className: "w-28",
    },
    {
      key: "updated",
      header: "Last Updated",
      render: (u) => (
        <div className="text-xs text-muted-foreground">
          {u.mobile_updated_at ? (
            <>
              <p>{formatManilaTime(u.mobile_updated_at)}</p>
              {u.updater_name && <p>by {u.updater_name}</p>}
            </>
          ) : (
            "-"
          )}
        </div>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (u) => (
        <Button size="sm" variant="ghost" onClick={() => handleEdit(u)} title="Edit mobile number">
          <Phone className="h-4 w-4" />
        </Button>
      ),
      className: "w-16",
    },
  ];

  return (
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

      {/* Edit Mobile Dialog */}
      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit SMS Settings</DialogTitle>
          </DialogHeader>
          {editingUser && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium">{editingUser.full_name || "Unknown"}</p>
                <p className="text-xs text-muted-foreground">{editingUser.email}</p>
              </div>

              <div className="space-y-2">
                <Label>Mobile Number (E.164)</Label>
                <Input
                  value={editPhone}
                  onChange={(e) => {
                    setEditPhone(e.target.value);
                    validatePhone(e.target.value);
                  }}
                  placeholder="+639171234567"
                />
                {phoneError && <p className="text-xs text-destructive">{phoneError}</p>}
              </div>

              <div className="flex items-center justify-between">
                <Label>SMS Enabled</Label>
                <Switch
                  checked={editSmsOptIn}
                  onCheckedChange={setEditSmsOptIn}
                  disabled={!editPhone.trim()}
                />
              </div>

              <div className="flex justify-between pt-2">
                <Button variant="destructive" size="sm" onClick={handleUnassign} disabled={saving || !editingUser.phone}>
                  <Trash2 className="mr-1 h-3 w-3" /> Unassign
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setEditingUser(null)}>Cancel</Button>
                  <Button onClick={handleSave} disabled={saving || !!phoneError}>
                    {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
                    Save
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <TestNotificationModal open={testModalOpen} onOpenChange={setTestModalOpen} />
    </div>
  );
}
