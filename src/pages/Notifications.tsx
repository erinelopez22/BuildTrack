import { useNotifications } from '@/hooks/useNotifications';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState } from '@/components/common/EmptyState';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Bell, Check, CheckCheck, Package, ClipboardList, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const notificationIcons: Record<string, React.ElementType> = {
  order: ClipboardList,
  inventory: Package,
  low_stock: AlertTriangle,
  default: Bell,
};

export default function Notifications() {
  const { notifications, loading, markAsRead, markAllAsRead, unreadCount } = useNotifications();

  if (!loading && notifications.length === 0) {
    return (
      <div className="animate-fade-in">
        <PageHeader title="Notifications" description="Stay updated on important events" />
        <EmptyState
          icon={Bell}
          title="No notifications"
          description="You're all caught up! Notifications will appear here when there are updates."
        />
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Notifications"
        description="Stay updated on important events"
        action={
          unreadCount > 0 && (
            <Button variant="outline" onClick={markAllAsRead}>
              <CheckCheck className="mr-2 h-4 w-4" />
              Mark all as read
            </Button>
          )
        }
      />

      <div className="space-y-3">
        {notifications.map((notification) => {
          const Icon = notificationIcons[notification.type] || notificationIcons.default;

          return (
            <Card
              key={notification.id}
              className={cn(
                'cursor-pointer transition-colors hover:bg-muted/50',
                !notification.is_read && 'border-l-4 border-l-accent bg-accent/5'
              )}
              onClick={() => !notification.is_read && markAsRead(notification.id)}
            >
              <CardContent className="flex items-start gap-4 p-4">
                <div
                  className={cn(
                    'rounded-full p-2',
                    notification.is_read
                      ? 'bg-muted text-muted-foreground'
                      : 'bg-accent/10 text-accent'
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 space-y-1">
                  <p className={cn('font-medium', !notification.is_read && 'text-foreground')}>
                    {notification.title}
                  </p>
                  <p className="text-sm text-muted-foreground">{notification.message}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(notification.created_at), 'MMM d, yyyy h:mm a')}
                  </p>
                </div>
                {!notification.is_read && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      markAsRead(notification.id);
                    }}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}