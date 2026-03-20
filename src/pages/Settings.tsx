import { useState } from 'react';
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
import { Shield, MessageSquare } from 'lucide-react';
import type { AppRole } from '@/types/database';

import { ROLE_DISPLAY_NAMES } from '@/types/database';

const roleLabels = ROLE_DISPLAY_NAMES;

const eventLabels: Record<string, string> = {
  order_status_change: 'Order Status Changes',
  low_stock: 'Low Stock Alerts',
  delivery_received: 'Delivery Received',
};

export default function Settings() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
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

  // SMS settings are configured server-side via environment variables.
  // This form is display-only and changes here have no backend effect.
  const handleSave = () => {
    toast({
      title: 'Info',
      description: 'SMS settings are configured via server environment variables and cannot be changed here.',
    });
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
                Twilio credentials are configured via server environment variables. The fields below are for reference only.
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
                  disabled
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
                  placeholder="Configured via environment variable"
                  disabled
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
                  placeholder="Configured via environment variable"
                  disabled
                />
              </div>

              <div className="space-y-2">
                <Label>Sender Phone Number</Label>
                <Input
                  value={formData.twilio_sender_number}
                  onChange={(e) =>
                    setFormData({ ...formData, twilio_sender_number: e.target.value })
                  }
                  placeholder="Configured via environment variable"
                  disabled
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
            <Button onClick={handleSave}>
              Save Settings
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
