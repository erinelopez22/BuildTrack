import { useNavigate } from 'react-router-dom';
import { useNotifications } from '@/hooks/useNotifications';
import { truncateApi } from '@/lib/apiClient';
import { PageHeader } from '@/components/common/PageHeader';
import { TruncateButton } from '@/components/common/TruncateButton';
import { EmptyState } from '@/components/common/EmptyState';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Bell, Check, CheckCheck, Package, ClipboardList, AlertTriangle, Users, FolderOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatManilaTime } from '@/lib/notificationService';

const notificationIcons: Record<string, React.ElementType> = {
  order: ClipboardList,
  inventory: Package,
  low_stock: AlertTriangle,
  team: Users,
  project: FolderOpen,
  default: Bell,
};

export default function Notifications() {
  const navigate = useNavigate();
  const { notifications, loading, markAsRead, markAllAsRead, unreadCount } = useNotifications();

  const handleNotificationClick = (notification: typeof notifications[0]) => {
    // Mark as read if unread
    if (!notification.is_read) {
      markAsRead(notification.id);
    }

    // Navigate based on reference type
    if (notification.reference_type && notification.reference_id) {
      switch (notification.reference_type) {
        case 'order':
          // Navigate to Orders page - the modal will be handled there
          navigate('/orders');
          break;
        case 'project':
          navigate(`/projects/${notification.reference_id}`);
          break;
        default:
          // Just mark as read, no navigation
          break;
      }
    }
  };

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
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button variant="outline" onClick={markAllAsRead}>
                <CheckCheck className="mr-2 h-4 w-4" />
                Mark all as read
              </Button>
            )}
            <TruncateButton
              label="Notifications"
              description="This will permanently delete ALL notifications for all users."
              onTruncate={truncateApi.notifications}
              onSuccess={() => window.location.reload()}
            />
          </div>
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
              onClick={() => handleNotificationClick(notification)}
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
                    {formatManilaTime(notification.created_at)}
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
