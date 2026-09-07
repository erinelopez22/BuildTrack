// Notifications hook — REST polling (every 30s).
// Realtime/SignalR was removed for the Vercel serverless deployment.
import { useEffect, useState, useCallback } from 'react';
import { notificationsApi, type Notification } from '@/lib/apiClient';
import { useAuth } from '@/contexts/AuthContext';

const POLL_MS = 30_000;

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    const res = await notificationsApi.getAll();
    if (res.success && res.data) {
      setNotifications(res.data);
      setUnreadCount(res.data.filter((n) => !n.isRead).length);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetchNotifications();
    const interval = setInterval(fetchNotifications, POLL_MS);
    return () => clearInterval(interval);
  }, [user, fetchNotifications]);

  const markAsRead = async (notificationId: string) => {
    await notificationsApi.markRead(notificationId);
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  const markAllAsRead = async () => {
    if (!user) return;
    await notificationsApi.markAllRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
  };

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    refresh: fetchNotifications,
  };
}
