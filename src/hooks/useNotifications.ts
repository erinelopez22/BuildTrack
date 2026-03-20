// Notifications hook - replaced Supabase realtime with REST polling + optional SignalR
// SignalR requires: npm install @microsoft/signalr
import { useEffect, useState, useCallback, useRef } from 'react';
import { notificationsApi, tokenStore, type Notification } from '@/lib/apiClient';
import { useAuth } from '@/contexts/AuthContext';

const SIGNALR_URL = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5069'}/hubs/notifications`;

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const connectionRef = useRef<unknown>(null);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    const res = await notificationsApi.getAll();
    if (res.success && res.data) {
      setNotifications(res.data);
      setUnreadCount(res.data.filter((n) => !n.isRead).length);
    }
    setLoading(false);
  }, [user]);

  // Set up SignalR for real-time notifications
  useEffect(() => {
    if (!user) return;

    fetchNotifications();

    let connection: {
      start: () => Promise<void>;
      on: (event: string, cb: (n: Notification) => void) => void;
      stop: () => Promise<void>;
    } | null = null;

    // Dynamically import SignalR to avoid breaking if not installed
    import('@microsoft/signalr')
      .then(({ HubConnectionBuilder, LogLevel }) => {
        const token = tokenStore.getAccess();
        connection = new HubConnectionBuilder()
          .withUrl(SIGNALR_URL, token ? { accessTokenFactory: () => token } : {})
          .withAutomaticReconnect()
          .configureLogging(LogLevel.Warning)
          .build();

        connection.on('NewNotification', (notification: Notification) => {
          setNotifications((prev) => [notification, ...prev]);
          setUnreadCount((prev) => prev + 1);
        });

        connection.start().catch((err) =>
          console.warn('SignalR connection failed (polling fallback):', err)
        );

        connectionRef.current = connection;
      })
      .catch(() => {
        // SignalR not installed - use polling fallback every 30s
        const interval = setInterval(fetchNotifications, 30_000);
        connectionRef.current = { stop: async () => clearInterval(interval) };
      });

    return () => {
      if (connectionRef.current) {
        (connectionRef.current as { stop: () => Promise<void> }).stop().catch(() => {});
        connectionRef.current = null;
      }
    };
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
