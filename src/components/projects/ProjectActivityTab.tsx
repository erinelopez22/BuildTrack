import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Activity, Package, ClipboardList, Users, FolderOpen } from 'lucide-react';
import { formatManilaTime } from '@/lib/notificationService';
import { formatActivityDescription } from '@/lib/activityLogger';
import type { Profile } from '@/types/database';
import type { Json } from '@/integrations/supabase/types';

interface AuditLog {
  id: string;
  action: string;
  table_name: string;
  record_id: string;
  old_values: Json | null;
  new_values: Json | null;
  user_id: string | null;
  created_at: string;
}

interface ProjectActivityTabProps {
  projectId: string;
}

export function ProjectActivityTab({ projectId }: ProjectActivityTabProps) {
  const [activities, setActivities] = useState<(AuditLog & { user?: Profile })[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchActivities = async () => {
    // Fetch audit logs related to this project
    // We need to find logs where the record_id matches orders/inventory for this project
    // or where the record_id is the project itself
    
    // First, get orders for this project to find related logs
    const { data: orders } = await supabase
      .from('orders')
      .select('id')
      .eq('project_id', projectId);
    
    const orderIds = orders?.map(o => o.id) || [];

    // Get audit logs for project, orders, and project_members
    const { data: logsData, error } = await supabase
      .from('audit_logs')
      .select('*')
      .or(`record_id.eq.${projectId},record_id.in.(${orderIds.join(',')})`)
      .order('created_at', { ascending: false })
      .limit(50);

    if (logsData && logsData.length > 0) {
      // Fetch user profiles
      const userIds = [...new Set(logsData.map(l => l.user_id).filter(Boolean))];
      const { data: usersData } = await supabase
        .from('profiles')
        .select('*')
        .in('id', userIds);

      const logsWithUsers = logsData.map(log => ({
        ...log,
        user: (usersData || []).find(u => u.id === log.user_id) as Profile | undefined,
      }));
      setActivities(logsWithUsers);
    } else {
      setActivities([]);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchActivities();

    // Set up realtime subscription
    const channel = supabase
      .channel('project-activity')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'audit_logs',
        },
        () => {
          fetchActivities();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId]);

  const getActivityIcon = (tableName: string) => {
    switch (tableName) {
      case 'orders':
        return <ClipboardList className="h-4 w-4" />;
      case 'project_inventory':
      case 'inventory_transactions':
        return <Package className="h-4 w-4" />;
      case 'project_members':
        return <Users className="h-4 w-4" />;
      case 'projects':
        return <FolderOpen className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity Log</CardTitle>
      </CardHeader>
      <CardContent>
        {activities.length > 0 ? (
          <div className="space-y-4">
            {activities.map((activity) => (
              <div
                key={activity.id}
                className="flex items-start gap-4 rounded-lg border p-4"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/10 flex-shrink-0 text-accent-foreground">
                  {getActivityIcon(activity.table_name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium">
                    {formatActivityDescription(activity)}
                  </p>
                  {activity.new_values && typeof activity.new_values === 'object' && 'order_number' in activity.new_values && (
                    <p className="text-sm text-muted-foreground font-mono">
                      {String((activity.new_values as Record<string, unknown>).order_number)}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <span>
                      By {activity.user?.full_name || activity.user?.email || 'Unknown'}
                    </span>
                    <span>•</span>
                    <span>{formatManilaTime(activity.created_at)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="py-8 text-center text-muted-foreground">
            No activity recorded yet.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
