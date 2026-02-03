import { useState, useEffect } from 'react';
import { request } from '@/integrations/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ClipboardList } from 'lucide-react';
import { formatManilaTime } from '@/lib/notificationService';

interface OrderActivity {
  id: string;
  orderNumber: string;
  status: string;
  createdAt: string;
  createdBy: string;
}

interface ProjectActivityTabProps {
  projectId: string;
}

export function ProjectActivityTab({ projectId }: ProjectActivityTabProps) {
  const [activities, setActivities] = useState<OrderActivity[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchActivities = async () => {
    try {
      const orders = await request<Array<{ id: string; orderNumber: string; status: string; createdAt: string; createdBy: string }>>(
        `/api/orders?projectId=${projectId}&limit=50`
      );
      setActivities(orders);
    } catch {
      setActivities([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();
  }, [projectId]);

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
        <CardTitle>Recent Orders</CardTitle>
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
                  <ClipboardList className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium">
                    Order {activity.orderNumber} – {activity.status.replace(/_/g, ' ')}
                  </p>
                  <p className="text-sm text-muted-foreground font-mono mt-0.5">{activity.orderNumber}</p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <span>{formatManilaTime(activity.createdAt)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="py-8 text-center text-muted-foreground">
            No orders for this project yet.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
