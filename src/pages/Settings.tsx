import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState } from '@/components/common/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Settings as SettingsIcon, Shield, MessageSquare, Loader2 } from 'lucide-react';
import type { SMSSettings, AppRole } from '@/types/database';

const roleLabels: Record<AppRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  project_manager: 'Project Manager',
  procurement: 'Procurement',
  storekeeper: 'Storekeeper',
  site_lead: 'Site Lead',
  viewer: 'Viewer',
};

const eventLabels: Record<string, string> = {
  order_status_change: 'Order Status Changes',
  low_stock: 'Low Stock Alerts',
  delivery_received: 'Delivery Received',
};

export default function Settings() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [settings, setSettings] = useState<SMSSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    twilio_account_sid: '',
    twilio_auth_token: '',
    twilio_sender_number: '',
    is_enabled: false,
    event_rules: {
      order_status_change: ['admin', 'project_manager', 'procurement'] as AppRole[],
      low_stock: ['admin', 'project_manager', 'storekeeper'] as AppRole[],
      delivery_received: ['admin', 'project_manager'] as AppRole[],
    },
  });

  const fetchSettings = async () => {
    const { data, error } = await supabase
      .from('sms_settings')
      .select('*')
      .limit(1)
      .single();

    if (data) {
      setSettings(data as SMSSettings);
      setFormData({
        twilio_account_sid: data.twilio_account_sid || '',
        twilio_auth_token: data.twilio_auth_token || '',
        twilio_sender_number: data.twilio_sender_number || '',
        is_enabled: data.is_enabled || false,
        event_rules: (data.event_rules as SMSSettings['event_rules']) || formData.event_rules,
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin()) {
      fetchSettings();
    } else {
      setLoading(false);
    }
  }, [isAdmin]);

  const handleSave = async () => {
    setSaving(true);

    const payload = {
      twilio_account_sid: formData.twilio_account_sid || null,
      twilio_auth_token: formData.twilio_auth_token || null,
      twilio_sender_number: formData.twilio_sender_number || null,
      is_enabled: formData.is_enabled,
      event_rules: formData.event_rules,
    };

    let error;
    if (settings) {
      const result = await supabase
        .from('sms_settings')
        .update(payload)
        .eq('id', settings.id);
      error = result.error;
    } else {
      const result = await supabase.from('sms_settings').insert(payload);
      error = result.error;
    }

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Settings saved successfully' });
      fetchSettings();
    }

    setSaving(false);
  };

  const toggleEventRole = (event: keyof typeof formData.event_rules, role: AppRole) => {
    setFormData((prev) => {
      const currentRoles = prev.event_rules[event];
      const newRoles = currentRoles.includes(role)
        ? currentRoles.filter((r) => r !== role)
        : [...currentRoles, role];

      return {
        ...prev,
        event_rules: {
          ...prev.event_rules,
          [event]: newRoles,
        },
      };
    });
  };

  if (!isAdmin()) {
    return (
      <div className="animate-fade-in">
        <PageHeader title="Settings" />
        <EmptyState
          icon={Shield}
          title="Access Denied"
          description="You don't have permission to view this page. Only administrators can manage settings."
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Settings"
        description="Configure system settings and integrations"
      />

      <Tabs defaultValue="sms" className="space-y-6">
        <TabsList>
          <TabsTrigger value="sms" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            SMS Notifications
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sms" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Twilio Configuration</CardTitle>
              <CardDescription>
                Configure your Twilio credentials for SMS notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable SMS Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Turn on to send SMS alerts for important events
                  </p>
                </div>
                <Switch
                  checked={formData.is_enabled}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, is_enabled: checked })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Twilio Account SID</Label>
                <Input
                  type="password"
                  value={formData.twilio_account_sid}
                  onChange={(e) =>
                    setFormData({ ...formData, twilio_account_sid: e.target.value })
                  }
                  placeholder="AC..."
                />
              </div>

              <div className="space-y-2">
                <Label>Twilio Auth Token</Label>
                <Input
                  type="password"
                  value={formData.twilio_auth_token}
                  onChange={(e) =>
                    setFormData({ ...formData, twilio_auth_token: e.target.value })
                  }
                  placeholder="••••••••"
                />
              </div>

              <div className="space-y-2">
                <Label>Sender Phone Number</Label>
                <Input
                  value={formData.twilio_sender_number}
                  onChange={(e) =>
                    setFormData({ ...formData, twilio_sender_number: e.target.value })
                  }
                  placeholder="+1234567890"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>SMS Event Rules</CardTitle>
              <CardDescription>
                Configure which roles receive SMS notifications for each event type
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {(Object.keys(eventLabels) as (keyof typeof eventLabels)[]).map((event) => (
                  <div key={event} className="space-y-3">
                    <Label className="text-base">{eventLabels[event]}</Label>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                      {(Object.keys(roleLabels) as AppRole[]).map((role) => (
                        <div key={role} className="flex items-center space-x-2">
                          <Checkbox
                            id={`${event}-${role}`}
                            checked={formData.event_rules[event as keyof typeof formData.event_rules]?.includes(role)}
                            onCheckedChange={() =>
                              toggleEventRole(event as keyof typeof formData.event_rules, role)
                            }
                          />
                          <Label
                            htmlFor={`${event}-${role}`}
                            className="text-sm font-normal"
                          >
                            {roleLabels[role]}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Settings'
              )}
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}